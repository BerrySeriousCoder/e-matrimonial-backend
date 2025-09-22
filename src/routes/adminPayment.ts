import express from 'express';
import { db } from '../db';
import { paymentConfigs, couponCodes, paymentTransactions, posts } from '../db/schema';
import { eq, desc } from 'drizzle-orm';
import { requireSuperadminAuth, requireRole } from '../middleware/adminAuth';
import { sanitizeInput, validate } from '../middleware/validation';
import Joi from 'joi';
import { logAdminAction } from '../utils/adminLogger';

const router = express.Router();

// Validation schemas
const adminPaymentSchemas = {
  updatePaymentConfig: Joi.object({
    basePriceFirst200: Joi.number().integer().min(0).required(),
    additionalPricePer20Chars: Joi.number().integer().min(0).required(),
    largeFontMultiplier: Joi.number().min(1.0).max(5.0).required(),
    visibility2WeeksMultiplier: Joi.number().min(0.1).max(5.0).required(),
    visibility3WeeksMultiplier: Joi.number().min(0.1).max(5.0).required(),
    visibility4WeeksMultiplier: Joi.number().min(0.1).max(5.0).required(),
  }),
  createCoupon: Joi.object({
    code: Joi.string().min(3).max(50).required(),
    discountPercentage: Joi.number().min(0).max(100).required(),
    usageLimit: Joi.number().integer().min(1).optional(),
    expiresAt: Joi.date().optional(),
  }),
  updateCoupon: Joi.object({
    discountPercentage: Joi.number().min(0).max(100).optional(),
    isActive: Joi.boolean().optional(),
    usageLimit: Joi.number().integer().min(1).optional(),
    expiresAt: Joi.date().optional(),
  }),
};

// GET /api/admin/payment/config - Get payment configuration
router.get('/config', requireSuperadminAuth, async (req, res) => {
  try {
    const [config] = await db.select().from(paymentConfigs).where(eq(paymentConfigs.id, 1));
    
    if (!config) {
      return res.status(404).json({ success: false, message: 'Payment configuration not found' });
    }

    res.json({
      success: true,
      config: {
        id: config.id,
        basePriceFirst200: config.basePriceFirst200,
        additionalPricePer20Chars: config.additionalPricePer20Chars,
        largeFontMultiplier: Number(config.largeFontMultiplier),
        visibility2WeeksMultiplier: Number(config.visibility2WeeksMultiplier),
        visibility3WeeksMultiplier: Number(config.visibility3WeeksMultiplier),
        visibility4WeeksMultiplier: Number(config.visibility4WeeksMultiplier),
        createdAt: config.createdAt,
        updatedAt: config.updatedAt,
      }
    });
  } catch (error) {
    console.error('Get payment config error:', error);
    res.status(500).json({ success: false, message: 'Failed to get payment configuration' });
  }
});

