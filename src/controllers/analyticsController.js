const Event = require('../models/Event');
const { getRedisClient } = require('../config/redis');
const logger = require('../utils/logger');
const { generateApiResponse } = require('../utils/response');

/**
 * Analytics Controller - Handles analytics data processing and reporting
 */
class AnalyticsController {

  /**
   * Get event summary analytics
   */
  async getEventSummary(req, res, next) {
    try {
      const { event, startDate, endDate, app_id } = req.query;
      const appId = app_id || req.application._id;

      logger.info('Generating event summary', {
        appId,
        event,
        startDate,
        endDate
      });

      // Generate cache key
      const cacheKey = `event-summary:${appId}:${event}:${startDate || ''}:${endDate || ''}`;
      const redisClient = getRedisClient();

      // Try to get from cache
      try {
        const cached = await redisClient.get(cacheKey);
        if (cached) {
          logger.debug('Serving event summary from cache', { cacheKey });
          const cachedData = JSON.parse(cached);
          return res.json(generateApiResponse(
            'Event summary retrieved successfully',
            cachedData
          ));
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
        deviceData: { mobile: 0, desktop: 0, tablet: 0 },
        hourlyData: this.generateEmptyHourlyData(),
        dailyData: this.generateEmptyDailyData()
      };

      // Add additional analytics data
      const enhancedResult = await this.enhanceEventSummary(result, appId, event, startDate, endDate);

      // Cache result
      try {
        await redisClient.setEx(
          cacheKey, 
          parseInt(process.env.CACHE_TTL_EVENTS) || 300, 
          JSON.stringify(enhancedResult)
        );
      } catch (cacheError) {
        logger.warn('Cache write failed:', cacheError);
      }

      logger.info('Event summary generated successfully', {
        appId,
        event,
        count: enhancedResult.count,
        uniqueUsers: enhancedResult.uniqueUsers
      });

      res.json(generateApiResponse(
        'Event summary retrieved successfully',
        enhancedResult
      ));

    } catch (error) {
      logger.error('Event summary generation failed:', error);
      next(error);
    }
  }

  /**
   * Get user statistics
   */
  async getUserStats(req, res, next) {
    try {
      const { userId } = req.query;
      const appId = req.application._id;

      logger.info('Generating user stats', { appId, userId });

      // Generate cache key
      const cacheKey = `user-stats:${appId}:${userId}`;
      const redisClient = getRedisClient();

      // Try to get from cache
      try {
        const cached = await redisClient.get(cacheKey);
        if (cached) {
          logger.debug('Serving user stats from cache', { cacheKey });
          const cachedData = JSON.parse(cached);
          return res.json(generateApiResponse(
            'User stats retrieved successfully',
            cachedData
          ));
        }
      } catch (cacheError) {
        logger.warn('Cache read failed, proceeding without cache:', cacheError);
      }

      // Get user stats with enhanced aggregation
      const userStats = await Event.aggregate([
        {
          $match: {
            appId: appId,
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
            uniqueEvents: { $addToSet: '$event' },
            recentEvents: { 
              $push: {
                event: '$event',
                url: '$url',
                timestamp: '$timestamp',
                device: '$device',
                metadata: '$metadata'
              }
            },
            deviceDetails: { $first: '$metadata' },
            ipAddress: { $first: '$ipAddress' },
            firstSeen: { $min: '$timestamp' },
            lastSeen: { $max: '$timestamp' },
            sessions: { $addToSet: '$sessionId' },
            mostUsedDevice: { 
              $push: {
                device: '$device',
                count: 1
              }
            }
          }
        },
        {
          $project: {
            userId: '$_id',
            totalEvents: 1,
            uniqueEventCount: { $size: '$uniqueEvents' },
            uniqueEvents: 1,
            deviceDetails: {
              browser: '$deviceDetails.browser',
              os: '$deviceDetails.os',
              screenSize: '$deviceDetails.screenSize',
              country: '$deviceDetails.country',
              city: '$deviceDetails.city',
              language: '$deviceDetails.language'
            },
            ipAddress: 1,
            firstSeen: 1,
            lastSeen: 1,
            sessionCount: { $size: '$sessions' },
            mostUsedDevice: {
              $arrayElemAt: [
                {
                  $map: {
                    input: {
                      $slice: [
                        {
                          $sortArray: {
                            input: '$mostUsedDevice',
                            sortBy: { count: -1 }
                          }
                        },
                        1
                      ]
                    },
                    as: 'device',
                    in: '$$device.device'
                  }
                },
                0
              ]
            },
            recentEvents: {
              $slice: ['$recentEvents', 10]
            }
          }
        }
      ]);

      const result = userStats[0] || {
        userId,
        totalEvents: 0,
        uniqueEventCount: 0,
        uniqueEvents: [],
        deviceDetails: {},
        ipAddress: null,
        firstSeen: null,
        lastSeen: null,
        sessionCount: 0,
        mostUsedDevice: null,
        recentEvents: []
      };

      // Add engagement metrics
      const enhancedResult = this.enhanceUserStats(result);

      // Cache result
      try {
        await redisClient.setEx(
          cacheKey, 
          parseInt(process.env.CACHE_TTL_STATS) || 120, 
          JSON.stringify(enhancedResult)
        );
      } catch (cacheError) {
        logger.warn('Cache write failed:', cacheError);
      }

      logger.info('User stats generated successfully', {
        appId,
        userId,
        totalEvents: enhancedResult.totalEvents
      });

      res.json(generateApiResponse(
        'User stats retrieved successfully',
        enhancedResult
      ));

    } catch (error) {
      logger.error('User stats generation failed:', error);
      next(error);
    }
  }

  /**
   * Get overall application analytics
   */
  async getAppAnalytics(req, res, next) {
    try {
      const { startDate, endDate } = req.query;
      const appId = req.application._id;

      logger.info('Generating app analytics', { appId, startDate, endDate });

      const cacheKey = `app-analytics:${appId}:${startDate || ''}:${endDate || ''}`;
      const redisClient = getRedisClient();

      // Try cache first
      try {
        const cached = await redisClient.get(cacheKey);
        if (cached) {
          logger.debug('Serving app analytics from cache', { cacheKey });
          return res.json(generateApiResponse(
            'App analytics retrieved successfully',
            JSON.parse(cached)
          ));
        }
      } catch (cacheError) {
        logger.warn('Cache read failed:', cacheError);
      }

      // Build match query
      const matchQuery = { appId };
      if (startDate || endDate) {
        matchQuery.timestamp = {};
        if (startDate) matchQuery.timestamp.$gte = new Date(startDate);
        if (endDate) matchQuery.timestamp.$lte = new Date(endDate + 'T23:59:59.999Z');
      }

      // Get comprehensive app analytics
      const analytics = await Event.aggregate([
        { $match: matchQuery },
        {
          $facet: {
            // Total metrics
            totals: [
              {
                $group: {
                  _id: null,
                  totalEvents: { $sum: 1 },
                  uniqueUsers: { $addToSet: '$userId' },
                  uniqueSessions: { $addToSet: '$sessionId' },
                  pageViews: {
                    $sum: {
                      $cond: [{ $eq: ['$event', 'page_view'] }, 1, 0]
                    }
                  }
                }
              }
            ],
            // Event breakdown
            events: [
              {
                $group: {
                  _id: '$event',
                  count: { $sum: 1 },
                  uniqueUsers: { $addToSet: '$userId' }
                }
              },
              { $sort: { count: -1 } }
            ],
            // Device breakdown
            devices: [
              {
                $group: {
                  _id: '$device',
                  count: { $sum: 1 }
                }
              }
            ],
            // Geographic data
            geography: [
              {
                $group: {
                  _id: '$metadata.country',
                  count: { $sum: 1 },
                  cities: { $addToSet: '$metadata.city' }
                }
              },
              { $sort: { count: -1 } }
            ],
            // Hourly distribution
            hourly: [
              {
                $group: {
                  _id: { $hour: '$timestamp' },
                  count: { $sum: 1 }
                }
              },
              { $sort: { _id: 1 } }
            ],
            // Recent activity
            recentActivity: [
              { $sort: { timestamp: -1 } },
              { $limit: 20 },
              {
                $project: {
                  event: 1,
                  userId: 1,
                  timestamp: 1,
                  device: 1,
                  url: 1
                }
              }
            ]
          }
        }
      ]);

      const result = this.formatAppAnalytics(analytics[0], startDate, endDate);

      // Cache result
      try {
        await redisClient.setEx(cacheKey, 600, JSON.stringify(result)); // 10 minutes
      } catch (cacheError) {
        logger.warn('Cache write failed:', cacheError);
      }

      logger.info('App analytics generated successfully', {
        appId,
        totalEvents: result.totals.totalEvents
      });

      res.json(generateApiResponse(
        'App analytics retrieved successfully',
        result
      ));

    } catch (error) {
      logger.error('App analytics generation failed:', error);
      next(error);
    }
  }

  /**
   * Get real-time analytics (last 1 hour)
   */
  async getRealTimeAnalytics(req, res, next) {
    try {
      const appId = req.application._id;
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

      logger.info('Generating real-time analytics', { appId });

      const realTimeData = await Event.aggregate([
        {
          $match: {
            appId: appId,
            timestamp: { $gte: oneHourAgo }
          }
        },
        {
          $group: {
            _id: {
              minute: { $minute: '$timestamp' },
              event: '$event'
            },
            count: { $sum: 1 },
            users: { $addToSet: '$userId' }
          }
        },
        {
          $group: {
            _id: '$_id.minute',
            events: {
              $push: {
                event: '$_id.event',
                count: '$count',
                uniqueUsers: { $size: '$users' }
              }
            },
            totalEvents: { $sum: '$count' },
            totalUsers: { $addToSet: '$users' }
          }
        },
        {
          $project: {
            minute: '$_id',
            events: 1,
            totalEvents: 1,
            totalUsers: { $size: '$totalUsers' }
          }
        },
        { $sort: { minute: -1 } },
        { $limit: 60 }
      ]);

      const result = {
        timeframe: 'last_hour',
        startTime: oneHourAgo,
        endTime: new Date(),
        data: realTimeData.reverse(),
        summary: {
          totalEvents: realTimeData.reduce((sum, item) => sum + item.totalEvents, 0),
          totalUsers: realTimeData.reduce((sum, item) => sum + item.totalUsers, 0)
        }
      };

      logger.info('Real-time analytics generated', {
        appId,
        totalEvents: result.summary.totalEvents
      });

      res.json(generateApiResponse(
        'Real-time analytics retrieved successfully',
        result
      ));

    } catch (error) {
      logger.error('Real-time analytics generation failed:', error);
      next(error);
    }
  }

  // Helper Methods

  /**
   * Enhance event summary with additional data
   */
  async enhanceEventSummary(summary, appId, event, startDate, endDate) {
    // Add conversion rate if applicable
    if (event.includes('conversion') || event.includes('purchase')) {
      const totalUsers = await this.getTotalUsers(appId, startDate, endDate);
      summary.conversionRate = totalUsers > 0 ? (summary.uniqueUsers / totalUsers) * 100 : 0;
    }

    // Add trend data
    summary.trend = await this.calculateEventTrend(appId, event, startDate, endDate);

    return summary;
  }

  /**
   * Enhance user stats with engagement metrics
   */
  enhanceUserStats(stats) {
    const now = new Date();
    const firstSeen = new Date(stats.firstSeen);
    const daysSinceFirstSeen = Math.max(1, Math.floor((now - firstSeen) / (1000 * 60 * 60 * 24)));
    
    stats.engagement = {
      eventsPerDay: stats.totalEvents / daysSinceFirstSeen,
      daysActive: daysSinceFirstSeen,
      lastActive: stats.lastSeen
    };

    return stats;
  }

  /**
   * Format app analytics data
   */
  formatAppAnalytics(analytics, startDate, endDate) {
    const totals = analytics.totals[0] || {
      totalEvents: 0,
      uniqueUsers: 0,
      uniqueSessions: 0,
      pageViews: 0
    };

    return {
      timeframe: {
        startDate: startDate || 'all_time',
        endDate: endDate || 'all_time'
      },
      totals: {
        totalEvents: totals.totalEvents,
        uniqueUsers: totals.uniqueUsers?.length || 0,
        uniqueSessions: totals.uniqueSessions?.length || 0,
        pageViews: totals.pageViews
      },
      events: analytics.events,
      devices: analytics.devices,
      geography: analytics.geography,
      hourlyDistribution: analytics.hourly,
      recentActivity: analytics.recentActivity
    };
  }

  /**
   * Generate empty hourly data structure
   */
  generateEmptyHourlyData() {
    const data = {};
    for (let i = 0; i < 24; i++) {
      data[i] = 0;
    }
    return data;
  }

  /**
   * Generate empty daily data structure
   */
  generateEmptyDailyData() {
    const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const data = {};
    days.forEach(day => {
      data[day] = 0;
    });
    return data;
  }

  /**
   * Get total users for conversion rate calculation
   */
  async getTotalUsers(appId, startDate, endDate) {
    const matchQuery = { appId };
    if (startDate || endDate) {
      matchQuery.timestamp = {};
      if (startDate) matchQuery.timestamp.$gte = new Date(startDate);
      if (endDate) matchQuery.timestamp.$lte = new Date(endDate + 'T23:59:59.999Z');
    }

    const result = await Event.aggregate([
      { $match: matchQuery },
      { $group: { _id: '$userId' } },
      { $count: 'totalUsers' }
    ]);

    return result[0]?.totalUsers || 0;
  }

  /**
   * Calculate event trend compared to previous period
   */
  async calculateEventTrend(appId, event, startDate, endDate) {
    if (!startDate || !endDate) {
      return { change: 0, trend: 'stable' };
    }

    const currentStart = new Date(startDate);
    const currentEnd = new Date(endDate);
    const periodMs = currentEnd - currentStart;
    
    const previousStart = new Date(currentStart.getTime() - periodMs);
    const previousEnd = new Date(currentEnd.getTime() - periodMs);

    try {
      const [currentPeriod, previousPeriod] = await Promise.all([
        Event.getEventSummary(appId, event, currentStart.toISOString().split('T')[0], currentEnd.toISOString().split('T')[0]),
        Event.getEventSummary(appId, event, previousStart.toISOString().split('T')[0], previousEnd.toISOString().split('T')[0])
      ]);

      const currentCount = currentPeriod[0]?.count || 0;
      const previousCount = previousPeriod[0]?.count || 0;

      if (previousCount === 0) {
        return currentCount > 0 ? 
          { change: 100, trend: 'up' } : 
          { change: 0, trend: 'stable' };
      }

      const change = ((currentCount - previousCount) / previousCount) * 100;

      return {
        change: Math.round(change * 100) / 100,
        trend: change > 0 ? 'up' : change < 0 ? 'down' : 'stable'
      };

    } catch (error) {
      logger.error('Error calculating event trend:', error);
      return { change: 0, trend: 'unknown' };
    }
  }
}

module.exports = new AnalyticsController();