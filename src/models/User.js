const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

/**
 * User Model - For extended user management if needed beyond Google Auth
 * This can be used for admin users, team members, or enhanced user profiles
 */
const userSchema = new mongoose.Schema({
  // Google OAuth2 profile information
  googleId: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email']
  },
  displayName: {
    type: String,
    required: [true, 'Display name is required'],
    trim: true,
    maxlength: [100, 'Display name cannot exceed 100 characters']
  },
  firstName: {
    type: String,
    trim: true,
    maxlength: [50, 'First name cannot exceed 50 characters']
  },
  lastName: {
    type: String,
    trim: true,
    maxlength: [50, 'Last name cannot exceed 50 characters']
  },
  profilePicture: {
    type: String,
    trim: true
  },

  // Local authentication (if needed)
  password: {
    type: String,
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },

  // User role and permissions
  role: {
    type: String,
    enum: {
      values: ['user', 'admin', 'super_admin'],
      message: 'Role must be user, admin, or super_admin'
    },
    default: 'user'
  },

  // Account status
  isActive: {
    type: Boolean,
    default: true
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  emailVerified: {
    type: Boolean,
    default: false
  },

  // Subscription and billing information
  subscription: {
    plan: {
      type: String,
      enum: ['free', 'starter', 'professional', 'enterprise'],
      default: 'free'
    },
    status: {
      type: String,
      enum: ['active', 'canceled', 'past_due', 'unpaid'],
      default: 'active'
    },
    currentPeriodStart: Date,
    currentPeriodEnd: Date,
    cancelAtPeriodEnd: {
      type: Boolean,
      default: false
    }
  },

  // Usage limits and tracking
  usage: {
    monthlyEvents: {
      type: Number,
      default: 0
    },
    monthlyLimit: {
      type: Number,
      default: 10000 // Free tier limit
    },
    lastReset: {
      type: Date,
      default: Date.now
    },
    totalEvents: {
      type: Number,
      default: 0
    }
  },

  // User preferences
  preferences: {
    timezone: {
      type: String,
      default: 'UTC'
    },
    dateFormat: {
      type: String,
      default: 'MM/DD/YYYY'
    },
    timeFormat: {
      type: String,
      enum: ['12h', '24h'],
      default: '12h'
    },
    emailNotifications: {
      type: Boolean,
      default: true
    },
    weeklyReports: {
      type: Boolean,
      default: true
    }
  },

  // Security and access
  lastLogin: Date,
  loginCount: {
    type: Number,
    default: 0
  },
  failedLoginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: Date,

  // Metadata
  timezone: String,
  locale: String,
  ipAddress: String,

  // Team management (if needed)
  team: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team'
  },
  invitedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }

}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      delete ret.password;
      return ret;
    }
  }
});

// Indexes for better query performance
userSchema.index({ email: 1 });
userSchema.index({ googleId: 1 });
userSchema.index({ role: 1 });
userSchema.index({ 'subscription.plan': 1 });
userSchema.index({ 'subscription.status': 1 });
userSchema.index({ createdAt: -1 });

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  if (this.firstName && this.lastName) {
    return `${this.firstName} ${this.lastName}`;
  }
  return this.displayName;
});

