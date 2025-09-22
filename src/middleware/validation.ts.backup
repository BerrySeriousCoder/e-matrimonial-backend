import Joi from 'joi';
import { Request, Response, NextFunction } from 'express';

// Validation schemas
export const schemas = {
  // User registration
  register: Joi.object({
    email: Joi.string().email().required().max(255),
    password: Joi.string().min(8).max(100).required(),
    otp: Joi.string().length(6).pattern(/^\d{6}$/).required()
  }),

  // User login
  login: Joi.object({
    email: Joi.string().email().required().max(255),
    password: Joi.string().required().max(100)
  }),

  // Password reset
  resetPassword: Joi.object({
    email: Joi.string().email().required().max(255),
    otp: Joi.string().length(6).pattern(/^\d{6}$/).required(),
    newPassword: Joi.string().min(8).max(100).required()
  }),

  // OTP request
  requestOtp: Joi.object({
    email: Joi.string().email().required().max(255)
  }),

  // OTP verification
  verifyOtp: Joi.object({
    email: Joi.string().email().required().max(255),
    otp: Joi.string().length(6).pattern(/^\d{6}$/).required()
  }),

  // Post creation - Fixed to match database schema
  createPost: Joi.object({
    email: Joi.string().email().required().max(255),
    content: Joi.string().min(10).max(1000).required(),
    otp: Joi.string().length(6).pattern(/^\d{6}$/).required(),
    lookingFor: Joi.string().valid('bride', 'groom').required(),
    duration: Joi.number().integer().min(28).max(56).required(),
    fontSize: Joi.string().valid('default', 'medium', 'large').default('default'),
    bgColor: Joi.string().max(50).pattern(/^#[0-9A-Fa-f]{6}$/).default('#ffffff')
  }),

  // Email sending (anonymous users)
  sendEmail: Joi.object({
    email: Joi.string().email().required().max(255),
    message: Joi.string().min(1).max(1000).required(),
    postId: Joi.number().integer().positive().required(),
    otp: Joi.string().length(6).pattern(/^\d{6}$/).required()
  }),

  // Authenticated email sending (logged-in users)
  sendAuthenticatedEmail: Joi.object({
    message: Joi.string().min(1).max(1000).required(),
    postId: Joi.number().integer().positive().required()
  }),

  // Authenticated post creation (logged-in users)
  createAuthenticatedPost: Joi.object({
    content: Joi.string().min(10).max(1000).required(),
    lookingFor: Joi.string().valid('bride', 'groom').required(),
    duration: Joi.number().integer().min(28).max(56).required(),
    fontSize: Joi.string().valid('default', 'medium', 'large').default('default'),
    bgColor: Joi.string().max(50).pattern(/^#[0-9A-Fa-f]{6}$/).default('#ffffff')
  }),

  // Admin login
  adminLogin: Joi.object({
    email: Joi.string().email().required().max(255),
    password: Joi.string().required().max(100)
  }),

  // Admin creation
  createAdmin: Joi.object({
    email: Joi.string().email().required().max(255),
    password: Joi.string().min(6).max(100).required()
  }),

  // Post approval/rejection
  postAction: Joi.object({
    postId: Joi.number().integer().positive().required(),
    action: Joi.string().valid('approve', 'reject').required(),
    reason: Joi.string().max(500).optional()
  }),

  // User selection
  userSelection: Joi.object({
    action: Joi.string().valid('add', 'remove').required(),
    profileId: Joi.number().integer().positive().required()
  }),

  // UI Text update
  updateUIText: Joi.object({
    value: Joi.string().required().max(500)
  }),

  // Query parameters for posts
  postsQuery: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    lookingFor: Joi.string().valid('bride', 'groom', 'all').optional(),
    search: Joi.string().max(100).optional(),
    filters: Joi.string().optional()
  }),

  // Admin posts query
  adminPostsQuery: Joi.object({
    status: Joi.string().valid('pending', 'published', 'archived', 'deleted', 'all').optional(),
    search: Joi.string().max(100).optional(),
    page: Joi.number().integer().min(1).default(1)
  }),

  // Admin management query
  adminManagementQuery: Joi.object({
    search: Joi.string().max(100).optional(),
    page: Joi.number().integer().min(1).default(1)
  }),

  // Search filter section creation
  createSearchFilterSection: Joi.object({
    name: Joi.string().max(100).required(),
    displayName: Joi.string().max(100).required(),
    description: Joi.string().max(255).optional(),
    order: Joi.number().integer().min(0).default(0)
  }),

  // Search filter section update
  updateSearchFilterSection: Joi.object({
    name: Joi.string().max(100).required(),
    displayName: Joi.string().max(100).required(),
    description: Joi.string().max(255).optional(),
    order: Joi.number().integer().min(0).required(),
    isActive: Joi.boolean().required()
  }),

  // Search filter option creation
  createSearchFilterOption: Joi.object({
    sectionId: Joi.number().integer().positive().required(),
    value: Joi.string().max(100).required(),
    displayName: Joi.string().max(100).required(),
    order: Joi.number().integer().min(0).default(0)
  }),

  // Search filter option update
  updateSearchFilterOption: Joi.object({
    sectionId: Joi.number().integer().positive().required(),
    value: Joi.string().max(100).required(),
    displayName: Joi.string().max(100).required(),
    order: Joi.number().integer().min(0).required(),
    isActive: Joi.boolean().required()
  }),


};

// Validation middleware factory
export const validate = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        details: error.details.map(detail => detail.message)
      });
    }

    // Replace req.body with validated data
    req.body = value;
    next();
  };
};

// Query validation middleware
export const validateQuery = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.query);
    
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid query parameters',
        details: error.details.map(detail => detail.message)
      });
    }

    // Don't replace req.query as it's read-only in Express
    // The validated values are available in the 'value' object
    // We'll use the original req.query values in the route handlers
    next();
  };
};

// Sanitization middleware
export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  // Sanitize string inputs
  const sanitizeString = (str: string): string => {
    return str
      .trim()
      .replace(/[<>]/g, '') // Remove potential HTML tags
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+=/gi, ''); // Remove event handlers
  };

  // Recursively sanitize object
  const sanitizeObject = (obj: any): any => {
    if (typeof obj === 'string') {
      return sanitizeString(obj);
    }
    
    if (Array.isArray(obj)) {
      return obj.map(sanitizeObject);
    }
    
    if (obj && typeof obj === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = sanitizeObject(value);
      }
      return sanitized;
    }
    
    return obj;
  };

  // Sanitize request body
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }

  // Note: Query sanitization removed due to Express compatibility issues
  // Query parameters are validated separately using validateQuery middleware

  next();
}; 