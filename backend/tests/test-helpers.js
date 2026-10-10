import './setup.js'; // Load environment variables first
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/app.js';
import User from '../src/models/User.js';
import { createToken } from '../src/utils/jwt.js';

/**
 * Create a test environment with in-memory MongoDB
 */
export class TestEnvironment {
  constructor() {
    this.mongoServer = null;
    this.agent = null;
    this.customer = null;
    this.ticket = null;
  }
  
  /**
   * Start the test environment
   */
  async start() {
    this.mongoServer = await MongoMemoryServer.create();
    const uri = this.mongoServer.getUri();
    await mongoose.connect(uri);
    
    // Create test users
    this.customer = await User.create({
      name: 'Test Customer',
      email: 'customer@test.com',
      password: 'password123',
      role: 'customer'
    });
    
    this.agent = await User.create({
      name: 'Test Agent',
      email: 'agent@test.com',
      password: 'password123',
      role: 'agent'
    });
    
    return this;
  }
  
  /**
   * Stop the test environment
   */
  async stop() {
    await mongoose.disconnect();
    if (this.mongoServer) {
      await this.mongoServer.stop();
    }
  }
  
  /**
   * Get authentication cookie for a user
   */
  getAuthCookie(user) {
    const token = createToken(user);
    return `token=${token}`;
  }
  
  /**
   * Create test request helper
   */
  createRequestHelper() {
    const env = this;
    
    return async (method, path, options = {}) => {
      const { body = null, user = null } = options;
      
      // Use supertest for integration tests
      const request = await import('supertest');
      let req = request.default(app)[method.toLowerCase()](path);
      
      // Add authentication cookie if user specified
      if (user) {
        const cookie = env.getAuthCookie(user);
        req = req.set('Cookie', cookie);
      }
      
      // Add body if provided
      if (body) {
        req = req.send(body);
      }
      
      return req;
    };
  }
}

/**
 * Clean up database between tests
 */
export async function cleanupDatabase() {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
}