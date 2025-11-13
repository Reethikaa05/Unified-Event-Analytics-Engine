const Application = require('../models/Application');
const logger = require('../utils/logger');
const { generateApiResponse } = require('../utils/response');

/**
 * Auth Controller - Handles application registration and API key management
 */
class AuthController {
  
  /**
   * Register a new application and generate API key
   */
  async registerApplication(req, res, next) {
    try {
      const { name, domain, type, createdBy } = req.body;

      logger.info('Registering new application', { name, domain, type, createdBy });

      // Generate API key
      const apiKey = await Application.generateApiKey();
      
      // Create application
      const application = new Application({
        name,
        domain,
        type,
        createdBy,
        apiKey
      });

      await application.save();

      logger.info('Application registered successfully', {
        appId: application._id,
        name: application.name,
        type: application.type
      });

      res.status(201).json(generateApiResponse(
        'Application registered successfully',
        {
          application: {
            id: application.id,
            name: application.name,
            domain: application.domain,
            type: application.type,
            apiKey: application.apiKey,
            expiresAt: application.expiresAt,
            createdAt: application.createdAt
          }
        },
        201
      ));

    } catch (error) {
      logger.error('Application registration failed:', error);
      next(error);
    }
  }

  /**
   * Get API key for registered application
   */
  async getApiKey(req, res, next) {
    try {
      const { appId, userId } = req.query;

      logger.info('Retrieving API key', { appId, userId });

      const application = await Application.findOne({
        _id: appId,
        createdBy: userId,
        isActive: true
      });

      if (!application) {
        logger.warn('Application not found for API key retrieval', { appId, userId });
        return res.status(404).json(generateApiResponse(
          'Application not found',
          null,
          404,
          'NO_APPLICATION_FOUND'
        ));
      }

      logger.info('API key retrieved successfully', { appId: application._id });

      res.json(generateApiResponse(
        'API key retrieved successfully',
        {
          application: {
            id: application.id,
            name: application.name,
            apiKey: application.apiKey,
            expiresAt: application.expiresAt
          }
        }
      ));

    } catch (error) {
      logger.error('API key retrieval failed:', error);
      next(error);
    }
  }

  /**
   * Revoke API key
   */
  async revokeApiKey(req, res, next) {
    try {
      const { appId, userId } = req.body;

      logger.info('Revoking API key', { appId, userId });

      const application = await Application.findOneAndUpdate(
        { _id: appId, createdBy: userId },
        { isActive: false },
        { new: true }
      );

      if (!application) {
        logger.warn('Application not found for revocation', { appId, userId });
        return res.status(404).json(generateApiResponse(
          'Application not found',
          null,
          404,
          'NO_APPLICATION_FOUND'
        ));
      }

      logger.info('API key revoked successfully', {
        appId: application._id,
        name: application.name
      });

      res.json(generateApiResponse(
        'API key revoked successfully',
        {
          application: {
            id: application.id,
            name: application.name,
            isActive: application.isActive
          }
        }
      ));

    } catch (error) {
      logger.error('API key revocation failed:', error);
      next(error);
    }
  }

  /**
   * Regenerate API key
   */
  async regenerateApiKey(req, res, next) {
    try {
      const { appId, userId } = req.body;

      logger.info('Regenerating API key', { appId, userId });

      const application = await Application.findOne({
        _id: appId,
        createdBy: userId
      });

      if (!application) {
        logger.warn('Application not found for regeneration', { appId, userId });
        return res.status(404).json(generateApiResponse(
          'Application not found',
          null,
          404,
          'NO_APPLICATION_FOUND'
        ));
      }

      // Generate new API key
      const newApiKey = await Application.generateApiKey();
      application.apiKey = newApiKey;
      application.isActive = true;
      application.expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year

      await application.save();

      logger.info('API key regenerated successfully', {
        appId: application._id,
        name: application.name
      });

      res.json(generateApiResponse(
        'API key regenerated successfully',
        {
          application: {
            id: application.id,
            name: application.name,
            apiKey: application.apiKey,
            expiresAt: application.expiresAt,
            isActive: application.isActive
          }
        }
      ));

    } catch (error) {
      logger.error('API key regeneration failed:', error);
      next(error);
    }
  }

  /**
   * Get all applications for a user
   */
  async getUserApplications(req, res, next) {
    try {
      const { userId } = req.params;

      logger.info('Retrieving user applications', { userId });

      const applications = await Application.find({
        createdBy: userId
      }).sort({ createdAt: -1 });

      logger.info('User applications retrieved', {
        userId,
        count: applications.length
      });

      res.json(generateApiResponse(
        'Applications retrieved successfully',
        {
          applications: applications.map(app => ({
            id: app.id,
            name: app.name,
            domain: app.domain,
            type: app.type,
            isActive: app.isActive,
            expiresAt: app.expiresAt,
            createdAt: app.createdAt,
            updatedAt: app.updatedAt
          }))
        }
      ));

    } catch (error) {
      logger.error('Failed to retrieve user applications:', error);
      next(error);
    }
  }

  /**
   * Validate API key (internal use)
   */
  async validateApiKey(apiKey) {
    try {
      const application = await Application.findByApiKey(apiKey);
      
      if (!application) {
        logger.warn('API key validation failed', { apiKey: apiKey.substring(0, 8) + '...' });
        return null;
      }

      logger.debug('API key validated successfully', {
        appId: application._id,
        name: application.name
      });

      return application;

    } catch (error) {
      logger.error('API key validation error:', error);
      return null;
    }
  }
}

module.exports = new AuthController();