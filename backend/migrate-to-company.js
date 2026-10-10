#!/usr/bin/env node
/**
 * migrate-to-company.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Safe, idempotent migration that maps existing single-company demo records to
 * a named legacy/demo Company workspace.
 *
 * USAGE
 *   node migrate-to-company.js --dry-run                         # default
 *   node migrate-to-company.js --dry-run --verbose
 *   node migrate-to-company.js --dry-run --existing-company-id=<ObjectId>
 *   node migrate-to-company.js --apply --confirm \
 *       --existing-company-id=<ObjectId>
 *
 * FLAGS
 *   --dry-run                     (default) Read-only analysis. No writes.
 *   --apply                       Apply mode. Requires --confirm.
 *   --confirm                     Required alongside --apply.
 *   --verbose                     Print per-record details.
 *   --existing-company-id=<ObjId> Explicit MongoDB ObjectId of the company to
 *                                 which all null-stamped records should be
 *                                 assigned. Required when the database contains
 *                                 memberships but no canonical company can be
 *                                 identified automatically (see AMBIGUITY).
 *
 * COMPANY RESOLUTION ORDER
 *   1. --existing-company-id flag  (operator-verified; highest precedence)
 *   2. Company with slug 'supportiq-demo'
 *   3. Company already referenced by a stamped record (single ID only)
 *   4. ABORT — ambiguous (see below)
 *
 * AMBIGUITY GUARD (exit 5)
 *   If the database contains Membership records but no Company can be
 *   identified through paths 1–3, the script aborts before any write and
 *   instructs the operator to supply the correct company ID via
 *   --existing-company-id.  The script NEVER guesses from the first
 *   membership record or the first registered user.
 *
 * KNOWN DEMO USERS
 *   Only users whose email matches a known seed address are added to the
 *   workspace automatically:
 *     agent@supportiq.dev, customer@supportiq.dev, alex@supportiq.dev
 *   Any other registered user is listed in the dry-run report under
 *   "USERS OUTSIDE KNOWN DEMO EMAILS" and must be given membership
 *   explicitly by the operator after migration.
 *
 * SAFETY CONTRACT
 *   • Never deletes, truncates, or overwrites any existing record.
 *   • Only writes: new Company (if needed), new Memberships, $set company on
 *     Tickets / Messages / Activities where company is currently null.
 *   • Idempotent: existing company reused; duplicate Memberships skipped;
 *     already-stamped records excluded.
 *   • Aborts before writes on orphans, ambiguous ownership, or conflicts.
 *   • Requires replica-set / Atlas transactions; aborts otherwise.
 *   • Production guard: refuses Atlas URIs without MIGRATION_ALLOW_PRODUCTION.
 *
 * IDEMPOTENCE
 *   Run this script twice on the same database and the second run is a no-op.
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import process from 'node:process';

import User       from './src/models/User.js';
import Company    from './src/models/Company.js';
import Membership from './src/models/Membership.js';
import Ticket     from './src/models/Ticket.js';
import Message    from './src/models/Message.js';
import Activity   from './src/models/Activity.js';

// ─────────────────────────────────────────────────────────────────────────────
// CLI args
// ─────────────────────────────────────────────────────────────────────────────
const rawArgs = process.argv.slice(2);
const argSet  = new Set(rawArgs);

const DRY_RUN = !argSet.has('--apply');
const CONFIRM = argSet.has('--confirm');
const VERBOSE = argSet.has('--verbose');

/** Parse --existing-company-id=<value>; null when the flag is absent. */
const EXISTING_COMPANY_ID = (() => {
  const flag = rawArgs.find(a => a.startsWith('--existing-company-id='));
  if (!flag) return null;
  const value = flag.slice('--existing-company-id='.length).trim();
  return value || null;
})();

// ─────────────────────────────────────────────────────────────────────────────
// Known demo user emails
// Only these are automatically included in the migration's membership plan.
// Users with other emails are reported for explicit operator decision.
// ─────────────────────────────────────────────────────────────────────────────
const DEMO_USER_EMAILS = new Set([
  'agent@supportiq.dev',
  'customer@supportiq.dev',
  'alex@supportiq.dev',
]);