// Virtual for checking if account is locked
userSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Password hashing middleware (if using local auth)
userSchema.pre('save', async function(next) {
  // Only run if password was modified
  if (!this.isModified('password')) return next();
  
  // Hash password with cost of 12
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Instance method to check password (if using local auth)
userSchema.methods.correctPassword = async function(candidatePassword, userPassword) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

// Instance method to check if user can perform action
userSchema.methods.can = function(action) {
  const permissions = {
    user: ['read_own_data', 'create_events', 'read_analytics'],
    admin: ['read_own_data', 'create_events', 'read_analytics', 'manage_team', 'read_team_data'],
    super_admin: ['read_own_data', 'create_events', 'read_analytics', 'manage_team', 'read_team_data', 'manage_users', 'system_config']
  };

  return permissions[this.role]?.includes(action) || false;
};

// Instance method to check subscription status
userSchema.methods.hasActiveSubscription = function() {
  return this.subscription.status === 'active' && 
         (!this.subscription.currentPeriodEnd || 
          this.subscription.currentPeriodEnd > new Date());
};

// Instance method to check usage limits
userSchema.methods.hasReachedLimit = function() {
  // Reset monthly usage if it's a new month
  const now = new Date();
  const lastReset = new Date(this.usage.lastReset);
  const isNewMonth = now.getMonth() !== lastReset.getMonth() || 
                     now.getFullYear() !== lastReset.getFullYear();

  if (isNewMonth) {
    this.usage.monthlyEvents = 0;
    this.usage.lastReset = now;
    return false;
  }

  return this.usage.monthlyEvents >= this.usage.monthlyLimit;
};

// Instance method to increment usage
userSchema.methods.incrementUsage = async function(count = 1) {
  this.usage.monthlyEvents += count;
  this.usage.totalEvents += count;
  await this.save();
};

// Static method to find or create user from Google profile
userSchema.statics.findOrCreate = async function(profile) {
  let user = await this.findOne({ googleId: profile.id });
  
  if (!user) {
    // Try to find by email as fallback
    user = await this.findOne({ email: profile.emails[0].value });
    
    if (user) {
      // Link Google account to existing user
      user.googleId = profile.id;
      await user.save();
    } else {
      // Create new user
      user = await this.create({
        googleId: profile.id,
        email: profile.emails[0].value,
        displayName: profile.displayName,
        firstName: profile.name?.givenName,
        lastName: profile.name?.familyName,
        profilePicture: profile.photos?.[0]?.value,
        isVerified: true,
        emailVerified: true
      });
    }
  }
  
  return user;
};

// Static method to get dashboard statistics for user
userSchema.statics.getUserDashboard = async function(userId) {
  const User = this;
  const Application = mongoose.model('Application');
  const Event = mongoose.model('Event');
  
  const [user, applications, recentEvents, usageStats] = await Promise.all([
    User.findById(userId).select('usage subscription preferences'),
    Application.find({ createdBy: userId }).select('name domain type isActive createdAt').sort({ createdAt: -1 }).limit(5),
    Event.aggregate([
      { $match: { appId: { $in: await Application.find({ createdBy: userId }).distinct('_id') } } },
      { $sort: { timestamp: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'applications',
          localField: 'appId',
          foreignField: '_id',
          as: 'application'
        }
      },
      {
        $project: {
          event: 1,
          url: 1,
          timestamp: 1,
          device: 1,
          'application.name': 1
        }
      }
    ]),
    Event.aggregate([
      { $match: { appId: { $in: await Application.find({ createdBy: userId }).distinct('_id') } } },
      {
        $group: {
          _id: null,
          totalEvents: { $sum: 1 },
          todayEvents: {
            $sum: {
              $cond: [
                { $gte: ['$timestamp', new Date(new Date().setHours(0, 0, 0, 0))] },
                1,
                0
              ]
            }
          },
          uniqueUsers: { $addToSet: '$userId' }
        }
      }
    ])
  ]);

  return {
    user: {
      usage: user.usage,
      subscription: user.subscription,
      preferences: user.preferences
    },
    applications,
    recentEvents,
    stats: {
      totalEvents: usageStats[0]?.totalEvents || 0,
      todayEvents: usageStats[0]?.todayEvents || 0,
      uniqueUsers: usageStats[0]?.uniqueUsers?.length || 0,
      applicationCount: applications.length
    }
  };
};

// Method to send welcome email
userSchema.methods.sendWelcomeEmail = async function() {
  // This would integrate with your email service
  // For now, we'll just log it
  console.log(`Welcome email sent to ${this.email}`);
};

// Method to reset failed login attempts
userSchema.methods.resetLoginAttempts = async function() {
  this.failedLoginAttempts = 0;
  this.lockUntil = undefined;
  await this.save();
};

// Method to increment failed login attempts
userSchema.methods.incrementLoginAttempts = async function() {
  this.failedLoginAttempts += 1;
  
  // Lock account after 5 failed attempts for 30 minutes
  if (this.failedLoginAttempts >= 5) {
    this.lockUntil = Date.now() + 30 * 60 * 1000; // 30 minutes
  }
  
  await this.save();
};

module.exports = mongoose.model('User', userSchema);