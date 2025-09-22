import { Router } from 'express';
import { db } from '../db';
import { searchFilterSections, searchFilterOptions, posts } from '../db/schema';
import { eq, and, inArray, desc, asc, ne, gte, lte, sql } from 'drizzle-orm';
import { requireSuperadminAuth } from '../middleware/adminAuth';
import { validate, sanitizeInput, schemas } from '../middleware/validation';

const router = Router();

// Helper function to reorder sections
const reorderSections = async (targetId: number, newOrder: number) => {
  const allSections = await db
    .select()
    .from(searchFilterSections)
    .orderBy(asc(searchFilterSections.order), asc(searchFilterSections.id));

  const targetSection = allSections.find(s => s.id === targetId);
  if (!targetSection) return;

  const oldOrder = targetSection.order;
  
  // If moving to the same position, no need to reorder
  if (oldOrder === newOrder) return;

  if (newOrder > oldOrder) {
    // Moving down: shift items between oldOrder+1 and newOrder up by 1
    await db
      .update(searchFilterSections)
      .set({ 
        order: sql`${searchFilterSections.order} - 1`,
        updatedAt: new Date().toISOString()
      })
      .where(and(
        gte(searchFilterSections.order, oldOrder + 1),
        lte(searchFilterSections.order, newOrder)
      ));
  } else {
    // Moving up: shift items between newOrder and oldOrder-1 down by 1
    await db
      .update(searchFilterSections)
      .set({ 
        order: sql`${searchFilterSections.order} + 1`,
        updatedAt: new Date().toISOString()
      })
      .where(and(
        gte(searchFilterSections.order, newOrder),
        lte(searchFilterSections.order, oldOrder - 1)
      ));
  }
};

// Helper function to reorder options within a section
const reorderOptions = async (targetId: number, sectionId: number, newOrder: number) => {
  const allOptions = await db
    .select()
    .from(searchFilterOptions)
    .where(eq(searchFilterOptions.sectionId, sectionId))
    .orderBy(asc(searchFilterOptions.order), asc(searchFilterOptions.id));

  const targetOption = allOptions.find(o => o.id === targetId);
  if (!targetOption) return;

  const oldOrder = targetOption.order;
  
  // If moving to the same position, no need to reorder
  if (oldOrder === newOrder) {
    // Still run normalization to fix any existing duplicates
    const allAfter = await db
      .select()
      .from(searchFilterOptions)
      .where(eq(searchFilterOptions.sectionId, sectionId))
      .orderBy(asc(searchFilterOptions.order), asc(searchFilterOptions.id));
    for (let i = 0; i < allAfter.length; i++) {
      if (allAfter[i].order !== i + 1) {
        await db
          .update(searchFilterOptions)
          .set({ order: i + 1, updatedAt: new Date().toISOString() })
          .where(eq(searchFilterOptions.id, allAfter[i].id));
      }
    }
    return;
  }

  if (newOrder > oldOrder) {
    // Moving down: shift items between oldOrder+1 and newOrder up by 1
    await db
      .update(searchFilterOptions)
      .set({ 
        order: sql`${searchFilterOptions.order} - 1`,
        updatedAt: new Date().toISOString()
      })
      .where(and(
        eq(searchFilterOptions.sectionId, sectionId),
        gte(searchFilterOptions.order, oldOrder + 1),
        lte(searchFilterOptions.order, newOrder)
      ));
  } else {
    // Moving up: shift items between newOrder and oldOrder-1 down by 1
    await db
      .update(searchFilterOptions)
      .set({ 
        order: sql`${searchFilterOptions.order} + 1`,
        updatedAt: new Date().toISOString()
      })
      .where(and(
        eq(searchFilterOptions.sectionId, sectionId),
        gte(searchFilterOptions.order, newOrder),
        lte(searchFilterOptions.order, oldOrder - 1)
      ));
  }

  // Set the target option's order to the new order
  await db
    .update(searchFilterOptions)
    .set({ order: newOrder, updatedAt: new Date().toISOString() })
    .where(eq(searchFilterOptions.id, targetId));

  // --- Robust normalization: re-sequence all orders in this section ---
  const allAfter = await db
    .select()
    .from(searchFilterOptions)
    .where(eq(searchFilterOptions.sectionId, sectionId))
    .orderBy(asc(searchFilterOptions.order), asc(searchFilterOptions.id));
  for (let i = 0; i < allAfter.length; i++) {
    if (allAfter[i].order !== i + 1) {
      await db
        .update(searchFilterOptions)
        .set({ order: i + 1, updatedAt: new Date().toISOString() })
        .where(eq(searchFilterOptions.id, allAfter[i].id));
    }
  }
};

