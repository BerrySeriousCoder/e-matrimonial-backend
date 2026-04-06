import { ChatOpenAI } from '@langchain/openai';
import { z } from 'zod';
import { db } from '../db/index';
import { classificationCategories, classificationOptions, postAiClassifications } from '../db/schema';
import { eq, asc } from 'drizzle-orm';
import { stripHtml } from './htmlUtils';
import dotenv from 'dotenv';

dotenv.config();

interface TaxonomyOption {
  id: number;
  name: string;
  displayName: string;
  categoryName: string;
  categoryDisplayName: string;
}

let cachedTaxonomy: TaxonomyOption[] | null = null;

async function loadTaxonomy(): Promise<TaxonomyOption[]> {
  if (cachedTaxonomy) return cachedTaxonomy;

  const categories = await db
    .select()
    .from(classificationCategories)
    .where(eq(classificationCategories.isActive, true))
    .orderBy(asc(classificationCategories.order));

  const options = await db
    .select()
    .from(classificationOptions)
    .where(eq(classificationOptions.isActive, true))
    .orderBy(asc(classificationOptions.order));

  cachedTaxonomy = options.map((opt) => {
    const cat = categories.find((c) => c.id === opt.categoryId);
    return {
      id: opt.id,
      name: opt.name,
      displayName: opt.displayName,
      categoryName: cat?.name ?? 'unknown',
      categoryDisplayName: cat?.displayName ?? 'Unknown',
    };
  });

  return cachedTaxonomy;
}

export function invalidateTaxonomyCache() {
  cachedTaxonomy = null;
}

function buildTaxonomyString(taxonomy: TaxonomyOption[]): string {
  const grouped = new Map<string, TaxonomyOption[]>();
  for (const opt of taxonomy) {
    const key = opt.categoryDisplayName;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(opt);
  }

  const lines: string[] = [];
  for (const [category, opts] of grouped) {
    lines.push(`${category}: ${opts.map((o) => `${o.displayName} (id:${o.id})`).join(', ')}`);
  }
  return lines.join('\n');
}

const ClassificationResult = z.object({
  classifications: z.array(
    z.object({
      optionId: z.number().describe('The id of the classification option'),
      confidence: z.number().min(0).max(1).describe('Confidence score between 0 and 1'),
      evidence: z.string().describe('Brief quote or phrase from the post that justifies this classification'),
    })
  ).describe('Array of classifications found in the post content. Empty array if none found.'),
});

export async function enrichPostClassifications(postId: number, htmlContent: string): Promise<void> {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey === 'your_openai_api_key_here') {
      console.log(`[AI Enrichment] Skipping post ${postId}: OPENAI_API_KEY not configured`);
      return;
    }

    const plainText = stripHtml(htmlContent);
    if (!plainText || plainText.length < 10) {
      console.log(`[AI Enrichment] Skipping post ${postId}: content too short`);
      return;
    }

    const taxonomy = await loadTaxonomy();
    const taxonomyStr = buildTaxonomyString(taxonomy);

    const model = new ChatOpenAI({
      modelName: 'gpt-4o-mini',
      temperature: 0,
      openAIApiKey: apiKey,
    });

    const structuredModel = model.withStructuredOutput(ClassificationResult);

    const result = await structuredModel.invoke([
      {
        role: 'system',
        content: `You are a classification engine for a matrimonial website. Given a post's text and a taxonomy of classification options, identify ALL classifications that have clear evidence in the post content.

RULES:
- Only assign a classification if there is explicit proof in the text (a word, phrase, or clear implication).
- Do NOT hallucinate or guess. If unsure, skip it.
- For each classification, provide the exact evidence (quote or paraphrase from the text).
- Confidence should reflect how clearly the text supports the classification (0.5 = implied, 1.0 = explicitly stated).
- Multiple classifications across different categories are expected.

TAXONOMY:
${taxonomyStr}`,
      },
      {
        role: 'user',
        content: `Classify this matrimonial post:\n\n${plainText}`,
      },
    ]);

    const validOptionIds = new Set(taxonomy.map((t) => t.id));
    const validClassifications = result.classifications.filter(
      (c) => validOptionIds.has(c.optionId) && c.confidence > 0
    );

    if (validClassifications.length === 0) {
      console.log(`[AI Enrichment] Post ${postId}: no classifications found`);
      return;
    }

    await db.delete(postAiClassifications).where(eq(postAiClassifications.postId, postId));

    await db.insert(postAiClassifications).values(
      validClassifications.map((c) => ({
        postId,
        classificationOptionId: c.optionId,
        confidence: c.confidence,
        evidence: c.evidence,
      }))
    );

    console.log(`[AI Enrichment] Post ${postId}: assigned ${validClassifications.length} AI classifications`);
  } catch (error) {
    console.error(`[AI Enrichment] Error enriching post ${postId}:`, error);
  }
}
