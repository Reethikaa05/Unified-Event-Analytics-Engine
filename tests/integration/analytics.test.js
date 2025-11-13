const request = require('supertest');
const app = require('../../src/app');
const Application = require('../../src/models/Application');
const Event = require('../../src/models/Event');
const { getRedisClient } = require('../../src/config/redis');

describe('Analytics Engine API Integration Tests', () => {
  let testApp;
  let apiKey;

  beforeAll(async () => {
    // Clear test data
    await Application.deleteMany({});
    await Event.deleteMany({});
    
    // Clear Redis cache
    const redisClient = getRedisClient();
    await redisClient.flushAll();
  });

  afterAll(async () => {
    // Close connections
    const redisClient = getRedisClient();
    await redisClient.quit();
  });

  describe('Application Registration', () => {
    it('should register a new application and return API key', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Test Analytics App',
          domain: 'https://testapp.com',
          type: 'web',
          createdBy: 'test-user-123'
        })
        .expect(201);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('application');
      expect(response.body.application).toHaveProperty('apiKey');
      expect(response.body.application.name).toBe('Test Analytics App');
      
      testApp = response.body.application;
      apiKey = response.body.application.apiKey;
    });

    it('should reject registration with invalid data', async () => {
      await request(app)
        .post('/api/auth/register')
        .send({
          name: '',
          domain: 'invalid-url',
          type: 'invalid-type',
          createdBy: ''
        })
        .expect(400);
    });
  });

  describe('Event Collection', () => {
    it('should collect analytics event with valid API key', async () => {
      const response = await request(app)
        .post('/api/analytics/collect')
        .set('x-api-key', apiKey)
        .send({
          event: 'button_click',
          url: 'https://testapp.com/home',
          userId: 'user-123',
          sessionId: 'session-456',
          device: 'desktop'
        })
        .expect(201);

      expect(response.body).toHaveProperty('eventId');
      expect(response.body).toHaveProperty('timestamp');
    });

    it('should reject event collection without API key', async () => {
      await request(app)
        .post('/api/analytics/collect')
        .send({
          event: 'button_click',
          url: 'https://testapp.com/home'
        })
        .expect(401);
    });

    it('should reject event collection with invalid API key', async () => {
      await request(app)
        .post('/api/analytics/collect')
        .set('x-api-key', 'invalid-key')
        .send({
          event: 'button_click',
          url: 'https://testapp.com/home'
        })
        .expect(401);
    });
  });

  describe('Analytics Endpoints', () => {
    it('should get event summary', async () => {
      const response = await request(app)
        .get('/api/analytics/event-summary?event=button_click')
        .set('x-api-key', apiKey)
        .expect(200);

      expect(response.body).toHaveProperty('event', 'button_click');
      expect(response.body).toHaveProperty('count');
      expect(response.body).toHaveProperty('uniqueUsers');
      expect(response.body).toHaveProperty('deviceData');
      expect(response.body.deviceData).toHaveProperty('mobile');
      expect(response.body.deviceData).toHaveProperty('desktop');
      expect(response.body.deviceData).toHaveProperty('tablet');
    });

    it('should get user statistics', async () => {
      const response = await request(app)
        .get('/api/analytics/user-stats?userId=user-123')
        .set('x-api-key', apiKey)
        .expect(200);

      expect(response.body).toHaveProperty('userId', 'user-123');
      expect(response.body).toHaveProperty('totalEvents');
      expect(response.body).toHaveProperty('deviceDetails');
      expect(response.body).toHaveProperty('recentEvents');
    });

    it('should reject analytics requests without API key', async () => {
      await request(app)
        .get('/api/analytics/event-summary?event=button_click')
        .expect(401);
    });
  });

  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'OK');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
    });
  });
});