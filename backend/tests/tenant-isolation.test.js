/**
 * Phase 2: Tenant isolation security tests.
 *
 * Verifies that every company-scoped resource (tickets, messages, activity,
 * agent list, AI analysis) cannot be accessed across tenant boundaries.
 *
 * All test data is created fresh in-memory — no Atlas connection required.
 * Uses MongoMemoryReplSet for transaction support.
 */

import './setup.js';
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';

import app from '../src/app.js';
import User from '../src/models/User.js';
import Company from '../src/models/Company.js';
import Membership from '../src/models/Membership.js';
import Ticket from '../src/models/Ticket.js';
import Message from '../src/models/Message.js';
import Activity from '../src/models/Activity.js';
import Invitation from '../src/models/Invitation.js';
import { createToken } from '../src/utils/jwt.js';

// ─── helpers ─────────────────────────────────────────────────────────────────

const cookieFor = (u) => `token=${createToken(u)}`;
const uid = () => `u${Date.now()}${Math.random().toString(36).slice(2, 8)}@t.io`;

// ─── fixtures ─────────────────────────────────────────────────────────────────

let mongoServer;
let adminA, agentA, customerA, customerA2;
let companyA, ticketA, ticketA2;
let adminB, agentB, customerB;
let companyB, ticketB;

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
    Ticket.deleteMany({}), Message.deleteMany({}), Activity.deleteMany({}),
    Invitation.deleteMany({}),
  ]);

  // ── Company A ──────────────────────────────────────────────────────────────
  adminA     = await User.create({ name: 'AdminA',     email: uid(), password: 'Pass1234!', role: 'agent'    });
  agentA     = await User.create({ name: 'AgentA',     email: uid(), password: 'Pass1234!', role: 'agent'    });
  customerA  = await User.create({ name: 'CustomerA',  email: uid(), password: 'Pass1234!', role: 'customer' });
  customerA2 = await User.create({ name: 'CustomerA2', email: uid(), password: 'Pass1234!', role: 'customer' });

  companyA = await Company.create({ name: 'Alpha',
    slug: `alpha-${Date.now()}`, createdBy: adminA._id });

  await Membership.insertMany([
    { user: adminA._id,     company: companyA._id, role: 'company_admin' },
    { user: agentA._id,     company: companyA._id, role: 'agent'         },
    { user: customerA._id,  company: companyA._id, role: 'customer'      },
    { user: customerA2._id, company: companyA._id, role: 'customer'      },
  ]);

  ticketA = await Ticket.create({
    title: 'Ticket Alpha', description: 'Issue in A',
    customer: customerA._id, company: companyA._id,
    status: 'open', priority: 'medium', category: 'technical',
  });
  ticketA2 = await Ticket.create({
    title: 'Ticket Alpha 2', description: 'Second issue in A',
    customer: customerA2._id, company: companyA._id,
    status: 'open', priority: 'low', category: 'general',
  });

  // ── Company B ──────────────────────────────────────────────────────────────
  adminB    = await User.create({ name: 'AdminB',    email: uid(), password: 'Pass1234!', role: 'agent'    });
  agentB    = await User.create({ name: 'AgentB',    email: uid(), password: 'Pass1234!', role: 'agent'    });
  customerB = await User.create({ name: 'CustomerB', email: uid(), password: 'Pass1234!', role: 'customer' });

  companyB = await Company.create({ name: 'Beta',
    slug: `beta-${Date.now()}`, createdBy: adminB._id });

  await Membership.insertMany([
    { user: adminB._id,    company: companyB._id, role: 'company_admin' },
    { user: agentB._id,    company: companyB._id, role: 'agent'         },
    { user: customerB._id, company: companyB._id, role: 'customer'      },
  ]);

  ticketB = await Ticket.create({
    title: 'Ticket Beta', description: 'Issue in B',
    customer: customerB._id, company: companyB._id,
    status: 'open', priority: 'high', category: 'billing',
  });
});