// GET /api/search-filters - Get all active sections and options
router.get('/', async (req, res) => {
  try {
    const sections = await db
      .select()
      .from(searchFilterSections)
      .where(eq(searchFilterSections.isActive, true))
      .orderBy(asc(searchFilterSections.order), asc(searchFilterSections.id));

    const options = await db
      .select()
      .from(searchFilterOptions)
      .where(eq(searchFilterOptions.isActive, true))
      .orderBy(asc(searchFilterOptions.order), asc(searchFilterOptions.id));

    // Group options by section
    const sectionsWithOptions = sections.map(section => ({
      ...section,
      options: options.filter(option => option.sectionId === section.id)
    }));

    res.json({ sections: sectionsWithOptions });
  } catch (error) {
    console.error('Error fetching search filters:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/search-filters/admin - Get all sections and options (including inactive) for admin
router.get('/admin', requireSuperadminAuth, async (req, res) => {
  try {
    const sections = await db
      .select()
      .from(searchFilterSections)
      .orderBy(asc(searchFilterSections.order), asc(searchFilterSections.id));

    const options = await db
      .select()
      .from(searchFilterOptions)
      .orderBy(asc(searchFilterOptions.order), asc(searchFilterOptions.id));

    // Group options by section
    const sectionsWithOptions = sections.map(section => ({
      ...section,
      options: options.filter(option => option.sectionId === section.id)
    }));

    res.json({ sections: sectionsWithOptions });
  } catch (error) {
    console.error('Error fetching search filters for admin:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/search-filters/sections - Create new section (Superadmin only)
router.post('/sections', requireSuperadminAuth, sanitizeInput, validate(schemas.createSearchFilterSection), async (req, res) => {
  try {
    const { name, displayName, description, order } = req.body;
    
    // Check if section name already exists
    const existingSection = await db
      .select()
      .from(searchFilterSections)
      .where(eq(searchFilterSections.name, name))
      .limit(1);

    if (existingSection.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Section name already exists' 
      });
    }

    // If order is specified and greater than 1, shift existing items
    if (order && order > 1) {
      await db
        .update(searchFilterSections)
        .set({ 
          order: sql`${searchFilterSections.order} + 1`,
          updatedAt: new Date().toISOString()
        })
        .where(gte(searchFilterSections.order, order));
    }
    
    const result = await db.insert(searchFilterSections).values({
      name,
      displayName,
      description,
      order: order || 1,
    }).returning();

    res.json({ 
      success: true,
      section: result[0] 
    });
  } catch (error) {
    console.error('Error creating search filter section:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error' 
    });
  }
});

// PUT /api/search-filters/sections/:id - Update section (Superadmin only)
router.put('/sections/:id', requireSuperadminAuth, sanitizeInput, validate(schemas.updateSearchFilterSection), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, displayName, description, order, isActive } = req.body;
    
    // Check if section exists
    const existingSection = await db
      .select()
      .from(searchFilterSections)
      .where(eq(searchFilterSections.id, parseInt(id)))
      .limit(1);

    if (existingSection.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'Section not found' 
      });
    }

    // Check if name conflicts with other sections
    const nameConflict = await db
      .select()
      .from(searchFilterSections)
      .where(and(
        eq(searchFilterSections.name, name),
        ne(searchFilterSections.id, parseInt(id))
      ))
      .limit(1);

    if (nameConflict.length > 0) {
      return res.status(400).json({ 
        success: false,
        message: 'Section name already exists' 
      });
    }

    const oldOrder = existingSection[0].order;
    
    // First, reorder if the order has changed
    if (oldOrder !== order) {
      await reorderSections(parseInt(id), order);
    }
    
    const result = await db
      .update(searchFilterSections)
      .set({
        name,
        displayName,
        description,
        order,
        isActive,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(searchFilterSections.id, parseInt(id)))
      .returning();

    res.json({ 
      success: true,
      section: result[0] 
    });
  } catch (error) {
    console.error('Error updating search filter section:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error' 
    });
  }
});

// DELETE /api/search-filters/sections/:id - Delete section (Superadmin only)
router.delete('/sections/:id', requireSuperadminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if section exists
    const existingSection = await db
      .select()
      .from(searchFilterSections)
      .where(eq(searchFilterSections.id, parseInt(id)))
      .limit(1);

    if (existingSection.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'Section not found' 
      });
    }

    // Delete section (cascade will handle options and tags)
    await db.delete(searchFilterSections).where(eq(searchFilterSections.id, parseInt(id)));

    res.json({ 
      success: true,
      message: 'Section deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting search filter section:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error' 
    });
  }
});

