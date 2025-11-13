🚀 Unified Event Analytics Engine

A scalable backend API for collecting and analyzing website and mobile app analytics events. Built with Node.js, Express, MongoDB, Redis, and Docker.

📋 Table of Contents

Features

Quick Start

Installation

API Usage

Architecture

Challenges & Solutions

Deployment

🚀 Features
Core Features
API Key Management - Secure registration, authentication, and revocation

Event Data Collection - High-volume event ingestion with data integrity

Analytics & Reporting - Time-based, event-based, and user-based aggregations

Real-time Processing - Redis caching for performance optimization

Rate Limiting - Abuse prevention for data submission and retrieval

Technical Features
RESTful API - Well-structured endpoints with proper HTTP status codes

Data Validation - Comprehensive input validation and error handling

Security - API key authentication, CORS, and security headers

Documentation - Complete Swagger/OpenAPI documentation

Testing - Comprehensive unit and integration tests

Containerization - Docker support for easy deployment

🛠️ Installation
Prerequisites
Node.js 18+

MongoDB (Local or Atlas)

Redis (Local or Cloud)

Docker 

Method 1: Docker 

# 1. Clone the repository
git clone https://github.com/Reethikaa05/Unified-Event-Analytics-Engine.git
cd analytics-engine

# 2. Create environment file
cp .env.example .env

# 3. Update .env with your credentials
# Edit MONGODB_URI and REDIS_URL in .env file

# 4. Start all services
docker-compose up -d

# 5. Verify services are running
docker-compose ps

# 6. Access the application
# API: http://localhost:3000
# Documentation: http://localhost:3000/api-docs
# Health Check: http://localhost:3000/health

Method 2: Local Development

# 1. Clone the repository
git clone https://github.com/Reethikaa05/Unified-Event-Analytics-Engine.git
cd analytics-engine

# 2. Install dependencies
npm install

# 3. Setup environment
cp .env.example .env

# 4. Update .env with your database credentials

# 5. Start MongoDB & Redis
# On Windows:
redis-server --service-start
mongod --dbpath="C:\data\db"

# On macOS:
brew services start redis
brew services start mongodb-community

# On Ubuntu:
sudo systemctl start redis-server
sudo systemctl start mongod

# 6. Start the application
npm run dev
Environment Configuration
Create .env file with the following variables:


# Server Configuration
NODE_ENV=development
PORT=3000
API_BASE_URL=http://localhost:3000

# Database Configuration (Choose one option)

# Option A: Local Development
MONGODB_URI=mongodb://localhost:27017/analytics_engine
REDIS_URL=redis://localhost:6379

# Option B: Cloud Services
MONGODB_URI=mongodb+srv://username:password@cluster.xxx.mongodb.net/analytics_engine?retryWrites=true&w=majority
REDIS_URL=redis://default:password@redis-host:port

# Security
JWT_SECRET=your-super-secret-jwt-key-change-in-production

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Cache Configuration
CACHE_TTL_EVENTS=300
CACHE_TTL_STATS=600

📊 API Usage
1. Register Your Application

Download
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Website",
    "domain": "https://mywebsite.com",
    "type": "web",
    "createdBy": "user-123"
  }'
Save the API key from the response for subsequent requests.

2. Collect Analytics Events

curl -X POST http://localhost:3000/api/events/collect \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "page_view",
    "url": "https://mywebsite.com/home",
    "userId": "user-123",
    "sessionId": "session-456",
    "device": "desktop",
    "referrer": "https://google.com",
    "metadata": {
      "browser": "Chrome",
      "os": "Windows",
      "screenSize": "1920x1080"
    }
  }'
3. Retrieve Analytics Data

# Get event summary
curl -X GET "http://localhost:3000/api/analytics/event-summary?event=page_view" \
  -H "x-api-key: YOUR_API_KEY"

# Get user statistics
curl -X GET "http://localhost:3000/api/analytics/user-stats?userId=user-123" \
  -H "x-api-key: YOUR_API_KEY"

# Get application analytics
curl -X GET "http://localhost:3000/api/analytics/app-analytics" \
  -H "x-api-key: YOUR_API_KEY"
4. Batch Event Collection

curl -X POST http://localhost:3000/api/events/batch \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "events": [
      {
        "event": "click",
        "url": "https://mywebsite.com/button",
        "userId": "user-123"
      },
      {
        "event": "scroll",
        "url": "https://mywebsite.com/page",
        "userId": "user-123"
      }
    ]
  }'


🏗️ Architecture
System Architecture

┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Web/Mobile    │───▶│   Analytics      │───▶│   MongoDB       │
│    Clients      │    │     Engine       │    │   (Primary      │
└─────────────────┘    └──────────────────┘    │    Database)    │
                         │         │           └─────────────────┘
                         │         │
                         │         └─────▶┌─────────────────┐
                         │                 │     Redis       │
                         │                 │   (Caching &    │
                         │                 │   Real-time)    │
                         │                 └─────────────────┘
                         │
                         └─────▶┌─────────────────┐
                                │   API           │
                                │ Documentation   │
                                └─────────────────┘


Database Schema
Applications - Registered apps with API keys and metadata

