import express from 'express';
import { sendEmail } from '../utils/sendEmail';
import { db } from '../db';
import { posts, otps, users } from '../db/schema';
import { eq, and, gte } from 'drizzle-orm';
import { validate, schemas } from '../middleware/validation';
import { sanitizeInput } from '../middleware/validation';
import { userAuth } from '../middleware/userAuth';
import { 
  validateEmailRequest, 
  recordEmailSent, 
  incrementDailyCount 
} from '../utils/emailValidation';
import { trackEmailEvent } from '../middleware/analytics';
import { tmplNewMessageToPoster } from '../utils/emailTemplates';

const router = express.Router();

// Send email (for anonymous users - requires OTP)
router.post('/send', sanitizeInput, validate(schemas.sendEmail), async (req, res) => {
  try {
    const { email, message, postId, otp } = req.body;

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

    // Create content preview for subject line
    const contentPreview = post[0].content.substring(0, 40).replace(/\s+/g, ' ').trim() + '...';
    const lookingFor = (post[0].lookingFor || 'unknown').charAt(0).toUpperCase() + (post[0].lookingFor || 'unknown').slice(1);

    // Send templated email
    const { html, text } = tmplNewMessageToPoster({
      toEmail: post[0].email,
      fromEmail: email,
      contentPreview,
      lookingFor,
      message,
    });
    await sendEmail({ to: post[0].email, subject: `[${lookingFor} - "${contentPreview}"] New message from ${email}`, text, html, replyTo: email });

    // Record the email sent
    await recordEmailSent(email, postId);

    // Track email analytics
    trackEmailEvent(email, post[0].email)(req, res, () => {});

    // Delete used OTP
    await db.delete(otps).where(eq(otps.id, otpRecord[0].id));

    res.json({
      success: true,
      message: 'Email sent successfully'
    });

  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send email'
    });
  }
});

// Send authenticated email (for logged-in users - no OTP required)
router.post('/send-authenticated', userAuth, sanitizeInput, validate(schemas.sendAuthenticatedEmail), async (req: any, res) => {
  try {
    const { message, postId } = req.body;
    const userId = req.user.id; // From userAuth middleware
    const userEmail = req.user.email; // From userAuth middleware

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

    // Create content preview for subject line
    const contentPreview = post[0].content.substring(0, 40).replace(/\s+/g, ' ').trim() + '...';
    const lookingFor = (post[0].lookingFor || 'unknown').charAt(0).toUpperCase() + (post[0].lookingFor || 'unknown').slice(1);

    // Send templated email
    const tpl = tmplNewMessageToPoster({
      toEmail: post[0].email,
      fromEmail: userEmail,
      contentPreview,
      lookingFor,
      message,
    });
    await sendEmail({ to: post[0].email, subject: `[${lookingFor} - "${contentPreview}"] New message from ${userEmail}`, text: tpl.text, html: tpl.html, replyTo: userEmail });

    // Record the email and increment daily count
    await recordEmailSent(userEmail, postId, userId);
    await incrementDailyCount(userId);

    // Track email analytics
    trackEmailEvent(userEmail, post[0].email)(req, res, () => {});

    res.json({
      success: true,
      message: 'Email sent successfully'
    });

  } catch (error) {
    console.error('Error sending authenticated email:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send email'
    });
  }
});

export default router; 