// POST /api/search-filters/options - Create new option (Superadmin only)
router.post('/options', requireSuperadminAuth, sanitizeInput, validate(schemas.createSearchFilterOption), async (req, res) => {
  try {
    const { sectionId, value, displayName, order } = req.body;
    
    // Check if section exists
    const existingSection = await db
      .select()
      .from(searchFilterSections)
      .where(eq(searchFilterSections.id, sectionId))
      .limit(1);

    if (existingSection.length === 0) {
      return res.status(400).json({ 
        success: false,
        message: 'Section not found' 
      });
    }

    // Check if option value already exists in this section
    const existingOption = await db
      .select()
      .from(searchFilterOptions)
      .where(and(
        eq(searchFilterOptions.sectionId, sectionId),
        eq(searchFilterOptions.value, value)
      ))
      .limit(1);

    if (existingOption.length > 0) {
      return res.status(400).json({ 
        success: false,
        message: 'Option value already exists in this section' 
      });
    }

    // If order is specified and greater than 1, shift existing items in this section
    if (order && order > 1) {
      await db
        .update(searchFilterOptions)
        .set({ 
          order: sql`${searchFilterOptions.order} + 1`,
          updatedAt: new Date().toISOString()
        })
        .where(and(
          eq(searchFilterOptions.sectionId, sectionId),
          gte(searchFilterOptions.order, order)
        ));
    }
    
    const result = await db.insert(searchFilterOptions).values({
      sectionId,
      value,
      displayName,
      order: order || 1,
    }).returning();

    res.json({ 
      success: true,
      option: result[0] 
    });
  } catch (error) {
    console.error('Error creating search filter option:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error' 
    });
  }
});

// PUT /api/search-filters/options/:id - Update option (Superadmin only)
router.put('/options/:id', requireSuperadminAuth, sanitizeInput, validate(schemas.updateSearchFilterOption), async (req, res) => {
  try {
    const { id } = req.params;
    const { sectionId, value, displayName, order, isActive } = req.body;
    
    // Check if option exists
    const existingOption = await db
      .select()
      .from(searchFilterOptions)
      .where(eq(searchFilterOptions.id, parseInt(id)))
      .limit(1);

    if (existingOption.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'Option not found' 
      });
    }

    // Check if section exists
    const existingSection = await db
      .select()
      .from(searchFilterSections)
      .where(eq(searchFilterSections.id, sectionId))
      .limit(1);

    if (existingSection.length === 0) {
      return res.status(400).json({ 
        success: false,
        message: 'Section not found' 
      });
    }

    // Check if value conflicts with other options in the same section
    const valueConflict = await db
      .select()
      .from(searchFilterOptions)
      .where(and(
        eq(searchFilterOptions.sectionId, sectionId),
        eq(searchFilterOptions.value, value),
        ne(searchFilterOptions.id, parseInt(id))
      ))
      .limit(1);

    if (valueConflict.length > 0) {
      return res.status(400).json({ 
        success: false,
        message: 'Option value already exists in this section' 
      });
    }

    const oldOrder = existingOption[0].order;
    const oldSectionId = existingOption[0].sectionId;
    
    // Update the option (do NOT update order directly)
    const result = await db
      .update(searchFilterOptions)
      .set({
        sectionId,
        value,
        displayName,
        isActive,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(searchFilterOptions.id, parseInt(id)))
      .returning();

    // If order or section changed, reorder options
    if (oldOrder !== order || oldSectionId !== sectionId) {
      // If section changed, normalize orders in both sections
      if (oldSectionId !== sectionId) {
        // For cross-section moves, we need to reorder both sections
        // First, get all options in the old section and reorder them
        const oldSectionOptions = await db
          .select()
          .from(searchFilterOptions)
          .where(eq(searchFilterOptions.sectionId, oldSectionId))
          .orderBy(asc(searchFilterOptions.order), asc(searchFilterOptions.id));
        
        for (let i = 0; i < oldSectionOptions.length; i++) {
          if (oldSectionOptions[i].order !== i + 1) {
            await db
              .update(searchFilterOptions)
              .set({ order: i + 1, updatedAt: new Date().toISOString() })
              .where(eq(searchFilterOptions.id, oldSectionOptions[i].id));
          }
        }
        
        // Then reorder the new section
        await reorderOptions(parseInt(id), sectionId, order);
      } else {
        // Same section, just reorder
        await reorderOptions(parseInt(id), sectionId, order);
      }
    } else if (order !== undefined) {
      // Even if order didn't change, if an order was specified, normalize to fix any duplicates
      await reorderOptions(parseInt(id), sectionId, order);
    }

    res.json({ 
      success: true,
      option: result[0] 
    });
  } catch (error) {
    console.error('Error updating search filter option:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error' 
    });
  }
});

// DELETE /api/search-filters/options/:id - Delete option (Superadmin only)
router.delete('/options/:id', requireSuperadminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if option exists
    const existingOption = await db
      .select()
      .from(searchFilterOptions)
      .where(eq(searchFilterOptions.id, parseInt(id)))
      .limit(1);

    if (existingOption.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'Option not found' 
      });
    }

    // Delete option (cascade will handle tags)
    await db.delete(searchFilterOptions).where(eq(searchFilterOptions.id, parseInt(id)));

    res.json({ 
      success: true,
      message: 'Option deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting search filter option:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error' 
    });
  }
});



export default router; 