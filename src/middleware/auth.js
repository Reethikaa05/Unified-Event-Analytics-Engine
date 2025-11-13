const Application = require('../models/Application');
const logger = require('../utils/logger');

const authenticateApiKey = async (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'] || 
                  req.headers['authorization']?.replace('Bearer ', '') ||
                  req.query.apiKey;

    if (!apiKey) {
      logger.warn('Authentication failed: API key missing', {
        ip: req.ip,
        path: req.path
      });
      return res.status(401).json({
        error: 'Authentication required',
        message: 'API key is missing. Please provide a valid API key in the x-api-key header.'
      });
    }

    const application = await Application.findByApiKey(apiKey);
    
    if (!application) {
      logger.warn('Authentication failed: Invalid API key', {
        ip: req.ip,
        path: req.path
      });
      return res.status(401).json({
        error: 'Invalid API key',
        message: 'The provided API key is invalid or expired.'
      });
    }

    if (!application.isActive) {
      logger.warn('Authentication failed: Application inactive', {
        appId: application._id,
        ip: req.ip
      });
      return res.status(401).json({
        error: 'Application inactive',
        message: 'This application has been deactivated.'
      });
    }

    req.application = application;
    logger.info('API key authenticated successfully', {
      appId: application._id,
      name: application.name
    });
    
    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    res.status(500).json({
      error: 'Authentication failed',
      message: 'Internal server error during authentication'
    });
  }
};

module.exports = { authenticateApiKey };