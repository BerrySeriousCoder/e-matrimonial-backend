import { Router } from 'express';
import { ChatOpenAI } from '@langchain/openai';
import { z } from 'zod';
import { db } from '../db';
import { posts, postAiClassifications, classificationOptions, classificationCategories, searchSynonymGroups, searchSynonymWords } from '../db/schema';
import { eq, and, gt, inArray, desc, asc, sql, or } from 'drizzle-orm';
import { stripHtml } from '../utils/htmlUtils';
import dotenv from 'dotenv';

dotenv.config();

const router = Router();

interface TaxonomyItem {
  id: number;
  name: string;
  displayName: string;
  categoryName: string;
  categoryDisplayName: string;
}

async function loadTaxonomy(): Promise<TaxonomyItem[]> {
  const options = await db
    .select({
      id: classificationOptions.id,
      name: classificationOptions.name,
      displayName: classificationOptions.displayName,
      categoryName: classificationCategories.name,
      categoryDisplayName: classificationCategories.displayName,
    })
    .from(classificationOptions)
    .innerJoin(classificationCategories, eq(classificationOptions.categoryId, classificationCategories.id))
    .where(eq(classificationOptions.isActive, true))
    .orderBy(asc(classificationCategories.order), asc(classificationOptions.order));

  return options;
}

async function loadSynonymDictionary(): Promise<Map<number, { name: string; words: string[] }>> {
  const words = await db
    .select({
      groupId: searchSynonymGroups.id,
      groupName: searchSynonymGroups.name,
      word: searchSynonymWords.word,
    })
    .from(searchSynonymWords)
    .innerJoin(searchSynonymGroups, eq(searchSynonymWords.groupId, searchSynonymGroups.id))
    .where(eq(searchSynonymGroups.isActive, true));

  const groups = new Map<number, { name: string; words: string[] }>();
  for (const w of words) {
    if (!groups.has(w.groupId)) groups.set(w.groupId, { name: w.groupName, words: [] });
    groups.get(w.groupId)!.words.push(w.word);
  }
  return groups;
}

function buildSynonymDictionaryString(dict: Map<number, { name: string; words: string[] }>): string {
  const lines: string[] = [];
  for (const [id, group] of dict) {
    lines.push(`${group.name} (id:${id}): ${group.words.join(', ')}`);
  }
  return lines.join('\n');
}

const SearchIntent = z.object({
  classificationIds: z.array(z.number()).describe('IDs of matching classification options from the taxonomy'),
  synonymGroupIds: z.array(z.number()).describe('IDs of synonym groups whose words should be included in the search to expand coverage'),
  keywords: z.array(z.string()).describe('Additional keywords to search in post content that are NOT covered by classifications or synonym groups'),
  lookingFor: z.enum(['bride', 'groom', 'any']).describe('Whether the user is looking for a bride, groom, or either'),
  summary: z.string().describe('Brief summary of what the user is looking for'),
});

