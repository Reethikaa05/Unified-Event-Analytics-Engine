const express = require('express');
const { body, query, param } = require('express-validator');
const eventController = require('../controllers/eventController');
const { authenticateApiKey } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validation');
const rateLimit = require('express-rate-limit');

const router = express.Router();

// Rate limiting for event collection
const eventRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // limit each IP to 100 events per minute
  message: {
    error: 'Too many events',
    message: 'Please reduce your event collection rate.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

const batchRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // limit each IP to 10 batch requests per minute
  message: {
    error: 'Too many batch requests',
    message: 'Please reduce your batch request rate.'
  }
});

/**
 * @swagger
 * /api/events/collect:
 *   post:
 *     summary: Collect a single analytics event
 *     tags: [Events]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - event
 *               - url
 *             properties:
 *               event:
 *                 type: string
 *                 example: "button_click"
 *               url:
 *                 type: string
 *                 example: "https://example.com/page"
 *               referrer:
 *                 type: string
 *                 example: "https://google.com"
 *               device:
 *                 type: string
 *                 enum: [mobile, desktop, tablet]
 *                 example: "mobile"
 *               userId:
 *                 type: string
 *                 example: "user123"
 *               sessionId:
 *                 type: string
 *                 example: "session456"
 *               ipAddress:
 *                 type: string
 *                 example: "192.168.1.1"
 *               userAgent:
 *                 type: string
 *               metadata:
 *                 type: object
 *               timestamp:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       201:
 *         description: Event collected successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       429:
 *         description: Too many requests
 */
router.post('/collect', [
  authenticateApiKey,
  eventRateLimit,
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
], handleValidationErrors, eventController.collectEvent);

/**
 * @swagger
 * /api/events/batch:
 *   post:
 *     summary: Collect multiple events in batch
 *     tags: [Events]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - events
 *             properties:
 *               events:
 *                 type: array
 *                 maxItems: 100
 *                 items:
 *                   type: object
 *                   required:
 *                     - event
 *                     - url
 *                   properties:
 *                     event:
 *                       type: string
 *                     url:
 *                       type: string
 *                     referrer:
 *                       type: string
 *                     device:
 *                       type: string
 *                       enum: [mobile, desktop, tablet]
 *                     userId:
 *                       type: string
 *                     sessionId:
 *                       type: string
 *                     ipAddress:
 *                       type: string
 *                     userAgent:
 *                       type: string
 *                     metadata:
 *                       type: object
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *     responses:
 *       201:
 *         description: Batch events processed successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       429:
 *         description: Too many requests
 */
router.post('/batch', [
  authenticateApiKey,
  batchRateLimit,
  body('events')
    .isArray({ min: 1, max: 100 })
    .withMessage('Events must be an array with 1-100 items'),
  body('events.*.event')
    .notEmpty()
    .withMessage('Event type is required for all events')
    .isLength({ max: 100 })
    .withMessage('Event type cannot exceed 100 characters')
    .trim(),
  body('events.*.url')
    .isURL()
    .withMessage('Valid URL is required for all events')
    .trim()
], handleValidationErrors, eventController.collectBatchEvents);

/**
 * @swagger
 * /api/events:
 *   get:
 *     summary: Get events with filtering and pagination
 *     tags: [Events]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: event
 *         schema:
 *           type: string
 *         description: Filter by event type
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         description: Filter by user ID
 *       - in: query
 *         name: sessionId
 *         schema:
 *           type: string
 *         description: Filter by session ID
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
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *         description: Number of items per page
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [timestamp, event, device]
 *           default: timestamp
 *         description: Field to sort by
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *     responses:
 *       200:
 *         description: Events retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/', [
  authenticateApiKey,
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('sortBy')
    .optional()
    .isIn(['timestamp', 'event', 'device', 'url'])
    .withMessage('SortBy must be timestamp, event, device, or url'),
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('SortOrder must be asc or desc'),
  query('startDate')
    .optional()
    .isDate()
    .withMessage('Start date must be a valid date'),
  query('endDate')
    .optional()
    .isDate()
    .withMessage('End date must be a valid date')
], handleValidationErrors, eventController.getEvents);

/**
 * @swagger
 * /api/events/{eventId}:
 *   get:
 *     summary: Get a specific event by ID
 *     tags: [Events]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *         description: Event ID
 *     responses:
 *       200:
 *         description: Event retrieved successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Event not found
 */
router.get('/:eventId', [
  authenticateApiKey,
  param('eventId')
    .isMongoId()
    .withMessage('Valid event ID is required')
], handleValidationErrors, eventController.getEventById);

/**
 * @swagger
 * /api/events/{eventId}:
 *   delete:
 *     summary: Delete a specific event
 *     tags: [Events]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *         description: Event ID
 *     responses:
 *       200:
 *         description: Event deleted successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Event not found
 */
router.delete('/:eventId', [
  authenticateApiKey,
  param('eventId')
    .isMongoId()
    .withMessage('Valid event ID is required')
], handleValidationErrors, eventController.deleteEvent);

module.exports = router;