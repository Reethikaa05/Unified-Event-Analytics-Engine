const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  appId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Application',
    required: true,
    index: true
  },
  event: {
    type: String,
    required: [true, 'Event type is required'],
    trim: true,
    maxlength: [100, 'Event type cannot be more than 100 characters'],
    index: true
  },
  userId: {
    type: String,
    index: true,
    sparse: true
  },
  sessionId: {
    type: String,
    index: true,
    sparse: true
  },
  url: {
    type: String,
    required: [true, 'URL is required'],
    trim: true
  },
  referrer: {
    type: String,
    trim: true
  },
  device: {
    type: String,
    enum: {
      values: ['mobile', 'desktop', 'tablet'],
      message: 'Device must be mobile, desktop, or tablet'
    },
    required: true
  },
  ipAddress: {
    type: String,
    required: true
  },
  userAgent: {
    type: String
  },
  metadata: {
    browser: String,
    os: String,
    screenSize: String,
    country: String,
    city: String,
    language: String,
    timezone: String,
    platform: String
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  }
});

// Compound indexes for better query performance
eventSchema.index({ appId: 1, event: 1, timestamp: -1 });
eventSchema.index({ appId: 1, userId: 1, timestamp: -1 });
eventSchema.index({ appId: 1, sessionId: 1, timestamp: -1 });
eventSchema.index({ timestamp: -1 });
eventSchema.index({ appId: 1, timestamp: -1 });

// Static method for event aggregation
eventSchema.statics.getEventSummary = async function(appId, event, startDate, endDate) {
  const matchStage = {
    appId: new mongoose.Types.ObjectId(appId),
    event: event
  };

  if (startDate || endDate) {
    matchStage.timestamp = {};
    if (startDate) matchStage.timestamp.$gte = new Date(startDate);
    if (endDate) matchStage.timestamp.$lte = new Date(endDate + 'T23:59:59.999Z');
  }

  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$event',
        count: { $sum: 1 },
        uniqueUsers: { $addToSet: '$userId' },
        deviceData: { 
          $push: {
            device: '$device',
            userId: '$userId'
          }
        }
      }
    },
    {
      $project: {
        event: '$_id',
        count: 1,
        uniqueUsers: { $size: '$uniqueUsers' },
        deviceData: {
          mobile: {
            $size: {
              $filter: {
                input: '$deviceData',
                as: 'device',
                cond: { $eq: ['$$device.device', 'mobile'] }
              }
            }
          },
          desktop: {
            $size: {
              $filter: {
                input: '$deviceData',
                as: 'device',
                cond: { $eq: ['$$device.device', 'desktop'] }
              }
            }
          },
          tablet: {
            $size: {
              $filter: {
                input: '$deviceData',
                as: 'device',
                cond: { $eq: ['$$device.device', 'tablet'] }
              }
            }
          }
        }
      }
    }
  ]);
};

module.exports = mongoose.model('Event', eventSchema);