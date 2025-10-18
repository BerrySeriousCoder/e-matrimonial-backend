import express from 'express';
import { db } from '../db';
import { posts, paymentTransactions, couponCodes } from '../db/schema';
import { eq } from 'drizzle-orm';
import { calculatePaymentAmount, getPaymentConfig } from '../utils/paymentCalculation';
import RazorpayService from '../utils/razorpayService';
import { sanitizeInput, validate } from '../middleware/validation';
import Joi from 'joi';

const router = express.Router();

// Validation schemas
const paymentSchemas = {
  calculatePayment: Joi.object({
    // Allow empty/short content so frontend can render base price summary before 10 chars
    content: Joi.string().max(1000).allow('').required(),
    fontSize: Joi.string().valid('default', 'large').required(),
    duration: Joi.number().valid(14, 21, 28).required(),
    icon: Joi.string().valid('businessman', 'doctor', 'itprofessional', 'lawyer', 'soldier', 'teacher').optional().allow(null),
    couponCode: Joi.string().optional().allow(''),
  }),
  createPaymentLink: Joi.object({
    postId: Joi.number().integer().positive().required(),
  }),
  verifyPayment: Joi.object({
    paymentLinkId: Joi.string().required(),
    paymentId: Joi.string().required(),
    paymentLinkReferenceId: Joi.string().required(),
    paymentLinkStatus: Joi.string().required(),
    signature: Joi.string().required(),
  }),
  verifyCallback: Joi.object({
    payment_link_id: Joi.string().required(),
    razorpay_payment_id: Joi.string().required(),
    payment_link_reference_id: Joi.string().required(),
    payment_link_status: Joi.string().required(),
    razorpay_signature: Joi.string().optional(),
  }),
  applyCoupon: Joi.object({
    couponCode: Joi.string().required(),
    content: Joi.string().min(10).max(1000).required(),
    fontSize: Joi.string().valid('default', 'large').required(),
    duration: Joi.number().valid(14, 21, 28).required(),
    icon: Joi.string().valid('businessman', 'doctor', 'itprofessional', 'lawyer', 'soldier', 'teacher').optional().allow(null),
  }),
};

// POST /api/payment/calculate - Calculate payment amount
router.post('/calculate', sanitizeInput, validate(paymentSchemas.calculatePayment), async (req, res) => {
  try {
    const { content, fontSize, duration, icon, couponCode } = req.body;
    
    const calculation = await calculatePaymentAmount(
      content,
      fontSize,
      duration,
      couponCode || undefined,
      icon || undefined
    );

    res.json({
      success: true,
      calculation: {
        ...calculation,
        formattedAmount: `₹${calculation.finalAmount.toLocaleString('en-IN')}`,
        formattedSubtotal: `₹${calculation.subtotal.toLocaleString('en-IN')}`,
        formattedDiscount: `₹${calculation.discountAmount.toLocaleString('en-IN')}`,
      }
    });
  } catch (error) {
    console.error('Payment calculation error:', error);
    res.status(500).json({ success: false, message: 'Failed to calculate payment' });
  }
});

// POST /api/payment/apply-coupon - Validate and apply coupon code
router.post('/apply-coupon', sanitizeInput, validate(paymentSchemas.applyCoupon), async (req, res) => {
  try {
    const { couponCode, content, fontSize, duration, icon } = req.body;
    
    const calculation = await calculatePaymentAmount(
      content,
      fontSize,
      duration,
      couponCode,
      icon || undefined
    );

    if (!calculation.couponValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired coupon code'
      });
    }

    res.json({
      success: true,
      calculation: {
        ...calculation,
        formattedAmount: `₹${calculation.finalAmount.toLocaleString('en-IN')}`,
        formattedSubtotal: `₹${calculation.subtotal.toLocaleString('en-IN')}`,
        formattedDiscount: `₹${calculation.discountAmount.toLocaleString('en-IN')}`,
      }
    });
  } catch (error) {
    console.error('Coupon application error:', error);
    res.status(500).json({ success: false, message: 'Failed to apply coupon' });
  }
});

