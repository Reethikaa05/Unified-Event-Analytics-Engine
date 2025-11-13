const express = require('express');
const authRoutes = require('./auth');
const analyticsRoutes = require('./analytics');
const eventRoutes = require('./events');
const userRoutes = require('./users');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Authentication
 *     description: Application registration and API key management
 *   - name: Analytics
 *     description: Analytics data and reporting endpoints
 *   - name: Events
 *     description: Event collection and management
 *   - name: Users
 *     description: User management and profiles
 */

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: Health check endpoint
 *     tags: [System]
 *     responses:
 *       200:
 *         description: Service is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "OK"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 uptime:
 *                   type: number
 *                   example: 12345.67
 *                 version:
 *                   type: string
 *                   example: "1.0.0"
 */
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

/**
 * @swagger
 * /api:
 *   get:
 *     summary: API information
 *     tags: [System]
 *     responses:
 *       200:
 *         description: API information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 name:
 *                   type: string
 *                   example: "Unified Analytics Engine API"
 *                 version:
 *                   type: string
 *                   example: "1.0.0"
 *                 description:
 *                   type: string
 *                   example: "Scalable backend API for website and mobile app analytics"
 *                 documentation:
 *                   type: string
 *                   example: "/api-docs"
 *                 endpoints:
 *                   type: object
 *                   properties:
 *                     auth:
 *                       type: string
 *                       example: "/api/auth"
 *                     analytics:
 *                       type: string
 *                       example: "/api/analytics"
 *                     events:
 *                       type: string
 *                       example: "/api/events"
 *                     users:
 *                       type: string
 *                       example: "/api/users"
 */
router.get('/', (req, res) => {
  res.json({
    name: 'Unified Analytics Engine API',
    version: '1.0.0',
    description: 'Scalable backend API for website and mobile app analytics',
    documentation: '/api-docs',
    health: '/api/health',
    endpoints: {
      auth: '/api/auth',
      analytics: '/api/analytics',
      events: '/api/events',
      users: '/api/users'
    },
    timestamp: new Date().toISOString()
  });
});

// Mount route modules
router.use('/auth', authRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/events', eventRoutes);
router.use('/users', userRoutes);

// 404 handler for API routes
router.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    message: `The requested endpoint ${req.originalUrl} does not exist.`,
    availableEndpoints: {
      auth: [
        'POST /api/auth/register',
        'GET /api/auth/api-key',
        'POST /api/auth/revoke',
        'POST /api/auth/regenerate'
      ],
      analytics: [
        'GET /api/analytics/event-summary',
        'GET /api/analytics/user-stats',
        'GET /api/analytics/app-analytics',
        'GET /api/analytics/real-time'
      ],
      events: [
        'POST /api/events/collect',
        'POST /api/events/batch',
        'GET /api/events',
        'GET /api/events/:eventId'
      ]
    }
  });
});

module.exports = router;