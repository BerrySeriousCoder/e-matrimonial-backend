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

// Body parser with limits
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Rate limiters
const { 
  generalLimiter, 
  authLimiter, 
  otpLimiter, 
  postLimiter,
  adminAuthLimiter,
  adminLimiter,
  superAdminLimiter
} = createRateLimiters();

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

// Apply rate limiting to routes
app.use('/api/posts', generalLimiter, postsRouter);
app.use('/api/otp', otpLimiter, otpRouter);
app.use('/api/email', generalLimiter, emailRouter);
app.use('/api/ui-texts', generalLimiter, uiTextsRouter);
app.use('/api/user', authLimiter, userRouter);

// Admin routes with separate rate limiters
app.use('/api/admin', adminLimiter, adminRouter);
app.use('/api/admin/management', superAdminLimiter, adminManagementRouter);

// Search filters routes
app.use('/api/search-filters', generalLimiter, searchFiltersRouter);

// Apply specific rate limiting to post creation
app.use('/api/posts', postLimiter);

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