// POST /api/payment/create-link - Create payment link for a post
router.post('/create-link', sanitizeInput, validate(paymentSchemas.createPaymentLink), async (req, res) => {
  try {
    const { postId } = req.body;
    
    // Get post details
    const [post] = await db.select().from(posts).where(eq(posts.id, postId));
    
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    if (post.status !== 'payment_pending') {
      return res.status(400).json({ 
        success: false, 
        message: 'Post is not in payment pending status' 
      });
    }

    // Calculate payment amount
    const calculation = await calculatePaymentAmount(
      post.content,
      post.fontSize as 'default' | 'large',
      post.expiresAt ? Math.ceil((new Date(post.expiresAt).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) as 14 | 21 | 28 : 14,
      post.couponCode || undefined,
      post.icon || undefined
    );

    // Create payment transaction record
    const [paymentTransaction] = await db.insert(paymentTransactions).values({
      postId: post.id,
      amount: calculation.subtotal,
      finalAmount: calculation.finalAmount,
      couponCode: post.couponCode,
      discountAmount: calculation.discountAmount,
      status: 'pending',
    }).returning();

    // Create payment link
    const paymentLink = await RazorpayService.createPaymentLink(
      calculation.finalAmount,
      post.id,
      post.email,
      `Payment for matrimonial ad - Post #${post.id}`,
      Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 days expiry
    );

    // Update payment transaction with Razorpay details
    await db.update(paymentTransactions)
      .set({
        razorpayPaymentLinkId: paymentLink.id,
        razorpayPaymentLinkReferenceId: paymentLink.reference_id,
      })
      .where(eq(paymentTransactions.id, paymentTransaction.id));

    res.json({
      success: true,
      paymentLink: paymentLink.short_url,
      paymentLinkId: paymentLink.id,
      amount: calculation.finalAmount,
      formattedAmount: `₹${calculation.finalAmount.toLocaleString('en-IN')}`,
    });
  } catch (error) {
    console.error('Payment link creation error:', error);
    res.status(500).json({ success: false, message: 'Failed to create payment link' });
  }
});

// POST /api/payment/verify - Verify payment via webhook
router.post('/verify', sanitizeInput, validate(paymentSchemas.verifyPayment), async (req, res) => {
  try {
    const { paymentLinkId, paymentId, paymentLinkReferenceId, paymentLinkStatus, signature } = req.body;
    
    // Verify signature
    const isValidSignature = RazorpayService.verifyPaymentSignature(
      paymentLinkId,
      paymentId,
      paymentLinkReferenceId,
      paymentLinkStatus,
      signature
    );

    if (!isValidSignature) {
      return res.status(400).json({ success: false, message: 'Invalid signature' });
    }

    // Get payment transaction
    const [paymentTransaction] = await db.select()
      .from(paymentTransactions)
      .where(eq(paymentTransactions.razorpayPaymentLinkId, paymentLinkId));

    if (!paymentTransaction) {
      return res.status(404).json({ success: false, message: 'Payment transaction not found' });
    }

    // Update payment transaction status
    const newStatus = paymentLinkStatus === 'paid' ? 'completed' : 'failed';
    await db.update(paymentTransactions)
      .set({
        razorpayPaymentId: paymentId,
        status: newStatus,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(paymentTransactions.id, paymentTransaction.id));

    // If payment is successful, update post status to published
    if (newStatus === 'completed') {
      await db.update(posts)
        .set({
          status: 'published',
          paymentTransactionId: paymentTransaction.id,
          baseAmount: paymentTransaction.amount,
          finalAmount: paymentTransaction.finalAmount,
        })
        .where(eq(posts.id, paymentTransaction.postId!));

      // Update coupon usage count if applicable
      if (paymentTransaction.couponCode) {
        const [coupon] = await db.select().from(couponCodes).where(eq(couponCodes.code, paymentTransaction.couponCode));
        if (coupon) {
          await db.update(couponCodes)
            .set({
              usedCount: (coupon.usedCount || 0) + 1
            })
            .where(eq(couponCodes.code, paymentTransaction.couponCode));
        }
      }
    }

    res.json({ success: true, status: newStatus });
  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({ success: false, message: 'Failed to verify payment' });
  }
});

// POST /api/payment/verify-callback - verify Razorpay redirect params for UX (non-authoritative)
router.post('/verify-callback', sanitizeInput, validate(paymentSchemas.verifyCallback), async (req, res) => {
  try {
    const { payment_link_id, razorpay_payment_id, payment_link_reference_id, payment_link_status, razorpay_signature } = req.body;
    const ok = RazorpayService.verifyPaymentSignature(
      payment_link_id,
      razorpay_payment_id,
      payment_link_reference_id,
      payment_link_status,
      razorpay_signature || ''
    );
    return res.json({ success: ok });
  } catch (error) {
    console.error('Payment verify-callback error:', error);
    return res.status(400).json({ success: false, message: 'Invalid signature' });
  }
});

// GET /api/payment/status/:postId - Get payment status for a post
router.get('/status/:postId', async (req, res) => {
  try {
    const postId = parseInt(req.params.postId);
    
    const [post] = await db.select()
      .from(posts)
      .where(eq(posts.id, postId));

    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    if (!post.paymentTransactionId) {
      return res.json({
        success: true,
        status: post.status,
        paymentRequired: false,
      });
    }

    const [paymentTransaction] = await db.select()
      .from(paymentTransactions)
      .where(eq(paymentTransactions.id, post.paymentTransactionId));

    res.json({
      success: true,
      status: post.status,
      paymentRequired: true,
      paymentStatus: paymentTransaction?.status || 'pending',
      amount: paymentTransaction?.finalAmount || 0,
      formattedAmount: paymentTransaction ? `₹${paymentTransaction.finalAmount.toLocaleString('en-IN')}` : '₹0',
    });
  } catch (error) {
    console.error('Payment status error:', error);
    res.status(500).json({ success: false, message: 'Failed to get payment status' });
  }
});

// GET /api/payment/config - Get payment configuration (public)
router.get('/config', async (req, res) => {
  try {
    const config = await getPaymentConfig();
    res.json({ success: true, config });
  } catch (error) {
    console.error('Payment config error:', error);
    res.status(500).json({ success: false, message: 'Failed to get payment configuration' });
  }
});

export default router;
