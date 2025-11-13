const express = require('express');
const { body, query } = require('express-validator');
const { authenticateApiKey } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validation');
const Event = require('../models/Event');
const { getRedisClient } = require('../config/redis');
const UserAgent = require('user-agents');
const geoip = require('geoip-lite');
const logger = require('../utils/logger');

const router = express.Router();

// Apply API key authentication to all analytics routes
router.use(authenticateApiKey);

/**
 * @swagger
 * components:
 *   schemas:
 *     AnalyticsEvent:
 *       type: object
 *       required:
 *         - event
 *         - url
 *       properties:
 *         event:
 *           type: string
 *           example: "button_click"
 *         url:
 *           type: string
 *           example: "https://example.com/page"
 *         referrer:
 *           type: string
 *           example: "https://google.com"
 *         device:
 *           type: string
 *           enum: [mobile, desktop, tablet]
 *           example: "mobile"
 *         userId:
 *           type: string
 *           example: "user123"
 *         sessionId:
 *           type: string
 *           example: "session456"
 *         ipAddress:
 *           type: string
 *           example: "192.168.1.1"
 *         userAgent:
 *           type: string
 *           example: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
 *         metadata:
 *           type: object
 *           properties:
 *             browser:
 *               type: string
 *             os:
 *               type: string
 *             screenSize:
 *               type: string
 *         timestamp:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/analytics/collect:
 *   post:
 *     summary: Collect analytics event
 *     tags: [Analytics]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AnalyticsEvent'
 *     responses:
 *       201:
 *         description: Event collected successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.post('/collect', [
  body('event')
    .notEmpty()
    .withMessage('Event type is required')
    .isLength({ max: 100 })
    .withMessage('Event type cannot exceed 100 characters')
    .trim(),
  body('url')
    .isURL()
    .withMessage('Valid URL is required')
    .trim(),
  body('device')
    .optional()
    .isIn(['mobile', 'desktop', 'tablet'])
    .withMessage('Device must be mobile, desktop, or tablet'),
  body('userId')
    .optional()
    .trim(),
  body('sessionId')
    .optional()
    .trim(),
  body('ipAddress')
    .optional()
    .isIP()
    .withMessage('Valid IP address is required'),
  body('timestamp')
    .optional()
    .isISO8601()
    .withMessage('Valid ISO 8601 timestamp is required')
], handleValidationErrors, async (req, res) => {
  try {
    const {
      event,
      url,
      referrer,
      device,
      userId,
      sessionId,
      ipAddress = req.ip,
      userAgent = req.get('User-Agent'),
      metadata = {},
      timestamp = new Date()
    } = req.body;

    // Parse user agent for additional metadata
    const userAgentData = new UserAgent(userAgent);
    const geo = geoip.lookup(ipAddress);

    const eventData = {
      appId: req.application._id,
      event,
      url,
      referrer,
      device: device || (userAgentData.deviceCategory === 'mobile' ? 'mobile' : 
                        userAgentData.deviceCategory === 'tablet' ? 'tablet' : 'desktop'),
      userId,
      sessionId,
      ipAddress,
      userAgent,
      metadata: {
        browser: userAgentData.browser.name || metadata.browser,
        os: userAgentData.os.name || metadata.os,
        screenSize: metadata.screenSize,
        country: geo?.country,
        city: geo?.city,
        language: req.get('Accept-Language')?.split(',')[0],
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        platform: userAgentData.platform
      },
      timestamp
    };

    const analyticsEvent = new Event(eventData);
    await analyticsEvent.save();

    // Invalidate relevant cache entries
    const redisClient = getRedisClient();
    const cachePatterns = [
      `event-summary:${req.application._id}:*`,
      `user-stats:${userId || sessionId}:*`,
      `analytics:${req.application._id}:*`
    ];
    
    for (const pattern of cachePatterns) {
      try {
        const keys = await redisClient.keys(pattern);
        if (keys.length > 0) {
          await redisClient.del(keys);
        }
      } catch (cacheError) {
        logger.warn('Cache invalidation failed:', cacheError);
      }
    }

    logger.info('Event collected successfully', {
      appId: req.application._id,
      event: event,
      userId: userId,
      sessionId: sessionId
    });

    res.status(201).json({
      message: 'Event collected successfully',
      eventId: analyticsEvent._id,
      timestamp: analyticsEvent.timestamp
    });
  } catch (error) {
    logger.error('Event collection failed:', error);
    res.status(500).json({
      error: 'Failed to collect event',
      message: 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /api/analytics/event-summary:
 *   get:
 *     summary: Get event summary analytics
 *     tags: [Analytics]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: event
 *         required: true
 *         schema:
 *           type: string
 *         description: Event type to filter by
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for filtering (YYYY-MM-DD)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for filtering (YYYY-MM-DD)
 *       - in: query
 *         name: app_id
 *         schema:
 *           type: string
 *         description: Specific app ID to filter by
 *     responses:
 *       200:
 *         description: Event summary retrieved successfully
 *       400:
 *         description: Validation error
 */
