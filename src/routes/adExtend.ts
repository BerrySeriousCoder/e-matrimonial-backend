import express from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../db';
import { posts, paymentTransactions } from '../db/schema';
import { eq } from 'drizzle-orm';
import { calculatePaymentAmount } from '../utils/paymentCalculation';
import RazorpayService from '../utils/razorpayService';
import { sendEmail } from '../utils/sendEmail';
import { tmplAdExtended } from '../utils/emailTemplates';

const router = express.Router();

// Middleware to verify and extract the ad-extend JWT token
function verifyExtendToken(req: express.Request, res: express.Response, next: express.NextFunction) {
  const token = req.params.token;
  if (!token) {
    return res.status(400).json({ success: false, message: 'Token is required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { postId: number; type: string };
    if (decoded.type !== 'ad_extend') {
      return res.status(400).json({ success: false, message: 'Invalid token type' });
    }
    (req as any).extendData = decoded;
    next();
  } catch (error) {
    if ((error as any).name === 'TokenExpiredError') {
      return res.status(410).json({ success: false, message: 'This extension link has expired' });
    }
    return res.status(400).json({ success: false, message: 'Invalid or expired token' });
  }
}

// GET /api/ad-extend/:token — Get post details for extension page
router.get('/:token', verifyExtendToken, async (req, res) => {
  try {
    const { postId } = (req as any).extendData;

    const [post] = await db.select().from(posts).where(eq(posts.id, postId));
    if (!post) {
      return res.status(404).json({ success: false, message: 'Ad not found' });
    }

    // Only published or recently expired posts can be extended
    if (post.status !== 'published' && post.status !== 'expired') {
      return res.status(400).json({ success: false, message: 'This ad cannot be extended' });
    }

    // Calculate extension price (fixed 2-week duration, same content/add-ons, no coupon)
    const calculation = await calculatePaymentAmount(
      post.content,
      post.fontSize as 'default' | 'large',
      14, // Fixed 2-week extension
      undefined, // No coupon for extensions
      post.icon || undefined,
      post.bgColor || undefined
    );

    // Calculate time remaining
    const now = new Date();
    const expiresAt = post.expiresAt ? new Date(post.expiresAt) : now;
    const timeLeftMs = Math.max(0, expiresAt.getTime() - now.getTime());
    const hoursLeft = Math.floor(timeLeftMs / (1000 * 60 * 60));
    const minutesLeft = Math.floor((timeLeftMs % (1000 * 60 * 60)) / (1000 * 60));

    res.json({
      success: true,
      post: {
        id: post.id,
        email: post.email,
        content: post.content,
        lookingFor: post.lookingFor,
        fontSize: post.fontSize,
        bgColor: post.bgColor,
        icon: post.icon,
        classificationId: post.classificationId,
        expiresAt: post.expiresAt,
        status: post.status,
        duration: post.duration,
      },
      timeRemaining: {
        hours: hoursLeft,
        minutes: minutesLeft,
        isExpired: timeLeftMs === 0,
        text: timeLeftMs === 0
          ? 'Expired'
          : hoursLeft > 24
            ? `${Math.floor(hoursLeft / 24)} day(s) and ${hoursLeft % 24} hour(s)`
            : hoursLeft > 0
              ? `${hoursLeft} hour(s) and ${minutesLeft} minute(s)`
              : `${minutesLeft} minute(s)`,
      },
      extensionPrice: {
        amount: calculation.finalAmount,
        formattedAmount: `₹${calculation.finalAmount.toLocaleString('en-IN')}`,
        breakdown: {
          baseAmount: calculation.baseAmount,
          additionalCost: calculation.additionalCost,
          iconCost: calculation.iconCost,
          highlightColorCost: calculation.highlightColorCost,
          fontMultiplier: calculation.fontMultiplier,
          subtotal: calculation.subtotal,
          finalAmount: calculation.finalAmount,
        },
      },
    });
  } catch (error) {
    console.error('Ad extend get error:', error);
    res.status(500).json({ success: false, message: 'Failed to get ad details' });
  }
});

// POST /api/ad-extend/:token/create-order — Create Razorpay order for extension
router.post('/:token/create-order', verifyExtendToken, async (req, res) => {
  try {
    const { postId } = (req as any).extendData;

    const [post] = await db.select().from(posts).where(eq(posts.id, postId));
    if (!post) {
      return res.status(404).json({ success: false, message: 'Ad not found' });
    }

    if (post.status !== 'published' && post.status !== 'expired') {
      return res.status(400).json({ success: false, message: 'This ad cannot be extended' });
    }

    // Calculate extension price server-side (never trust client)
    const calculation = await calculatePaymentAmount(
      post.content,
      post.fontSize as 'default' | 'large',
      14, // Fixed 2-week extension
      undefined, // No coupon
      post.icon || undefined,
      post.bgColor || undefined
    );

    // Create Razorpay Order with receipt prefix to identify extension payments
    const order = await RazorpayService.createOrder(
      calculation.finalAmount,
      post.id,
      `extend_${post.id}_${Date.now()}`
    );

    // Create payment transaction record
    await db.insert(paymentTransactions).values({
      postId: post.id,
      amount: calculation.subtotal,
      finalAmount: calculation.finalAmount,
      razorpayOrderId: order.id,
      status: 'pending',
    });

    res.json({
      success: true,
      orderId: order.id,
      amount: calculation.finalAmount * 100, // paise for Razorpay Checkout
      currency: 'INR',
      key: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error('Ad extend create-order error:', error);
    res.status(500).json({ success: false, message: 'Failed to create payment order' });
  }
});

// POST /api/ad-extend/:token/verify-order — Verify payment and apply extension
router.post('/:token/verify-order', async (req, res) => {
  try {
    // Verify token first
    const token = req.params.token;
    let decoded: { postId: number; type: string };
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET!) as { postId: number; type: string };
      if (decoded.type !== 'ad_extend') {
        return res.status(400).json({ success: false, message: 'Invalid token type' });
      }
    } catch (tokenError) {
      if ((tokenError as any).name === 'TokenExpiredError') {
        return res.status(410).json({ success: false, message: 'Extension link has expired' });
      }
      return res.status(400).json({ success: false, message: 'Invalid token' });
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Missing payment details' });
    }

    // Verify Razorpay signature
    const isValid = RazorpayService.verifyOrderPaymentSignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    );

    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Payment verification failed' });
    }

    // Find payment transaction
    const [paymentTransaction] = await db.select()
      .from(paymentTransactions)
      .where(eq(paymentTransactions.razorpayOrderId, razorpay_order_id));

    if (!paymentTransaction) {
      return res.status(404).json({ success: false, message: 'Payment transaction not found' });
    }

    // Update payment transaction
    await db.update(paymentTransactions)
      .set({
        razorpayPaymentId: razorpay_payment_id,
        status: 'completed',
        updatedAt: new Date().toISOString(),
      })
      .where(eq(paymentTransactions.id, paymentTransaction.id));

    // Get the post
    const postId = decoded.postId;
    const [post] = await db.select().from(posts).where(eq(posts.id, postId));
    if (!post) {
      return res.status(404).json({ success: false, message: 'Ad not found' });
    }

    // Calculate new expiresAt: max(currentExpiresAt, now()) + 14 days
    // This preserves remaining time if ad hasn't expired yet
    const now = new Date();
    const currentExpiry = post.expiresAt ? new Date(post.expiresAt) : now;
    const baseTime = currentExpiry > now ? currentExpiry : now;
    const newExpiresAt = new Date(baseTime.getTime() + 14 * 24 * 60 * 60 * 1000);

    // Update post: extend expiry, set status to published (in case it expired), reset reminder flag
    await db.update(posts)
      .set({
        expiresAt: newExpiresAt.toISOString(),
        status: 'published',
        expiryReminderSent: false, // Reset so they can get another reminder for the new expiry
      })
      .where(eq(posts.id, postId));

    // Send confirmation email
    try {
      const { html, text } = tmplAdExtended({
        email: post.email,
        postId: post.id,
        content: post.content,
        newExpiresAt,
      });
      await sendEmail({
        to: post.email,
        subject: '[e-matrimonial.in] Your ad has been extended!',
        text,
        html,
        disableUnsubscribe: true,
        logMetadata: { senderEmail: 'system', postId: post.id, emailType: 'ad_extended' },
      });
    } catch (emailError) {
      console.error('Error sending ad extended email:', emailError);
    }

    res.json({
      success: true,
      message: 'Ad extended successfully!',
      newExpiresAt: newExpiresAt.toISOString(),
      postId: post.id,
    });
  } catch (error) {
    console.error('Ad extend verify-order error:', error);
    res.status(500).json({ success: false, message: 'Payment verification failed' });
  }
});

export default router;
