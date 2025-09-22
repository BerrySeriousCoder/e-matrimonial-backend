import express from 'express';
import { db } from '../db';
import { paymentTransactions, posts, couponCodes } from '../db/schema';
import { eq } from 'drizzle-orm';
import RazorpayService from '../utils/razorpayService';
import { sendEmail } from '../utils/sendEmail';
import { tmplPublished } from '../utils/emailTemplates';
import { AnalyticsService } from '../services/analyticsService';

const router = express.Router();

// Middleware to handle raw body for webhook signature verification
router.use(express.raw({ type: 'application/json', limit: '10mb' }));

// Test endpoint to verify webhook configuration
router.get('/test', (req, res) => {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  res.json({
    webhookSecretConfigured: !!webhookSecret,
    webhookSecretLength: webhookSecret?.length || 0,
    environment: process.env.NODE_ENV
  });
});

// Razorpay webhook handler
router.post('/razorpay', async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'] as string;
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    
    
    if (!webhookSecret) {
      console.error('RAZORPAY_WEBHOOK_SECRET not configured');
      return res.status(500).json({ error: 'Webhook secret not configured' });
    }

    // Verify webhook signature
    const crypto = require('crypto');
    
    // Ensure we get the raw body as string
    let body;
    if (Buffer.isBuffer(req.body)) {
      body = req.body.toString('utf8');
    } else {
      body = req.body.toString();
    }
    
    // Create HMAC signature
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(body)
      .digest('hex');


    if (signature !== expectedSignature) {
      console.error('Invalid webhook signature');
      return res.status(400).json({ error: 'Invalid signature' });
    }

    const event = JSON.parse(body);

    switch (event.event) {
      case 'payment_link.paid':
        await handlePaymentLinkPaid(event.payload || event);
        break;
      case 'payment_link.partially_paid':
        await handlePaymentLinkPartiallyPaid(event.payload || event);
        break;
      case 'payment_link.expired':
        await handlePaymentLinkExpired(event.payload || event);
        break;
      case 'payment_link.cancelled':
        await handlePaymentLinkCancelled(event.payload || event);
        break;
      default:
        console.log('Unhandled webhook event:', event.event);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

async function handlePaymentLinkPaid(payload: any) {
  try {
    // Extract data from nested entity structure
    const payment_link = payload.payment_link?.entity;
    const payment = payload.payment?.entity;

    // Find the post by payment link reference_id (format: post_123)
    const referenceId = payment_link?.reference_id;
    if (!referenceId || !referenceId.startsWith('post_')) {
      console.error('Invalid reference_id:', referenceId);
      return;
    }

    const postId = parseInt(referenceId.replace('post_', ''));
    const [post] = await db.select()
      .from(posts)
      .where(eq(posts.id, postId));

    if (!post) {
      console.error('Post not found for ID:', postId);
      return;
    }

    // Create payment transaction record
    // Convert amount from paise to rupees (Razorpay sends amount in paise)
    const amountInRupees = Math.round(payment.amount / 100);
    
    const [paymentTransaction] = await db.insert(paymentTransactions)
      .values({
        postId: postId,
        razorpayPaymentLinkId: payment_link.id,
        razorpayPaymentId: payment.id,
        razorpayPaymentLinkReferenceId: referenceId,
        amount: post.baseAmount || 0,
        finalAmount: amountInRupees, // Use actual paid amount
        currency: 'INR',
        status: 'completed',
        couponCode: post.couponCode,
        discountAmount: (post.baseAmount || 0) - amountInRupees,
      })
      .returning();

    // Set expiresAt based on post duration (14, 21, or 28 days)
    const expiresAt = new Date();
    const duration = post.duration || 14; // Default to 14 days if not set
    expiresAt.setDate(expiresAt.getDate() + duration);
    const expiresAtString = expiresAt.toISOString();

    // Update post status to published
    await db.update(posts)
      .set({
        status: 'published',
        paymentTransactionId: paymentTransaction.id,
        expiresAt: expiresAtString,
      })
      .where(eq(posts.id, postId));

    // Update coupon usage count if applicable
    if (post.couponCode) {
      const [coupon] = await db.select().from(couponCodes).where(eq(couponCodes.code, post.couponCode));
      if (coupon) {
        await db.update(couponCodes)
          .set({
            usedCount: (coupon.usedCount || 0) + 1
          })
          .where(eq(couponCodes.code, post.couponCode));
      }
    }

    // Track payment success analytics
    try {
      await AnalyticsService.trackEvent({
        eventType: 'payment_success',
        userId: post.userId?.toString(),
        metadata: {
          postId: postId,
          amount: payment?.amount ? payment.amount / 100 : 0, // Convert from paise to rupees
          currency: payment?.currency || 'INR',
          paymentId: payment?.id,
          couponCode: post.couponCode
        }
      });
    } catch (analyticsError) {
      console.error('Error tracking payment success analytics:', analyticsError);
    }

    // Send confirmation email
    try {
      const { html, text } = tmplPublished({ 
        email: post.email, 
        expiresAt: new Date(expiresAtString)
      });
      await sendEmail({ 
        to: post.email, 
        subject: '[E‑Matrimonials] Your ad is now live!', 
        text, 
        html 
      });
    } catch (emailError) {
      console.error('Error sending confirmation email:', emailError);
    }

  } catch (error) {
    console.error('Error handling payment link paid:', error);
  }
}

async function handlePaymentLinkPartiallyPaid(payload: any) {
  try {
    const payment_link = payload.payment_link?.entity;

    // Find the post by payment link reference_id
    const referenceId = payment_link?.reference_id;
    if (!referenceId || !referenceId.startsWith('post_')) {
      console.error('Invalid reference_id:', referenceId);
      return;
    }

    const postId = parseInt(referenceId.replace('post_', ''));
    const [post] = await db.select()
      .from(posts)
      .where(eq(posts.id, postId));

    if (post) {
      // Create or update payment transaction
      const [existingTransaction] = await db.select()
        .from(paymentTransactions)
        .where(eq(paymentTransactions.razorpayPaymentLinkId, payment_link.id));

      if (existingTransaction) {
        await db.update(paymentTransactions)
          .set({
            status: 'partially_paid',
            updatedAt: new Date().toISOString(),
          })
          .where(eq(paymentTransactions.id, existingTransaction.id));
      }
    }
  } catch (error) {
    console.error('Error handling payment link partially paid:', error);
  }
}

async function handlePaymentLinkExpired(payload: any) {
  try {
    const payment_link = payload.payment_link?.entity;

    // Find the post by payment link reference_id
    const referenceId = payment_link?.reference_id;
    if (!referenceId || !referenceId.startsWith('post_')) {
      console.error('Invalid reference_id:', referenceId);
      return;
    }

    const postId = parseInt(referenceId.replace('post_', ''));
    const [post] = await db.select()
      .from(posts)
      .where(eq(posts.id, postId));

    if (post) {
      // Create or update payment transaction
      const [existingTransaction] = await db.select()
        .from(paymentTransactions)
        .where(eq(paymentTransactions.razorpayPaymentLinkId, payment_link.id));

      if (existingTransaction) {
        await db.update(paymentTransactions)
          .set({
            status: 'expired',
            updatedAt: new Date().toISOString(),
          })
          .where(eq(paymentTransactions.id, existingTransaction.id));
      }

      // Update post status back to pending for re-approval
      await db.update(posts)
        .set({
          status: 'pending',
        })
        .where(eq(posts.id, postId));
    }
  } catch (error) {
    console.error('Error handling payment link expired:', error);
  }
}

async function handlePaymentLinkCancelled(payload: any) {
  try {
    const payment_link = payload.payment_link?.entity;

    // Find the post by payment link reference_id
    const referenceId = payment_link?.reference_id;
    if (!referenceId || !referenceId.startsWith('post_')) {
      console.error('Invalid reference_id:', referenceId);
      return;
    }

    const postId = parseInt(referenceId.replace('post_', ''));
    const [post] = await db.select()
      .from(posts)
      .where(eq(posts.id, postId));

    if (post) {
      // Create or update payment transaction
      const [existingTransaction] = await db.select()
        .from(paymentTransactions)
        .where(eq(paymentTransactions.razorpayPaymentLinkId, payment_link.id));

      if (existingTransaction) {
        await db.update(paymentTransactions)
          .set({
            status: 'cancelled',
            updatedAt: new Date().toISOString(),
          })
          .where(eq(paymentTransactions.id, existingTransaction.id));
      }

      // Update post status back to pending
      await db.update(posts)
        .set({
          status: 'pending',
        })
        .where(eq(posts.id, postId));
    }
  } catch (error) {
    console.error('Error handling payment link cancelled:', error);
  }
}

export default router;