Events - Analytics events with user, device, and geographic data

Indexes - Optimized for time-based and event-based queries

Technology Stack
Backend: Node.js, Express.js

Database: MongoDB with Mongoose ODM

Cache: Redis for session storage and caching

Authentication: API Key-based authentication

Documentation: Swagger/OpenAPI

Containerization: Docker & Docker Compose

⚡ Implemented Features
✅ API Key Management
Registration: POST /api/auth/register - Create new applications

Retrieval: GET /api/auth/api-key - Get API keys

Revocation: POST /api/auth/revoke - Deactivate API keys

Security: Hashed API keys with bcrypt

✅ Event Collection
Single Events: POST /api/events/collect - Individual event tracking

Batch Processing: POST /api/events/batch - Multiple events in one request

Data Enrichment: Automatic user agent parsing, IP geolocation

Validation: Comprehensive input validation and sanitization

✅ Analytics Endpoints
Event Summary: GET /api/analytics/event-summary - Event statistics

User Statistics: GET /api/analytics/user-stats - User behavior analytics

Application Analytics: GET /api/analytics/app-analytics - Overall app metrics

Real-time Data: GET /api/analytics/real-time - Live activity monitoring

✅ Performance Optimization
Redis Caching: Frequently accessed data with configurable TTL

Database Indexing: Optimized queries for analytics aggregations

Rate Limiting: Protection against API abuse

Connection Pooling: Efficient database connections

✅ Security Features
API Key Authentication: Secure header-based authentication

Input Validation: Express-validator for all endpoints

CORS Protection: Configurable cross-origin resource sharing

Helmet.js: Security headers protection

Rate Limiting: Request throttling per IP address

🎯 Challenges & Solutions
Challenge 1: Database Connection Issues
Problem: MongoDB and Redis connection failures during initial setup
Solution:

Implemented comprehensive connection error handling

Added connection timeouts and retry mechanisms

Provided both local and cloud database options

Created detailed troubleshooting documentation

Challenge 2: Authentication Security
Problem: Secure API key management without exposing secrets
Solution:

Implemented bcrypt hashing for API keys

Used secure header-based authentication (x-api-key)

Added key expiration and revocation features

Implemented proper error messages without information leakage

Challenge 3: Performance with High Volume Data
Problem: Efficient handling of large-scale event data
Solution:

Implemented Redis caching for frequent queries

Added database indexing for optimized aggregations

Designed batch processing for multiple events

Used connection pooling for database efficiency

Challenge 4: Data Validation & Integrity
Problem: Ensuring data quality and preventing invalid submissions
Solution:

Comprehensive Express validator middleware

Automatic data enrichment (user agent parsing, geolocation)

Input sanitization and type checking

Structured error responses with validation details

Challenge 5: Deployment & Environment Setup
Problem: Complex environment configuration across different setups
Solution:

Docker containerization for consistent environments

Detailed environment variable documentation

Multiple deployment options (local, cloud, Docker)

Comprehensive setup scripts and verification steps

🚀 Deployment
Production Deployment

Option 1: Render.com (Recommended)

# 1. Create account at render.com
# 2. Connect GitHub repository
# 3. Create Web Service with:
#    - Build Command: npm install
#    - Start Command: npm start
# 4. Add environment variables in dashboard

Option 2: Railway.app

# 1. Create account at railway.app
# 2. Connect GitHub repository
# 3. Add MongoDB & Redis plugins
# 4. Railway auto-deploys with environment detection

Option 3: Traditional VPS

# 1. Setup Node.js environment
# 2. Install PM2 for process management
pm2 start src/app.js --name "analytics-engine"

# 3. Configure reverse proxy (nginx)
# 4. Setup MongoDB and Redis services
Environment Variables for Production
env
NODE_ENV=production
MONGODB_URI=your_production_mongodb_connection
REDIS_URL=your_production_redis_connection
JWT_SECRET=your_secure_jwt_secret
API_BASE_URL=your_production_domain


🧪 Testing

# Run all tests
npm test

# Run tests with coverage report
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Run specific test suite
npx jest tests/integration/analytics.test.js
📊 Monitoring & Health Checks
Health Endpoint: GET /health - System status monitoring

API Documentation: GET /api-docs - Interactive API documentation

Logging: Comprehensive Winston logger with different levels

Error Tracking: Structured error handling and reporting

🔧 Maintenance
Regular Tasks
Monitor database storage and performance

Review API usage and rate limiting

Update dependencies and security patches

Backup MongoDB data regularly

Monitor Redis memory usage

Troubleshooting
Check application logs for errors

Verify database connections

Monitor system resources

Check API rate limiting metrics

Review cache hit rates

🤝 Contributing
Fork the repository

Create a feature branch: git checkout -b feature/amazing-feature

Commit your changes: git commit -m 'Add amazing feature'

Push to the branch: git push origin feature/amazing-feature

Open a Pull Request

📄 License
This project is licensed under the MIT License - see the LICENSE file for details.

🆘 Support
For support and questions:

Check the API documentation at /api-docs

Review the troubleshooting section above

Check application logs for specific error messages

Create an issue in the GitHub repository