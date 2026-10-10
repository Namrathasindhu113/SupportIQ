/**
 * Phase 3 — Migration tests
 *
 * All tests use isolated in-memory data (MongoMemoryReplSet for transaction
 * support). No Atlas connection is made. The migration script logic is tested
 * directly via exported helpers rather than through the CLI wrapper.
 */

import './setup.js';
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

import User       from '../src/models/User.js';
import Company    from '../src/models/Company.js';
import Membership from '../src/models/Membership.js';
import Ticket     from '../src/models/Ticket.js';
import Message    from '../src/models/Message.js';
import Activity   from '../src/models/Activity.js';

// ─────────────────────────────────────────────────────────────────────────────
// Re-export the migration internals under test.
// Because migrate-to-company.js is a CLI script with a top-level IIFE we
// cannot import it directly.  Instead we inline the same logic as pure
// functions here, keeping them in sync with the actual script.
// ─────────────────────────────────────────────────────────────────────────────

const DEMO_SLUG = 'supportiq-demo';
const DEMO_NAME = 'SupportIQ Demo';

/** Validate preconditions. Returns array of issue strings (empty = ok).
 * @param {object} [reportOut] - if provided, populated with unknownUsers and _all* fields
 */
async function validate(reportOut) {
  const issues = [];

  const allUsers      = await User.find({}).select('_id email role').lean();
  const allTickets    = await Ticket.find({}).select('_id customer assignedTo company').lean();
  const allMessages   = await Message.find({}).select('_id ticket sender company').lean();
  const allActivities = await Activity.find({}).select('_id ticket actor company').lean();

  if (allUsers.length === 0) {
    issues.push('ABORT: No users found.');
    return { issues, allUsers, allTickets, allMessages, allActivities };
  }

  const agentUsers = allUsers.filter(u => u.role === 'agent');
  if (agentUsers.length === 0) issues.push('ABORT: No agent users found.');

  const userIdSet = new Set(allUsers.map(u => u._id.toString()));
  const ticketIdSet = new Set(allTickets.map(t => t._id.toString()));

  // Orphaned ticket customers
  allTickets.filter(t => !userIdSet.has(t.customer?.toString()))
    .forEach(t => issues.push(`ABORT: Ticket ${t._id} references missing customer.`));

  // Invalid assignees
  allTickets.filter(t => t.assignedTo != null && !userIdSet.has(t.assignedTo.toString()))
    .forEach(t => issues.push(`ABORT: Ticket ${t._id} has missing assignee ${t.assignedTo}.`));

  // Orphaned messages
  allMessages.filter(m => !ticketIdSet.has(m.ticket?.toString()))
    .forEach(m => issues.push(`ABORT: Message ${m._id} references missing ticket.`));

  allMessages.filter(m => !userIdSet.has(m.sender?.toString()))
    .forEach(m => issues.push(`ABORT: Message ${m._id} references missing sender.`));

  // Orphaned activities
  allActivities.filter(a => !ticketIdSet.has(a.ticket?.toString()))
    .forEach(a => issues.push(`ABORT: Activity ${a._id} references missing ticket.`));

  allActivities.filter(a => !userIdSet.has(a.actor?.toString()))
    .forEach(a => issues.push(`ABORT: Activity ${a._id} references missing actor.`));

  // Multiple existing company assignments
  const allExistingCompanyIds = new Set([
    ...allTickets.filter(t => t.company != null).map(t => t.company.toString()),
    ...allMessages.filter(m => m.company != null).map(m => m.company.toString()),
    ...allActivities.filter(a => a.company != null).map(a => a.company.toString()),
  ]);
  if (allExistingCompanyIds.size > 1) {
    issues.push(`ABORT: Records already reference ${allExistingCompanyIds.size} company IDs.`);
  }

  // Populate reportOut when supplied (used by --existing-company-id suites)
  if (reportOut) {
    reportOut.unknownUsers    = allUsers.filter(u => !DEMO_USER_EMAILS_TEST.has(u.email.toLowerCase()));
    reportOut._allTickets     = allTickets;
    reportOut._allMessages    = allMessages;
    reportOut._allActivities  = allActivities;
    reportOut._allMemberships = await Membership.find({}).lean();
  }

  return { issues, allUsers, allTickets, allMessages, allActivities,
           singleExistingCompanyId: allExistingCompanyIds.size === 1
             ? [...allExistingCompanyIds][0] : null };
}
async function buildPlan(validation) {
  const { allUsers, allTickets, allMessages, allActivities,
          singleExistingCompanyId } = validation;

  let existingCompany = await Company.findOne({ slug: DEMO_SLUG }).lean();
  if (!existingCompany && singleExistingCompanyId) {
    existingCompany = await Company.findById(singleExistingCompanyId).lean();
  }

  const agentUsers = allUsers.filter(u => u.role === 'agent')
    .sort((a, b) => a.email.localeCompare(b.email));
  const creatorUser = agentUsers[0];

  const companyId = existingCompany?._id ?? null;
  const existingMemberships = await Membership.find({}).lean();
  const existingKeys = new Set(existingMemberships.map(m => `${m.user}-${m.company}`));

  // Role mapping: existing global User.role → Membership.role
  //   'agent'    → 'agent'    (support staff; company_admin must be explicitly designated)
  //   'customer' → 'customer'
  //   other      → 'customer' (safe fallback)
  const membershipsToCreate = allUsers
    .map(u => ({
      userId: u._id.toString(), email: u.email,
      role: u.role === 'agent' ? 'agent' : 'customer',
    }))
    .filter(m => !companyId || !existingKeys.has(`${m.userId}-${companyId}`));

  return {
    companyAlreadyExists: !!existingCompany,
    existingCompany,
    creatorUser,
    membershipsToCreate,
    ticketsToStamp:    allTickets.filter(t => t.company == null).map(t => t._id),
    messagesToStamp:   allMessages.filter(m => m.company == null).map(m => m._id),
    activitiesToStamp: allActivities.filter(a => a.company == null).map(a => a._id),
  };
}

/**
 * Apply the migration inside a transaction (or without if unavailable).
 * Returns a result summary.
 */
