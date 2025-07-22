import express from 'express';
import bcrypt from 'bcryptjs';
import { eq, and, desc, like, sql } from 'drizzle-orm';
import { db } from '../db';
import { admins } from '../db/schema';
import { requireSuperadminAuth, AdminRequest } from '../middleware/adminAuth';
import { logAdminAction } from '../utils/adminLogger';

const router = express.Router();

// GET /api/admin/management - List all admins with search and pagination
router.get('/', requireSuperadminAuth, async (req: AdminRequest, res) => {
  try {
    const { search, page = 1 } = req.query;
    const limit = 20;
    const offset = (Number(page) - 1) * limit;

    // Build where conditions
    const whereConditions = [];
    if (search && typeof search === 'string') {
      whereConditions.push(like(admins.email, `%${search}%`));
    }

    const [adminsData, totalCount] = await Promise.all([
      db.select({
        id: admins.id,
        email: admins.email,
        createdAt: admins.createdAt,
      })
        .from(admins)
        .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
        .orderBy(desc(admins.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ count: sql<number>`count(*)` })
        .from(admins)
        .where(whereConditions.length > 0 ? and(...whereConditions) : undefined),
    ]);

    const total = totalCount[0]?.count || 0;
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      admins: adminsData,
      total,
      page: Number(page),
      totalPages,
    });
  } catch (error) {
    console.error('Error fetching admins:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch admins' });
  }
});

// POST /api/admin/management - Create new admin
router.post('/', requireSuperadminAuth, async (req: AdminRequest, res) => {
  try {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format'
      });
    }

    // Validate password strength (minimum 6 characters)
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters long'
      });
    }

    // Check if admin already exists
    const existingAdmin = await db.select().from(admins).where(eq(admins.email, email));
    if (existingAdmin.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Admin with this email already exists'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new admin
    const [newAdmin] = await db.insert(admins)
      .values({
        email,
        password: hashedPassword,
      })
      .returning({
        id: admins.id,
        email: admins.email,
        createdAt: admins.createdAt,
      });

    // Log the action
    await logAdminAction(req, {
      action: 'create_admin',
      entityType: 'admin',
      entityId: newAdmin.id,
      details: `Superadmin ${req.admin!.email} created new admin: ${email}`,
    });

    res.status(201).json({
      success: true,
      message: 'Admin created successfully',
      admin: newAdmin,
    });
  } catch (error) {
    console.error('Error creating admin:', error);
    res.status(500).json({ success: false, error: 'Failed to create admin' });
  }
});

// PUT /api/admin/management/:id/password - Reset admin password
router.put('/:id/password', requireSuperadminAuth, async (req: AdminRequest, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    // Validate required fields
    if (!password) {
      return res.status(400).json({
        success: false,
        error: 'Password is required'
      });
    }

    // Validate password strength (minimum 6 characters)
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters long'
      });
    }

    // Check if admin exists
    const existingAdmin = await db.select().from(admins).where(eq(admins.id, Number(id)));
    if (existingAdmin.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Admin not found'
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update admin password
    await db.update(admins)
      .set({ password: hashedPassword })
      .where(eq(admins.id, Number(id)));

    // Log the action
    await logAdminAction(req, {
      action: 'reset_admin_password',
      entityType: 'admin',
      entityId: Number(id),
      details: `Superadmin ${req.admin!.email} reset password for admin: ${existingAdmin[0].email}`,
    });

    res.json({
      success: true,
      message: 'Admin password reset successfully',
    });
  } catch (error) {
    console.error('Error resetting admin password:', error);
    res.status(500).json({ success: false, error: 'Failed to reset admin password' });
  }
});

// DELETE /api/admin/management/:id - Delete admin (optional)
router.delete('/:id', requireSuperadminAuth, async (req: AdminRequest, res) => {
  try {
    const { id } = req.params;

    // Check if admin exists
    const existingAdmin = await db.select().from(admins).where(eq(admins.id, Number(id)));
    if (existingAdmin.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Admin not found'
      });
    }

    // Prevent superadmin from deleting themselves
    if (existingAdmin[0].email === req.admin!.email) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete your own account'
      });
    }

    // Delete admin
    await db.delete(admins).where(eq(admins.id, Number(id)));

    // Log the action
    await logAdminAction(req, {
      action: 'delete_admin',
      entityType: 'admin',
      entityId: Number(id),
      details: `Superadmin ${req.admin!.email} deleted admin: ${existingAdmin[0].email}`,
    });

    res.json({
      success: true,
      message: 'Admin deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting admin:', error);
    res.status(500).json({ success: false, error: 'Failed to delete admin' });
  }
});

export default router; 