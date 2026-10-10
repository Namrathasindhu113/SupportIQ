/**
 * Test environment setup
 * This file is imported first by all test files to ensure environment variables are loaded.
 * 
 * Usage: add `import './setup.js';` at the top of every test file before other imports.
 * OR: use a --require flag in package.json test script.
 */

import 'dotenv/config';

// Ensure test mode
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'test';
}

// Ensure JWT_SECRET is available for tests
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'test-secret-for-integration-tests';
}

// Ensure JWT_EXPIRES_IN is available
if (!process.env.JWT_EXPIRES_IN) {
  process.env.JWT_EXPIRES_IN = '7d';
}
