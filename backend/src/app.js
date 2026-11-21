// src/app.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');

dotenv.config();

// ---- Middleware -------------------------------------------------
const app = express();

// Basic security headers
app.use(helmet());

// Enable CORS – only allow the frontend origin (configured via env)
const allowedOrigin = process.env.FRONTEND_URL || '*';
app.use(
    cors({
        origin: allowedOrigin,
        credentials: true,
    })
);

// Body parser (JSON) – limit to 2 MB (adjust if you expect larger payloads)
app.use(express.json({ limit: '2mb' }));

// HTTP request logger (dev-friendly)
app.use(morgan('dev'));

// Simple rate limiter (global – can be refined per‑route later)
const limiter = rateLimit({
    windowMs: 60_000, // 1 min
    max: 100,         // max 100 requests per IP per minute
});
app.use(limiter);

// ---- Routes ------------------------------------------------------
// NOTE: actual routers (auth, emails, threads, …) will be added later.
// Example placeholder:
// const authRouter = require('./routes/auth.routes');
// app.use('/api/auth', authRouter);

// Health check (always present)
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
});

// ---- 404 handler -------------------------------------------------
app.use((_req, _res, next) => {
    const err = new Error('Not Found');
    err.status = 404;
    next(err);
});

// ---- Central error handler ---------------------------------------
app.use((err, _req, res, _next) => {
    const status = err.status || 500;
    const requestId = _req.headers && _req.headers['x-request-id']
        ? _req.headers['x-request-id']
        : `${Date.now()}-${Math.random()}`;
    console.error(`[${requestId}]`, err);
    res.status(status).json({
        error: true,
        message: err.message || 'Internal Server Error',
        requestId,
    });
});

module.exports = app;
