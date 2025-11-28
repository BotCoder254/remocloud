const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { errorHandler } = require('./utils/errors');
require('dotenv').config();

const { initDB } = require('./models/database');
const authRoutes = require('./routers/auth');
const apiKeyRoutes = require('./routers/apiKeys');
const bucketRoutes = require('./routers/buckets');
const fileRoutes = require('./routers/files');
const uploadRoutes = require('./routers/uploads');
const storageRoutes = require('./routers/storage');
const cdnRoutes = require('./routers/cdn');
const transformRoutes = require('./routers/transforms');
const analyticsRoutes = require('./routers/analytics');

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize database
initDB();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/keys', apiKeyRoutes);
app.use('/api/buckets', bucketRoutes);
app.use('/api/files', fileRoutes);
app.use('/api', uploadRoutes);
app.use('/api/storage', storageRoutes);
app.use('/api', transformRoutes);
app.use('/api', analyticsRoutes);
app.use('/cdn', cdnRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling middleware (must be last)
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});