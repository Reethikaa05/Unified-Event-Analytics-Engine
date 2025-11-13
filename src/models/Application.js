const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const applicationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Application name is required'],
    trim: true,
    maxlength: [100, 'Name cannot be more than 100 characters']
  },
  domain: {
    type: String,
    required: [true, 'Domain is required'],
    trim: true,
    validate: {
      validator: function(v) {
        return /^https?:\/\/.+\..+/.test(v);
      },
      message: 'Please provide a valid domain URL'
    }
  },
  type: {
    type: String,
    enum: {
      values: ['web', 'mobile'],
      message: 'Type must be either web or mobile'
    },
    required: true
  },
  apiKey: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  apiKeyHash: {
    type: String,
    required: true,
    select: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: String,
    required: [true, 'User ID is required']
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year default
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      delete ret.apiKeyHash;
      return ret;
    }
  }
});

// Index for better query performance
applicationSchema.index({ createdBy: 1, isActive: 1 });
applicationSchema.index({ expiresAt: 1 });
applicationSchema.index({ apiKey: 1 });

// Generate API Key
applicationSchema.statics.generateApiKey = async function() {
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(Date.now().toString() + Math.random().toString(), salt);
  return Buffer.from(hash).toString('base64')
    .replace(/[^a-zA-Z0-9]/g, '')
    .substring(0, 32)
    .toUpperCase();
};

// Hash API Key before saving
applicationSchema.pre('save', async function(next) {
  if (this.isModified('apiKey') || this.isNew) {
    this.apiKeyHash = await bcrypt.hash(this.apiKey, 12);
  }
  next();
});

// Verify API Key
applicationSchema.methods.verifyApiKey = async function(apiKey) {
  if (!this.apiKeyHash) {
    return false;
  }
  return bcrypt.compare(apiKey, this.apiKeyHash);
};

// Check if API key is expired
applicationSchema.methods.isExpired = function() {
  return this.expiresAt < new Date();
};

// Static method to find application by API key
applicationSchema.statics.findByApiKey = async function(apiKey) {
  const applications = await this.find({ isActive: true }).select('+apiKeyHash');
  
  for (let app of applications) {
    const isValid = await app.verifyApiKey(apiKey);
    if (isValid && !app.isExpired()) {
      return app;
    }
  }
  return null;
};

module.exports = mongoose.model('Application', applicationSchema);