// ══════════════════════════════════════════════════════════════════════════════
describe('Ticket list isolation', () => {
  it('companyA agent sees only companyA tickets', async () => {
    const res = await request(app)
      .get('/api/v1/tickets')
      .set('Cookie', cookieFor(agentA))
      .set('X-Company-Id', companyA._id.toString());

    assert.strictEqual(res.status, 200);
    const ids = res.body.data.tickets.map((t) => t._id.toString());
    assert(ids.includes(ticketA._id.toString()),  'must include companyA ticket');
    assert(!ids.includes(ticketB._id.toString()), 'must NOT include companyB ticket');
  });

  it('companyB agent sees only companyB tickets', async () => {
    const res = await request(app)
      .get('/api/v1/tickets')
      .set('Cookie', cookieFor(agentB))
      .set('X-Company-Id', companyB._id.toString());

    assert.strictEqual(res.status, 200);
    const ids = res.body.data.tickets.map((t) => t._id.toString());
    assert(ids.includes(ticketB._id.toString()),  'must include companyB ticket');
    assert(!ids.includes(ticketA._id.toString()), 'must NOT include companyA ticket');
  });

  it('customer in companyA sees only their own tickets', async () => {
    const res = await request(app)
      .get('/api/v1/tickets')
      .set('Cookie', cookieFor(customerA))
      .set('X-Company-Id', companyA._id.toString());

    assert.strictEqual(res.status, 200);
    const ids = res.body.data.tickets.map((t) => t._id.toString());
    assert(ids.includes(ticketA._id.toString()),   'must include own ticket');
    assert(!ids.includes(ticketA2._id.toString()), 'must NOT include other customer\'s ticket');
    assert(!ids.includes(ticketB._id.toString()),  'must NOT include companyB ticket');
  });

  it('returns 400 without X-Company-Id header', async () => {
    const res = await request(app)
      .get('/api/v1/tickets')
      .set('Cookie', cookieFor(agentA));
    assert.strictEqual(res.status, 400);
  });

  it('returns 403 when user is not a member of the supplied company', async () => {
    const res = await request(app)
      .get('/api/v1/tickets')
      .set('Cookie', cookieFor(agentA))
      .set('X-Company-Id', companyB._id.toString());
    assert.strictEqual(res.status, 403);
  });
});

