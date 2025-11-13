const express = require('express');
const { body, query } = require('express-validator');
const Application = require('../models/Application');
const { handleValidationErrors } = require('../middleware/validation');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Application:
 *       type: object
 *       required:
 *         - name
 *         - domain
 *         - type
 *         - createdBy
 *       properties:
 *         name:
 *           type: string
 *           example: "My Awesome App"
 *         domain:
 *           type: string
 *           example: "https://myapp.com"
 *         type:
 *           type: string
 *           enum: [web, mobile]
 *           example: "web"
 *         createdBy:
 *           type: string
 *           example: "google-oauth2|123456789"
 *     ApplicationResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *         application:
 *           $ref: '#/components/schemas/Application'
 */

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new application and generate API key
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Application'
 *     responses:
 *       201:
 *         description: Application registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApplicationResponse'
 *       400:
 *         description: Validation error
 *       500:
 *         description: Internal server error
 */
router.post('/register', [
  body('name')
    .notEmpty()
    .withMessage('Application name is required')
    .isLength({ max: 100 })
    .withMessage('Name cannot exceed 100 characters')
    .trim(),
  body('domain')
    .isURL()
    .withMessage('Valid domain URL is required')
    .trim(),
  body('type')
    .isIn(['web', 'mobile'])
    .withMessage('Type must be either web or mobile'),
  body('createdBy')
    .notEmpty()
    .withMessage('User ID is required')
], handleValidationErrors, async (req, res) => {
  try {
    const { name, domain, type, createdBy } = req.body;

    const apiKey = await Application.generateApiKey();
    
    const application = new Application({
      name,
      domain,
      type,
      createdBy,
      apiKey
    });

    await application.save();

    logger.info('New application registered', {
      appId: application._id,
      name: application.name,
      type: application.type
    });

    res.status(201).json({
      message: 'Application registered successfully',
      application: {
        id: application.id,
        name: application.name,
        domain: application.domain,
        type: application.type,
        apiKey: application.apiKey,
        expiresAt: application.expiresAt,
        createdAt: application.createdAt
      }
    });
  } catch (error) {
    logger.error('Application registration failed:', error);
    res.status(500).json({
      error: 'Registration failed',
      message: 'Could not register application. Please try again.'
    });
  }
});

/**
 * @swagger
 * /api/auth/api-key:
 *   get:
 *     summary: Get API key for registered application
 *     tags: [Authentication]
 *     parameters:
 *       - in: query
 *         name: appId
 *         required: true
 *         schema:
 *           type: string
 *         description: Application ID
 *       - in: query
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: Google Auth user ID
 *     responses:
 *       200:
 *         description: API key retrieved successfully
 *       404:
 *         description: Application not found
 */
router.get('/api-key', [
  query('appId')
    .notEmpty()
    .withMessage('Application ID is required'),
  query('userId')
    .notEmpty()
    .withMessage('User ID is required')
], handleValidationErrors, async (req, res) => {
  try {
    const { appId, userId } = req.query;

    const application = await Application.findOne({
      _id: appId,
      createdBy: userId,
      isActive: true
    });

    if (!application) {
      return res.status(404).json({
        error: 'Application not found',
        message: 'No active application found with the provided credentials'
      });
    }

    res.json({
      application: {
        id: application.id,
        name: application.name,
        apiKey: application.apiKey,
        expiresAt: application.expiresAt
      }
    });
  } catch (error) {
    logger.error('API key retrieval failed:', error);
    res.status(500).json({
      error: 'Failed to retrieve API key',
      message: 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /api/auth/revoke:
 *   post:
 *     summary: Revoke API key
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - appId
 *               - userId
 *             properties:
 *               appId:
 *                 type: string
 *               userId:
 *                 type: string
 *     responses:
 *       200:
 *         description: API key revoked successfully
 *       404:
 *         description: Application not found
 */
router.post('/revoke', [
  body('appId')
    .notEmpty()
    .withMessage('Application ID is required'),
  body('userId')
    .notEmpty()
    .withMessage('User ID is required')
], handleValidationErrors, async (req, res) => {
  try {
    const { appId, userId } = req.body;

    const application = await Application.findOneAndUpdate(
      { _id: appId, createdBy: userId },
      { isActive: false },
      { new: true }
    );

    if (!application) {
      return res.status(404).json({
        error: 'Application not found',
        message: 'No application found with the provided credentials'
      });
    }

    logger.info('API key revoked', {
      appId: application._id,
      name: application.name
    });

    res.json({
      message: 'API key revoked successfully',
      application: {
        id: application.id,
        name: application.name,
        isActive: application.isActive
      }
    });
  } catch (error) {
    logger.error('API key revocation failed:', error);
    res.status(500).json({
      error: 'Failed to revoke API key',
      message: 'Internal server error'
    });
  }
});

module.exports = router;