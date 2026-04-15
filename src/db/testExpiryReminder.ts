/**
 * Test script: Insert a published ad expiring in 2 minutes, then trigger the cron job.
 * 
 * Usage: cd backend && npx tsx src/db/testExpiryReminder.ts
 */
import dotenv from 'dotenv';
dotenv.config();

import { db } from './index';
import { posts } from './schema';
import { CronService } from '../services/cronService';

async function main() {
  const email = 'iamshredderig@gmail.com';
  
  // Set expiry to 47 hours from now (tests the time calculation in email)
  const expiresAt = new Date(Date.now() + 47 * 60 * 60 * 1000);

  console.log('='.repeat(60));
  console.log('🧪 AD EXPIRY REMINDER — END-TO-END TEST');
  console.log('='.repeat(60));
  console.log(`📧 Email: ${email}`);
  console.log(`⏰ Current time: ${new Date().toISOString()}`);
  console.log(`⏰ Ad will expire at: ${expiresAt.toISOString()}`);
  console.log(`⏰ That's in ~47 hours`);
  console.log('');

  // Step 1: Insert a published test ad with classification
  console.log('📝 Step 1: Inserting test ad into database...');
  const [insertedPost] = await db.insert(posts).values({
    email,
    content: '<p>Well-settled <strong>Software Engineer</strong> working in Bangalore, 28 years, 5\'10\", Brahmin family. M.Tech from IIT Delhi. Father is a retired government officer, mother is a homemaker. Own house in Jaipur. Looking for a <em>well-educated, cultured bride</em> from a good family. Preference for working professionals. Horoscope matching preferred. Interested families may contact.</p>',
    lookingFor: 'bride',
    duration: 14,
    fontSize: 'default',
    bgColor: '#e6f3ff',
    icon: 'itprofessional',
    classificationId: 2, // Brahmin classification
    status: 'published',
    publishedAt: new Date().toISOString(),
    expiresAt: expiresAt.toISOString(),
    expiryReminderSent: false,
  }).returning();

  console.log(`✅ Test ad created! Post ID: ${insertedPost.id}`);
  console.log(`   Status: ${insertedPost.status}`);
  console.log(`   Expires at: ${insertedPost.expiresAt}`);
  console.log(`   expiryReminderSent: ${insertedPost.expiryReminderSent}`);
  console.log('');

  // Step 2: Trigger the cron job immediately
  console.log('🔄 Step 2: Triggering expiry check cron job...');
  console.log('   This will find the ad (expiring within 48h) and send the reminder email.');
  console.log('');

  await CronService.checkExpiringAds();

  console.log('');
  console.log('='.repeat(60));
  console.log('✅ TEST COMPLETE!');
  console.log('='.repeat(60));
  console.log('');
  console.log('📬 Check your inbox at: iamshredderig@gmail.com');
  console.log('   You should receive an email titled:');
  console.log('   "[E‑Matrimonials] Your ad is expiring soon — extend it now!"');
  console.log('');
  console.log('🔗 The email will contain an "Extend Your Ad" button.');
  console.log('   Click it to test the full extension + payment flow.');
  console.log('');
  console.log(`💡 Post ID: ${insertedPost.id}`);
  console.log(`   You can also manually check: SELECT * FROM posts WHERE id = ${insertedPost.id};`);

  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