// PUT /api/admin/payment/config - Update payment configuration
router.put('/config', requireSuperadminAuth, sanitizeInput, validate(adminPaymentSchemas.updatePaymentConfig), async (req: any, res) => {
  try {
    const {
      basePriceFirst200,
      additionalPricePer20Chars,
      largeFontMultiplier,
      visibility2WeeksMultiplier,
      visibility3WeeksMultiplier,
      visibility4WeeksMultiplier,
    } = req.body;

    // Get current config for logging
    const [currentConfig] = await db.select().from(paymentConfigs).where(eq(paymentConfigs.id, 1));
    
    const [updatedConfig] = await db.update(paymentConfigs)
      .set({
        basePriceFirst200,
        additionalPricePer20Chars,
        largeFontMultiplier: largeFontMultiplier.toString(),
        visibility2WeeksMultiplier: visibility2WeeksMultiplier.toString(),
        visibility3WeeksMultiplier: visibility3WeeksMultiplier.toString(),
        visibility4WeeksMultiplier: visibility4WeeksMultiplier.toString(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(paymentConfigs.id, 1))
      .returning();

    // Log the action
    await logAdminAction(req, {
      action: 'update_payment_config',
      entityType: 'payment_config',
      entityId: 1,
      oldData: currentConfig,
      newData: updatedConfig,
      details: `Admin ${req.admin!.email} updated payment configuration`,
    });

    res.json({
      success: true,
      message: 'Payment configuration updated successfully',
      config: updatedConfig
    });
  } catch (error) {
    console.error('Update payment config error:', error);
    res.status(500).json({ success: false, message: 'Failed to update payment configuration' });
  }
});

// GET /api/admin/coupons - Get all coupon codes
router.get('/coupons', requireRole(['superadmin', 'admin']), async (req, res) => {
  try {
    const coupons = await db.select()
      .from(couponCodes)
      .orderBy(desc(couponCodes.createdAt));

    res.json({
      success: true,
      coupons: coupons.map(coupon => ({
        id: coupon.id,
        code: coupon.code,
        discountPercentage: Number(coupon.discountPercentage),
        isActive: coupon.isActive,
        usageLimit: coupon.usageLimit,
        usedCount: coupon.usedCount,
        expiresAt: coupon.expiresAt,
        createdAt: coupon.createdAt,
        usagePercentage: coupon.usageLimit ? (coupon.usedCount / coupon.usageLimit) * 100 : 0,
      }))
    });
  } catch (error) {
    console.error('Get coupons error:', error);
    res.status(500).json({ success: false, message: 'Failed to get coupon codes' });
  }
});

// POST /api/admin/coupons - Create new coupon code
router.post('/coupons', requireSuperadminAuth, sanitizeInput, validate(adminPaymentSchemas.createCoupon), async (req: any, res) => {
  try {
    const { code, discountPercentage, usageLimit, expiresAt } = req.body;

    // Check if coupon code already exists
    const [existingCoupon] = await db.select()
      .from(couponCodes)
      .where(eq(couponCodes.code, code));

    if (existingCoupon) {
      return res.status(400).json({ success: false, message: 'Coupon code already exists' });
    }

    const [newCoupon] = await db.insert(couponCodes).values({
      code,
      discountPercentage: discountPercentage.toString(),
      usageLimit,
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
    }).returning();

    // Log the action
    await logAdminAction(req, {
      action: 'create_coupon',
      entityType: 'coupon',
      entityId: newCoupon.id,
      newData: newCoupon,
      details: `Admin ${req.admin!.email} created coupon code: ${code}`,
    });

    res.status(201).json({
      success: true,
      message: 'Coupon code created successfully',
      coupon: newCoupon
    });
  } catch (error) {
    console.error('Create coupon error:', error);
    res.status(500).json({ success: false, message: 'Failed to create coupon code' });
  }
});

// PUT /api/admin/coupons/:id - Update coupon code
router.put('/coupons/:id', requireSuperadminAuth, sanitizeInput, validate(adminPaymentSchemas.updateCoupon), async (req: any, res) => {
  try {
    const couponId = parseInt(req.params.id);
    const { discountPercentage, isActive, usageLimit, expiresAt } = req.body;

    // Get current coupon for logging
    const [currentCoupon] = await db.select()
      .from(couponCodes)
      .where(eq(couponCodes.id, couponId));

    if (!currentCoupon) {
      return res.status(404).json({ success: false, message: 'Coupon not found' });
    }

    const updateData: any = {};
    if (discountPercentage !== undefined) updateData.discountPercentage = discountPercentage.toString();
    if (isActive !== undefined) updateData.isActive = isActive;
    if (usageLimit !== undefined) updateData.usageLimit = usageLimit;
    if (expiresAt !== undefined) updateData.expiresAt = expiresAt ? new Date(expiresAt) : null;

    const [updatedCoupon] = await db.update(couponCodes)
      .set(updateData)
      .where(eq(couponCodes.id, couponId))
      .returning();

    // Log the action
    await logAdminAction(req, {
      action: 'update_coupon',
      entityType: 'coupon',
      entityId: couponId,
      oldData: currentCoupon,
      newData: updatedCoupon,
      details: `Admin ${req.admin!.email} updated coupon code: ${currentCoupon.code}`,
    });

    res.json({
      success: true,
      message: 'Coupon code updated successfully',
      coupon: updatedCoupon
    });
  } catch (error) {
    console.error('Update coupon error:', error);
    res.status(500).json({ success: false, message: 'Failed to update coupon code' });
  }
});

// DELETE /api/admin/coupons/:id - Deactivate coupon code
router.delete('/coupons/:id', requireSuperadminAuth, async (req: any, res) => {
  try {
    const couponId = parseInt(req.params.id);

    // Get current coupon for logging
    const [currentCoupon] = await db.select()
      .from(couponCodes)
      .where(eq(couponCodes.id, couponId));

    if (!currentCoupon) {
      return res.status(404).json({ success: false, message: 'Coupon not found' });
    }

    // Deactivate instead of deleting
    const [updatedCoupon] = await db.update(couponCodes)
      .set({ isActive: false })
      .where(eq(couponCodes.id, couponId))
      .returning();

    // Log the action
    await logAdminAction(req, {
      action: 'deactivate_coupon',
      entityType: 'coupon',
      entityId: couponId,
      oldData: currentCoupon,
      newData: updatedCoupon,
      details: `Admin ${req.admin!.email} deactivated coupon code: ${currentCoupon.code}`,
    });

    res.json({
      success: true,
      message: 'Coupon code deactivated successfully'
    });
  } catch (error) {
    console.error('Deactivate coupon error:', error);
    res.status(500).json({ success: false, message: 'Failed to deactivate coupon code' });
  }
});

// GET /api/admin/payment/transactions - Get payment transactions
router.get('/transactions', requireRole(['superadmin', 'admin']), async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    const transactions = await db.select({
      id: paymentTransactions.id,
      postId: paymentTransactions.postId,
      amount: paymentTransactions.amount,
      finalAmount: paymentTransactions.finalAmount,
      status: paymentTransactions.status,
      couponCode: paymentTransactions.couponCode,
      discountAmount: paymentTransactions.discountAmount,
      createdAt: paymentTransactions.createdAt,
      updatedAt: paymentTransactions.updatedAt,
      postEmail: posts.email,
      postContent: posts.content,
    })
      .from(paymentTransactions)
      .leftJoin(posts, eq(paymentTransactions.postId, posts.id))
      .orderBy(desc(paymentTransactions.createdAt))
      .limit(limit)
      .offset(offset);

    const totalCount = await db.select({ count: paymentTransactions.id })
      .from(paymentTransactions);

    res.json({
      success: true,
      transactions: transactions.map(tx => ({
        ...tx,
        formattedAmount: `₹${tx.finalAmount.toLocaleString('en-IN')}`,
        formattedDiscount: `₹${tx.discountAmount.toLocaleString('en-IN')}`,
      })),
      pagination: {
        page,
        limit,
        total: totalCount.length,
        pages: Math.ceil(totalCount.length / limit),
      }
    });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ success: false, message: 'Failed to get payment transactions' });
  }
});

export default router;
