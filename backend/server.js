require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');

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
    // Allow requests with no origin (like mobile apps, curl, or same-origin page loads)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS']
}));

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// XSS protection headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Locks down browser features this app never uses, so an XSS payload
  // (if one ever slipped through) couldn't turn on the camera/mic/location
  // silently. The Scan QR feature is the one place camera is used, and that
  // grant comes from the page's own getUserMedia call, not this header —
  // Permissions-Policy restricts cross-origin/embedded use, not same-origin.
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), payment=()');
  next();
});

// Serve static frontend files — explicit allowlist only. The previous
// `express.static(path.join(__dirname, '../'))` served the ENTIRE project
// root, which includes backend/ (server.js, every route, every model, and
// critically backend/.env — DB password, JWT secret, admin secret were all
// publicly downloadable at /backend/.env). This mounts only the actual
// frontend directories and the specific static files at the root that pages
// reference, so nothing outside those is ever reachable over HTTP.
const frontendPath = path.join(__dirname, '../');
const staticHeaders = {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
};
app.use('/css', express.static(path.join(frontendPath, 'css'), staticHeaders));
app.use('/js', express.static(path.join(frontendPath, 'js'), staticHeaders));
app.use('/pages', express.static(path.join(frontendPath, 'pages'), staticHeaders));
['index.html', 'register.html', 'manifest.json', 'sw.js', 'icon-192.png', 'icon-512.png'].forEach(file => {
  app.get('/' + file, (req, res) => res.sendFile(path.join(frontendPath, file), staticHeaders));
});

// DB connect
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => { console.error('❌ MongoDB error:', err.message); process.exit(1); });

// Health check — reports whether the server process is up and whether it
// currently has a working MongoDB connection. Useful for Render's health
// checks and for quickly checking "is the DB actually connected" without
// digging through logs.
app.get(['/health', '/api/health'], (req, res) => {
  const dbState = mongoose.connection.readyState; // 0=disconnected 1=connected 2=connecting 3=disconnecting
  const dbStatus = ['disconnected', 'connected', 'connecting', 'disconnecting'][dbState] || 'unknown';
  res.status(dbState === 1 ? 200 : 503).json({
    success: dbState === 1,
    status: dbState === 1 ? 'ok' : 'degraded',
    db: dbStatus,
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

// Rate limiter — protects login/register from brute-force and spam
// 20 requests per 15 minutes per IP on auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts from this device. Please wait 15 minutes and try again.' },
});

// General API rate limiter — every other route was previously unprotected.
// Threshold is intentionally generous: a lot of campus WiFi routes NAT many
// students through one shared public IP, so a strict per-IP limit here would
// throttle everyone behind that gateway together, not just an abusive client.
// This is sized to stop scraping/DoS-style abuse, not to police normal use —
// the notification bell alone polls every 30s (~30 req/15min per user), so a
// few dozen concurrent students on one gateway is still well under this.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests from this network. Please wait a few minutes and try again.' },
});

// API routes
app.use('/api/auth',       authLimiter, require('./routes/auth'));
app.use('/api/complaints', apiLimiter, require('./routes/complaints'));
app.use('/api/laundry',    apiLimiter, require('./routes/laundry'));
app.use('/api/timetable',  apiLimiter, require('./routes/timetable'));
app.use('/api/events',     apiLimiter, require('./routes/events'));
app.use('/api/clubs',      apiLimiter, require('./routes/clubs'));
app.use('/api/bus',        apiLimiter, require('./routes/bus'));
app.use('/api/materials',  apiLimiter, require('./routes/materials'));
app.use('/api/analytics',  apiLimiter, require('./routes/analytics'));
app.use('/api/exam-calendar', apiLimiter, require('./routes/exam-calendar'));
app.use('/api/notifications', apiLimiter, require('./routes/notifications'));
app.use('/api/sos',           apiLimiter, require('./routes/sos'));
app.use('/api/canteen',       apiLimiter, require('./routes/canteen'));
app.use('/api/mess',          apiLimiter, require('./routes/mess'));
app.use('/api/super',         apiLimiter, require('./routes/superadmin'));
app.use('/api/store',         apiLimiter, require('./routes/store'));
app.use('/api/feedback',      apiLimiter, require('./routes/feedback'));
app.use('/api/suggestions',   apiLimiter, require('./routes/suggestions'));
app.use('/api/visitors',      apiLimiter, require('./routes/visitors'));
app.use('/api/appointments',  apiLimiter, require('./routes/appointments'));
app.use('/api/lostfound',     apiLimiter, require('./routes/lostfound'));
app.use('/api/library',       apiLimiter, require('./routes/library'));
app.use('/api/polls',         apiLimiter, require('./routes/polls'));
app.use('/api/campus-locations', apiLimiter, require('./routes/campus-locations'));
app.use('/api/badges',        apiLimiter, require('./routes/badges'));
app.use('/api/opportunities', apiLimiter, require('./routes/opportunities'));
app.use('/api/scholarships',  apiLimiter, require('./routes/scholarships'));
app.use('/api/medical',       apiLimiter, require('./routes/medical'));
app.use('/api/chat',          apiLimiter, require('./routes/chat'));

// Serve login page for root
app.get('/', (req, res) => res.sendFile(path.join(frontendPath, 'index.html')));

// Serve register page (short alias — /register.html is covered by the allowlist above)
app.get('/register', (req, res) => res.sendFile(path.join(frontendPath, 'register.html')));

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

// Without these, one unhandled promise rejection anywhere in the app (a
// missed .catch() in some route, a background job, etc.) crashes the entire
// Node process — logging everyone out and taking the whole site down until
// Render restarts it. This logs the error and keeps serving instead.
process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled promise rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught exception:', err);
  // Intentionally not exiting — Express's own request-level try/catch blocks
  // handle almost all real errors already; this is a last-resort net for
  // anything outside a request context, and killing the process on every
  // such error would be worse than logging and continuing.
});

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
  if (!process.env.ADMIN_SECRET) {
    console.warn(`\n⚠️  ADMIN_SECRET is not set — admin registration is disabled until it is configured.`);
  } else if (process.env.NODE_ENV === 'development') {
    console.log(`\n🔑 Admin secret key for registration: ${process.env.ADMIN_SECRET}`);
  } else {
    console.log(`\n🔑 Admin secret key configured (hidden in production)`);
  }
  console.log(`📋 OTPs print here when students register\n`);
});

module.exports = app;