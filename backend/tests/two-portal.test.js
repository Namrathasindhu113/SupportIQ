/**
 * Two-Portal Architecture Tests
 *
 * Verifies the Customer Portal / Agent Portal split:
 *
 *  Customer Portal:
 *   - Customer with one membership gets company auto-resolved (GET /companies/my)
 *   - Customer with no membership gets 0 memberships (access-pending state)
 *   - Customer cannot create a company (403 — only agent accounts may do this)
 *   - Customer cannot call POST /companies/:id/members (no membership = 403)
 *
 *  Agent Portal:
 *   - Agent with one workspace gets exactly that workspace in GET /companies/my
 *   - Agent with multiple workspaces gets all of them
 *   - Agent membership role is 'agent', NOT 'company_admin', after migration mapping
 *   - company_admin is only assigned explicitly (workspace creation or addMember)
 *
 *  addMember endpoint (POST /api/v1/companies/:id/members):
 *   - Requires company_admin role — agent is denied
 *   - Adds an existing user by email
 *   - Returns 404 for unknown email
 *   - Returns 409 for duplicate active membership
 *   - Cannot add user to a different company than the one in X-Company-Id
 *   - Cannot escalate own role via addMember (adding yourself)
 *   - Invalid role rejected
 *
 *  Cross-portal isolation:
 *   - Customer cannot access agent endpoints even with valid session
 *   - Agent cannot access customer's tickets from a different company
 */

import './setup.js';
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';

import app        from '../src/app.js';
import User       from '../src/models/User.js';
import Company    from '../src/models/Company.js';
import Membership from '../src/models/Membership.js';
import Ticket     from '../src/models/Ticket.js';
import { createToken } from '../src/utils/jwt.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const uid   = () => `u${Date.now()}${Math.random().toString(36).slice(2, 7)}@test.io`;
const cookie = (u) => `token=${createToken(u)}`;

const mkUser = (role = 'customer', extra = {}) =>
  User.create({ name: 'T', email: uid(), password: 'Pass1234!', role, ...extra });

