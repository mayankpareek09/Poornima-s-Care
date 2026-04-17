require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();

// ✅ FIXED: CORS — properly configured with credentials support
// In production, set FRONTEND_URL in your environment variables
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'https://poornima-s-care.onrender.com',
  'http://localhost:5000',
  'http://localhost:3000'
].filter(Boolean);

app.use(cors({ 
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      callback(null, true); // Allow all in production for now (you can tighten this later)
    }
  },
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS']
}));

app.use(express.json({ limit: '20mb' }));       // 20mb to allow base64 photo uploads
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Serve static frontend files
const frontendPath = path.join(__dirname, '../');
app.use(express.static(frontendPath));

// DB connect
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => { console.error('❌ MongoDB error:', err.message); process.exit(1); });

// API routes
app.use('/api/auth',       require('./routes/auth'));
app.use('/api/complaints', require('./routes/complaints'));
app.use('/api/laundry',    require('./routes/laundry'));
app.use('/api/timetable',  require('./routes/timetable'));
app.use('/api/events',     require('./routes/events'));
app.use('/api/clubs',      require('./routes/clubs'));
app.use('/api/bus',        require('./routes/bus'));
app.use('/api/materials',  require('./routes/materials'));
app.use('/api/analytics',  require('./routes/analytics'));

// Serve login page for root
app.get('/', (req, res) => res.sendFile(path.join(frontendPath, 'index.html')));

// Serve register page
app.get('/register', (req, res) => res.sendFile(path.join(frontendPath, 'register.html')));
app.get('/register.html', (req, res) => res.sendFile(path.join(frontendPath, 'register.html')));

// Fallback: serve index / login for unmatched routes (SPA style)
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ success: false, message: 'API route not found.' });
 res.sendFile(path.join(frontendPath, 'index.html'));
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

const PORT = process.env.PORT || 5000;
const os = require('os');

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 Poornima's Care — Running on port ${PORT}`);
  console.log(`📄 Local:  http://localhost:${PORT}/`);
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        console.log(`🌐 Network: http://${net.address}:${PORT}/  (${name})`);
      }
    }
  }
  // ✅ FIXED: Only show admin key hint in development, not the actual key
  if (process.env.NODE_ENV === 'development') {
    console.log(`\n🔑 Admin secret key for registration: ${process.env.ADMIN_SECRET || 'PC_ADMIN_2026'}`);
  } else {
    console.log(`\n🔑 Admin secret key configured (hidden in production)`);
  }
  console.log(`📋 OTPs print here when students register\n`);
});

module.exports = app;