// ─────────────────────────────────────────────────────────────────────────────
// Demo company identity
// ─────────────────────────────────────────────────────────────────────────────
const DEMO_COMPANY_SLUG = 'supportiq-demo';
const DEMO_COMPANY_NAME = 'SupportIQ Demo';

// ─────────────────────────────────────────────────────────────────────────────
// Logging
// ─────────────────────────────────────────────────────────────────────────────
const log = {
  info:  (...a) => console.log('  ', ...a),
  ok:    (...a) => console.log('  ✅', ...a),
  warn:  (...a) => console.warn(' ⚠️ ', ...a),
  error: (...a) => console.error(' ❌', ...a),
  hr:    ()     => console.log('─'.repeat(72)),
  head:  (s)    => { log.hr(); console.log(`  ${s}`); log.hr(); },
};

// ─────────────────────────────────────────────────────────────────────────────
// Production guard
// ─────────────────────────────────────────────────────────────────────────────
const PRODUCTION_INDICATORS = [
  /cluster0/i,
  /mongodb\.net/i,
  /prod/i,
  /production/i,
];

function checkProductionGuard(uri) {
  if (!uri) return;
  const isProd = PRODUCTION_INDICATORS.some(rx => rx.test(uri));
  if (!isProd) return;

  const override = process.env.MIGRATION_ALLOW_PRODUCTION;
  if (override === 'yes-i-know-what-i-am-doing') {
    log.warn('Production URI detected. MIGRATION_ALLOW_PRODUCTION override accepted.');
    log.warn('THIS MIGRATION WILL WRITE TO A PRODUCTION DATABASE.');
    return;
  }

  log.error('Production database URI detected in MONGO_URI.');
  log.error('This migration script refuses to run against production by default.');
  log.error('');
  log.error('If you have verified a complete backup and fully understand the');
  log.error('consequences, set the environment variable:');
  log.error('  MIGRATION_ALLOW_PRODUCTION=yes-i-know-what-i-am-doing');
  log.error('');
  log.error('This override is intentionally verbose and must be set explicitly.');
  process.exit(2);
}

// ─────────────────────────────────────────────────────────────────────────────
// Connect
// ─────────────────────────────────────────────────────────────────────────────
async function connect() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    log.error('MONGO_URI is not set. Check your .env file.');
    process.exit(1);
  }
  checkProductionGuard(uri);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15_000 });
}

