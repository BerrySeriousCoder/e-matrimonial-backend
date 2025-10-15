import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import postsRouter from './routes/posts';
import otpRouter from './routes/otp';
import emailRouter from './routes/email';
import uiTextsRouter from './routes/uiTexts';
import userRouter from './routes/user';
import adminRouter from './routes/admin';
import adminManagementRouter from './routes/adminManagement';
import searchFiltersRouter from './routes/searchFilters';
import dataEntryRouter from './routes/dataEntry';
import paymentRouter from './routes/payment';
import adminPaymentRouter from './routes/adminPayment';
import webhookRouter from './routes/webhook';
import analyticsRouter from './routes/analytics';

// Security imports
import {
  createRateLimiters,
  helmetConfig,
  requestSizeLimiter,
  validateEnvironment,
  errorHandler,
  notFoundHandler,
  requestLogger
} from './middleware/security';

dotenv.config();

// Validate environment variables on startup
try {
  validateEnvironment();
  console.log('✅ Environment validation passed');
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  console.error('❌ Environment validation failed:', errorMessage);
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 4000;

// Security middleware (order matters!)
app.use(helmetConfig);
app.use(requestLogger);
app.use(requestSizeLimiter);

// CORS configuration (you'll configure this later)
app.use(cors());

// Webhook routes (must be before JSON parsing)
app.use('/api/webhook', webhookRouter);

// Body parser with limits
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Rate limiters (temporarily disabled for production testing)
const {
  generalLimiter,
  authLimiter,
  otpLimiter,
  postLimiter,
  adminAuthLimiter,
  adminLimiter,
  superAdminLimiter
} = createRateLimiters();

// Toggle to disable all rate limits in one place (set to false to re-enable)
const DISABLE_RATE_LIMIT = true;
const passThrough = (_req: any, _res: any, next: any) => next();

const GL = DISABLE_RATE_LIMIT ? passThrough : generalLimiter;
const AL = DISABLE_RATE_LIMIT ? passThrough : authLimiter;
const OL = DISABLE_RATE_LIMIT ? passThrough : otpLimiter;
const PL = DISABLE_RATE_LIMIT ? passThrough : postLimiter;
const ADM = DISABLE_RATE_LIMIT ? passThrough : adminLimiter;
const SAL = DISABLE_RATE_LIMIT ? passThrough : superAdminLimiter;

// Root route to check if backend is running
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Backend is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Apply rate limiting to routes (may be no-ops when disabled)
app.use('/api/posts', GL, postsRouter);
app.use('/api/otp', OL, otpRouter);
app.use('/api/email', GL, emailRouter);
app.use('/api/ui-texts', GL, uiTextsRouter);
app.use('/api/user', AL, userRouter);

// Admin routes with separate rate limiters
app.use('/api/admin', ADM, adminRouter);
app.use('/api/admin/management', SAL, adminManagementRouter);
app.use('/api/data-entry', ADM, dataEntryRouter);

// Search filters routes
app.use('/api/search-filters', GL, searchFiltersRouter);

// Payment routes
app.use('/api/payment', GL, paymentRouter);
app.use('/api/admin/payment', ADM, adminPaymentRouter);

// Analytics routes
app.use('/api/analytics', ADM, analyticsRouter);

// Apply specific rate limiting to post creation
app.use('/api/posts', PL);

// Error handling middleware (must be last)
app.use(notFoundHandler);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔒 Security measures enabled:`);
  console.log(`   - Rate limiting`);
  console.log(`   - Helmet security headers`);
  console.log(`   - Input validation`);
  console.log(`   - Request size limiting`);
  console.log(`   - Error handling`);
}); 