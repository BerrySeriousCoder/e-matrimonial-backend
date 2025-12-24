import express from 'express';
import multer from 'multer';
import { sendEmail, EmailAttachment } from '../utils/sendEmail';
import { db } from '../db';
import { posts, otps, users } from '../db/schema';
import { eq, and, gte } from 'drizzle-orm';
import { validate, schemas } from '../middleware/validation';
import { sanitizeInput } from '../middleware/validation';
import { stripHtml } from '../utils/htmlUtils';
import { userAuth } from '../middleware/userAuth';
import {
  validateEmailRequest,
  recordEmailSent,
  incrementDailyCount
} from '../utils/emailValidation';
import { trackEmailEvent } from '../middleware/analytics';
import { tmplNewMessageToPoster } from '../utils/emailTemplates';
import { moderateImage, isAllowedImageType, MAX_IMAGE_SIZE } from '../utils/imageModeration';

const router = express.Router();

// Configure multer for image uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_IMAGE_SIZE, // 5MB
  },
  fileFilter: (req, file, cb) => {
    if (isAllowedImageType(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (JPEG, PNG, GIF, WEBP) are allowed'));
    }
  },
});

// Wrapper to handle multer errors properly
const uploadWithErrorHandling = (fieldName: string) => {
  return (req: any, res: any, next: express.NextFunction) => {
    upload.single(fieldName)(req, res, (err: any) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            message: 'Image file is too large. Maximum size is 5MB.',
          });
        }
        return res.status(400).json({
          success: false,
          message: `Upload error: ${err.message}`,
        });
      } else if (err) {
        return res.status(400).json({
          success: false,
          message: err.message || 'Error uploading file',
        });
      }
      
      // Convert postId from string to number (FormData sends everything as strings)
      if (req.body && req.body.postId) {
        req.body.postId = parseInt(req.body.postId, 10);
      }
      
      next();
    });
  };
};

// Send email (for anonymous users - requires OTP)
router.post('/send', uploadWithErrorHandling('attachment'), sanitizeInput, validate(schemas.sendEmail), async (req: any, res: any) => {
  try {
    const { email, message, postId, otp } = req.body;
    const file = req.file as Express.Multer.File | undefined;

    // If attachment provided, moderate it first
    let attachment: EmailAttachment | undefined;
    if (file) {
      console.log('Moderating uploaded image:', { filename: file.originalname, size: file.size, type: file.mimetype });
      const moderationResult = await moderateImage(file.buffer);
      
      if (!moderationResult.safe) {
        console.log('Image rejected by moderation:', moderationResult);
        return res.status(400).json({
          success: false,
          message: moderationResult.reason || 'Image failed content moderation.',
        });
      }

      // Image is safe, prepare attachment
      attachment = {
        content: file.buffer.toString('base64'),
        filename: file.originalname,
        type: file.mimetype,
        disposition: 'attachment',
      };
    }

    // Verify OTP
    const otpRecord = await db.select().from(otps)
      .where(and(
        eq(otps.email, email),
        eq(otps.otp, otp),
        gte(otps.expiresAt, new Date().toISOString())
      ));

    if (otpRecord.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP'
      });
    }

    // Validate email request (check if already sent to this post)
    const validation = await validateEmailRequest(email, postId, message);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.error
      });
    }

    // Get post details
    const post = await db.select().from(posts).where(eq(posts.id, postId));
    if (post.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    // Create content preview for subject line (strip HTML)
    const contentPreview = stripHtml(post[0].content).substring(0, 40).replace(/\s+/g, ' ').trim() + '...';
    const lookingFor = (post[0].lookingFor || 'unknown').charAt(0).toUpperCase() + (post[0].lookingFor || 'unknown').slice(1);

    // Send templated email
    const { html, text } = tmplNewMessageToPoster({
      toEmail: post[0].email,
      fromEmail: email,
      contentPreview,
      lookingFor,
      message,
    });

    // Attempt to send email with detailed error handling
    try {
      await sendEmail({
        to: post[0].email,
        subject: `[${lookingFor} - "${contentPreview}"] New message from ${email}`,
        text,
        html,
        replyTo: email,
        attachments: attachment ? [attachment] : undefined,
      });
      console.log(`Email successfully sent to ${post[0].email} from ${email} for post ${postId}`, attachment ? '(with attachment)' : '');
    } catch (emailError: any) {
      // Log detailed error before re-throwing
      console.error('Failed to send email via SendGrid:', {
        error: emailError?.message,
        code: emailError?.code,
        statusCode: emailError?.response?.statusCode,
        to: post[0].email,
        from: email,
        postId,
        sendGridError: emailError?.response?.body
      });
      throw emailError; // Re-throw to be caught by outer catch
    }

    // Record the email sent (only if sendEmail succeeded)
    await recordEmailSent(email, postId);

    // Track email analytics
    trackEmailEvent(email, post[0].email)(req, res, () => { });

    // Delete used OTP (non-blocking - email was already sent successfully)
    try {
      await db.delete(otps).where(eq(otps.email, email));
    } catch (otpDeleteError) {
      // Log but don't fail - email was sent successfully
      console.warn('Failed to delete OTP after successful email send:', otpDeleteError);
    }

    res.json({
      success: true,
      message: 'Email sent successfully'
    });

  } catch (error: any) {
    console.error('Error in /api/email/send route:', {
      message: error?.message,
      code: error?.code,
      stack: error?.stack,
      response: error?.response?.body,
      statusCode: error?.response?.statusCode
    });
    res.status(500).json({
      success: false,
      message: 'Failed to send email'
    });
  }
});

