import { Router } from 'express';
import { db } from '../db';
import { uiTexts } from '../db/schema';
import { eq } from 'drizzle-orm';
import { requireSuperadminAuth, AdminRequest } from '../middleware/adminAuth';
import { validate, sanitizeInput, schemas } from '../middleware/validation';

const router = Router();

// GET /api/ui-texts
router.get('/', async (req, res) => {
  try {
    const allTexts = await db.select().from(uiTexts);
    
    // Convert array to object format for easier frontend consumption
    const textsObject = allTexts.reduce((acc, text) => {
      acc[text.key] = text.value;
      return acc;
    }, {} as Record<string, string>);

    res.json({
      texts: textsObject,
    });
  } catch (error) {
    console.error('Error fetching UI texts:', error);
    res.status(500).json({ error: 'Failed to fetch UI texts' });
  }
});

// GET /api/ui-texts/admin - Get all texts with descriptions for admin (Superadmin Only)
router.get('/admin', requireSuperadminAuth, async (req: AdminRequest, res) => {
  try {
    const allTexts = await db.select().from(uiTexts).orderBy(uiTexts.key);
    res.json({
      success: true,
      texts: allTexts,
    });
  } catch (error) {
    console.error('Error fetching UI texts for admin:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch UI texts' });
  }
});

// PUT /api/ui-texts/admin/:key - Update a specific text (Superadmin Only)
router.put('/admin/:key', requireSuperadminAuth, sanitizeInput, validate(schemas.updateUIText), async (req: AdminRequest, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;

    await db
      .update(uiTexts)
      .set({ value, updatedAt: new Date().toISOString() })
      .where(eq(uiTexts.key, key));

  res.json({
      success: true,
      message: 'UI text updated successfully',
    });
  } catch (error) {
    console.error('Error updating UI text:', error);
    res.status(500).json({ success: false, error: 'Failed to update UI text' });
  }
});

export default router; 