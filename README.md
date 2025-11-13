# 🚀 Unified Event Analytics Engine

A **scalable backend API** for collecting and analyzing website and mobile app analytics events — built using **Node.js, Express, MongoDB, Redis, and Docker**.

---

## 📘 Table of Contents

- [Overview](#overview)
- [Implemented Features](#implemented-features)
- [Installation & Running the Project](#installation--running-the-project)
- [API Usage](#api-usage)
- [Architecture Overview](#architecture-overview)
- [Challenges & Solutions](#challenges--solutions)
- [Deployment](#deployment)
- [Maintenance](#maintenance)
- [Contributing](#contributing)
- [License](#license)
- [Support](#support)

---

## 🌐 Overview

The **Unified Event Analytics Engine** provides a powerful backend system for:
- Securely collecting and analyzing analytics events from multiple platforms.
- Generating insights through real-time processing, caching, and aggregation.
- Enabling developers to integrate analytics with minimal setup and maximum scalability.

---

## ⚡ Implemented Features

### 🧩 Core Features
- **API Key Management** — Secure registration, authentication, and revocation.  
- **Event Data Collection** — High-volume ingestion with data validation.  
- **Analytics & Reporting** — Time-based and user-based aggregations.  
- **Real-Time Processing** — Redis caching for faster data access.  
- **Rate Limiting** — Prevent abuse during event submission and retrieval.

### 🧠 Technical Highlights
- **RESTful API** — Structured endpoints and proper HTTP status codes.  
- **Input Validation** — Using `express-validator` for all inputs.  
- **Security** — CORS, Helmet.js, and secure API key hashing with bcrypt.  
- **Documentation** — Complete Swagger/OpenAPI docs at `/api-docs`.  
- **Testing** — Unit and integration tests with Jest.  
- **Containerization** — Docker for easy deployment.

---

## 🛠️ Installation & Running the Project

### 🔹 Prerequisites
Ensure you have:
- **Node.js** v18+
- **MongoDB** (local or cloud, e.g., MongoDB Atlas)
- **Redis**
- **Docker** (optional for containerized setup)

---

### 🚀 Method 1: Run with Docker

```bash
# 1. Clone the repository
git clone https://github.com/Reethikaa05/Unified-Event-Analytics-Engine.git
cd analytics-engine

# 2. Create environment file
cp .env.example .env

# 3. Update credentials in .env (MongoDB, Redis, JWT)

# 4. Start services
docker-compose up -d

# 5. Verify services
docker-compose ps

# 6. Access:
# API: http://localhost:3000
# Docs: http://localhost:3000/api-docs
# Health: http://localhost:3000/health
```

---

### 🔹 Method 2: Run Locally

```bash
# 1. Clone the repository
git clone https://github.com/Reethikaa05/Unified-Event-Analytics-Engine.git
cd analytics-engine

# 2. Install dependencies
npm install

# 3. Setup environment
cp .env.example .env
# Update with MongoDB and Redis credentials

# 4. Start MongoDB & Redis
# Windows
redis-server --service-start
mongod --dbpath="C:\data\db"

# macOS
brew services start redis
brew services start mongodb-community

# Ubuntu
sudo systemctl start redis-server
sudo systemctl start mongod

# 5. Run the application
npm run dev
```

---

## 📊 API Usage

### 1️⃣ Register Application
```bash
curl -X POST http://localhost:3000/api/auth/register   -H "Content-Type: application/json"   -d '{
    "name": "My Website",
    "domain": "https://mywebsite.com",
    "type": "web",
    "createdBy": "user-123"
  }'
```

### 2️⃣ Collect Analytics Event
```bash
curl -X POST http://localhost:3000/api/events/collect   -H "x-api-key: YOUR_API_KEY"   -H "Content-Type: application/json"   -d '{
    "event": "page_view",
    "url": "https://mywebsite.com/home",
    "userId": "user-123",
    "device": "desktop"
  }'
```

### 3️⃣ Retrieve Analytics
```bash
curl -X GET "http://localhost:3000/api/analytics/event-summary?event=page_view"   -H "x-api-key: YOUR_API_KEY"
```

---

## 🏗️ Architecture Overview

```
┌──────────────┐     ┌─────────────────┐     ┌──────────────┐
│ Web/Mobile   │ ───▶│ Analytics Engine│ ───▶│ MongoDB      │
│ Clients      │     │  (API Server)   │     │ (Database)   │
└──────────────┘     └─────────────────┘     └──────────────┘
         │                      │
         │                      └──▶ Redis (Caching & Real-time)
         │
         └──▶ Swagger UI (/api-docs)
```

**Tech Stack**
- **Backend:** Node.js + Express  
- **Database:** MongoDB (Mongoose)  
- **Cache:** Redis  
- **Authentication:** API Key-based  
- **Docs:** Swagger/OpenAPI  
- **Containerization:** Docker  

---

## 🎯 Challenges & Solutions

| **Challenge** | **Problem** | **Solution** |
|----------------|-------------|--------------|
| Database Connection | MongoDB/Redis failing on startup | Implemented retry & timeout mechanisms; added better error logs. |
| Authentication Security | Protect API keys | Hashed keys using bcrypt and used secure header-based auth. |
| Performance at Scale | Handling millions of events | Added Redis caching, DB indexing, and batch event processing. |
| Data Validation | Prevent invalid event data | Used express-validator with custom sanitization logic. |
| Deployment | Inconsistent environments | Containerized using Docker and documented setup clearly. |

---

## 🚀 Deployment

### ✅ Render (Recommended)
1. Connect repo to [Render.com](https://render.com)  
2. Set build command: `npm install`  
3. Set start command: `npm start`  
4. Add environment variables in dashboard  

### ✅ Railway.app
1. Connect GitHub repo  
2. Add **MongoDB** & **Redis** plugins  
3. Deploy automatically  

### ✅ VPS + PM2
```bash
pm2 start src/app.js --name "analytics-engine"
```

---

## 🔧 Maintenance

### Regular Tasks
- Monitor **database storage** & **performance**
- Review **API usage** and **rate limits**
- Update **dependencies & security patches**
- Regularly **backup MongoDB data**
- Monitor **Redis memory usage**

### Troubleshooting
- Check **logs** for errors (via Winston)
- Verify **database connections**
- Monitor **API rate limits & cache hits**

---

## 🤝 Contributing

1. Fork the repo  
2. Create a new branch  
   ```bash
   git checkout -b feature/your-feature
   ```
3. Commit your changes  
   ```bash
   git commit -m "Add new feature"
   ```
4. Push and create a Pull Request  

---

## 📄 License

This project is licensed under the **MIT License**.  
See the [LICENSE](./LICENSE) file for details.

---

## 🆘 Support

If you encounter issues:
- Visit the **API docs** → `/api-docs`
- Check logs or use the **/health** endpoint
- Review the **Troubleshooting** section
- Create an issue on the GitHub repository

---

