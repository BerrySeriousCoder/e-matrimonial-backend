import { Router } from 'express';
import { db } from '../db';
import { searchSynonymGroups, searchSynonymWords } from '../db/schema';
import { eq, and, asc } from 'drizzle-orm';
import { requireSuperadminAuth } from '../middleware/adminAuth';
import { validate, sanitizeInput, schemas } from '../middleware/validation';

const router = Router();

// GET /api/synonyms - Get all active synonym groups with words (public, for search)
router.get('/', async (req, res) => {
  try {
    const groups = await db
      .select()
      .from(searchSynonymGroups)
      .where(eq(searchSynonymGroups.isActive, true))
      .orderBy(asc(searchSynonymGroups.name));

    const words = await db
      .select()
      .from(searchSynonymWords)
      .orderBy(asc(searchSynonymWords.word));

    // Group words by their group
    const groupsWithWords = groups.map(group => ({
      ...group,
      words: words.filter(word => word.groupId === group.id)
    }));

    res.json({ success: true, groups: groupsWithWords });
  } catch (error) {
    console.error('Error fetching synonyms:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/synonyms/admin - Get all groups with words (including inactive) for admin
router.get('/admin', requireSuperadminAuth, async (req, res) => {
  try {
    const groups = await db
      .select()
      .from(searchSynonymGroups)
      .orderBy(asc(searchSynonymGroups.name));

    const words = await db
      .select()
      .from(searchSynonymWords)
      .orderBy(asc(searchSynonymWords.word));

    // Group words by their group
    const groupsWithWords = groups.map(group => ({
      ...group,
      words: words.filter(word => word.groupId === group.id)
    }));

    res.json({ success: true, groups: groupsWithWords });
  } catch (error) {
    console.error('Error fetching synonyms for admin:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/synonyms/groups - Create new synonym group (Superadmin only)
router.post('/groups', requireSuperadminAuth, sanitizeInput, validate(schemas.createSynonymGroup), async (req, res) => {
  try {
    const { name } = req.body;

    // Check if group name already exists
    const existingGroup = await db
      .select()
      .from(searchSynonymGroups)
      .where(eq(searchSynonymGroups.name, name))
      .limit(1);

    if (existingGroup.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Group name already exists'
      });
    }

    const result = await db.insert(searchSynonymGroups).values({
      name,
    }).returning();

    res.json({
      success: true,
      group: result[0]
    });
  } catch (error) {
    console.error('Error creating synonym group:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// PUT /api/synonyms/groups/:id - Update synonym group (Superadmin only)
router.put('/groups/:id', requireSuperadminAuth, sanitizeInput, validate(schemas.updateSynonymGroup), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, isActive } = req.body;

    // Check if group exists
    const existingGroup = await db
      .select()
      .from(searchSynonymGroups)
      .where(eq(searchSynonymGroups.id, parseInt(id)))
      .limit(1);

    if (existingGroup.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }

    // Check if name conflicts with other groups
    const nameConflict = await db
      .select()
      .from(searchSynonymGroups)
      .where(and(
        eq(searchSynonymGroups.name, name),
        // Use raw SQL for not equal comparison
      ))
      .limit(1);

    // Filter out the current group from conflict check
    const actualConflict = nameConflict.filter(g => g.id !== parseInt(id));
    if (actualConflict.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Group name already exists'
      });
    }

    const result = await db
      .update(searchSynonymGroups)
      .set({
        name,
        isActive,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(searchSynonymGroups.id, parseInt(id)))
      .returning();

    res.json({
      success: true,
      group: result[0]
    });
  } catch (error) {
    console.error('Error updating synonym group:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// DELETE /api/synonyms/groups/:id - Delete synonym group (Superadmin only)
router.delete('/groups/:id', requireSuperadminAuth, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if group exists
    const existingGroup = await db
      .select()
      .from(searchSynonymGroups)
      .where(eq(searchSynonymGroups.id, parseInt(id)))
      .limit(1);

    if (existingGroup.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }

    // Delete group (cascade will handle words)
    await db.delete(searchSynonymGroups).where(eq(searchSynonymGroups.id, parseInt(id)));

    res.json({
      success: true,
      message: 'Group deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting synonym group:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// POST /api/synonyms/words - Add word to group (Superadmin only)
router.post('/words', requireSuperadminAuth, sanitizeInput, validate(schemas.createSynonymWord), async (req, res) => {
  try {
    const { groupId, word } = req.body;

    // Check if group exists
    const existingGroup = await db
      .select()
      .from(searchSynonymGroups)
      .where(eq(searchSynonymGroups.id, groupId))
      .limit(1);

    if (existingGroup.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Group not found'
      });
    }

    // Check if word already exists (globally, since words must be unique)
    const existingWord = await db
      .select()
      .from(searchSynonymWords)
      .where(eq(searchSynonymWords.word, word.toLowerCase()))
      .limit(1);

    if (existingWord.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Word already exists in another group'
      });
    }

    const result = await db.insert(searchSynonymWords).values({
      groupId,
      word: word.toLowerCase(), // Store words in lowercase for case-insensitive matching
    }).returning();

    res.json({
      success: true,
      word: result[0]
    });
  } catch (error) {
    console.error('Error adding synonym word:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// DELETE /api/synonyms/words/:id - Remove word from group (Superadmin only)
router.delete('/words/:id', requireSuperadminAuth, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if word exists
    const existingWord = await db
      .select()
      .from(searchSynonymWords)
      .where(eq(searchSynonymWords.id, parseInt(id)))
      .limit(1);

    if (existingWord.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Word not found'
      });
    }

    // Delete word
    await db.delete(searchSynonymWords).where(eq(searchSynonymWords.id, parseInt(id)));

    res.json({
      success: true,
      message: 'Word deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting synonym word:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export default router;