// ─────────────────────────────────────────────────────────────────────────────
// validateExplicitCompanyId — additional checks run when --existing-company-id
// is supplied.  Populates report._forcedCompany on success.
// Returns an issue string on failure, null on success.
// ─────────────────────────────────────────────────────────────────────────────
export async function validateExplicitCompanyId(rawId, report) {
  // 1. Must be a syntactically valid MongoDB ObjectId
  if (!mongoose.isValidObjectId(rawId)) {
    return (
      `ABORT: --existing-company-id="${rawId}" is not a valid MongoDB ObjectId. ` +
      'Find the correct _id in the Atlas Data Explorer and retry.'
    );
  }

  // 2. Exactly one Company document must exist for that ID
  const company = await Company.findById(rawId).lean();
  if (!company) {
    return (
      `ABORT: No Company document found for --existing-company-id="${rawId}". ` +
      'Verify the ID in the Atlas Data Explorer before retrying.'
    );
  }

  // 3. No already-stamped record may reference a DIFFERENT company ID
  const allTickets    = report._allTickets    ?? [];
  const allMessages   = report._allMessages   ?? [];
  const allActivities = report._allActivities ?? [];

  const conflictingIds = new Set([
    ...allTickets.filter(t => t.company != null).map(t => t.company.toString()),
    ...allMessages.filter(m => m.company != null).map(m => m.company.toString()),
    ...allActivities.filter(a => a.company != null).map(a => a.company.toString()),
  ]);
  conflictingIds.delete(rawId); // same company is fine

  if (conflictingIds.size > 0) {
    return (
      `ABORT: --existing-company-id="${rawId}" conflicts with records already ` +
      `stamped with a different company ID: ${[...conflictingIds].join(', ')}. ` +
      'Resolve the conflict manually before retrying.'
    );
  }

  // All checks passed — store for use by buildPlan
  report._forcedCompany = company;
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// validate — runs before any writes
// ─────────────────────────────────────────────────────────────────────────────
export async function validate(report) {
  const issues = [];

  // ── 1. Users ───────────────────────────────────────────────────────────────
  const allUsers = await User.find({}).select('_id email role').lean();
  report.totalUsers = allUsers.length;

  if (allUsers.length === 0) {
    issues.push('ABORT: No users found in the database. Cannot determine company membership.');
  }

  const agentUsers = allUsers.filter(u => u.role === 'agent');
  if (agentUsers.length === 0) {
    issues.push('ABORT: No agent users found. Cannot assign a company creator.');
  }

  // Identify users outside known demo emails — reported, not auto-added
  report.unknownUsers = allUsers.filter(
    u => !DEMO_USER_EMAILS.has(u.email.toLowerCase())
  );

  // ── 2. Tickets ─────────────────────────────────────────────────────────────
  const allTickets = await Ticket.find({}).select('_id customer assignedTo company').lean();
  report.totalTickets = allTickets.length;

  const existingCompanyIds = new Set();
  const ticketsWithCompany = allTickets.filter(t => t.company != null);
  ticketsWithCompany.forEach(t => existingCompanyIds.add(t.company.toString()));
  report.ticketsAlreadyStamped = ticketsWithCompany.length;

  if (existingCompanyIds.size > 1) {
    issues.push(
      `ABORT: Tickets already reference ${existingCompanyIds.size} different company IDs. ` +
      'Multi-company data exists; this migration is for single-company databases only.'
    );
  }

  const userIdSet = new Set(allUsers.map(u => u._id.toString()));

  const orphanedTickets = allTickets.filter(
    t => !userIdSet.has(t.customer?.toString())
  );
  report.orphanedTickets = orphanedTickets.length;
  if (orphanedTickets.length > 0) {
    issues.push(
      `ABORT: ${orphanedTickets.length} ticket(s) reference non-existent customer user(s).`
    );
    if (VERBOSE) orphanedTickets.forEach(t =>
      log.error(`  Orphaned ticket: ${t._id} (customer: ${t.customer})`)
    );
  }

  const orphanedAssignees = allTickets.filter(
    t => t.assignedTo != null && !userIdSet.has(t.assignedTo.toString())
  );
  report.orphanedAssignees = orphanedAssignees.length;
  if (orphanedAssignees.length > 0) {
    issues.push(
      `ABORT: ${orphanedAssignees.length} ticket(s) reference non-existent assignee user(s).`
    );
    if (VERBOSE) orphanedAssignees.forEach(t =>
      log.error(`  Invalid assignee: ${t._id} (assignedTo: ${t.assignedTo})`)
    );
  }

  // ── 3. Messages ────────────────────────────────────────────────────────────
  const allTicketIds = new Set(allTickets.map(t => t._id.toString()));
  const allMessages  = await Message.find({}).select('_id ticket sender company').lean();
  report.totalMessages          = allMessages.length;
  report.messagesAlreadyStamped = allMessages.filter(m => m.company != null).length;

  const orphanedMessages = allMessages.filter(
    m => !allTicketIds.has(m.ticket?.toString())
  );
  report.orphanedMessages = orphanedMessages.length;
  if (orphanedMessages.length > 0) {
    issues.push(
      `ABORT: ${orphanedMessages.length} message(s) reference non-existent ticket(s).`
    );
  }

  const orphanedMessageSenders = allMessages.filter(
    m => !userIdSet.has(m.sender?.toString())
  );
  report.orphanedMessageSenders = orphanedMessageSenders.length;
  if (orphanedMessageSenders.length > 0) {
    issues.push(
      `ABORT: ${orphanedMessageSenders.length} message(s) reference non-existent sender user(s).`
    );
  }

  // ── 4. Activities ──────────────────────────────────────────────────────────
  const allActivities = await Activity.find({}).select('_id ticket actor company').lean();
  report.totalActivities          = allActivities.length;
  report.activitiesAlreadyStamped = allActivities.filter(a => a.company != null).length;

  const orphanedActivities = allActivities.filter(
    a => !allTicketIds.has(a.ticket?.toString())
  );
  report.orphanedActivities = orphanedActivities.length;
  if (orphanedActivities.length > 0) {
    issues.push(
      `ABORT: ${orphanedActivities.length} activity record(s) reference non-existent ticket(s).`
    );
  }

  const orphanedActors = allActivities.filter(
    a => !userIdSet.has(a.actor?.toString())
  );
  report.orphanedActors = orphanedActors.length;
  if (orphanedActors.length > 0) {
    issues.push(
      `ABORT: ${orphanedActors.length} activity record(s) reference non-existent actor user(s).`
    );
  }

  // ── 5. Existing memberships ────────────────────────────────────────────────
  const allMemberships = await Membership.find({}).lean();
  report.existingMemberships = allMemberships.length;

  // ── 6. Conflicting company assignments across all three collections ────────
  const existingMsgCompanyIds = new Set(
    allMessages.filter(m => m.company != null).map(m => m.company.toString())
  );
  const existingActCompanyIds = new Set(
    allActivities.filter(a => a.company != null).map(a => a.company.toString())
  );
  const allExistingCompanyIds = new Set([
    ...existingCompanyIds,
    ...existingMsgCompanyIds,
    ...existingActCompanyIds,
  ]);
  if (allExistingCompanyIds.size > 1) {
    issues.push(
      `ABORT: Records already reference multiple distinct company IDs ` +
      `(${allExistingCompanyIds.size}). This migration is for single-company databases only.`
    );
  }

  // Store for downstream use in buildPlan / validateExplicitCompanyId
  report._allUsers       = allUsers;
  report._allTickets     = allTickets;
  report._allMessages    = allMessages;
  report._allActivities  = allActivities;
  report._allMemberships = allMemberships;
  report._singleExistingCompanyId = allExistingCompanyIds.size === 1
    ? [...allExistingCompanyIds][0]
    : null;

  return issues;
}

// ─────────────────────────────────────────────────────────────────────────────
// buildPlan — compute what WOULD be written (no DB writes)
//
// Returns either:
//   { ambiguous: true, existingMembershipsCount: N }   ← operator must act
//   { ambiguous: false, companyAlreadyExists, existingCompany, … }
//
// Company resolution order:
//   1. report._forcedCompany  (set by validateExplicitCompanyId when flag given)
//   2. Company with slug 'supportiq-demo'
//   3. Company already referenced by a single stamped record set
//   4. AMBIGUOUS — return { ambiguous: true }
// ─────────────────────────────────────────────────────────────────────────────
export async function buildPlan(report) {
  const {
    _allUsers, _allTickets, _allMessages, _allActivities,
    _allMemberships, _singleExistingCompanyId, _forcedCompany,
  } = report;

  // ── Company resolution ────────────────────────────────────────────────────
  let existingCompany = null;
  let companySource   = null;

  if (_forcedCompany) {
    // Path 1: operator supplied --existing-company-id, already validated
    existingCompany = _forcedCompany;
    companySource   = 'explicit-flag';
  } else {
    // Path 2: canonical demo slug
    existingCompany = await Company.findOne({ slug: DEMO_COMPANY_SLUG }).lean();
    if (existingCompany) {
      companySource = 'demo-slug';
    } else if (_singleExistingCompanyId) {
      // Path 3: single company ID already stamped on records
      existingCompany = await Company.findById(_singleExistingCompanyId).lean();
      companySource   = 'stamped-records';
    }
  }

  // ── Ambiguity guard ───────────────────────────────────────────────────────
  // Memberships exist but we still cannot identify the target company.
  // Do NOT guess — abort and require the operator to supply the company ID.
  if (!existingCompany && _allMemberships.length > 0) {
    return { ambiguous: true, existingMembershipsCount: _allMemberships.length };
  }

  const companyAlreadyExists = !!existingCompany;
  const companyId            = existingCompany?._id ?? null;

  // ── Creator user (only used when we must create a new company) ────────────
  // Must be a known demo agent; alphabetically first by email.
  const agentCreators = _allUsers
    .filter(u => u.role === 'agent' && DEMO_USER_EMAILS.has(u.email.toLowerCase()))
    .sort((a, b) => a.email.localeCompare(b.email));
  const creatorUser = agentCreators[0] ?? null;

  // ── Memberships to create — known demo users only ─────────────────────────
  // Unknown users are reported in the dry-run output and NOT auto-added.
  const existingMembershipKeys = new Set(
    _allMemberships.map(m => `${m.user}-${m.company}`)
  );

  const membershipsToCreate = _allUsers
    // Only the three known demo addresses are eligible for auto-membership
    .filter(u => DEMO_USER_EMAILS.has(u.email.toLowerCase()))
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
    ticketsToStamp:    _allTickets.filter(t => t.company == null).map(t => t._id),
    messagesToStamp:   _allMessages.filter(m => m.company == null).map(m => m._id),
    activitiesToStamp: _allActivities.filter(a => a.company == null).map(a => a._id),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// applyMigration — transactional writes (requires replica set / Atlas)
// ─────────────────────────────────────────────────────────────────────────────
async function applyMigration(plan, report) {
  const {
    companyAlreadyExists, existingCompany, creatorUser,
    membershipsToCreate, ticketsToStamp, messagesToStamp, activitiesToStamp,
  } = plan;

  // ── Require transaction support before any write ──────────────────────────
  let probeSession;
  try {
    probeSession = await mongoose.startSession();
    await probeSession.withTransaction(async () => { /* no-op probe */ });
    await probeSession.endSession();
    probeSession = null;
  } catch (_probeErr) {
    try { await probeSession?.endSession(); } catch (_) { /* ignore */ }
    log.error('This database does not support multi-document transactions.');
    log.error('The migration requires a replica set or Atlas deployment.');
    log.error('Aborting — no changes have been written.');
    log.error('');
    log.error('To proceed, connect to a MongoDB replica set or Atlas cluster.');
    log.error('Standalone mongod instances do not support transactions.');
    process.exit(4);
  }

  // ── Transactional write helper ────────────────────────────────────────────
  const writes = async (txSession) => {
    let companyDoc = existingCompany
      ? await Company.findById(existingCompany._id).session(txSession)
      : null;

    if (!companyDoc) {
      log.info(`Creating Company: "${DEMO_COMPANY_NAME}" (slug: ${DEMO_COMPANY_SLUG})`);
      const [created] = await Company.create(
        [{ name: DEMO_COMPANY_NAME, slug: DEMO_COMPANY_SLUG, createdBy: creatorUser._id }],
        { session: txSession }
      );
      companyDoc = created;
      report.companyCreated = true;
    } else {
      log.info(`Company already exists: "${companyDoc.name}" (${companyDoc._id})`);
      report.companyCreated = false;
    }

    const companyId = companyDoc._id;

    report.membershipsCreated = 0;
    for (const m of membershipsToCreate) {
      const already = await Membership.findOne({ user: m.userId, company: companyId })
        .session(txSession).lean();
      if (already) {
        if (VERBOSE) log.info(`  Membership already exists: ${m.email} → ${m.role} (skip)`);
        continue;
      }
      log.info(`  Creating membership: ${m.email} → ${m.role}`);
      await Membership.create(
        [{ user: m.userId, company: companyId, role: m.role }],
        { session: txSession }
      );
      report.membershipsCreated++;
    }

    if (ticketsToStamp.length > 0) {
      const r = await Ticket.updateMany(
        { _id: { $in: ticketsToStamp }, company: null },
        { $set: { company: companyId } },
        { session: txSession }
      );
      report.ticketsStamped = r.modifiedCount;
      log.info(`Stamped ${report.ticketsStamped} ticket(s) with company ID.`);
    } else {
      report.ticketsStamped = 0;
      log.info('All tickets already have a company assignment (nothing to do).');
    }

    if (messagesToStamp.length > 0) {
      const r = await Message.updateMany(
        { _id: { $in: messagesToStamp }, company: null },
        { $set: { company: companyId } },
        { session: txSession }
      );
      report.messagesStamped = r.modifiedCount;
      log.info(`Stamped ${report.messagesStamped} message(s) with company ID.`);
    } else {
      report.messagesStamped = 0;
      log.info('All messages already have a company assignment (nothing to do).');
    }

    if (activitiesToStamp.length > 0) {
      const r = await Activity.updateMany(
        { _id: { $in: activitiesToStamp }, company: null },
        { $set: { company: companyId } },
        { session: txSession }
      );
      report.activitiesStamped = r.modifiedCount;
      log.info(`Stamped ${report.activitiesStamped} activity record(s) with company ID.`);
    } else {
      report.activitiesStamped = 0;
      log.info('All activities already have a company assignment (nothing to do).');
    }

    report.finalCompanyId = companyId.toString();
  };

  const txSession = await mongoose.startSession();
  log.info('Using a MongoDB transaction.');
  try {
    await txSession.withTransaction(() => writes(txSession));
    log.ok('Transaction committed successfully.');
  } catch (err) {
    log.error('Transaction aborted. No changes were written.');
    throw err;
  } finally {
    await txSession.endSession();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// printReport
// ─────────────────────────────────────────────────────────────────────────────
function printReport(report, plan, mode) {
  log.head(mode === 'dry-run' ? 'DRY-RUN REPORT (no changes written)' : 'APPLY REPORT');

  console.log('\n  CURRENT STATE');
  console.log(`    Users (total):           ${report.totalUsers}`);
  console.log(`    Tickets:                 ${report.totalTickets} (${report.ticketsAlreadyStamped} already stamped)`);
  console.log(`    Messages:                ${report.totalMessages} (${report.messagesAlreadyStamped} already stamped)`);
  console.log(`    Activities:              ${report.totalActivities} (${report.activitiesAlreadyStamped} already stamped)`);
  console.log(`    Existing memberships:    ${report.existingMemberships}`);

  if (report.unknownUsers?.length > 0) {
    console.log('\n  USERS OUTSIDE KNOWN DEMO EMAILS (not auto-added — assign membership explicitly)');
    report.unknownUsers.forEach(u =>
      console.log(`    ${u.email.padEnd(42)} role: ${u.role}`)
    );
  }

  console.log('\n  VALIDATION');
  console.log(`    Orphaned tickets:        ${report.orphanedTickets}`);
  console.log(`    Invalid assignees:       ${report.orphanedAssignees}`);
  console.log(`    Orphaned messages:       ${report.orphanedMessages}`);
  console.log(`    Orphaned activities:     ${report.orphanedActivities}`);

  console.log('\n  PLAN');
  if (plan.companyAlreadyExists) {
    console.log(
      `    Company:                 REUSE "${plan.existingCompany.name}" ` +
      `(${plan.existingCompany._id}) [source: ${plan.companySource}]`
    );
  } else {
    console.log(`    Company:                 CREATE "${DEMO_COMPANY_NAME}" (slug: ${DEMO_COMPANY_SLUG})`);
  }
  console.log(`    Memberships to create:   ${plan.membershipsToCreate.length}`);
  plan.membershipsToCreate.forEach(m =>
    console.log(`      ${m.email.padEnd(42)} → ${m.role}`)
  );
  console.log(`    Tickets to stamp:        ${plan.ticketsToStamp.length}`);
  console.log(`    Messages to stamp:       ${plan.messagesToStamp.length}`);
  console.log(`    Activities to stamp:     ${plan.activitiesToStamp.length}`);

  if (mode !== 'dry-run') {
    console.log('\n  RESULTS');
    console.log(`    Company created:         ${report.companyCreated}`);
    console.log(`    Memberships created:     ${report.membershipsCreated}`);
    console.log(`    Tickets stamped:         ${report.ticketsStamped}`);
    console.log(`    Messages stamped:        ${report.messagesStamped}`);
    console.log(`    Activities stamped:      ${report.activitiesStamped}`);
    console.log(`    Company ID:              ${report.finalCompanyId}`);
  }

  log.hr();
}

// ─────────────────────────────────────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────────────────────────────────────
(async () => {
  console.log('\n  SupportIQ — Company Migration Script');
  console.log(`  Mode: ${DRY_RUN ? '🔍 DRY-RUN (no writes)' : '⚙️  APPLY'}`);
  if (EXISTING_COMPANY_ID) {
    console.log(`  Explicit company ID: ${EXISTING_COMPANY_ID}`);
  }

  if (!DRY_RUN && !CONFIRM) {
    log.error('--apply requires --confirm to prevent accidental execution.');
    log.error('Run: node migrate-to-company.js --apply --confirm [--existing-company-id=<id>]');
    process.exit(1);
  }
  log.hr();

  try {
    process.stdout.write('  Connecting to MongoDB… ');
    await connect();
    console.log('connected.\n');

    const report = {};
    log.info('Running pre-migration validation…');
    const issues = await validate(report);

    // Validate --existing-company-id before checking general issues so its
    // specific error message appears first if the ID is bad.
    if (EXISTING_COMPANY_ID) {
      const idIssue = await validateExplicitCompanyId(EXISTING_COMPANY_ID, report);
      if (idIssue) issues.unshift(idIssue);
    }

    if (issues.length > 0) {
      log.hr();
      log.error('Validation failed. Aborting — NO changes have been written.\n');
      issues.forEach(issue => log.error(`  ${issue}`));
      log.hr();
      await mongoose.disconnect();
      process.exit(3);
    }

    log.ok('Validation passed.');

    const plan = await buildPlan(report);

    // ── Ambiguity abort ──────────────────────────────────────────────────────
    if (plan.ambiguous) {
      log.hr();
      log.error('AMBIGUOUS TARGET — cannot identify the correct workspace.\n');
      log.error(
        `  The database contains ${plan.existingMembershipsCount} membership record(s),`
      );
      log.error(
        '  but no company can be identified via the demo slug or stamped records.'
      );
      log.error('');
      log.error(
        '  This typically means a workspace was created via the UI before the'
      );
      log.error('  migration ran.  The migration must NOT guess the target company.');
      log.error('');
      log.error('  ACTION REQUIRED:');
      log.error('    1. Find the correct Company _id in the Atlas Data Explorer.');
      log.error('    2. Re-run the dry-run with the explicit company ID:');
      log.error('');
      log.error(
        '       MIGRATION_ALLOW_PRODUCTION=yes-i-know-what-i-am-doing \\'
      );
      log.error(
        '         node migrate-to-company.js --dry-run --verbose \\'
      );
      log.error('         --existing-company-id=<ObjectId>');
      log.error('');
      log.error('    3. Confirm the dry-run shows REUSE with the correct company.');
      log.error('    4. Then run with --apply --confirm --existing-company-id=<ObjectId>.');
      log.hr();
      await mongoose.disconnect();
      process.exit(5);
    }

    // ── Nothing to do? ───────────────────────────────────────────────────────
    const nothingToDo =
      plan.companyAlreadyExists &&
      plan.membershipsToCreate.length === 0 &&
      plan.ticketsToStamp.length      === 0 &&
      plan.messagesToStamp.length     === 0 &&
      plan.activitiesToStamp.length   === 0;

    if (nothingToDo) {
      log.ok('Migration is already complete. Nothing to do.');
      printReport(report, plan, DRY_RUN ? 'dry-run' : 'apply');
      await mongoose.disconnect();
      process.exit(0);
    }

    // ── Dry-run or Apply ──────────────────────────────────────────────────────
    if (DRY_RUN) {
      printReport(report, plan, 'dry-run');
      log.info('This was a dry-run. Use --apply --confirm to write changes.');
    } else {
      log.info('\nApplying migration…\n');
      await applyMigration(plan, report);
      printReport(report, plan, 'apply');
      log.ok('Migration complete.');
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    log.error('Migration failed:', err.message);
    if (VERBOSE) log.error(err.stack);
    try { await mongoose.disconnect(); } catch (_) { /* ignore */ }
    process.exit(1);
  }
})();