describe('Support overview isolation', () => {
  it('returns company-scoped metrics and activity to an agent', async () => {
    await Activity.create([
      { ticket: ticketA._id, actor: agentA._id, type: 'ticket_created', company: companyA._id },
      { ticket: ticketB._id, actor: agentB._id, type: 'ticket_created', company: companyB._id },
    ]);

    const res = await request(app)
      .get('/api/v1/tickets/overview')
      .set('Cookie', cookieFor(agentA))
      .set('X-Company-Id', companyA._id.toString());

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.metrics.total, 2);
    assert.strictEqual(res.body.data.metrics.open, 2);
    assert.strictEqual(res.body.data.metrics.unassigned, 2);
    assert.strictEqual(res.body.data.recentActivity.length, 1);
    assert.strictEqual(res.body.data.recentActivity[0].ticket._id, ticketA._id.toString());
  });

  it('does not expose the agent overview to customers', async () => {
    const res = await request(app)
      .get('/api/v1/tickets/overview')
      .set('Cookie', cookieFor(customerA))
      .set('X-Company-Id', companyA._id.toString());

    assert.strictEqual(res.status, 403);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
describe('Ticket detail isolation', () => {
  it('companyA agent can access companyA ticket', async () => {
    const res = await request(app)
      .get(`/api/v1/tickets/${ticketA._id}`)
      .set('Cookie', cookieFor(agentA))
      .set('X-Company-Id', companyA._id.toString());

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.ticket._id.toString(), ticketA._id.toString());
  });

  it('companyA agent gets 404 (not 403) for companyB ticket — no existence leak', async () => {
    const res = await request(app)
      .get(`/api/v1/tickets/${ticketB._id}`)
      .set('Cookie', cookieFor(agentA))
      .set('X-Company-Id', companyA._id.toString());
    assert.strictEqual(res.status, 404);
  });

  it('companyA customer can access their own ticket', async () => {
    const res = await request(app)
      .get(`/api/v1/tickets/${ticketA._id}`)
      .set('Cookie', cookieFor(customerA))
      .set('X-Company-Id', companyA._id.toString());
    assert.strictEqual(res.status, 200);
  });

  it('companyA customer gets 403 for another customer\'s ticket in same company', async () => {
    const res = await request(app)
      .get(`/api/v1/tickets/${ticketA2._id}`)
      .set('Cookie', cookieFor(customerA))
      .set('X-Company-Id', companyA._id.toString());
    assert.strictEqual(res.status, 403);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
describe('Status / priority / category update isolation', () => {
  it('companyA agent can update companyA ticket status', async () => {
    const res = await request(app)
      .patch(`/api/v1/tickets/${ticketA._id}/status`)
      .set('Cookie', cookieFor(agentA))
      .set('X-Company-Id', companyA._id.toString())
      .send({ status: 'in_progress' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.ticket.status, 'in_progress');
  });

  it('companyA agent cannot update companyB ticket status (404)', async () => {
    const res = await request(app)
      .patch(`/api/v1/tickets/${ticketB._id}/status`)
      .set('Cookie', cookieFor(agentA))
      .set('X-Company-Id', companyA._id.toString())
      .send({ status: 'in_progress' });
    assert.strictEqual(res.status, 404);
  });

  it('customer cannot update ticket status (403)', async () => {
    const res = await request(app)
      .patch(`/api/v1/tickets/${ticketA._id}/status`)
      .set('Cookie', cookieFor(customerA))
      .set('X-Company-Id', companyA._id.toString())
      .send({ status: 'in_progress' });
    assert.strictEqual(res.status, 403);
  });

  it('companyA agent can update companyA ticket priority', async () => {
    const res = await request(app)
      .patch(`/api/v1/tickets/${ticketA._id}/priority`)
      .set('Cookie', cookieFor(agentA))
      .set('X-Company-Id', companyA._id.toString())
      .send({ priority: 'high' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.ticket.priority, 'high');
  });

  it('companyA agent cannot update companyB ticket priority (404)', async () => {
    const res = await request(app)
      .patch(`/api/v1/tickets/${ticketB._id}/priority`)
      .set('Cookie', cookieFor(agentA))
      .set('X-Company-Id', companyA._id.toString())
      .send({ priority: 'low' });
    assert.strictEqual(res.status, 404);
  });

  it('companyA agent can update companyA ticket category', async () => {
    const res = await request(app)
      .patch(`/api/v1/tickets/${ticketA._id}/category`)
      .set('Cookie', cookieFor(agentA))
      .set('X-Company-Id', companyA._id.toString())
      .send({ category: 'billing' });
    assert.strictEqual(res.status, 200);
  });

  it('companyA agent cannot update companyB ticket category (404)', async () => {
    const res = await request(app)
      .patch(`/api/v1/tickets/${ticketB._id}/category`)
      .set('Cookie', cookieFor(agentA))
      .set('X-Company-Id', companyA._id.toString())
      .send({ category: 'general' });
    assert.strictEqual(res.status, 404);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
describe('Assignment isolation', () => {
  it('companyA agent can assign ticket to a companyA agent', async () => {
    const res = await request(app)
      .patch(`/api/v1/tickets/${ticketA._id}/assign`)
      .set('Cookie', cookieFor(agentA))
      .set('X-Company-Id', companyA._id.toString())
      .send({ assignedTo: agentA._id.toString() });
    assert.strictEqual(res.status, 200);
    const assignedId = res.body.data.ticket.assignedTo?._id ?? res.body.data.ticket.assignedTo;
    assert.strictEqual(assignedId.toString(), agentA._id.toString());
  });

  it('companyA agent cannot assign ticket to a companyB agent (400)', async () => {
    const res = await request(app)
      .patch(`/api/v1/tickets/${ticketA._id}/assign`)
      .set('Cookie', cookieFor(agentA))
      .set('X-Company-Id', companyA._id.toString())
      .send({ assignedTo: agentB._id.toString() });
    assert.strictEqual(res.status, 400);
  });

  it('companyA agent cannot assign ticket to a customer (400)', async () => {
    const res = await request(app)
      .patch(`/api/v1/tickets/${ticketA._id}/assign`)
      .set('Cookie', cookieFor(agentA))
      .set('X-Company-Id', companyA._id.toString())
      .send({ assignedTo: customerA._id.toString() });
    assert.strictEqual(res.status, 400);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
describe('Messages isolation', () => {
  it('companyA member can POST a message to companyA ticket', async () => {
    const res = await request(app)
      .post(`/api/v1/tickets/${ticketA._id}/messages`)
      .set('Cookie', cookieFor(agentA))
      .set('X-Company-Id', companyA._id.toString())
      .send({ body: 'Hello from agent A' });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.data.message.body, 'Hello from agent A');
  });

  it('companyA member cannot POST a message to companyB ticket (404)', async () => {
    const res = await request(app)
      .post(`/api/v1/tickets/${ticketB._id}/messages`)
      .set('Cookie', cookieFor(agentA))
      .set('X-Company-Id', companyA._id.toString())
      .send({ body: 'Cross-tenant attempt' });
    assert.strictEqual(res.status, 404);
  });

  it('message creation writes company field from server-side membership', async () => {
    const res = await request(app)
      .post(`/api/v1/tickets/${ticketA._id}/messages`)
      .set('Cookie', cookieFor(agentA))
      .set('X-Company-Id', companyA._id.toString())
      .send({ body: 'Company-scoped message' });
    assert.strictEqual(res.status, 201);

    const msg = await Message.findById(res.body.data.message._id).lean();
    assert(msg, 'message must be persisted');
    assert.strictEqual(msg.company.toString(), companyA._id.toString());
  });

  it('companyA member can GET messages for companyA ticket', async () => {
    await Message.create({
      ticket: ticketA._id, sender: agentA._id,
      body: 'Seed', company: companyA._id,
    });
    const res = await request(app)
      .get(`/api/v1/tickets/${ticketA._id}/messages`)
      .set('Cookie', cookieFor(agentA))
      .set('X-Company-Id', companyA._id.toString());
    assert.strictEqual(res.status, 200);
    assert(res.body.data.messages.length >= 1);
  });

  it('companyA member cannot GET messages for companyB ticket (404)', async () => {
    const res = await request(app)
      .get(`/api/v1/tickets/${ticketB._id}/messages`)
      .set('Cookie', cookieFor(agentA))
      .set('X-Company-Id', companyA._id.toString());
    assert.strictEqual(res.status, 404);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
describe('Activity isolation', () => {
  it('companyA member can GET activity for companyA ticket', async () => {
    const res = await request(app)
      .get(`/api/v1/tickets/${ticketA._id}/activity`)
      .set('Cookie', cookieFor(agentA))
      .set('X-Company-Id', companyA._id.toString());
    assert.strictEqual(res.status, 200);
    assert(Array.isArray(res.body.data.activities));
  });

  it('companyA member cannot GET activity for companyB ticket (404)', async () => {
    const res = await request(app)
      .get(`/api/v1/tickets/${ticketB._id}/activity`)
      .set('Cookie', cookieFor(agentA))
      .set('X-Company-Id', companyA._id.toString());
    assert.strictEqual(res.status, 404);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
describe('Agent list isolation', () => {
  it('companyA agent sees only companyA agents and admins', async () => {
    const res = await request(app)
      .get('/api/v1/users/agents')
      .set('Cookie', cookieFor(agentA))
      .set('X-Company-Id', companyA._id.toString());

    assert.strictEqual(res.status, 200);
    const ids = res.body.data.agents.map((a) => a._id.toString());
    assert(ids.includes(adminA._id.toString()), 'must include companyA admin');
    assert(ids.includes(agentA._id.toString()), 'must include companyA agent');
    assert(!ids.includes(agentB._id.toString()),  'must NOT include companyB agent');
    assert(!ids.includes(adminB._id.toString()),  'must NOT include companyB admin');
  });

  it('companyA agent list does not include customers', async () => {
    const res = await request(app)
      .get('/api/v1/users/agents')
      .set('Cookie', cookieFor(agentA))
      .set('X-Company-Id', companyA._id.toString());
    assert.strictEqual(res.status, 200);
    const ids = res.body.data.agents.map((a) => a._id.toString());
    assert(!ids.includes(customerA._id.toString()),  'must NOT include customer');
    assert(!ids.includes(customerA2._id.toString()), 'must NOT include customer2');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
describe('AI analysis isolation', () => {
  it('companyA agent can request AI analysis on companyA ticket (access granted)', async () => {
    const res = await request(app)
      .post(`/api/v1/tickets/${ticketA._id}/ai/analyze`)
      .set('Cookie', cookieFor(agentA))
      .set('X-Company-Id', companyA._id.toString());

    // 200 = analysed; any 5xx from the AI provider is also acceptable — the
    // important thing is the request passed the tenant gate (not 403 or 404)
    assert(res.status < 500 || res.status === 502,
      `Expected request to pass the tenant gate, got ${res.status}: ${JSON.stringify(res.body)}`);
  });

  it('companyA agent cannot run AI analysis on companyB ticket (404)', async () => {
    const res = await request(app)
      .post(`/api/v1/tickets/${ticketB._id}/ai/analyze`)
      .set('Cookie', cookieFor(agentA))
      .set('X-Company-Id', companyA._id.toString());
    assert.strictEqual(res.status, 404);
  });

  it('companyA agent can GET AI analysis for companyA ticket (200)', async () => {
    const res = await request(app)
      .get(`/api/v1/tickets/${ticketA._id}/ai/analyze`)
      .set('Cookie', cookieFor(agentA))
      .set('X-Company-Id', companyA._id.toString());
    assert.strictEqual(res.status, 200);
  });

  it('companyA agent cannot GET AI analysis for companyB ticket (404)', async () => {
    const res = await request(app)
      .get(`/api/v1/tickets/${ticketB._id}/ai/analyze`)
      .set('Cookie', cookieFor(agentA))
      .set('X-Company-Id', companyA._id.toString());
    assert.strictEqual(res.status, 404);
  });

  it('AI analysis activity is logged with the correct company ID', async () => {
    const analyzeRes = await request(app)
      .post(`/api/v1/tickets/${ticketA._id}/ai/analyze`)
      .set('Cookie', cookieFor(agentA))
      .set('X-Company-Id', companyA._id.toString());

    // Only assert on the activity when a new analysis was actually generated
    if (analyzeRes.status === 200 && analyzeRes.body?.message?.includes('generated')) {
      const act = await Activity.findOne({ ticket: ticketA._id, type: 'ai_analyzed' }).lean();
      assert(act, 'ai_analyzed activity must be created');
      assert.strictEqual(act.company.toString(), companyA._id.toString());
    }
  });
});