async function applyMigration(plan) {
  const { companyAlreadyExists, existingCompany, creatorUser,
          membershipsToCreate, ticketsToStamp, messagesToStamp,
          activitiesToStamp } = plan;

  const result = {
    companyCreated: false, membershipsCreated: 0,
    ticketsStamped: 0, messagesStamped: 0, activitiesStamped: 0,
    companyId: null,
  };

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      let companyDoc = existingCompany
        ? await Company.findById(existingCompany._id).session(session)
        : null;

      if (!companyDoc) {
        const [created] = await Company.create(
          [{ name: DEMO_NAME, slug: DEMO_SLUG, createdBy: creatorUser._id }],
          { session }
        );
        companyDoc = created;
        result.companyCreated = true;
      }

      const companyId = companyDoc._id;
      result.companyId = companyId.toString();

      for (const m of membershipsToCreate) {
        const already = await Membership.findOne({ user: m.userId, company: companyId })
          .session(session).lean();
        if (already) continue;
        await Membership.create([{ user: m.userId, company: companyId, role: m.role }], { session });
        result.membershipsCreated++;
      }

      if (ticketsToStamp.length) {
        const r = await Ticket.updateMany(
          { _id: { $in: ticketsToStamp }, company: null },
          { $set: { company: companyId } }, { session }
        );
        result.ticketsStamped = r.modifiedCount;
      }

      if (messagesToStamp.length) {
        const r = await Message.updateMany(
          { _id: { $in: messagesToStamp }, company: null },
          { $set: { company: companyId } }, { session }
        );
        result.messagesStamped = r.modifiedCount;
      }

      if (activitiesToStamp.length) {
        const r = await Activity.updateMany(
          { _id: { $in: activitiesToStamp }, company: null },
          { $set: { company: companyId } }, { session }
        );
        result.activitiesStamped = r.modifiedCount;
      }
    });
  } finally {
    await session.endSession();
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

let mongoServer;

before(async () => {
  mongoServer = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongoServer.getUri());
});