// Send authenticated email (for logged-in users - no OTP required)
router.post('/send-authenticated', uploadWithErrorHandling('attachment'), userAuth, sanitizeInput, validate(schemas.sendAuthenticatedEmail), async (req: any, res: any) => {
  try {
    const { message, postId } = req.body;
    const userId = req.user.id; // From userAuth middleware
    const userEmail = req.user.email; // From userAuth middleware
    const file = req.file as Express.Multer.File | undefined;

    // If attachment provided, moderate it first
    let attachment: EmailAttachment | undefined;
    if (file) {
      console.log('Moderating uploaded image:', { filename: file.originalname, size: file.size, type: file.mimetype });
      const moderationResult = await moderateImage(file.buffer);
      
      if (!moderationResult.safe) {
        console.log('Image rejected by moderation:', moderationResult);
        return res.status(400).json({
          success: false,
          message: moderationResult.reason || 'Image failed content moderation.',
        });
      }

      // Image is safe, prepare attachment
      attachment = {
        content: file.buffer.toString('base64'),
        filename: file.originalname,
        type: file.mimetype,
        disposition: 'attachment',
      };
    }

    // Validate email request
    const validation = await validateEmailRequest(userEmail, postId, message, userId);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.error
      });
    }

    // Get post details
    const post = await db.select().from(posts).where(eq(posts.id, postId));
    if (post.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    // Create content preview for subject line (strip HTML)
    const contentPreview = stripHtml(post[0].content).substring(0, 40).replace(/\s+/g, ' ').trim() + '...';
    const lookingFor = (post[0].lookingFor || 'unknown').charAt(0).toUpperCase() + (post[0].lookingFor || 'unknown').slice(1);

    // Send templated email
    const tpl = tmplNewMessageToPoster({
      toEmail: post[0].email,
      fromEmail: userEmail,
      contentPreview,
      lookingFor,
      message,
    });

    // Attempt to send email with detailed error handling
    try {
      await sendEmail({
        to: post[0].email,
        subject: `[${lookingFor} - "${contentPreview}"] New message from ${userEmail}`,
        text: tpl.text,
        html: tpl.html,
        replyTo: userEmail,
        attachments: attachment ? [attachment] : undefined,
      });
      console.log(`Authenticated email successfully sent to ${post[0].email} from ${userEmail} for post ${postId}`, attachment ? '(with attachment)' : '');
    } catch (emailError: any) {
      // Log detailed error before re-throwing
      console.error('Failed to send authenticated email via SendGrid:', {
        error: emailError?.message,
        code: emailError?.code,
        statusCode: emailError?.response?.statusCode,
        to: post[0].email,
        from: userEmail,
        postId,
        userId,
        sendGridError: emailError?.response?.body
      });
      throw emailError; // Re-throw to be caught by outer catch
    }

    // Record the email and increment daily count (only if sendEmail succeeded)
    await recordEmailSent(userEmail, postId, userId);
    await incrementDailyCount(userId);

    // Track email analytics
    trackEmailEvent(userEmail, post[0].email)(req, res, () => { });

    res.json({
      success: true,
      message: 'Email sent successfully'
    });

  } catch (error: any) {
    console.error('Error in /api/email/send-authenticated route:', {
      message: error?.message,
      code: error?.code,
      stack: error?.stack,
      response: error?.response?.body,
      statusCode: error?.response?.statusCode
    });
    res.status(500).json({
      success: false,
      message: 'Failed to send email'
    });
  }
});

export default router; 