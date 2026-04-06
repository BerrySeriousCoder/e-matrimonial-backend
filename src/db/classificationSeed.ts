import { db } from './index';
import { classificationCategories, classificationOptions } from './schema';
import { eq } from 'drizzle-orm';

interface CategoryData {
  name: string;
  displayName: string;
  order: number;
  options: { name: string; displayName: string; forBride: boolean; forGroom: boolean; order: number }[];
}

const CLASSIFICATION_DATA: CategoryData[] = [
  {
    name: 'caste', displayName: 'Caste', order: 1,
    options: [
      { name: 'agarwal-bisa', displayName: 'Agarwal- Bisa', forBride: true, forGroom: true, order: 1 },
      { name: 'brahmin', displayName: 'Brahmin', forBride: true, forGroom: true, order: 2 },
      { name: 'chaurasia', displayName: 'Chaurasia', forBride: true, forGroom: true, order: 3 },
      { name: 'garhwali', displayName: 'Garhwali', forBride: true, forGroom: true, order: 4 },
      { name: 'gujar', displayName: 'Gujar', forBride: true, forGroom: true, order: 5 },
      { name: 'gujarati-vaishnav', displayName: 'Gujarati Vaishnav', forBride: true, forGroom: true, order: 6 },
      { name: 'jain', displayName: 'Jain', forBride: true, forGroom: true, order: 7 },
      { name: 'jaiswal', displayName: 'Jaiswal', forBride: true, forGroom: true, order: 8 },
      { name: 'jatav', displayName: 'Jatav', forBride: true, forGroom: true, order: 9 },
      { name: 'kashyap', displayName: 'Kashyap', forBride: true, forGroom: true, order: 10 },
      { name: 'kayastha', displayName: 'Kayastha', forBride: true, forGroom: true, order: 11 },
      { name: 'khatri', displayName: 'Khatri', forBride: true, forGroom: true, order: 12 },
      { name: 'kshatriya', displayName: 'Kshatriya', forBride: true, forGroom: true, order: 13 },
      { name: 'kumauni', displayName: 'Kumauni', forBride: true, forGroom: true, order: 14 },
      { name: 'kurmi', displayName: 'Kurmi', forBride: true, forGroom: true, order: 15 },
      { name: 'kushwaha', displayName: 'Kushwaha', forBride: true, forGroom: true, order: 16 },
      { name: 'maheshwari', displayName: 'Maheshwari', forBride: true, forGroom: true, order: 17 },
      { name: 'sahu-teli', displayName: 'Sahu-Teli', forBride: true, forGroom: true, order: 18 },
      { name: 'saini', displayName: 'Saini', forBride: true, forGroom: true, order: 19 },
      { name: 'swarnkar', displayName: 'Swarnkar', forBride: true, forGroom: true, order: 20 },
      { name: 'tamil-iyer', displayName: 'Tamil Iyer', forBride: true, forGroom: true, order: 21 },
      { name: 'vaish', displayName: 'Vaish', forBride: true, forGroom: true, order: 22 },
      { name: 'vaishnav', displayName: 'Vaishnav', forBride: true, forGroom: true, order: 23 },
      { name: 'valmiki', displayName: 'Valmiki', forBride: true, forGroom: true, order: 24 },
      { name: 'yadav', displayName: 'Yadav', forBride: true, forGroom: true, order: 25 },
    ],
  },
  {
    name: 'community', displayName: 'Community', order: 2,
    options: [
      { name: 'agarwal', displayName: 'Agarwal', forBride: true, forGroom: true, order: 1 },
      { name: 'arora', displayName: 'Arora', forBride: true, forGroom: true, order: 2 },
      { name: 'bhumihar', displayName: 'Bhumihar', forBride: true, forGroom: true, order: 3 },
      { name: 'jat', displayName: 'Jat', forBride: true, forGroom: true, order: 4 },
      { name: 'keralite', displayName: 'Keralite', forBride: true, forGroom: true, order: 5 },
      { name: 'maratha', displayName: 'Maratha', forBride: true, forGroom: true, order: 6 },
      { name: 'marwaris', displayName: 'Marwaris', forBride: true, forGroom: true, order: 7 },
      { name: 'north-indian', displayName: 'North Indian', forBride: true, forGroom: true, order: 8 },
      { name: 'rajput', displayName: 'Rajput', forBride: true, forGroom: true, order: 9 },
      { name: 'shetty', displayName: 'Shetty', forBride: false, forGroom: true, order: 10 },
    ],
  },
  {
    name: 'profession', displayName: 'Profession', order: 3,
    options: [
      { name: 'architect', displayName: 'Architect', forBride: true, forGroom: true, order: 1 },
      { name: 'chef', displayName: 'Chef', forBride: true, forGroom: true, order: 2 },
      { name: 'doctors', displayName: 'Doctors', forBride: true, forGroom: true, order: 3 },
      { name: 'engineers', displayName: 'Engineers', forBride: true, forGroom: true, order: 4 },
      { name: 'government-defence', displayName: 'Government/ Defence', forBride: true, forGroom: true, order: 5 },
      { name: 'ias-allied-services', displayName: 'Ias/ Allied Services', forBride: true, forGroom: true, order: 6 },
      { name: 'journalist', displayName: 'Journalist', forBride: true, forGroom: true, order: 7 },
      { name: 'mba-ca', displayName: 'MBA/CA', forBride: true, forGroom: true, order: 8 },
    ],
  },
  {
    name: 'religion', displayName: 'Religion', order: 4,
    options: [
      { name: 'buddhist', displayName: 'Buddhist', forBride: true, forGroom: true, order: 1 },
      { name: 'christian', displayName: 'Christian', forBride: true, forGroom: true, order: 2 },
      { name: 'hindu', displayName: 'Hindu', forBride: true, forGroom: true, order: 3 },
      { name: 'muslim', displayName: 'Muslim', forBride: true, forGroom: true, order: 4 },
      { name: 'parsi', displayName: 'Parsi', forBride: true, forGroom: true, order: 5 },
      { name: 'sikh', displayName: 'Sikh', forBride: true, forGroom: true, order: 6 },
    ],
  },
  {
    name: 'general-others-special', displayName: 'General/Others/Special', order: 5,
    options: [
      { name: 'caste-no-bar', displayName: 'Caste No Bar', forBride: true, forGroom: true, order: 1 },
      { name: 'civil-marriage', displayName: 'Civil Marriage', forBride: true, forGroom: true, order: 2 },
      { name: 'cosmopolitan', displayName: 'Cosmopolitan', forBride: true, forGroom: true, order: 3 },
      { name: 'disabled-handicapped', displayName: 'Disabled/ Handicapped', forBride: true, forGroom: false, order: 4 },
      { name: 'hiv-positive', displayName: 'HIV Positive', forBride: true, forGroom: false, order: 5 },
      { name: 'manglik', displayName: 'Manglik', forBride: true, forGroom: true, order: 6 },
      { name: 'religion-no-bar', displayName: 'Religion No Bar', forBride: true, forGroom: true, order: 7 },
      { name: 'sc-st', displayName: 'SC/ST', forBride: true, forGroom: true, order: 8 },
      { name: 'second-marriage', displayName: 'Second Marriage', forBride: true, forGroom: true, order: 9 },
    ],
  },
  {
    name: 'language', displayName: 'Language', order: 6,
    options: [
      { name: 'assamese', displayName: 'Assamese', forBride: true, forGroom: false, order: 1 },
      { name: 'bengali', displayName: 'Bengali', forBride: true, forGroom: true, order: 2 },
      { name: 'gujarati', displayName: 'Gujarati', forBride: true, forGroom: true, order: 3 },
      { name: 'himachali', displayName: 'Himachali', forBride: true, forGroom: true, order: 4 },
      { name: 'malayali', displayName: 'Malayali', forBride: true, forGroom: true, order: 5 },
      { name: 'marathi-konkani', displayName: 'Marathi/Konkani', forBride: true, forGroom: false, order: 6 },
      { name: 'oriya', displayName: 'Oriya', forBride: true, forGroom: true, order: 7 },
      { name: 'punjabi', displayName: 'Punjabi', forBride: true, forGroom: true, order: 8 },
      { name: 'sindhi', displayName: 'Sindhi', forBride: true, forGroom: true, order: 9 },
      { name: 'tamil', displayName: 'Tamil', forBride: true, forGroom: true, order: 10 },
      { name: 'telugu', displayName: 'Telugu', forBride: true, forGroom: true, order: 11 },
    ],
  },
  {
    name: 'nationality', displayName: 'Nationality', order: 7,
    options: [
      { name: 'nri-green-card', displayName: 'NRI / Green Card', forBride: true, forGroom: true, order: 1 },
    ],
  },
];

