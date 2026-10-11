import './setup.js';
import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';

import app from '../src/app.js';
import User from '../src/models/User.js';

const password = 'Cookie-Test-Password-123!';

const cookieFrom = (response) => {
  const cookie = response.headers['set-cookie']?.find((value) => value.startsWith('token='));
  assert.ok(cookie, 'response should set the token cookie');
  return cookie;
};

const assertCookieOptions = (cookie, { sameSite, secure }) => {
  assert.match(cookie, /;\s*HttpOnly(?:;|$)/i);
  assert.ok(
    cookie.toLowerCase().includes(`samesite=${sameSite.toLowerCase()}`),
    `cookie should use SameSite=${sameSite}`
  );
  if (secure) {
    assert.match(cookie, /;\s*Secure(?:;|$)/i);
  } else {
    assert.doesNotMatch(cookie, /;\s*Secure(?:;|$)/i);
  }
};

const withCookieEnvironment = async (environment, callback) => {
  const previous = {
    nodeEnv: process.env.NODE_ENV,
    cookieSecure: process.env.COOKIE_SECURE,
  };
  process.env.NODE_ENV = environment.nodeEnv;
  process.env.COOKIE_SECURE = environment.cookieSecure;
  try {
    await callback();
  } finally {
    process.env.NODE_ENV = previous.nodeEnv;
    process.env.COOKIE_SECURE = previous.cookieSecure;
  }
};

describe('authentication cookie options', () => {
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
    await User.deleteMany({});
  });

  it('sets production cookie options when logging in', async () => {
    const user = await User.create({
      name: 'Cookie Test',
      email: 'login-production@example.com',
      password,
    });

    await withCookieEnvironment(
      { nodeEnv: 'production', cookieSecure: 'true' },
      async () => {
        const response = await request(app)
          .post('/api/v1/auth/login')
          .send({ email: user.email, password });

        assert.equal(response.status, 200);
        assertCookieOptions(cookieFrom(response), { sameSite: 'None', secure: true });
      }
    );
  });

  it('sets production cookie options when registering', async () => {
    await withCookieEnvironment(
      { nodeEnv: 'production', cookieSecure: 'true' },
      async () => {
        const response = await request(app)
          .post('/api/v1/auth/register')
          .send({
            name: 'Cookie Test',
            email: 'register-production@example.com',
            password,
          });

        assert.equal(response.status, 201);
        assertCookieOptions(cookieFrom(response), { sameSite: 'None', secure: true });
      }
    );
  });

  it('retains lax same-site behavior in development and follows COOKIE_SECURE', async () => {
    const user = await User.create({
      name: 'Cookie Test',
      email: 'login-development@example.com',
      password,
    });

    await withCookieEnvironment(
      { nodeEnv: 'development', cookieSecure: 'false' },
      async () => {
        const response = await request(app)
          .post('/api/v1/auth/login')
          .send({ email: user.email, password });

        assert.equal(response.status, 200);
        assertCookieOptions(cookieFrom(response), { sameSite: 'Lax', secure: false });
      }
    );
  });

  it('clears the production cookie with matching options', async () => {
    await withCookieEnvironment(
      { nodeEnv: 'production', cookieSecure: 'true' },
      async () => {
        const response = await request(app).post('/api/v1/auth/logout');
        const cookie = cookieFrom(response);

        assert.equal(response.status, 200);
        assert.match(cookie, /^token=;/);
        assert.match(cookie, /;\s*Expires=Thu, 01 Jan 1970/i);
        assertCookieOptions(cookie, { sameSite: 'None', secure: true });
      }
    );
  });

  it('clears the development cookie with matching options', async () => {
    await withCookieEnvironment(
      { nodeEnv: 'development', cookieSecure: 'false' },
      async () => {
        const response = await request(app).post('/api/v1/auth/logout');
        const cookie = cookieFrom(response);

        assert.equal(response.status, 200);
        assert.match(cookie, /^token=;/);
        assert.match(cookie, /;\s*Expires=Thu, 01 Jan 1970/i);
        assertCookieOptions(cookie, { sameSite: 'Lax', secure: false });
      }
    );
  });
});
