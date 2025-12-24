import Joi from 'joi';
import { Request, Response, NextFunction } from 'express';
import { sanitizeHtml, getTextLength } from '../utils/htmlUtils';

// Allowed background colors - only 5 blue and pink shades
const ALLOWED_BG_COLORS = [
  '#ffffff', // Default White
  '#e6f3ff', // Light Blue
  '#cce7ff', // Soft Blue
  '#ffe6f0', // Light Pink
  '#ffcce6'  // Soft Pink
];

// Allowed icon values
const ALLOWED_ICONS = [
  'businessman',
  'doctor',
  'itprofessional',
  'lawyer',
  'soldier',
  'teacher'
];

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

  // Post creation - Updated for payment system
  createPost: Joi.object({
    email: Joi.string().email().required().max(255),
    content: Joi.string().min(10).max(5000).required().custom((value, helpers) => {
      const textLength = getTextLength(value);
      if (textLength < 10 || textLength > 1000) {
        return helpers.error('string.textLength', { textLength });
      }
      return value;
    }, 'HTML content validation'),
    otp: Joi.string().length(6).pattern(/^\d{6}$/).required(),
    lookingFor: Joi.string().valid('bride', 'groom').required(),
    duration: Joi.number().integer().valid(14, 21, 28).required(), // 2, 3, 4 weeks
    fontSize: Joi.string().valid('default', 'large').default('default'), // Removed 'medium'
    bgColor: Joi.string().valid(...ALLOWED_BG_COLORS).default('#ffffff'),
    icon: Joi.string().valid(...ALLOWED_ICONS).optional().allow(null),
    couponCode: Joi.string().optional().allow('')
  }).messages({
    'string.textLength': 'Content text length must be between 10 and 1000 characters (currently {{#textLength}})'
  }),

  // Email sending (anonymous users)
  sendEmail: Joi.object({
    email: Joi.string().email().required().max(255),
    message: Joi.string().min(1).max(5000).required(),
    postId: Joi.number().integer().positive().required(),
    otp: Joi.string().length(6).pattern(/^\d{6}$/).required()
  }),

  // Authenticated email sending (logged-in users)
  sendAuthenticatedEmail: Joi.object({
    message: Joi.string().min(1).max(5000).required(),
    postId: Joi.number().integer().positive().required()
  }),

  // Authenticated post creation (logged-in users) with restricted colors
  createAuthenticatedPost: Joi.object({
    content: Joi.string().min(10).max(5000).required().custom((value, helpers) => {
      const textLength = getTextLength(value);
      if (textLength < 10 || textLength > 1000) {
        return helpers.error('string.textLength', { textLength });
      }
      return value;
    }, 'HTML content validation'),
    lookingFor: Joi.string().valid('bride', 'groom').required(),
    duration: Joi.number().integer().valid(14, 21, 28).required(), // 2, 3, 4 weeks
    fontSize: Joi.string().valid('default', 'large').default('default'), // Removed 'medium'
    bgColor: Joi.string().valid(...ALLOWED_BG_COLORS).default('#ffffff'),
    icon: Joi.string().valid(...ALLOWED_ICONS).optional().allow(null),
    couponCode: Joi.string().optional().allow('')
  }).messages({
    'string.textLength': 'Content text length must be between 10 and 1000 characters (currently {{#textLength}})'
  }),

  // Admin login
  adminLogin: Joi.object({
    email: Joi.string().email().required().max(255),
    password: Joi.string().required().max(100)
  }),

  // Admin creation
  createAdmin: Joi.object({
    email: Joi.string().email().required().max(255),
    password: Joi.string().min(6).max(100).required(),
    role: Joi.string().valid('admin', 'data_entry').optional()
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
    status: Joi.string().valid('pending', 'published', 'archived', 'deleted', 'expired', 'edited', 'all').optional(),
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

  // Search synonym group creation
  createSynonymGroup: Joi.object({
    name: Joi.string().max(100).required()
  }),

  // Search synonym group update
  updateSynonymGroup: Joi.object({
    name: Joi.string().max(100).required(),
    isActive: Joi.boolean().required()
  }),

  // Search synonym word creation
  createSynonymWord: Joi.object({
    groupId: Joi.number().integer().positive().required(),
    word: Joi.string().max(100).required()
  }),

  // Admin post creation with restricted colors - Updated for payment system
  createAdminPost: Joi.object({
    email: Joi.string().email().required().max(255),
    content: Joi.string().min(10).max(5000).required().custom((value, helpers) => {
      const textLength = getTextLength(value);
      if (textLength < 10 || textLength > 1000) {
        return helpers.error('string.textLength', { textLength });
      }
      return value;
    }, 'HTML content validation'),
    lookingFor: Joi.string().valid('bride', 'groom').required(),
    duration: Joi.number().integer().valid(14, 21, 28).required(), // 2, 3, 4 weeks
    fontSize: Joi.string().valid('default', 'large').default('default'), // Removed 'medium'
    bgColor: Joi.string().valid(...ALLOWED_BG_COLORS).default('#ffffff'),
    icon: Joi.string().valid(...ALLOWED_ICONS).optional().allow(null),
    couponCode: Joi.string().optional().allow('')
  }).messages({
    'string.textLength': 'Content text length must be between 10 and 1000 characters (currently {{#textLength}})'
  }),

  // Admin post update with restricted colors
  updateAdminPost: Joi.object({
    content: Joi.string().min(10).max(5000).optional().custom((value, helpers) => {
      if (!value) return value;
      const textLength = getTextLength(value);
      if (textLength < 10 || textLength > 1000) {
        return helpers.error('string.textLength', { textLength });
      }
      return value;
    }, 'HTML content validation'),
    lookingFor: Joi.string().valid('bride', 'groom').optional(),
    duration: Joi.number().integer().valid(14, 21, 28).optional(), // 2, 3, 4 weeks
    fontSize: Joi.string().valid('default', 'large').optional(), // Removed 'medium'
    bgColor: Joi.string().valid(...ALLOWED_BG_COLORS).optional(),
    icon: Joi.string().valid(...ALLOWED_ICONS).optional().allow(null)
  }).messages({
    'string.textLength': 'Content text length must be between 10 and 1000 characters (currently {{#textLength}})'
  }),

};

// Export allowed colors and icons for use in other parts of the application
export { ALLOWED_BG_COLORS, ALLOWED_ICONS };

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
  // Sanitize string inputs - allow safe HTML for content fields
  const sanitizeString = (str: string, fieldName?: string): string => {
    // Allow HTML for content and message fields
    if (fieldName === 'content' || fieldName === 'message') {
      return sanitizeHtml(str.trim());
    }
    // Strip HTML for other fields
    return str
      .trim()
      .replace(/[<>]/g, '') // Remove potential HTML tags
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+=/gi, ''); // Remove event handlers
  };

  // Recursively sanitize object
  const sanitizeObject = (obj: any, parentKey?: string): any => {
    if (typeof obj === 'string') {
      return sanitizeString(obj, parentKey);
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => sanitizeObject(item, parentKey));
    }

    if (obj && typeof obj === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = sanitizeObject(value, key);
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