async function seed() {
  console.log('Seeding classification data...');

  for (const cat of CLASSIFICATION_DATA) {
    const existing = await db.select().from(classificationCategories).where(eq(classificationCategories.name, cat.name));

    let categoryId: number;
    if (existing.length > 0) {
      categoryId = existing[0].id;
      console.log(`  Category "${cat.displayName}" already exists (id=${categoryId}), updating...`);
      await db.update(classificationCategories)
        .set({ displayName: cat.displayName, order: cat.order })
        .where(eq(classificationCategories.id, categoryId));
    } else {
      const [inserted] = await db.insert(classificationCategories)
        .values({ name: cat.name, displayName: cat.displayName, order: cat.order })
        .returning();
      categoryId = inserted.id;
      console.log(`  Created category "${cat.displayName}" (id=${categoryId})`);
    }

    for (const opt of cat.options) {
      const existingOpt = await db.select().from(classificationOptions)
        .where(eq(classificationOptions.name, opt.name));

      if (existingOpt.length > 0) {
        await db.update(classificationOptions)
          .set({ displayName: opt.displayName, forBride: opt.forBride, forGroom: opt.forGroom, order: opt.order, categoryId })
          .where(eq(classificationOptions.id, existingOpt[0].id));
      } else {
        await db.insert(classificationOptions)
          .values({ categoryId, name: opt.name, displayName: opt.displayName, forBride: opt.forBride, forGroom: opt.forGroom, order: opt.order });
      }
    }
    console.log(`    -> ${cat.options.length} options seeded for "${cat.displayName}"`);
  }

  console.log('Classification seeding complete!');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
