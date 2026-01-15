const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const path = require('path');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const app = express();

// Allow multiple origins (prod + local) and handle preflight
const DEFAULT_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173'];
const envOrigins = process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',').map(s => s.trim()) : [];
const allowedOrigins = Array.from(new Set([...envOrigins, ...DEFAULT_ORIGINS]));

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    const ok = allowedOrigins.includes(origin) || /https?:\/\/.*\.vercel\.app$/.test(origin);
    return ok ? callback(null, true) : callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

// mount other routers
app.use('/users', require('./routes/user.routes'));
app.use('/captains', require('./routes/captain.routes'));
app.use('/rides', require('./routes/ride.routes'));

// mount maps and payment routers
const mapRoutes = require('./routes/maps.routes');
const paymentRoutes = require('./routes/payment.route');
app.use('/maps', mapRoutes);
app.use('/payment', paymentRoutes);

app.use(express.static(path.join(__dirname, "../frontend/dist")));

// NOTE: MongoDB connect is handled from server.js (single centralized connection).
// Removed duplicate mongoose.connect call to prevent "openUri on an active connection" errors.

// Add this at the end (after all routes)
app.use((err, req, res, next) => {
  // log error server-side for debugging (do not expose stack in response)
  console.error(err && (err.stack || err.message || err));
  const status = err && err.status ? err.status : 500;
  res.status(status).json({ message: err && err.message ? err.message : 'Internal Server Error' });
});

module.exports = app;
