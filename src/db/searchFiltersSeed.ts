import { db } from './index';
import { searchFilterSections, searchFilterOptions } from './schema';

const seedSearchFilters = async () => {
  try {
    console.log('🌱 Seeding search filters...');

    // Check if sections already exist
    const existingSections = await db.select().from(searchFilterSections);
    if (existingSections.length > 0) {
      console.log('✅ Search filter sections already exist, skipping...');
      return;
    }

    // Insert default sections
    const sections = [
      { name: 'complexion', displayName: 'Complexion & Appearance', description: 'Physical appearance and complexion options', order: 1 },
      { name: 'education', displayName: 'Education & Profession', description: 'Educational qualifications and professional details', order: 2 },
      { name: 'age_height', displayName: 'Age & Height', description: 'Age and height preferences', order: 3 },
      { name: 'overseas', displayName: 'Overseas Status', description: 'Overseas residency and work status', order: 4 },
      { name: 'abbreviations', displayName: 'Abbreviations/SMS Style', description: 'Common abbreviations and short forms', order: 5 },
      { name: 'astrology', displayName: 'Astrology Labels', description: 'Astrological and cultural preferences', order: 6 }
    ];

    const insertedSections = await db.insert(searchFilterSections).values(sections).returning();
    console.log(`✅ Inserted ${insertedSections.length} sections`);

    // Insert default options
    const options = [
      // Complexion options
      { sectionId: 1, value: 'fair', displayName: 'Fair', order: 1 },
      { sectionId: 1, value: 'gori', displayName: 'Gori', order: 2 },
      { sectionId: 1, value: 'tall', displayName: 'Tall', order: 3 },
      { sectionId: 1, value: 'wheatish', displayName: 'Wheatish', order: 4 },

      // Education options
      { sectionId: 2, value: 'mba', displayName: 'MBA', order: 1 },
      { sectionId: 2, value: 'btech', displayName: 'B.Tech', order: 2 },
      { sectionId: 2, value: 'mbbs', displayName: 'MBBS', order: 3 },
      { sectionId: 2, value: 'iim', displayName: 'IIM', order: 4 },
      { sectionId: 2, value: 'mnc', displayName: 'MNC', order: 5 },
      { sectionId: 2, value: 'govt_job', displayName: 'Govt Job', order: 6 },

      // Age & Height options
      { sectionId: 3, value: 'age_25_30', displayName: 'Age 25-30', order: 1 },
      { sectionId: 3, value: 'age_30_35', displayName: 'Age 30-35', order: 2 },
      { sectionId: 3, value: 'height_5_6', displayName: 'Height 5\'6"', order: 3 },
      { sectionId: 3, value: 'height_5_8', displayName: 'Height 5\'8"', order: 4 },

      // Overseas options
      { sectionId: 4, value: 'nri', displayName: 'NRI', order: 1 },
      { sectionId: 4, value: 'green_card', displayName: 'Green Card', order: 2 },
      { sectionId: 4, value: 'working_abroad', displayName: 'Working Abroad', order: 3 },

      // Abbreviations options
      { sectionId: 5, value: 'sm$', displayName: 'SM$', order: 1 },
      { sectionId: 5, value: 'pqm', displayName: 'PQM', order: 2 },
      { sectionId: 5, value: 'edu', displayName: 'Edu', order: 3 },
      { sectionId: 5, value: 'hsome', displayName: 'H\'some', order: 4 },
      { sectionId: 5, value: 'bful', displayName: 'B\'ful', order: 5 },

      // Astrology options
      { sectionId: 6, value: 'manglik', displayName: 'Manglik', order: 1 },
      { sectionId: 6, value: 'non_manglik', displayName: 'Non-Manglik', order: 2 }
    ];

    const insertedOptions = await db.insert(searchFilterOptions).values(options).returning();
    console.log(`✅ Inserted ${insertedOptions.length} options`);

    console.log('🎉 Search filters seeded successfully!');
  } catch (error) {
    console.error('❌ Error seeding search filters:', error);
    throw error;
  }
};

// Run the seed function
seedSearchFilters()
  .then(() => {
    console.log('✅ Search filters seeding completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Search filters seeding failed:', error);
    process.exit(1);
  }); 