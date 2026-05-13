import express from 'express';
import multer from 'multer';
import XLSX from 'xlsx';
import bcrypt from 'bcryptjs';
import { eq, and, sql } from 'drizzle-orm';
import { db } from '../db';
import { posts, users, admins, classificationOptions, classificationCategories, bulkImportJobs } from '../db/schema';
import { requireAdminAuth, AdminRequest } from '../middleware/adminAuth';
import { logAdminAction } from '../utils/adminLogger';

const router = express.Router();

const DEFAULT_EMAIL = 'e.matrimonial.services@gmail.com';

// Multer config: memory storage, xlsx only, 10MB max
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const allowedMimes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];
    if (allowedMimes.includes(file.mimetype) || file.originalname.endsWith('.xlsx')) {
      cb(null, true);
    } else {
      cb(new Error('Only .xlsx files are allowed'));
    }
  },
});

// ─── Helpers ───

function normalizePhone(raw: string | number | undefined | null): string[] {
  if (raw === undefined || raw === null) return [];
  // Convert to string (XLSX may return numbers for phone cells)
  const str = String(raw).trim();
  if (!str) return [];
  // Split by comma, slash, or space-separated groups
  const parts = str.split(/[,\/]/).map(p => p.trim()).filter(Boolean);
  const phones: string[] = [];
  for (const part of parts) {
    // Strip everything except digits
    let digits = part.replace(/[^\d]/g, '');
    // Remove leading country code (91 for India) if number is > 10 digits
    if (digits.length > 10 && digits.startsWith('91')) {
      digits = digits.slice(2);
    }
    if (digits.length >= 10 && digits.length <= 13) {
      phones.push(digits);
    }
  }
  return phones;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

interface ClassificationLookup {
  id: number;
  name: string;
  displayName: string;
  categoryName: string;
}

async function loadClassificationLookup(): Promise<ClassificationLookup[]> {
  const categories = await db.select().from(classificationCategories)
    .where(eq(classificationCategories.isActive, true));

  const options = await db.select().from(classificationOptions)
    .where(eq(classificationOptions.isActive, true));

  return options.map(opt => {
    const cat = categories.find(c => c.id === opt.categoryId);
    return {
      id: opt.id,
      name: opt.name.toLowerCase(),
      displayName: opt.displayName.toLowerCase(),
      categoryName: cat?.name || 'unknown',
    };
  });
}

function matchClassification(casteValue: string, lookup: ClassificationLookup[]): number | null {
  if (!casteValue) return null;
  const normalised = casteValue.trim().toLowerCase();
  // Exact match on name or displayName
  const exact = lookup.find(
    l => l.name === normalised || l.displayName === normalised
  );
  if (exact) return exact.id;

  // Partial match (caste value contained in displayName or vice versa)
  const partial = lookup.find(
    l => l.displayName.includes(normalised) || normalised.includes(l.displayName)
  );
  if (partial) return partial.id;

  return null;
}

interface ValidProfile {
  rowNumber: number;
  content: string;
  lookingFor: 'bride' | 'groom';
  classificationId: number;
  email: string;
  phoneNumbers: string[];
  originalData: Record<string, any>;
}

interface RejectedProfile {
  rowNumber: number;
  data: Record<string, any>;
  reasons: string[];
}

// ─── POST /validate ───
// Parses and validates an uploaded XLSX. No DB writes.
router.post('/validate', requireAdminAuth, upload.single('file'), async (req: AdminRequest, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    // Parse XLSX
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return res.status(400).json({ success: false, message: 'Empty workbook — no sheets found' });
    }

    const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
    if (rows.length === 0) {
      return res.status(400).json({ success: false, message: 'Sheet is empty — no data rows found' });
    }

    // Check required headers
    const headers = Object.keys(rows[0]);
    const requiredHeaders = ['exact_raw_profile_text', 'looking_for', 'caste'];
    const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
    if (missingHeaders.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required columns: ${missingHeaders.join(', ')}`,
        headers,
      });
    }

    // Load classification options for caste matching
    const classificationLookup = await loadClassificationLookup();

    // Load active published posts for duplicate checking
    const activePostsRaw = await db.select({
      id: posts.id,
      email: posts.email,
      phoneNumbers: posts.phoneNumbers,
    })
      .from(posts)
      .where(and(
        eq(posts.status, 'published'),
        sql`${posts.expiresAt} > now()`
      ));

    // Build duplicate lookup structures
    const activeEmailPhoneMap = new Map<string, { postId: number; phones: Set<string> }[]>();
    for (const ap of activePostsRaw) {
      const key = ap.email.toLowerCase();
      if (!activeEmailPhoneMap.has(key)) activeEmailPhoneMap.set(key, []);
      const phones = new Set<string>(
        Array.isArray(ap.phoneNumbers) ? ap.phoneNumbers : []
      );
      activeEmailPhoneMap.get(key)!.push({ postId: ap.id, phones });
    }

    const validProfiles: ValidProfile[] = [];
    const rejectedProfiles: RejectedProfile[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2; // +2 because row 1 is headers, data starts at row 2
      const reasons: string[] = [];

      // 1. Validate exact_raw_profile_text
      const rawText = row['exact_raw_profile_text'];
      if (!rawText || typeof rawText !== 'string' || rawText.trim().length < 10) {
        reasons.push('Missing or too short profile text (minimum 10 characters)');
      }

      // 2. Validate looking_for
      const lookingForVal = row['looking_for'];
      const normalizedLookingFor = (typeof lookingForVal === 'string' ? lookingForVal.trim().toLowerCase() : '');
      if (normalizedLookingFor !== 'bride' && normalizedLookingFor !== 'groom') {
        reasons.push(`Missing or invalid looking_for value "${lookingForVal || ''}" (must be "bride" or "groom")`);
      }

      // 3. Match caste → classificationId
      const casteVal = row['caste'];
      let classificationId: number | null = null;
      if (!casteVal || (typeof casteVal === 'string' && !casteVal.trim())) {
        reasons.push('Missing caste (classification) value');
      } else if (typeof casteVal === 'string' && casteVal.trim()) {
        classificationId = matchClassification(casteVal, classificationLookup);
        if (!classificationId) {
          reasons.push(`Unknown classification: "${casteVal}". Check spelling or add it to classifications.`);
        }
      }

      // 4. Parse contact_email
      const rawEmail = row['contact_email'];
      let email = DEFAULT_EMAIL;
      if (rawEmail && typeof rawEmail === 'string' && rawEmail.trim()) {
        const trimmedEmail = rawEmail.trim();
        if (isValidEmail(trimmedEmail)) {
          email = trimmedEmail;
        } else {
          reasons.push(`Invalid email format: "${trimmedEmail}"`);
        }
      }

      // 5. Parse contact_phone
      const rawPhone = row['contact_phone'];
      let phoneNumbers: string[] = [];
      if (rawPhone !== undefined && rawPhone !== null) {
        phoneNumbers = normalizePhone(rawPhone);
        // If phone was provided but none were valid, warn (but don't reject)
      }

      // 6. Duplicate check against active published posts
      if (reasons.length === 0) {
        const emailLower = email.toLowerCase();
        const activeForEmail = activeEmailPhoneMap.get(emailLower);
        if (activeForEmail && phoneNumbers.length > 0) {
          for (const activePub of activeForEmail) {
            const overlap = phoneNumbers.some(p => activePub.phones.has(p));
            if (overlap) {
              reasons.push(`Duplicate — active profile exists (Post #${activePub.postId}) with matching email and phone`);
              break;
            }
          }
        }
      }

      if (reasons.length > 0) {
        rejectedProfiles.push({ rowNumber, data: row, reasons });
      } else {
        validProfiles.push({
          rowNumber,
          content: `<p>${rawText.trim()}</p>`,
          lookingFor: normalizedLookingFor as 'bride' | 'groom',
          classificationId: classificationId!,
          email,
          phoneNumbers,
          originalData: row,
        });
      }
    }

    res.json({
      success: true,
      totalRows: rows.length,
      validCount: validProfiles.length,
      rejectedCount: rejectedProfiles.length,
      validProfiles,
      rejectedProfiles,
    });
  } catch (error: any) {
    console.error('Bulk import validate error:', error);
    if (error.message === 'Only .xlsx files are allowed') {
      return res.status(400).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: 'Failed to process file' });
  }
});