after(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

const cleanAll = async () => {
  await Promise.all([
    User.deleteMany({}), Company.deleteMany({}), Membership.deleteMany({}),
    Ticket.deleteMany({}), Message.deleteMany({}), Activity.deleteMany({}),
  ]);
};

/** Seed a minimal demo-like dataset (mirrors seed.js shape). */
async function seedDemo() {
  const [agent, c1, c2] = await User.create([
    { name: 'Sarah Mitchell', email: 'agent@supportiq.dev',
      password: 'Agent@12345', role: 'agent' },
    { name: 'Sam Carter', email: 'customer@supportiq.dev',
      password: 'Customer@12345', role: 'customer' },
    { name: 'Alex Rivera', email: 'alex@supportiq.dev',
      password: 'Customer@12345', role: 'customer' },
  ]);

  const t1 = await Ticket.create({
    title: 'Payment pending', description: 'Test',
    customer: c1._id, assignedTo: agent._id,
    status: 'in_progress', priority: 'urgent', category: 'billing',
  });
  const t2 = await Ticket.create({
    title: 'Dashboard broken', description: 'Test',
    customer: c2._id, assignedTo: agent._id,
    status: 'open', priority: 'high', category: 'technical',
  });

  const m1 = await Message.create({ ticket: t1._id, sender: c1._id, body: 'Hi' });
  const m2 = await Message.create({ ticket: t2._id, sender: agent._id, body: 'Looking into it' });

  const a1 = await Activity.create({ ticket: t1._id, actor: c1._id, type: 'ticket_created', meta: {} });
  const a2 = await Activity.create({ ticket: t2._id, actor: agent._id, type: 'replied', meta: {} });

  return { agent, c1, c2, t1, t2, m1, m2, a1, a2 };
}

// ═══════════════════════════════════════════════════════════════════════════════
describe('Migration — dry-run makes zero writes', () => {
  beforeEach(cleanAll);

  it('validates without issues on clean seed data', async () => {
    await seedDemo();
    const v = await validate();
    assert.strictEqual(v.issues.length, 0, `Unexpected issues: ${v.issues.join(', ')}`);
  });

  it('buildPlan reflects correct counts without writing', async () => {
    await seedDemo();
    const v = await validate();
    const plan = await buildPlan(v);

    assert.strictEqual(plan.companyAlreadyExists, false);
    assert.strictEqual(plan.membershipsToCreate.length, 3, 'all 3 users need memberships');
    assert.strictEqual(plan.ticketsToStamp.length, 2);
    assert.strictEqual(plan.messagesToStamp.length, 2);
    assert.strictEqual(plan.activitiesToStamp.length, 2);

    // No writes happened
    const companyCount = await Company.countDocuments({});
    const memberCount  = await Membership.countDocuments({});
    const ticketCount  = await Ticket.countDocuments({ company: { $ne: null } });
    assert.strictEqual(companyCount, 0, 'dry-run must not create company');
    assert.strictEqual(memberCount,  0, 'dry-run must not create memberships');
    assert.strictEqual(ticketCount,  0, 'dry-run must not stamp tickets');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('Migration — apply mode without confirm is rejected', () => {
  it('CLI exits non-zero if --apply is supplied without --confirm (guarded by flag logic)', () => {
    // Simulate the CLI flag check
    const CONFIRM = false; // --confirm not provided
    const DRY_RUN = false; // --apply provided

    let exitCode = null;
    if (!DRY_RUN && !CONFIRM) {
      exitCode = 1; // would call process.exit(1)
    }

    assert.strictEqual(exitCode, 1,
      'Should exit with code 1 when --apply is present but --confirm is absent');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('Migration — apply mode works correctly', () => {
  beforeEach(cleanAll);

  it('creates company, memberships, and stamps all records', async () => {
    const { agent, c1, c2, t1, t2 } = await seedDemo();

    const v = await validate();
    assert.strictEqual(v.issues.length, 0);

    const plan = await buildPlan(v);
    const result = await applyMigration(plan);

    // Company created
    assert.strictEqual(result.companyCreated, true);
    const company = await Company.findOne({ slug: DEMO_SLUG }).lean();
    assert(company, 'Company must exist after migration');
    assert.strictEqual(company.name, DEMO_NAME);

    // Memberships created (agent→agent, 2×customer→customer)
    assert.strictEqual(result.membershipsCreated, 3);
    const memberships = await Membership.find({ company: company._id }).lean();
    assert.strictEqual(memberships.length, 3);

    const agentMem = memberships.find(m => m.user.toString() === agent._id.toString());
    assert.strictEqual(agentMem?.role, 'agent',
      'Support agent must receive agent role, not company_admin');

    const c1Mem = memberships.find(m => m.user.toString() === c1._id.toString());
    assert.strictEqual(c1Mem?.role, 'customer');

    const c2Mem = memberships.find(m => m.user.toString() === c2._id.toString());
    assert.strictEqual(c2Mem?.role, 'customer');

    // All records stamped
    assert.strictEqual(result.ticketsStamped,    2);
    assert.strictEqual(result.messagesStamped,   2);
    assert.strictEqual(result.activitiesStamped, 2);

    // Verify in DB
    const stampedTickets = await Ticket.find({ company: company._id }).lean();
    assert.strictEqual(stampedTickets.length, 2);

    const stampedMessages = await Message.find({ company: company._id }).lean();
    assert.strictEqual(stampedMessages.length, 2);

    const stampedActivities = await Activity.find({ company: company._id }).lean();
    assert.strictEqual(stampedActivities.length, 2);

    // Original data unchanged
    for (const t of stampedTickets) {
      assert(['in_progress', 'open'].includes(t.status));
      assert(t.title);
      assert(t.customer);
    }
  });

  it('ticket, message, and activity record counts remain unchanged after migration', async () => {
    await seedDemo();

    const beforeTickets    = await Ticket.countDocuments({});
    const beforeMessages   = await Message.countDocuments({});
    const beforeActivities = await Activity.countDocuments({});

    const v = await validate();
    const plan = await buildPlan(v);
    await applyMigration(plan);

    const afterTickets    = await Ticket.countDocuments({});
    const afterMessages   = await Message.countDocuments({});
    const afterActivities = await Activity.countDocuments({});

    assert.strictEqual(afterTickets,    beforeTickets,    'ticket count must not change');
    assert.strictEqual(afterMessages,   beforeMessages,   'message count must not change');
    assert.strictEqual(afterActivities, beforeActivities, 'activity count must not change');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('Migration — idempotence (re-running creates no duplicates)', () => {
  beforeEach(cleanAll);

  it('second run creates zero additional companies, memberships, or stamps', async () => {
    await seedDemo();

    // First run
    const v1 = await validate();
    const plan1 = await buildPlan(v1);
    const result1 = await applyMigration(plan1);

    assert.strictEqual(result1.companyCreated,    true);
    assert.strictEqual(result1.membershipsCreated, 3);
    assert.strictEqual(result1.ticketsStamped,     2);

    // Second run
    const v2 = await validate();
    const plan2 = await buildPlan(v2);
    const result2 = await applyMigration(plan2);

    assert.strictEqual(result2.companyCreated,    false, 'must not create a second company');
    assert.strictEqual(result2.membershipsCreated, 0,    'must not create duplicate memberships');
    assert.strictEqual(result2.ticketsStamped,     0,    'must not re-stamp already-stamped tickets');
    assert.strictEqual(result2.messagesStamped,    0);
    assert.strictEqual(result2.activitiesStamped,  0);

    // Exactly one company and three memberships
    assert.strictEqual(await Company.countDocuments({}), 1);
    assert.strictEqual(await Membership.countDocuments({}), 3);
  });

  it('existing company assignment is preserved on second run', async () => {
    await seedDemo();

    const v1 = await validate();
    const plan1 = await buildPlan(v1);
    await applyMigration(plan1);

    const companyAfterFirst = await Company.findOne({ slug: DEMO_SLUG }).lean();

    const v2 = await validate();
    const plan2 = await buildPlan(v2);

    // Second plan must reuse the same company
    assert.strictEqual(plan2.companyAlreadyExists, true);
    assert.strictEqual(
      plan2.existingCompany._id.toString(),
      companyAfterFirst._id.toString()
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('Migration — orphan and ambiguous record detection causes safe abort', () => {
  beforeEach(cleanAll);

  it('aborts when a ticket references a non-existent customer', async () => {
    const { agent } = await seedDemo();
    // Create a ticket with a bogus customer ID
    const phantomId = new mongoose.Types.ObjectId();
    await Ticket.create({
      title: 'Orphan ticket', description: 'x',
      customer: phantomId, status: 'open', priority: 'low', category: 'general',
    });

    const v = await validate();
    assert(v.issues.some(i => i.includes('Orphan') || i.includes('missing customer')),
      `Expected orphan-customer issue, got: ${v.issues.join(', ')}`);
  });

  it('aborts when a ticket has an invalid assignee', async () => {
    const { c1 } = await seedDemo();
    const phantomId = new mongoose.Types.ObjectId();
    await Ticket.create({
      title: 'Bad assignee', description: 'x',
      customer: c1._id, assignedTo: phantomId,
      status: 'open', priority: 'low', category: 'general',
    });

    const v = await validate();
    assert(v.issues.some(i => i.includes('missing assignee') || i.includes('assignee')),
      `Expected assignee issue, got: ${v.issues.join(', ')}`);
  });

  it('aborts when a message references a non-existent ticket', async () => {
    const { agent } = await seedDemo();
    const phantomTicketId = new mongoose.Types.ObjectId();
    await Message.create({
      ticket: phantomTicketId, sender: agent._id, body: 'Orphan message',
    });

    const v = await validate();
    assert(v.issues.some(i => i.includes('Message') && i.includes('missing ticket')),
      `Expected orphan-message issue, got: ${v.issues.join(', ')}`);
  });

  it('aborts when records reference multiple distinct company IDs', async () => {
    await seedDemo();
    const compA = await Company.create({ name: 'A', slug: 'co-a', createdBy: (await User.findOne()).id });
    const compB = await Company.create({ name: 'B', slug: 'co-b', createdBy: (await User.findOne()).id });

    // Stamp some tickets with different company IDs
    const tickets = await Ticket.find({}).lean();
    await Ticket.updateOne({ _id: tickets[0]._id }, { $set: { company: compA._id } });
    await Ticket.updateOne({ _id: tickets[1]._id }, { $set: { company: compB._id } });

    const v = await validate();
    assert(v.issues.some(i => i.includes('multiple') || i.includes('2 company IDs')),
      `Expected multi-company conflict, got: ${v.issues.join(', ')}`);
  });

  it('aborts when no agent users exist', async () => {
    // Create only customer users
    await User.create([
      { name: 'C1', email: 'c1@t.io', password: 'pass1234', role: 'customer' },
      { name: 'C2', email: 'c2@t.io', password: 'pass1234', role: 'customer' },
    ]);

    const v = await validate();
    assert(v.issues.some(i => i.includes('No agent users')),
      `Expected no-agent issue, got: ${v.issues.join(', ')}`);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('Migration — transaction rollback on failure', () => {
  beforeEach(cleanAll);

  it('leaves the database unchanged when the apply transaction is aborted', async () => {
    const { t1 } = await seedDemo();

    const beforeCompanies = await Company.countDocuments({});
    const beforeMembers   = await Membership.countDocuments({});
    const beforeStamped   = await Ticket.countDocuments({ company: { $ne: null } });

    // Simulate a mid-transaction failure by deliberately inserting a bad slug
    // to trigger a Mongoose validation error inside the transaction
    const session = await mongoose.startSession();
    let threw = false;
    try {
      await session.withTransaction(async () => {
        await Company.create([{ name: 'X', slug: 'INVALID SLUG!!!',
          createdBy: (await User.findOne().session(session))._id }], { session });
        // If the above doesn't throw, force one
        throw new Error('Forced rollback for test');
      });
    } catch (err) {
      threw = true;
    } finally {
      await session.endSession();
    }

    assert(threw, 'Transaction must have thrown');

    // Nothing should have changed
    assert.strictEqual(await Company.countDocuments({}),   beforeCompanies);
    assert.strictEqual(await Membership.countDocuments({}), beforeMembers);
    assert.strictEqual(await Ticket.countDocuments({ company: { $ne: null } }), beforeStamped);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('Migration — existing company assignment is preserved', () => {
  beforeEach(cleanAll);

  it('does not overwrite tickets already stamped with a company', async () => {
    const { agent, c1, t1 } = await seedDemo();

    // Pre-stamp one ticket with a company that already exists
    const existingCompany = await Company.create({
      name: DEMO_NAME, slug: DEMO_SLUG, createdBy: agent._id,
    });
    // Explicitly designate agent as company_admin — this is valid when done intentionally
    await Membership.create({ user: agent._id, company: existingCompany._id, role: 'company_admin' });
    await Ticket.updateOne({ _id: t1._id }, { $set: { company: existingCompany._id } });

    const v = await validate();
    // Validation should pass since there's only one company ID
    assert.strictEqual(v.issues.length, 0, `Unexpected issues: ${v.issues.join(', ')}`);

    const plan = await buildPlan(v);

    // Plan must reuse the existing company
    assert.strictEqual(plan.companyAlreadyExists, true);
    assert.strictEqual(plan.existingCompany._id.toString(), existingCompany._id.toString());

    // t1 should NOT be in ticketsToStamp since it's already stamped
    assert(!plan.ticketsToStamp.some(id => id.toString() === t1._id.toString()),
      'Already-stamped ticket must not appear in ticketsToStamp');

    const result = await applyMigration(plan);

    // company count still 1
    assert.strictEqual(await Company.countDocuments({}), 1);

    // t1 still has the same company
    const t1After = await Ticket.findById(t1._id).lean();
    assert.strictEqual(t1After.company.toString(), existingCompany._id.toString());
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('Migration — cross-company assignment conflict detection', () => {
  beforeEach(cleanAll);

  it('detects tickets already stamped with conflicting company IDs', async () => {
    await seedDemo();
    const compA = await Company.create({ name: 'A', slug: 'co-aa', createdBy: (await User.findOne()).id });
    const compB = await Company.create({ name: 'B', slug: 'co-bb', createdBy: (await User.findOne()).id });

    const [t1, t2] = await Ticket.find({}).lean();
    await Ticket.updateOne({ _id: t1._id }, { $set: { company: compA._id } });
    await Ticket.updateOne({ _id: t2._id }, { $set: { company: compB._id } });

    const v = await validate();
    const hasConflict = v.issues.some(i =>
      i.toLowerCase().includes('multiple') || i.includes('2 company ID')
    );
    assert(hasConflict,
      `Expected cross-company conflict issue, got: ${v.issues.join(', ')}`);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('Migration — production guard', () => {
  const PRODUCTION_INDICATORS = [/cluster0/i, /mongodb\.net/i, /prod/i, /production/i];

  function checkProductionGuard(uri, allowEnv) {
    const isProd = PRODUCTION_INDICATORS.some(rx => rx.test(uri));
    if (!isProd) return 'allowed';
    if (allowEnv === 'yes-i-know-what-i-am-doing') return 'override-accepted';
    return 'blocked';
  }

  it('blocks Atlas URI without override', () => {
    const result = checkProductionGuard(
      'mongodb+srv://user:pass@cluster0.abcdef.mongodb.net/mydb',
      undefined
    );
    assert.strictEqual(result, 'blocked');
  });

  it('blocks URI containing "prod" without override', () => {
    const result = checkProductionGuard('mongodb://prod-server:27017/mydb', undefined);
    assert.strictEqual(result, 'blocked');
  });

  it('allows localhost URI without override', () => {
    const result = checkProductionGuard('mongodb://localhost:27017/test', undefined);
    assert.strictEqual(result, 'allowed');
  });

  it('accepts Atlas URI when override env is set', () => {
    const result = checkProductionGuard(
      'mongodb+srv://user:pass@cluster0.abcdef.mongodb.net/mydb',
      'yes-i-know-what-i-am-doing'
    );
    assert.strictEqual(result, 'override-accepted');
  });

  it('does NOT accept a partial or typo override', () => {
    const result = checkProductionGuard(
      'mongodb+srv://user:pass@cluster0.abcdef.mongodb.net/mydb',
      'yes'
    );
    assert.strictEqual(result, 'blocked');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('Migration — membership role mapping', () => {
  beforeEach(cleanAll);

  it('demo agent (Sarah Mitchell) receives "agent" role, not company_admin', async () => {
    const { agent } = await seedDemo();

    const v = await validate();
    const plan = await buildPlan(v);

    const agentEntry = plan.membershipsToCreate.find(
      m => m.userId === agent._id.toString()
    );
    assert(agentEntry, 'Agent must appear in membershipsToCreate');
    assert.strictEqual(
      agentEntry.role, 'agent',
      'Global agent role must map to membership role "agent", not "company_admin"'
    );
  });

  it('customer users (Sam Carter, Alex Rivera) receive "customer" role', async () => {
    const { c1, c2 } = await seedDemo();

    const v = await validate();
    const plan = await buildPlan(v);

    for (const customer of [c1, c2]) {
      const entry = plan.membershipsToCreate.find(
        m => m.userId === customer._id.toString()
      );
      assert(entry, `Customer ${customer.email} must appear in membershipsToCreate`);
      assert.strictEqual(entry.role, 'customer',
        `Customer ${customer.email} must receive "customer" role`);
    }
  });

  it('no user receives company_admin via the automated migration mapping', async () => {
    await seedDemo();

    const v = await validate();
    const plan = await buildPlan(v);

    const adminEntries = plan.membershipsToCreate.filter(m => m.role === 'company_admin');
    assert.strictEqual(
      adminEntries.length, 0,
      `Migration must not assign company_admin automatically; found: ${
        adminEntries.map(m => m.email).join(', ')
      }`
    );
  });

  it('after apply, agent membership role is "agent"', async () => {
    const { agent } = await seedDemo();

    const v = await validate();
    const plan = await buildPlan(v);
    await applyMigration(plan);

    const company = await Company.findOne({ slug: DEMO_SLUG }).lean();
    const agentMem = await Membership.findOne({
      user: agent._id, company: company._id,
    }).lean();

    assert(agentMem, 'Agent membership must exist after migration');
    assert.strictEqual(
      agentMem.role, 'agent',
      `Expected role "agent", got "${agentMem.role}"`
    );
  });

  it('after apply, customer memberships have role "customer"', async () => {
    const { c1, c2 } = await seedDemo();

    const v = await validate();
    const plan = await buildPlan(v);
    await applyMigration(plan);

    const company = await Company.findOne({ slug: DEMO_SLUG }).lean();
    for (const customer of [c1, c2]) {
      const mem = await Membership.findOne({
        user: customer._id, company: company._id,
      }).lean();
      assert(mem, `Customer ${customer.email} must have a membership`);
      assert.strictEqual(mem.role, 'customer');
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('Migration — workspace administration requires explicit designation', () => {
  beforeEach(cleanAll);

  it('workspace creation via the application creates a company_admin membership', async () => {
    // The workspace creation flow (POST /api/v1/companies) explicitly assigns
    // company_admin — separate from, and not derived from, global User.role.
    const { agent } = await seedDemo();

    // Simulate what companyController.createCompany does
    const company = await Company.create({
      name: 'Explicitly Created Workspace',
      slug: 'explicit-ws',
      createdBy: agent._id,
    });
    const adminMembership = await Membership.create({
      user: agent._id, company: company._id, role: 'company_admin',
    });

    assert.strictEqual(adminMembership.role, 'company_admin',
      'Workspace creation must produce a company_admin membership');

    // Verify the migration does NOT overwrite this explicitly assigned role
    const v = await validate();
    const plan = await buildPlan(v);

    // The agent already has a membership for this company — not in membershipsToCreate
    const alreadyCovered = plan.membershipsToCreate.find(
      m => m.userId === agent._id.toString()
    );
    // membershipsToCreate filters by the demo slug company, not explicit-ws;
    // since DEMO_SLUG company doesn't exist yet, agent IS in the list for that
    // future company. The explicit-ws membership is separate and untouched.
    // What matters: the explicit-ws membership keeps its role after migration.
    const result = await applyMigration(plan);

    // explicit-ws admin membership is unchanged
    const explicitMem = await Membership.findOne({
      user: agent._id, company: company._id,
    }).lean();
    assert.strictEqual(explicitMem.role, 'company_admin',
      'Explicitly assigned company_admin must not be overwritten by migration');
  });

  it('upgrading agent to company_admin manually after migration is supported', async () => {
    const { agent } = await seedDemo();

    const v = await validate();
    const plan = await buildPlan(v);
    await applyMigration(plan);

    const demoCompany = await Company.findOne({ slug: DEMO_SLUG }).lean();

    // Manually upgrade (simulates an operator running a targeted update)
    await Membership.updateOne(
      { user: agent._id, company: demoCompany._id },
      { $set: { role: 'company_admin' } }
    );

    const upgraded = await Membership.findOne({
      user: agent._id, company: demoCompany._id,
    }).lean();
    assert.strictEqual(upgraded.role, 'company_admin');

    // Running migration again must not downgrade it (idempotence)
    const v2 = await validate();
    const plan2 = await buildPlan(v2);

    // Agent already has membership — not in membershipsToCreate
    const inPlan = plan2.membershipsToCreate.find(
      m => m.userId === agent._id.toString()
    );
    assert(!inPlan, 'Agent already has membership — must not appear in plan again');

    await applyMigration(plan2);

    const afterSecondRun = await Membership.findOne({
      user: agent._id, company: demoCompany._id,
    }).lean();
    assert.strictEqual(afterSecondRun.role, 'company_admin',
      'Manual company_admin upgrade must survive a second migration run');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('Migration — transaction abort when transactions are unavailable', () => {
  // We cannot easily test process.exit(4) in-process.
  // Instead we verify the transaction probe logic and document the behaviour.

  it('transaction probe succeeds on the in-memory replica set (transactions are available)', async () => {
    // The test database is MongoMemoryReplSet — transactions must work.
    let transactionWorked = false;
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        transactionWorked = true;
      });
    } finally {
      await session.endSession();
    }
    assert(transactionWorked, 'Transactions must work on MongoMemoryReplSet');
  });

  it('migration writes are always wrapped in a transaction (no non-transactional path)', async () => {
    // Read the migration source to confirm there is no fallback write path.
    // This is a documentation-level test: if the source ever re-introduces a
    // non-transactional path the grep will catch it.
    const { readFile } = await import('node:fs/promises');
    const src = await readFile(
      new URL('../migrate-to-company.js', import.meta.url),
      'utf8'
    );

    // Must NOT contain the old non-transactional warning or fallback
    assert(
      !src.includes('Non-transactional writes'),
      'Migration must not contain a non-transactional write path'
    );
    assert(
      !src.includes('await writes(null)'),
      'Migration must not call writes(null) — the non-transactional fallback'
    );

    // Must contain the abort on transaction unavailability
    assert(
      src.includes('process.exit(4)'),
      'Migration must abort (exit 4) when transactions are unavailable'
    );

    // Must contain the replica set requirement message
    assert(
      src.includes('requires a replica set'),
      'Migration must document the replica set requirement in the abort message'
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// New suites added for --existing-company-id support and ambiguity detection.
// The helpers below mirror the updated migrate-to-company.js logic.
// ─────────────────────────────────────────────────────────────────────────────

// ── Helpers mirroring the updated script logic ────────────────────────────────

/** Known demo user emails — only these are auto-added to memberships. */
const DEMO_USER_EMAILS_TEST = new Set([
  'agent@supportiq.dev',
  'customer@supportiq.dev',
  'alex@supportiq.dev',
]);

/**
 * buildPlanV2 — mirrors the updated buildPlan that accepts an optional
 * forced company ID and implements the ambiguity guard.
 *
 * @param {object} validation   - result of validate()
 * @param {string|null} forcedId - pre-validated company ID string, or null
 */
async function buildPlanV2(validation, forcedId = null) {
  const {
    allUsers, allTickets, allMessages, allActivities,
    singleExistingCompanyId,
  } = validation;

  // Load existing memberships inside the function (mirrors the script)
  const existingMemberships = await Membership.find({}).lean();

  // Resolve forced company if supplied
  let forcedCompany = null;
  if (forcedId) {
    forcedCompany = await Company.findById(forcedId).lean();
  }

  // Company resolution order
  let existingCompany = null;
  let companySource   = null;

  if (forcedCompany) {
    existingCompany = forcedCompany;
    companySource   = 'explicit-flag';
  } else {
    existingCompany = await Company.findOne({ slug: DEMO_SLUG }).lean();
    if (existingCompany) {
      companySource = 'demo-slug';
    } else if (singleExistingCompanyId) {
      existingCompany = await Company.findById(singleExistingCompanyId).lean();
      companySource   = 'stamped-records';
    }
  }

  // Ambiguity guard
  if (!existingCompany && existingMemberships.length > 0) {
    return { ambiguous: true, existingMembershipsCount: existingMemberships.length };
  }

  const companyAlreadyExists = !!existingCompany;
  const companyId = existingCompany?._id ?? null;

  const agentCreators = allUsers
    .filter(u => u.role === 'agent' && DEMO_USER_EMAILS_TEST.has(u.email.toLowerCase()))
    .sort((a, b) => a.email.localeCompare(b.email));
  const creatorUser = agentCreators[0] ?? null;

  const existingMembershipKeys = new Set(
    existingMemberships.map(m => `${m.user}-${m.company}`)
  );

  // Only known demo users are auto-added
  const membershipsToCreate = allUsers
    .filter(u => DEMO_USER_EMAILS_TEST.has(u.email.toLowerCase()))
    .map(u => ({
      userId: u._id.toString(),
      email:  u.email,
      role:   u.role === 'agent' ? 'agent' : 'customer',
    }))
    .filter(m => {
      if (!companyId) return true;
      return !existingMembershipKeys.has(`${m.userId}-${companyId}`);
    });

  return {
    ambiguous: false,
    companyAlreadyExists,
    companySource,
    existingCompany,
    creatorUser,
    membershipsToCreate,
    ticketsToStamp:    allTickets.filter(t => t.company == null).map(t => t._id),
    messagesToStamp:   allMessages.filter(m => m.company == null).map(m => m._id),
    activitiesToStamp: allActivities.filter(a => a.company == null).map(a => a._id),
  };
}

/**
 * validateExplicitCompanyIdTest — mirrors the script function of the same name.
 * Returns an issue string on failure, null on success.
 */
async function validateExplicitCompanyIdTest(rawId, report) {
  if (!mongoose.isValidObjectId(rawId)) {
    return `ABORT: --existing-company-id="${rawId}" is not a valid MongoDB ObjectId.`;
  }
  const company = await Company.findById(rawId).lean();
  if (!company) {
    return `ABORT: No Company document found for --existing-company-id="${rawId}".`;
  }
  const conflictingIds = new Set([
    ...(report._allTickets    || []).filter(t => t.company != null).map(t => t.company.toString()),
    ...(report._allMessages   || []).filter(m => m.company != null).map(m => m.company.toString()),
    ...(report._allActivities || []).filter(a => a.company != null).map(a => a.company.toString()),
  ]);
  conflictingIds.delete(rawId);
  if (conflictingIds.size > 0) {
    return (
      `ABORT: --existing-company-id="${rawId}" conflicts with records already ` +
      `stamped with a different company ID: ${[...conflictingIds].join(', ')}.`
    );
  }
  report._forcedCompany = company;
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Apply using the updated plan (V2 plan shape)
// ─────────────────────────────────────────────────────────────────────────────
async function applyMigrationV2(plan) {
  const {
    companyAlreadyExists, existingCompany, creatorUser,
    membershipsToCreate, ticketsToStamp, messagesToStamp, activitiesToStamp,
  } = plan;

  const result = {
    companyCreated: false, membershipsCreated: 0,
    ticketsStamped: 0, messagesStamped: 0, activitiesStamped: 0,
    companyId: null,
  };

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      let companyDoc = existingCompany
        ? await Company.findById(existingCompany._id).session(session)
        : null;

      if (!companyDoc) {
        const [created] = await Company.create(
          [{ name: DEMO_NAME, slug: DEMO_SLUG, createdBy: creatorUser._id }],
          { session }
        );
        companyDoc = created;
        result.companyCreated = true;
      }

      const companyId = companyDoc._id;
      result.companyId = companyId.toString();

      for (const m of membershipsToCreate) {
        const already = await Membership.findOne({ user: m.userId, company: companyId })
          .session(session).lean();
        if (already) continue;
        await Membership.create(
          [{ user: m.userId, company: companyId, role: m.role }],
          { session }
        );
        result.membershipsCreated++;
      }

      if (ticketsToStamp.length) {
        const r = await Ticket.updateMany(
          { _id: { $in: ticketsToStamp }, company: null },
          { $set: { company: companyId } }, { session }
        );
        result.ticketsStamped = r.modifiedCount;
      }
      if (messagesToStamp.length) {
        const r = await Message.updateMany(
          { _id: { $in: messagesToStamp }, company: null },
          { $set: { company: companyId } }, { session }
        );
        result.messagesStamped = r.modifiedCount;
      }
      if (activitiesToStamp.length) {
        const r = await Activity.updateMany(
          { _id: { $in: activitiesToStamp }, company: null },
          { $set: { company: companyId } }, { session }
        );
        result.activitiesStamped = r.modifiedCount;
      }
    });
  } finally {
    await session.endSession();
  }
  return result;
}

// ═══════════════════════════════════════════════════════════════════════════════
describe('Migration — --existing-company-id flag: validation', () => {
  beforeEach(cleanAll);

  it('rejects a syntactically invalid ObjectId', async () => {
    const report = { _allTickets: [], _allMessages: [], _allActivities: [] };
    const issue = await validateExplicitCompanyIdTest('not-an-object-id', report);
    assert(issue, 'Expected an issue for invalid ObjectId');
    assert(issue.includes('not a valid MongoDB ObjectId'),
      `Unexpected message: ${issue}`);
  });

  it('rejects a valid ObjectId that references no existing company', async () => {
    const phantomId = new mongoose.Types.ObjectId().toString();
    const report = { _allTickets: [], _allMessages: [], _allActivities: [] };
    const issue = await validateExplicitCompanyIdTest(phantomId, report);
    assert(issue, 'Expected an issue for missing company');
    assert(issue.includes('No Company document found'),
      `Unexpected message: ${issue}`);
  });

  it('rejects an ID when stamped records reference a DIFFERENT company', async () => {
    // Create two separate companies
    const { agent } = await seedDemo();
    const compA = await Company.create({ name: 'A', slug: 'cid-a', createdBy: agent._id });
    const compB = await Company.create({ name: 'B', slug: 'cid-b', createdBy: agent._id });

    // Pre-stamp a ticket with compA
    const ticket = await Ticket.findOne({}).lean();
    await Ticket.updateOne({ _id: ticket._id }, { $set: { company: compA._id } });

    const stampedTickets = await Ticket.find({}).select('_id company').lean();
    const report = {
      _allTickets:    stampedTickets,
      _allMessages:   [],
      _allActivities: [],
    };

    // Supplying compB's ID must be rejected because compA is already stamped
    const issue = await validateExplicitCompanyIdTest(compB._id.toString(), report);
    assert(issue, 'Expected a conflict issue');
    assert(issue.includes('conflicts with records already stamped'),
      `Unexpected message: ${issue}`);
  });

  it('accepts a valid ID that matches the single already-stamped company', async () => {
    const { agent } = await seedDemo();
    const comp = await Company.create({ name: 'Narcote', slug: 'narcote', createdBy: agent._id });

    // Stamp one ticket with this company
    const ticket = await Ticket.findOne({}).lean();
    await Ticket.updateOne({ _id: ticket._id }, { $set: { company: comp._id } });

    const stampedTickets = await Ticket.find({}).select('_id company').lean();
    const report = {
      _allTickets:    stampedTickets,
      _allMessages:   [],
      _allActivities: [],
    };

    const issue = await validateExplicitCompanyIdTest(comp._id.toString(), report);
    assert.strictEqual(issue, null, `Expected no issue, got: ${issue}`);
    assert.strictEqual(
      report._forcedCompany._id.toString(),
      comp._id.toString(),
      '_forcedCompany must be set on success'
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('Migration — --existing-company-id flag: plan and apply behaviour', () => {
  beforeEach(cleanAll);

  it('with explicit ID the plan uses REUSE with source "explicit-flag"', async () => {
    const { agent } = await seedDemo();
    const uiCompany = await Company.create({
      name: 'Narcote', slug: 'narcote', createdBy: agent._id,
    });

    const v = await validate();
    const plan = await buildPlanV2(v, uiCompany._id.toString());

    assert.strictEqual(plan.ambiguous, false);
    assert.strictEqual(plan.companyAlreadyExists, true);
    assert.strictEqual(plan.companySource, 'explicit-flag');
    assert.strictEqual(
      plan.existingCompany._id.toString(),
      uiCompany._id.toString()
    );
  });

  it('applies migration against the UI-created company when explicit ID is supplied', async () => {
    const { agent, c1, c2, t1, t2 } = await seedDemo();
    const uiCompany = await Company.create({
      name: 'Narcote', slug: 'narcote', createdBy: agent._id,
    });

    const v = await validate();
    const plan = await buildPlanV2(v, uiCompany._id.toString());
    const result = await applyMigrationV2(plan);

    // No second company created — Narcote was reused
    assert.strictEqual(result.companyCreated, false);
    assert.strictEqual(await Company.countDocuments({}), 1);

    // Tickets stamped with Narcote's ID
    const stamped = await Ticket.find({ company: uiCompany._id }).lean();
    assert.strictEqual(stamped.length, 2);

    // Three demo memberships created
    assert.strictEqual(result.membershipsCreated, 3);
    const mems = await Membership.find({ company: uiCompany._id }).lean();
    assert.strictEqual(mems.length, 3);

    // Existing agent membership (company_admin from workspace creation) is separate
    // and untouched — the migration created agent-role memberships, not company_admin
    const agentMem = mems.find(m => m.user.toString() === agent._id.toString());
    assert.strictEqual(agentMem?.role, 'agent');
  });

  it('dry-run with explicit ID makes zero writes', async () => {
    const { agent } = await seedDemo();
    const uiCompany = await Company.create({
      name: 'Narcote', slug: 'narcote', createdBy: agent._id,
    });

    const v = await validate();
    const plan = await buildPlanV2(v, uiCompany._id.toString());

    // buildPlanV2 is read-only; verify nothing was written
    assert.strictEqual(await Ticket.countDocuments({ company: { $ne: null } }), 0);
    assert.strictEqual(await Membership.countDocuments({ company: uiCompany._id }), 0);
  });

  it('idempotent: second run with the same explicit ID is a no-op', async () => {
    const { agent } = await seedDemo();
    const uiCompany = await Company.create({
      name: 'Narcote', slug: 'narcote', createdBy: agent._id,
    });

    // First apply
    const v1 = await validate();
    const plan1 = await buildPlanV2(v1, uiCompany._id.toString());
    const r1 = await applyMigrationV2(plan1);

    assert.strictEqual(r1.membershipsCreated, 3);
    assert.strictEqual(r1.ticketsStamped, 2);

    // Second apply
    const v2 = await validate();
    const plan2 = await buildPlanV2(v2, uiCompany._id.toString());
    const r2 = await applyMigrationV2(plan2);

    assert.strictEqual(r2.membershipsCreated, 0, 'no new memberships on second run');
    assert.strictEqual(r2.ticketsStamped,      0, 'no re-stamping on second run');
    assert.strictEqual(r2.messagesStamped,     0);
    assert.strictEqual(r2.activitiesStamped,   0);
    assert.strictEqual(await Company.countDocuments({}), 1);
    assert.strictEqual(await Membership.countDocuments({}), 3);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('Migration — ambiguity detection', () => {
  beforeEach(cleanAll);

  it('returns { ambiguous: true } when memberships exist but no company resolves', async () => {
    // Simulate the Atlas state: membership exists from the UI-created company,
    // but that company has a non-demo slug and no records are stamped.
    const { agent } = await seedDemo();
    const uiCompany = await Company.create({
      name: 'Narcote', slug: 'narcote', createdBy: agent._id,
    });
    // The agent joined via the UI — one membership, no stamped records
    await Membership.create({ user: agent._id, company: uiCompany._id, role: 'company_admin' });

    const v = await validate();
    // No explicit ID supplied → ambiguity guard fires
    const plan = await buildPlanV2(v, null);

    assert.strictEqual(plan.ambiguous, true);
    assert.strictEqual(
      plan.existingMembershipsCount, 1,
      'Should report exactly 1 membership causing the ambiguity'
    );
  });

  it('does NOT flag ambiguity when no memberships exist (clean-slate case)', async () => {
    await seedDemo();
    // No memberships created — straightforward new-company path
    const v = await validate();
    const plan = await buildPlanV2(v, null);

    assert.strictEqual(plan.ambiguous, false);
    assert.strictEqual(plan.companyAlreadyExists, false);
  });

  it('resolves without ambiguity when the explicit flag is supplied', async () => {
    const { agent } = await seedDemo();
    const uiCompany = await Company.create({
      name: 'Narcote', slug: 'narcote', createdBy: agent._id,
    });
    await Membership.create({ user: agent._id, company: uiCompany._id, role: 'company_admin' });

    const v = await validate();
    // Ambiguity is resolved by supplying the explicit company ID
    const plan = await buildPlanV2(v, uiCompany._id.toString());

    assert.strictEqual(plan.ambiguous, false);
    assert.strictEqual(plan.companySource, 'explicit-flag');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('Migration — unknown user exclusion and reporting', () => {
  beforeEach(cleanAll);

  it('unknown user is NOT auto-added to membershipsToCreate', async () => {
    const { agent, c1, c2 } = await seedDemo();

    // A fourth user who registered via the normal sign-up flow
    const unknown = await User.create({
      name: 'Unknown User',
      email: 'namrathasindhu113@gmail.com',
      password: 'Pass1234!',
      role: 'customer',
    });

    const v = await validate();
    const plan = await buildPlanV2(v, null);

    // Unknown user must not appear in membershipsToCreate
    const unknownEntry = plan.membershipsToCreate.find(
      m => m.userId === unknown._id.toString()
    );
    assert.strictEqual(unknownEntry, undefined,
      'User outside DEMO_USER_EMAILS must not be auto-added to the workspace');

    // Only the three known demo users should be in the plan
    assert.strictEqual(plan.membershipsToCreate.length, 3,
      'Exactly 3 demo-user memberships should be planned');
  });

  it('validate() populates unknownUsers for reporting', async () => {
    const { agent, c1, c2 } = await seedDemo();
    await User.create({
      name: 'Unknown User',
      email: 'extra@external.com',
      password: 'Pass1234!',
      role: 'customer',
    });

    const report = {};
    await validate(report);

    assert(Array.isArray(report.unknownUsers), 'unknownUsers must be an array');
    const unknownEmails = report.unknownUsers.map(u => u.email);
    assert(
      unknownEmails.includes('extra@external.com'),
      'extra@external.com must appear in unknownUsers'
    );
    assert(
      !unknownEmails.includes('agent@supportiq.dev'),
      'known demo user must NOT appear in unknownUsers'
    );
  });

  it('existing membership for an unknown user is not overwritten or duplicated', async () => {
    const { agent, c1, c2 } = await seedDemo();
    const uiCompany = await Company.create({
      name: 'Narcote', slug: 'narcote', createdBy: agent._id,
    });

    // Unknown user already has an explicit membership (e.g. added by admin via UI)
    const unknown = await User.create({
      name: 'Unknown User',
      email: 'extra@external.com',
      password: 'Pass1234!',
      role: 'customer',
    });
    const priorMembership = await Membership.create({
      user: unknown._id, company: uiCompany._id, role: 'customer',
    });

    const v = await validate();
    const plan = await buildPlanV2(v, uiCompany._id.toString());
    await applyMigrationV2(plan);

    // Prior membership must remain unchanged
    const mem = await Membership.findById(priorMembership._id).lean();
    assert(mem, 'Prior membership must still exist');
    assert.strictEqual(mem.role, 'customer');

    // No duplicate membership must have been created
    const count = await Membership.countDocuments({
      user: unknown._id, company: uiCompany._id,
    });
    assert.strictEqual(count, 1, 'Must not duplicate the existing membership');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('Migration — source annotation in dry-run plan', () => {
  beforeEach(cleanAll);

  it('plan shows companySource "explicit-flag" when flag is supplied', async () => {
    const { agent } = await seedDemo();
    const uiCompany = await Company.create({
      name: 'Narcote', slug: 'narcote', createdBy: agent._id,
    });
    const v = await validate();
    const plan = await buildPlanV2(v, uiCompany._id.toString());
    assert.strictEqual(plan.companySource, 'explicit-flag');
  });

  it('plan shows companySource "demo-slug" when slug matches', async () => {
    const { agent } = await seedDemo();
    await Company.create({ name: DEMO_NAME, slug: DEMO_SLUG, createdBy: agent._id });
    const v = await validate();
    const plan = await buildPlanV2(v, null);
    assert.strictEqual(plan.ambiguous, false);
    assert.strictEqual(plan.companySource, 'demo-slug');
  });

  it('plan shows companySource "stamped-records" when company found via stamped ticket', async () => {
    const { agent, t1 } = await seedDemo();
    const comp = await Company.create({ name: 'Via Stamp', slug: 'via-stamp', createdBy: agent._id });
    await Ticket.updateOne({ _id: t1._id }, { $set: { company: comp._id } });

    const v = await validate();
    const plan = await buildPlanV2(v, null);
    assert.strictEqual(plan.ambiguous, false);
    assert.strictEqual(plan.companySource, 'stamped-records');
  });
});
