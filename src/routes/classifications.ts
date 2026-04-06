import { Router } from 'express';
import { db } from '../db';
import { classificationCategories, classificationOptions } from '../db/schema';
import { eq, asc } from 'drizzle-orm';

const router = Router();

// GET /api/classifications - returns full classification tree
router.get('/', async (_req, res) => {
  try {
    const categories = await db.select()
      .from(classificationCategories)
      .where(eq(classificationCategories.isActive, true))
      .orderBy(asc(classificationCategories.order));

    const options = await db.select()
      .from(classificationOptions)
      .where(eq(classificationOptions.isActive, true))
      .orderBy(asc(classificationOptions.order));

    const tree = categories.map(cat => ({
      id: cat.id,
      name: cat.name,
      displayName: cat.displayName,
      order: cat.order,
      options: options
        .filter(opt => opt.categoryId === cat.id)
        .map(opt => ({
          id: opt.id,
          name: opt.name,
          displayName: opt.displayName,
          forBride: opt.forBride,
          forGroom: opt.forGroom,
          order: opt.order,
        })),
    }));

    res.json({ success: true, classifications: tree });
  } catch (error) {
    console.error('Error fetching classifications:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

export default router;