// ─── POST /confirm ───
// Inserts validated profiles into the database as pending posts.
router.post('/confirm', requireAdminAuth, async (req: AdminRequest, res) => {
  try {
    const { validProfiles } = req.body;

    if (!Array.isArray(validProfiles) || validProfiles.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid profiles to import' });
    }

    const adminId = req.admin!.adminId;
    let importedCount = 0;

    // Process in batches to avoid overloading
    for (const profile of validProfiles) {
      try {
        // Create or get user for this email
        let userId: number;
        const existingUser = await db.select().from(users).where(eq(users.email, profile.email));

        if (existingUser.length > 0) {
          userId = existingUser[0].id;
        } else {
          const randomPassword = Math.random().toString(36).slice(-8);
          const hashedPassword = await bcrypt.hash(randomPassword, 10);
          const [newUser] = await db.insert(users)
            .values({ email: profile.email, password: hashedPassword })
            .returning();
          userId = newUser.id;
        }

        // Insert post as published directly (no email notification for bulk imports)
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 14); // 14 days default

        await db.insert(posts).values({
          email: profile.email,
          content: profile.content,
          userId,
          lookingFor: profile.lookingFor,
          classificationId: profile.classificationId || null,
          phoneNumbers: profile.phoneNumbers.length > 0 ? profile.phoneNumbers : null,
          fontSize: 'default',
          bgColor: '#ffffff',
          icon: null,
          duration: 14,
          status: 'published',
          publishedAt: new Date().toISOString(),
          expiresAt: expiresAt.toISOString(),
          baseAmount: 0,
          finalAmount: 0,
          couponCode: null,
          createdByAdminId: adminId,
        });

        importedCount++;
      } catch (rowError) {
        console.error(`Bulk import: failed to insert profile for ${profile.email}:`, rowError);
        // Continue with next profile
      }
    }

    // Create import job record
    const [importJob] = await db.insert(bulkImportJobs).values({
      adminId,
      fileName: 'bulk_import.xlsx',
      totalRows: validProfiles.length,
      successCount: importedCount,
      rejectedCount: 0, // rejected profiles were already handled in /validate
      status: 'completed',
    }).returning();

    // Log admin action
    await logAdminAction(req, {
      action: 'bulk_import',
      entityType: 'post',
      entityId: importJob.id,
      details: `Admin ${req.admin!.email} bulk imported ${importedCount} profiles`,
    });

    res.json({
      success: true,
      message: `${importedCount} profiles published successfully`,
      jobId: importJob.id,
      importedCount,
    });
  } catch (error) {
    console.error('Bulk import confirm error:', error);
    res.status(500).json({ success: false, message: 'Failed to import profiles' });
  }
});