router.post('/', async (req, res) => {
  try {
    const { query } = req.body;

    if (!query || typeof query !== 'string' || query.trim().length < 3) {
      return res.status(400).json({ success: false, message: 'Please provide a search query (at least 3 characters)' });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey === 'your_openai_api_key_here') {
      return res.status(503).json({ success: false, message: 'AI search is not configured yet' });
    }

    const [taxonomy, synonymDict] = await Promise.all([
      loadTaxonomy(),
      loadSynonymDictionary(),
    ]);

    const taxonomyStr = taxonomy
      .reduce((acc: string[], item) => {
        const last = acc.length > 0 ? acc[acc.length - 1] : '';
        const prefix = `${item.categoryDisplayName}: `;
        if (!last.startsWith(prefix)) {
          acc.push(`${prefix}${item.displayName} (id:${item.id})`);
        } else {
          acc[acc.length - 1] += `, ${item.displayName} (id:${item.id})`;
        }
        return acc;
      }, [])
      .join('\n');

    const synonymStr = buildSynonymDictionaryString(synonymDict);

    const model = new ChatOpenAI({
      modelName: 'gpt-4o-mini',
      temperature: 0,
      openAIApiKey: apiKey,
    });

    const structuredModel = model.withStructuredOutput(SearchIntent);

    const intent = await structuredModel.invoke([
      {
        role: 'system',
        content: `You are a search assistant for an Indian matrimonial website. Parse the user's natural language query to identify:

1. Classification IDs from the taxonomy that match their requirements
2. Synonym group IDs from the synonym dictionary that relate to the query
3. Additional keywords NOT covered by classifications or synonym groups
4. Whether they are looking for a bride, groom, or either

TAXONOMY:
${taxonomyStr}

SYNONYM DICTIONARY (use these to expand search coverage):
${synonymStr}

RULES:
- Match classifications generously but accurately (e.g., "Agarwal" matches both caste and community options)
- If the user's query relates to any synonym group, include that group's ID in synonymGroupIds (e.g., "UK" matches the group containing "uk, london, england")
- Use keywords ONLY for terms not covered by taxonomy or synonym groups
- Infer lookingFor from context: "boy" / "groom" / "ladka" = groom, "girl" / "bride" / "ladki" = bride
- If unclear, set lookingFor to "any"`,
      },
      {
        role: 'user',
        content: query.trim(),
      },
    ]);

    const whereConditions: any[] = [
      eq(posts.status, 'published'),
      gt(posts.expiresAt, new Date().toISOString()),
    ];

    if (intent.lookingFor !== 'any') {
      // IMPORTANT: Invert the lookingFor for the DB query.
      // The AI intent means "the user wants to FIND a [bride/groom]".
      // A post's lookingFor field means "the poster IS looking for a [bride/groom]".
      // So if the user wants a groom (boy), we show posts where the person IS a groom,
      // i.e. posts where lookingFor = 'bride' (a man seeking a bride).
      const dbLookingFor = intent.lookingFor === 'groom' ? 'bride' : 'groom';
      whereConditions.push(eq(posts.lookingFor, dbLookingFor));
    }

    const validIds = intent.classificationIds.filter((id) =>
      taxonomy.some((t) => t.id === id)
    );

    let postIds: number[] = [];

    if (validIds.length > 0) {
      const aiMatches = await db
        .selectDistinct({ postId: postAiClassifications.postId })
        .from(postAiClassifications)
        .where(inArray(postAiClassifications.classificationOptionId, validIds));

      const humanMatches = await db
        .selectDistinct({ id: posts.id })
        .from(posts)
        .where(
          and(
            ...whereConditions,
            inArray(posts.classificationId, validIds)
          )
        );

      const idSet = new Set<number>();
      aiMatches.forEach((m) => idSet.add(m.postId));
      humanMatches.forEach((m) => idSet.add(m.id));
      postIds = Array.from(idSet);
    }

    // Expand synonym groups into search terms
    const synonymSearchTerms: string[] = [];
    const validSynonymGroupIds = intent.synonymGroupIds?.filter((id) => synonymDict.has(id)) || [];
    for (const gid of validSynonymGroupIds) {
      const group = synonymDict.get(gid);
      if (group) synonymSearchTerms.push(...group.words);
    }

    // Build synonym LIKE conditions (OR within group, AND between groups is handled by overall query)
    let synonymConditions: any[] = [];
    if (synonymSearchTerms.length > 0) {
      synonymConditions = [sql`(${synonymSearchTerms
        .map(term => sql`LOWER(REGEXP_REPLACE(${posts.content}, '<[^>]*>', '', 'g')) LIKE ${`%${term.toLowerCase()}%`} OR LOWER(${posts.email}) LIKE ${`%${term.toLowerCase()}%`}`)
        .reduce((acc, c) => sql`${acc} OR ${c}`)})`];
    }

    let keywordConditions: any[] = [];
    if (intent.keywords.length > 0) {
      keywordConditions = intent.keywords.map((kw) => {
        const lowerKw = kw.toLowerCase();
        return sql`(LOWER(REGEXP_REPLACE(${posts.content}, '<[^>]*>', '', 'g')) LIKE ${`%${lowerKw}%`} OR LOWER(${posts.email}) LIKE ${`%${lowerKw}%`})`;
      });
    }

    // Merge synonym and keyword conditions
    const textConditions = [...synonymConditions, ...keywordConditions];

    let finalWhere;

    if (postIds.length > 0 && textConditions.length > 0) {
      finalWhere = and(
        ...whereConditions,
        or(
          inArray(posts.id, postIds),
          and(...textConditions)
        )
      );
    } else if (postIds.length > 0) {
      finalWhere = and(
        ...whereConditions,
        inArray(posts.id, postIds)
      );
    } else if (textConditions.length > 0) {
      finalWhere = and(
        ...whereConditions,
        and(...textConditions)
      );
    } else {
      return res.json({
        success: true,
        posts: [],
        total: 0,
        intent: {
          classificationIds: validIds,
          synonymGroupIds: validSynonymGroupIds,
          keywords: intent.keywords,
          lookingFor: intent.lookingFor,
          summary: intent.summary,
        },
        message: 'No matching criteria found for your query',
      });
    }

    const page = parseInt(req.body.page as string) || 1;
    const limit = 20;

    const [results, totalCount] = await Promise.all([
      db
        .select()
        .from(posts)
        .where(finalWhere)
        .orderBy(desc(posts.createdAt))
        .limit(limit)
        .offset((page - 1) * limit),
      db.select({ count: sql<number>`count(*)` }).from(posts).where(finalWhere),
    ]);

    const total = Number(totalCount[0]?.count || 0);

    const matchedClassNames = validIds
      .map((id) => taxonomy.find((t) => t.id === id)?.displayName)
      .filter(Boolean);

    res.json({
      success: true,
      posts: results,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      intent: {
        classificationIds: validIds,
        classificationNames: matchedClassNames,
        synonymGroupIds: validSynonymGroupIds,
        keywords: intent.keywords,
        lookingFor: intent.lookingFor,
        summary: intent.summary,
      },
    });
  } catch (error) {
    console.error('AI search error:', error);
    res.status(500).json({ success: false, message: 'AI search failed. Please try again.' });
  }
});

export default router;
