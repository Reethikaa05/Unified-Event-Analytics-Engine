const redis = require('redis');
const logger = require('../utils/logger');

let redisClient;

const connectRedis = async () => {
  try {
    redisClient = redis.createClient({
      url: process.env.REDIS_URL || 'redis://default:bW3mToCwJiD9fEH2zfMZjYu8Rghq1c1g@redis-11231.c239.us-east-1-2.ec2.cloud.redislabs.com:11231',
      socket: {
        connectTimeout: 60000,
        lazyConnect: true,
      }
    });

    redisClient.on('error', (err) => {
      logger.error('❌ Redis Client Error:', err);
    });

    redisClient.on('connect', () => {
      logger.info('✅ Redis Client Connected');
    });

    redisClient.on('ready', () => {
      logger.info('✅ Redis Client Ready');
    });

    redisClient.on('end', () => {
      logger.warn('⚠️ Redis Client Disconnected');
    });

    await redisClient.connect();

  } catch (error) {
    logger.error('❌ Redis connection failed:', error);
    process.exit(1);
  }
};

const getRedisClient = () => {
  if (!redisClient) {
    throw new Error('Redis client not initialized');
  }
  return redisClient;
};

module.exports = { connectRedis, getRedisClient };