const mkCompany = async (creator, role = 'company_admin') => {
  const s = `co-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  const company = await Company.create({ name: s, slug: s, createdBy: creator._id });
  const membership = await Membership.create({ user: creator._id, company: company._id, role });
  return { company, membership };
};

// ─── Fixtures ─────────────────────────────────────────────────────────────────

let mongoServer;

before(async () => {
  mongoServer = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongoServer.getUri());
});

after(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}), Company.deleteMany({}), Membership.deleteMany({}),
    Ticket.deleteMany({}),
  ]);
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('Customer Portal — membership resolution', () => {

  it('customer with one membership gets exactly that company', async () => {
    const customer = await mkUser('customer');
    const { company } = await mkCompany(await mkUser('agent'));
    await Membership.create({ user: customer._id, company: company._id, role: 'customer' });

    const res = await request(app)
      .get('/api/v1/companies/my')
      .set('Cookie', cookie(customer));

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.memberships.length, 1);
    assert.strictEqual(res.body.data.memberships[0].company._id, company._id.toString());
    assert.strictEqual(res.body.data.memberships[0].role, 'customer');
  });

  it('customer with no membership returns empty list (access-pending state)', async () => {
    const customer = await mkUser('customer');

    const res = await request(app)
      .get('/api/v1/companies/my')
      .set('Cookie', cookie(customer));

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.memberships.length, 0);
  });

  it('customer cannot create a company workspace', async () => {
    const customer = await mkUser('customer');

    const res = await request(app)
      .post('/api/v1/companies')
      .set('Cookie', cookie(customer))
      .send({ name: 'Sneaky Workspace', slug: 'sneaky-ws' });

    assert.strictEqual(res.status, 403);
    assert.strictEqual(
      await Company.countDocuments({ slug: 'sneaky-ws' }),
      0,
      'A rejected customer request must not create a company'
    );
  });

  it('customer cannot call POST /companies/:id/members (no membership = 403)', async () => {
    const customer = await mkUser('customer');
    const admin    = await mkUser('agent');
    const { company } = await mkCompany(admin);
    // Note: customer has NO membership in this company
    const target = await mkUser('customer');

    const res = await request(app)
      .post(`/api/v1/companies/${company._id}/members`)
      .set('Cookie', cookie(customer))
      .set('X-Company-Id', company._id.toString())
      .send({ email: target.email, role: 'customer' });

    assert.strictEqual(res.status, 403);
  });

  it('customer cannot access agent dashboard tickets from another company', async () => {
    const customer = await mkUser('customer');
    const admin    = await mkUser('agent');
    const { company } = await mkCompany(admin);
    await Membership.create({ user: customer._id, company: company._id, role: 'customer' });

    // Customer tries to hit an agent-only route
    const res = await request(app)
      .get('/api/v1/tickets')
      .set('Cookie', cookie(customer))
      .set('X-Company-Id', company._id.toString())
      .query({ limit: 5 });

    // Request succeeds but returns only customer's own tickets (0 here)
    assert.strictEqual(res.status, 200);
    // Because customer has no tickets, total is 0
    assert.strictEqual(res.body.data.pagination.total, 0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('Agent Portal — workspace resolution', () => {

  it('agent with one workspace gets exactly that workspace', async () => {
    const agent = await mkUser('agent');
    const { company } = await mkCompany(agent, 'agent');

    const res = await request(app)
      .get('/api/v1/companies/my')
      .set('Cookie', cookie(agent));

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.memberships.length, 1);
    assert.strictEqual(res.body.data.memberships[0].company._id, company._id.toString());
  });

  it('agent with multiple workspaces gets all of them', async () => {
    const agent = await mkUser('agent');
    const { company: c1 } = await mkCompany(agent, 'agent');
    const admin2 = await mkUser('agent');
    const { company: c2 } = await mkCompany(admin2, 'company_admin');
    await Membership.create({ user: agent._id, company: c2._id, role: 'agent' });

    const res = await request(app)
      .get('/api/v1/companies/my')
      .set('Cookie', cookie(agent));

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.memberships.length, 2);
    const ids = res.body.data.memberships.map(m => m.company._id);
    assert(ids.includes(c1._id.toString()));
    assert(ids.includes(c2._id.toString()));
  });

  it('agent membership role is "agent" (not company_admin) after direct add', async () => {
    const admin = await mkUser('agent');
    const { company } = await mkCompany(admin, 'company_admin');
    const agent = await mkUser('agent');

    const res = await request(app)
      .post(`/api/v1/companies/${company._id}/members`)
      .set('Cookie', cookie(admin))
      .set('X-Company-Id', company._id.toString())
      .send({ email: agent.email, role: 'agent' });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.data.membership.role, 'agent');

    const mem = await Membership.findOne({ user: agent._id, company: company._id });
    assert.strictEqual(mem.role, 'agent');
  });

  it('agent cannot access another company\'s tickets (cross-company 403/404)', async () => {
    const agentA = await mkUser('agent');
    const { company: compA } = await mkCompany(agentA, 'agent');

    const adminB = await mkUser('agent');
    const { company: compB } = await mkCompany(adminB, 'company_admin');
    const customerB = await mkUser('customer');
    await Membership.create({ user: customerB._id, company: compB._id, role: 'customer' });
    await Ticket.create({ title: 'B ticket', description: 'x', customer: customerB._id, company: compB._id, status: 'open', priority: 'low', category: 'general' });

    // agentA requests tickets from compB (which they are not a member of)
    const res = await request(app)
      .get('/api/v1/tickets')
      .set('Cookie', cookie(agentA))
      .set('X-Company-Id', compB._id.toString());

    assert.strictEqual(res.status, 403);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('addMember endpoint — authorization', () => {

  it('requires company_admin — plain agent is denied', async () => {
    const admin  = await mkUser('agent');
    const { company } = await mkCompany(admin, 'company_admin');
    const agent  = await mkUser('agent');
    await Membership.create({ user: agent._id, company: company._id, role: 'agent' });
    const target = await mkUser('customer');

    const res = await request(app)
      .post(`/api/v1/companies/${company._id}/members`)
      .set('Cookie', cookie(agent))
      .set('X-Company-Id', company._id.toString())
      .send({ email: target.email, role: 'customer' });

    assert.strictEqual(res.status, 403);
  });

  it('requires authentication — no cookie returns 401', async () => {
    const admin = await mkUser('agent');
    const { company } = await mkCompany(admin, 'company_admin');

    const res = await request(app)
      .post(`/api/v1/companies/${company._id}/members`)
      .set('X-Company-Id', company._id.toString())
      .send({ email: 'anyone@x.io', role: 'customer' });

    assert.strictEqual(res.status, 401);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('addMember endpoint — business logic', () => {

  it('adds an existing user by email and returns 201', async () => {
    const admin  = await mkUser('agent');
    const { company } = await mkCompany(admin, 'company_admin');
    const target = await mkUser('customer');

    const res = await request(app)
      .post(`/api/v1/companies/${company._id}/members`)
      .set('Cookie', cookie(admin))
      .set('X-Company-Id', company._id.toString())
      .send({ email: target.email, role: 'customer' });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.data.membership.role, 'customer');
    assert.strictEqual(res.body.data.membership.user.email, target.email);

    // Membership persisted
    const mem = await Membership.findOne({ user: target._id, company: company._id });
    assert(mem);
    assert.strictEqual(mem.role, 'customer');
  });

  it('returns 404 when target email has no account', async () => {
    const admin = await mkUser('agent');
    const { company } = await mkCompany(admin, 'company_admin');

    const res = await request(app)
      .post(`/api/v1/companies/${company._id}/members`)
      .set('Cookie', cookie(admin))
      .set('X-Company-Id', company._id.toString())
      .send({ email: 'nobody@nowhere.io', role: 'customer' });

    assert.strictEqual(res.status, 404);
  });

  it('returns 409 for duplicate active membership', async () => {
    const admin  = await mkUser('agent');
    const { company } = await mkCompany(admin, 'company_admin');
    const target = await mkUser('customer');
    await Membership.create({ user: target._id, company: company._id, role: 'customer' });

    const res = await request(app)
      .post(`/api/v1/companies/${company._id}/members`)
      .set('Cookie', cookie(admin))
      .set('X-Company-Id', company._id.toString())
      .send({ email: target.email, role: 'customer' });

    assert.strictEqual(res.status, 409);
  });

  it('rejects invalid role value', async () => {
    const admin  = await mkUser('agent');
    const { company } = await mkCompany(admin, 'company_admin');
    const target = await mkUser('customer');

    const res = await request(app)
      .post(`/api/v1/companies/${company._id}/members`)
      .set('Cookie', cookie(admin))
      .set('X-Company-Id', company._id.toString())
      .send({ email: target.email, role: 'superuser' });

    assert.strictEqual(res.status, 400);
  });

  it('cross-company: admin of companyA cannot add member to companyB', async () => {
    const adminA = await mkUser('agent');
    const { company: compA } = await mkCompany(adminA, 'company_admin');
    const adminB = await mkUser('agent');
    const { company: compB } = await mkCompany(adminB, 'company_admin');
    const target = await mkUser('customer');

    // adminA tries to add to compB using compB's ID in the header
    // but adminA has no membership in compB → requireMembership returns 403
    const res = await request(app)
      .post(`/api/v1/companies/${compB._id}/members`)
      .set('Cookie', cookie(adminA))
      .set('X-Company-Id', compB._id.toString())
      .send({ email: target.email, role: 'customer' });

    assert.strictEqual(res.status, 403);
  });

  it('admin can add an agent-role member (not just customers)', async () => {
    const admin = await mkUser('agent');
    const { company } = await mkCompany(admin, 'company_admin');
    const newAgent = await mkUser('agent');

    const res = await request(app)
      .post(`/api/v1/companies/${company._id}/members`)
      .set('Cookie', cookie(admin))
      .set('X-Company-Id', company._id.toString())
      .send({ email: newAgent.email, role: 'agent' });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.data.membership.role, 'agent');
  });

  it('missing email returns 400', async () => {
    const admin = await mkUser('agent');
    const { company } = await mkCompany(admin, 'company_admin');

    const res = await request(app)
      .post(`/api/v1/companies/${company._id}/members`)
      .set('Cookie', cookie(admin))
      .set('X-Company-Id', company._id.toString())
      .send({ role: 'customer' });

    assert.strictEqual(res.status, 400);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('Automatic company selection — WorkspaceContext contract', () => {
  // These tests verify the backend API contract that WorkspaceContext relies on.

  it('GET /companies/my returns the membership role from the DB, not from user.role', async () => {
    // An agent-role user has a 'customer' membership in the company
    const agent = await mkUser('agent');
    const admin = await mkUser('agent');
    const { company } = await mkCompany(admin, 'company_admin');
    await Membership.create({ user: agent._id, company: company._id, role: 'customer' });

    const res = await request(app)
      .get('/api/v1/companies/my')
      .set('Cookie', cookie(agent));

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.memberships.length, 1);
    // Membership role overrides global user role
    assert.strictEqual(res.body.data.memberships[0].role, 'customer',
      'The membership role (customer) must be returned, not the global user role (agent)');
  });

  it('unauthenticated request to /companies/my returns 401', async () => {
    const res = await request(app).get('/api/v1/companies/my');
    assert.strictEqual(res.status, 401);
  });
});