// ─── POST /export-rejected ───
// Generates an XLSX file of rejected profiles with reasons.
router.post('/export-rejected', requireAdminAuth, async (req: AdminRequest, res) => {
  try {
    const { rejectedProfiles } = req.body;

    if (!Array.isArray(rejectedProfiles) || rejectedProfiles.length === 0) {
      return res.status(400).json({ success: false, message: 'No rejected profiles to export' });
    }

    // Build rows using same column names as the import template so users can fix and re-upload
    const exportRows = rejectedProfiles.map((rp: RejectedProfile) => ({
      exact_raw_profile_text: rp.data?.exact_raw_profile_text || '',
      looking_for: rp.data?.looking_for || '',
      caste: rp.data?.caste || '',
      contact_email: rp.data?.contact_email || '',
      contact_phone: rp.data?.contact_phone !== undefined ? String(rp.data.contact_phone) : '',
      rejection_reasons: Array.isArray(rp.reasons) ? rp.reasons.join('; ') : String(rp.reasons || ''),
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportRows);

    // Set column widths for readability
    worksheet['!cols'] = [
      { wch: 60 },  // exact_raw_profile_text
      { wch: 12 },  // looking_for
      { wch: 20 },  // caste
      { wch: 30 },  // contact_email
      { wch: 25 },  // contact_phone
      { wch: 50 },  // rejection_reasons
    ];

    // Set row height for header
    worksheet['!rows'] = [{ hpt: 24 }];

    // Enable auto-filter on header row
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    worksheet['!autofilter'] = { ref: XLSX.utils.encode_range(range) };

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Rejected Profiles');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=rejected_profiles.xlsx');
    res.send(buffer);
  } catch (error) {
    console.error('Export rejected error:', error);
    res.status(500).json({ success: false, message: 'Failed to export rejected profiles' });
  }
});

export default router;
