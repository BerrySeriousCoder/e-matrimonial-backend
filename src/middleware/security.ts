import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { Request, Response, NextFunction } from 'express';

// Rate limiting configurations
export const createRateLimiters = () => {
  // General API rate limiter - More lenient for general browsing
  const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 300, // limit each IP to 300 requests per windowMs
    message: {
      success: false,
      message: 'Too many requests from this IP, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Auth rate limiter - Separate for different auth operations
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // limit each IP to 20 auth requests per windowMs
    message: {
      success: false,
      message: 'Too many authentication attempts, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // OTP rate limiter - More lenient but still protective
  const otpLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // limit each IP to 10 OTP requests per windowMs
    message: {
      success: false,
      message: 'Too many OTP requests, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Post creation rate limiter - More lenient
  const postLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // limit each IP to 5 posts per hour
    message: {
      success: false,
      message: 'Too many post attempts, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Admin authentication rate limiter - More lenient than user auth
  const adminAuthLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50, // limit each IP to 50 admin auth requests per windowMs
    message: {
      success: false,
      message: 'Too many admin authentication attempts, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Admin operations rate limiter - For general admin operations
  const adminLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200, // limit each IP to 200 admin requests per windowMs
    message: {
      success: false,
      message: 'Too many admin operations, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Super admin operations rate limiter - Most lenient
  const superAdminLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500, // limit each IP to 500 super admin requests per windowMs
    message: {
      success: false,
      message: 'Too many super admin operations, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
  });

  return {
    generalLimiter,
    authLimiter,
    otpLimiter,
    postLimiter,
    adminAuthLimiter,
    adminLimiter,
    superAdminLimiter
  };
};

// Helmet configuration
export const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
});

// Request size limiter
export const requestSizeLimiter = (req: Request, res: Response, next: NextFunction) => {
  const contentLength = parseInt(req.headers['content-length'] || '0');
  const maxSize = 1024 * 1024; // 1MB

  if (contentLength > maxSize) {
    return res.status(413).json({
      success: false,
      message: 'Request entity too large'
    });
  }

  next();
};

// Environment variable validator
export const validateEnvironment = () => {
  const requiredEnvVars = [
    'JWT_SECRET',
    'DATABASE_URL',
    'SENDGRID_API_KEY',
    'SUPERADMIN_EMAIL'
  ];

  const missing = requiredEnvVars.filter(envVar => !process.env[envVar]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  // Validate JWT_SECRET strength
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long');
  }
};

// Error handling middleware
export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err);

  // Don't leak error details in production
  if (process.env.NODE_ENV === 'production') {
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }

  res.status(500).json({
    success: false,
    message: err.message,
    stack: err.stack
  });
};

// 404 handler
export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
};

// Request logging middleware
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`);
  });

  next();
}; 