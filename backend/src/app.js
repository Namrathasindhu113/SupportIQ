import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import errorHandler from './middleware/errorHandler.js';
import authRoutes from './routes/auth.js';
import ticketRoutes from './routes/tickets.js';
import userRoutes from './routes/users.js';

const app = express();

// ── CORS ─────────────────────────────────────────────────────────────────────
// Allow requests from the frontend origin with cookies
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
    credentials: true, // required for httpOnly cookie exchange
  })
);

// ── Body parsers ──────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// ── Cookie parser ─────────────────────────────────────────────────────────────
app.use(cookieParser());

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/v1/health', (_req, res) => {
  res.status(200).json({ success: true, message: 'SupportIQ API is running.' });
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/v1/auth',    authRoutes);
app.use('/api/v1/tickets', ticketRoutes);
app.use('/api/v1/users',   userRoutes);

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found.' });
});

// ── Centralized error handler (must be last) ──────────────────────────────────
app.use(errorHandler);

export default app;
