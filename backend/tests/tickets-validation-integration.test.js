/**
 * Regression test: GET /api/v1/tickets query-param validation.
 * Now also verifies that company membership is required (400 without header).
 *
 * Root cause from Phase 1: the frontend was sending limit=200, backend caps at 50.
 */

import './setup.js';
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import app from '../src/app.js';
import User from '../src/models/User.js';
import Company from '../src/models/Company.js';
import Membership from '../src/models/Membership.js';
import { createToken } from '../src/utils/jwt.js';

let mongoServer;
let customer, agent;
let company;

before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

after(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  // Clean slate
  for (const col of Object.values(mongoose.connection.collections)) {
    await col.deleteMany({});
  }

  customer = await User.create({
    name: 'Val Customer', email: 'valcust@test.com', password: 'pass1234', role: 'customer'
  });
  agent = await User.create({
    name: 'Val Agent', email: 'valagent@test.com', password: 'pass1234', role: 'agent'
  });
  company = await Company.create({
    name: 'Val Co', slug: 'val-co', createdBy: agent._id
  });
  await Membership.create({ user: customer._id, company: company._id, role: 'customer' });
  await Membership.create({ user: agent._id,    company: company._id, role: 'agent'    });
});

const cookieFor = (u) => `token=${createToken(u)}`;
const companyHeader = () => company._id.toString();

describe('GET /api/v1/tickets — query-param validation (regression)', () => {

  // ── Membership requirement ────────────────────────────────────────────────
  it('returns 400 without X-Company-Id header', async () => {
    const res = await request(app)
      .get('/api/v1/tickets?limit=10')
      .set('Cookie', cookieFor(customer));
    assert.strictEqual(res.status, 400);
  });

  it('returns 401 without authentication', async () => {
    const res = await request(app)
      .get('/api/v1/tickets?limit=10')
      .set('X-Company-Id', companyHeader());
    assert.strictEqual(res.status, 401);
  });

  // ── The bug: limit > 50 ────────────────────────────────────────────────────
  it('limit=200 returns 400 (was crashing the customer dashboard)', async () => {
    const res = await request(app)
      .get('/api/v1/tickets?limit=200')
      .set('Cookie', cookieFor(customer))
      .set('X-Company-Id', companyHeader());
    assert.strictEqual(res.status, 400, 'limit=200 must be rejected');
    assert.strictEqual(res.body.success, false);
    assert(
      res.body.message?.toLowerCase().includes('validation'),
      `Expected validation message, got: "${res.body.message}"`
    );
  });

  it('limit=51 returns 400', async () => {
    const res = await request(app)
      .get('/api/v1/tickets?limit=51')
      .set('Cookie', cookieFor(customer))
      .set('X-Company-Id', companyHeader());
    assert.strictEqual(res.status, 400);
  });

  // ── Valid limits must pass ─────────────────────────────────────────────────
  it('limit=50 returns 200 (boundary — exactly at cap)', async () => {
    const res = await request(app)
      .get('/api/v1/tickets?limit=50')
      .set('Cookie', cookieFor(customer))
      .set('X-Company-Id', companyHeader());
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
  });

  it('limit=1 returns 200 (used by the fixed stats calls)', async () => {
    const res = await request(app)
      .get('/api/v1/tickets?limit=1')
      .set('Cookie', cookieFor(customer))
      .set('X-Company-Id', companyHeader());
    assert.strictEqual(res.status, 200);
    assert(Array.isArray(res.body.data?.tickets));
    assert(typeof res.body.data?.pagination?.total === 'number');
  });

  it('limit=8 (default page size) returns 200', async () => {
    const res = await request(app)
      .get('/api/v1/tickets?limit=8')
      .set('Cookie', cookieFor(customer))
      .set('X-Company-Id', companyHeader());
    assert.strictEqual(res.status, 200);
  });

  // ── Other validated params ─────────────────────────────────────────────────
  it('page=0 returns 400', async () => {
    const res = await request(app)
      .get('/api/v1/tickets?page=0')
      .set('Cookie', cookieFor(customer))
      .set('X-Company-Id', companyHeader());
    assert.strictEqual(res.status, 400);
  });

  it('page=1 returns 200', async () => {
    const res = await request(app)
      .get('/api/v1/tickets?page=1')
      .set('Cookie', cookieFor(customer))
      .set('X-Company-Id', companyHeader());
    assert.strictEqual(res.status, 200);
  });

  it('status=invalid returns 400', async () => {
    const res = await request(app)
      .get('/api/v1/tickets?status=invalid')
      .set('Cookie', cookieFor(customer))
      .set('X-Company-Id', companyHeader());
    assert.strictEqual(res.status, 400);
  });

  it('status=open returns 200', async () => {
    const res = await request(app)
      .get('/api/v1/tickets?status=open')
      .set('Cookie', cookieFor(customer))
      .set('X-Company-Id', companyHeader());
    assert.strictEqual(res.status, 200);
  });

  it('status=in_progress&limit=1 returns pagination.total (fix pattern)', async () => {
    const res = await request(app)
      .get('/api/v1/tickets?status=in_progress&limit=1')
      .set('Cookie', cookieFor(customer))
      .set('X-Company-Id', companyHeader());
    assert.strictEqual(res.status, 200);
    assert(
      typeof res.body.data?.pagination?.total === 'number',
      'pagination.total must be a number'
    );
  });

  it('priority=urgent&limit=1 returns 200 (agent dashboard fix pattern)', async () => {
    const res = await request(app)
      .get('/api/v1/tickets?priority=urgent&limit=1')
      .set('Cookie', cookieFor(customer))
      .set('X-Company-Id', companyHeader());
    assert.strictEqual(res.status, 200);
  });

  it('agent can also access tickets', async () => {
    const res = await request(app)
      .get('/api/v1/tickets?limit=10')
      .set('Cookie', cookieFor(agent))
      .set('X-Company-Id', companyHeader());
    assert.strictEqual(res.status, 200);
  });
});