router.get('/event-summary', [
  query('event')
    .notEmpty()
    .withMessage('Event type is required')
    .trim(),
  query('startDate')
    .optional()
    .isDate()
    .withMessage('Start date must be a valid date in YYYY-MM-DD format'),
  query('endDate')
    .optional()
    .isDate()
    .withMessage('End date must be a valid date in YYYY-MM-DD format')
], handleValidationErrors, async (req, res) => {
  try {
    const { event, startDate, endDate, app_id } = req.query;
    const appId = app_id || req.application._id;

    // Generate cache key
    const cacheKey = `event-summary:${appId}:${event}:${startDate || ''}:${endDate || ''}`;
    const redisClient = getRedisClient();

    // Try to get from cache
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        logger.debug('Serving event summary from cache', { cacheKey });
        return res.json(JSON.parse(cached));
      }
    } catch (cacheError) {
      logger.warn('Cache read failed, proceeding without cache:', cacheError);
    }

    // Execute aggregation
    const summary = await Event.getEventSummary(appId, event, startDate, endDate);

    const result = summary[0] || {
      event,
      count: 0,
      uniqueUsers: 0,
      deviceData: { mobile: 0, desktop: 0, tablet: 0 }
    };

    // Cache result for 5 minutes
    try {
      await redisClient.setEx(
        cacheKey, 
        parseInt(process.env.CACHE_TTL_EVENTS) || 300, 
        JSON.stringify(result)
      );
    } catch (cacheError) {
      logger.warn('Cache write failed:', cacheError);
    }

    logger.info('Event summary generated', {
      appId,
      event,
      count: result.count,
      uniqueUsers: result.uniqueUsers
    });

    res.json(result);
  } catch (error) {
    logger.error('Event summary generation failed:', error);
    res.status(500).json({
      error: 'Failed to get event summary',
      message: 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /api/analytics/user-stats:
 *   get:
 *     summary: Get user statistics
 *     tags: [Analytics]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID to get stats for
 *     responses:
 *       200:
 *         description: User stats retrieved successfully
 *       400:
 *         description: Validation error
 */
router.get('/user-stats', [
  query('userId')
    .notEmpty()
    .withMessage('User ID is required')
    .trim()
], handleValidationErrors, async (req, res) => {
  try {
    const { userId } = req.query;
    const appId = req.application._id;

    // Generate cache key
    const cacheKey = `user-stats:${appId}:${userId}`;
    const redisClient = getRedisClient();

    // Try to get from cache
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        logger.debug('Serving user stats from cache', { cacheKey });
        return res.json(JSON.parse(cached));
      }
    } catch (cacheError) {
      logger.warn('Cache read failed, proceeding without cache:', cacheError);
    }

    // Get user stats
    const userStats = await Event.aggregate([
      {
        $match: {
          appId: new require('mongoose').Types.ObjectId(appId),
          userId: userId
        }
      },
      {
        $sort: { timestamp: -1 }
      },
      {
        $group: {
          _id: '$userId',
          totalEvents: { $sum: 1 },
          recentEvents: { 
            $push: {
              event: '$event',
              url: '$url',
              timestamp: '$timestamp',
              device: '$device'
            }
          },
          deviceDetails: { $first: '$metadata' },
          ipAddress: { $first: '$ipAddress' },
          firstSeen: { $min: '$timestamp' },
          lastSeen: { $max: '$timestamp' }
        }
      },
      {
        $project: {
          userId: '$_id',
          totalEvents: 1,
          deviceDetails: {
            browser: '$deviceDetails.browser',
            os: '$deviceDetails.os',
            screenSize: '$deviceDetails.screenSize',
            country: '$deviceDetails.country',
            city: '$deviceDetails.city'
          },
          ipAddress: 1,
          firstSeen: 1,
          lastSeen: 1,
          recentEvents: {
            $slice: ['$recentEvents', 10]
          }
        }
      }
    ]);

    const result = userStats[0] || {
      userId,
      totalEvents: 0,
      deviceDetails: {},
      ipAddress: null,
      firstSeen: null,
      lastSeen: null,
      recentEvents: []
    };

    // Cache result for 2 minutes
    try {
      await redisClient.setEx(
        cacheKey, 
        parseInt(process.env.CACHE_TTL_STATS) || 120, 
        JSON.stringify(result)
      );
    } catch (cacheError) {
      logger.warn('Cache write failed:', cacheError);
    }

    logger.info('User stats generated', {
      appId,
      userId,
      totalEvents: result.totalEvents
    });

    res.json(result);
  } catch (error) {
    logger.error('User stats generation failed:', error);
    res.status(500).json({
      error: 'Failed to get user stats',
      message: 'Internal server error'
    });
  }
});

module.exports = router;