// server/app.js - Express app configuration
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();

// -- Middleware --
app.use(cors({
  origin: function(origin, callback) {
    const allowed = [
      'http://localhost:5173',
      'http://localhost:4173',
      process.env.CLIENT_URL
    ].filter(Boolean);
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin || allowed.some(u => origin.startsWith(u))) {
      callback(null, true);
    } else {
      callback(null, true); // Allow all in case of custom domains
    }
  },
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// -- Request logging (dev only) --
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });
}

// -- Routes --
app.use('/api/auth', require('./routes/auth'));
app.use('/api/workspaces', require('./routes/workspaces'));
app.use('/api/services', require('./routes/services'));
app.use('/api/availability', require('./routes/availability'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/contacts', require('./routes/contacts'));
app.use('/api/conversations', require('./routes/conversations'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/staff', require('./routes/staff'));
app.use('/api/forms', require('./routes/forms'));
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/activity', require('./routes/activity'));

// -- Root health check (for Render) --
app.get('/', (req, res) => {
  res.json({ message: 'CareOps API is running', status: 'ok', timestamp: new Date().toISOString() });
});

// -- Health check --
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// -- 404 handler --
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// -- Global error handler --
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
});

module.exports = app;
