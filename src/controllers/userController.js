const User = require('../models/User');
const Application = require('../models/Application');
const Event = require('../models/Event');
const logger = require('../utils/logger');
const { generateApiResponse } = require('../utils/response');

/**
 * User Controller - Handles user management and profile operations
 */
class UserController {

  /**
   * Get current user profile
   */
  async getUserProfile(req, res, next) {
    try {
      // In a real implementation, you'd get user ID from JWT token
      // For now, we'll use a placeholder - this should be replaced with actual auth
      const userId = req.user?.id || req.application?.createdBy;
      
      if (!userId) {
        return res.status(401).json(generateApiResponse(
          'User not authenticated',
          null,
          401,
          'UNAUTHORIZED'
        ));
      }

      logger.info('Retrieving user profile', { userId });

      const user = await User.findById(userId).select('-__v');

      if (!user) {
        logger.warn('User not found', { userId });
        return res.status(404).json(generateApiResponse(
          'User not found',
          null,
          404,
          'USER_NOT_FOUND'
        ));
      }

      logger.info('User profile retrieved successfully', { userId });

      res.json(generateApiResponse(
        'User profile retrieved successfully',
        { user }
      ));

    } catch (error) {
      logger.error('User profile retrieval failed:', error);
      next(error);
    }
  }

  /**
   * Update user profile
   */
  async updateUserProfile(req, res, next) {
    try {
      const userId = req.user?.id || req.application?.createdBy;
      const { displayName, firstName, lastName, timezone, preferences } = req.body;

      if (!userId) {
        return res.status(401).json(generateApiResponse(
          'User not authenticated',
          null,
          401,
          'UNAUTHORIZED'
        ));
      }

      logger.info('Updating user profile', { userId });

      const updateData = {};
      if (displayName) updateData.displayName = displayName;
      if (firstName) updateData.firstName = firstName;
      if (lastName) updateData.lastName = lastName;
      if (timezone) updateData.timezone = timezone;
      if (preferences) updateData.preferences = { ...preferences };

      const user = await User.findByIdAndUpdate(
        userId,
        updateData,
        { new: true, runValidators: true }
      ).select('-__v');

      if (!user) {
        logger.warn('User not found for update', { userId });
        return res.status(404).json(generateApiResponse(
          'User not found',
          null,
          404,
          'USER_NOT_FOUND'
        ));
      }

      logger.info('User profile updated successfully', { userId });

      res.json(generateApiResponse(
        'Profile updated successfully',
        { user }
      ));

    } catch (error) {
      logger.error('User profile update failed:', error);
      next(error);
    }
  }

  /**
   * Get user dashboard data
   */
  async getUserDashboard(req, res, next) {
    try {
      const userId = req.user?.id || req.application?.createdBy;

      if (!userId) {
        return res.status(401).json(generateApiResponse(
          'User not authenticated',
          null,
          401,
          'UNAUTHORIZED'
        ));
      }

      logger.info('Generating user dashboard', { userId });

      const dashboardData = await User.getUserDashboard(userId);

      logger.info('User dashboard generated successfully', { userId });

      res.json(generateApiResponse(
        'Dashboard data retrieved successfully',
        dashboardData
      ));

    } catch (error) {
      logger.error('User dashboard generation failed:', error);
      next(error);
    }
  }

  /**
   * Get user usage statistics
   */
  async getUserUsage(req, res, next) {
    try {
      const userId = req.user?.id || req.application?.createdBy;

      if (!userId) {
        return res.status(401).json(generateApiResponse(
          'User not authenticated',
          null,
          401,
          'UNAUTHORIZED'
        ));
      }

      logger.info('Retrieving user usage statistics', { userId });

      const user = await User.findById(userId).select('usage subscription');
      
      if (!user) {
        return res.status(404).json(generateApiResponse(
          'User not found',
          null,
          404,
          'USER_NOT_FOUND'
        ));
      }

      // Calculate additional usage metrics
      const applications = await Application.find({ createdBy: userId });
      const appIds = applications.map(app => app._id);

      const eventStats = await Event.aggregate([
        {
          $match: {
            appId: { $in: appIds },
            timestamp: {
              $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) // This month
            }
          }
        },
        {
          $group: {
            _id: null,
            monthlyEvents: { $sum: 1 },
            uniqueUsers: { $addToSet: '$userId' }
          }
        }
      ]);

      const usageData = {
        current: {
          monthlyEvents: user.usage.monthlyEvents,
          monthlyLimit: user.usage.monthlyLimit,
          usagePercentage: (user.usage.monthlyEvents / user.usage.monthlyLimit) * 100,
          totalEvents: user.usage.totalEvents
        },
        applications: applications.length,
        uniqueUsers: eventStats[0]?.uniqueUsers?.length || 0,
        remainingEvents: Math.max(0, user.usage.monthlyLimit - user.usage.monthlyEvents),
        resetDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1) // First day of next month
      };

      logger.info('User usage statistics retrieved', { userId });

      res.json(generateApiResponse(
        'Usage statistics retrieved successfully',
        usageData
      ));

    } catch (error) {
      logger.error('User usage statistics retrieval failed:', error);
      next(error);
    }
  }

  /**
   * Get user subscription information
   */
  async getUserSubscription(req, res, next) {
    try {
      const userId = req.user?.id || req.application?.createdBy;

      if (!userId) {
        return res.status(401).json(generateApiResponse(
          'User not authenticated',
          null,
          401,
          'UNAUTHORIZED'
        ));
      }

      logger.info('Retrieving user subscription', { userId });

      const user = await User.findById(userId).select('subscription');
      
      if (!user) {
        return res.status(404).json(generateApiResponse(
          'User not found',
          null,
          404,
          'USER_NOT_FOUND'
        ));
      }

      const subscriptionData = {
        plan: user.subscription.plan,
        status: user.subscription.status,
        currentPeriodStart: user.subscription.currentPeriodStart,
        currentPeriodEnd: user.subscription.currentPeriodEnd,
        cancelAtPeriodEnd: user.subscription.cancelAtPeriodEnd,
        isActive: user.hasActiveSubscription(),
        features: this.getPlanFeatures(user.subscription.plan)
      };

      logger.info('User subscription retrieved', { userId });

      res.json(generateApiResponse(
        'Subscription information retrieved successfully',
        subscriptionData
      ));

    } catch (error) {
      logger.error('User subscription retrieval failed:', error);
      next(error);
    }
  }

  /**
   * Get features for each plan
   */
  getPlanFeatures(plan) {
    const features = {
      free: {
        monthlyEvents: 10000,
        dataRetention: '30 days',
        realTimeAnalytics: false,
        customEvents: true,
        apiAccess: true,
        support: 'Community'
      },
      starter: {
        monthlyEvents: 50000,
        dataRetention: '90 days',
        realTimeAnalytics: true,
        customEvents: true,
        apiAccess: true,
        support: 'Email'
      },
      professional: {
        monthlyEvents: 250000,
        dataRetention: '1 year',
        realTimeAnalytics: true,
        customEvents: true,
        apiAccess: true,
        support: 'Priority Email'
      },
      enterprise: {
        monthlyEvents: 'Unlimited',
        dataRetention: 'Custom',
        realTimeAnalytics: true,
        customEvents: true,
        apiAccess: true,
        support: 'Dedicated'
      }
    };

    return features[plan] || features.free;
  }
}

module.exports = new UserController();