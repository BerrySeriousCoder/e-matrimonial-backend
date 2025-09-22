import { db } from './index';
import { posts, users } from './schema';
import bcrypt from 'bcryptjs';

// Generate diverse dummy posts for testing the newspaper cards
function buildDummyData(total: number) {
  const lookingFors = ['bride', 'groom'] as const;
  const fontSizes = ['default', 'large'] as const;
  const bgColors = ['#e6f3ff', '#cce7ff', '#ffe6f0', '#ffcce6', '#cce7ff', '#e6f3ff'] as const;
  const cities = ['Delhi', 'Mumbai', 'Bengaluru', 'Pune', 'Chennai', 'Hyderabad', 'Kolkata'];
  const countries = ['USA', 'UK', 'Canada', 'Australia'];
  const professions = [
    'software engineer', 'MBBS doctor', 'IAS officer', 'IPS officer', 'CA', 'banker', 'teacher',
    'entrepreneur', 'product manager', 'data scientist', 'civil engineer', 'lawyer', 'architect'
  ];
  const educations = ['MBA', 'B.Tech', 'IIM graduate', 'IIT graduate', 'MTech', 'PhD'];
  const traits = ['fair', 'wheatish', 'tall', 'handsome', 'beautiful', 'manglik', 'non-manglik'];
  const heights = [`5'2"`, `5'4"`, `5'5"`, `5'6"`, `5'7"`, `5'8"`, `5'9"`, `5'10"`, `6'0"`, `6'2"`];

  const data: Array<{
    email: string;
    content: string;
    lookingFor: 'bride' | 'groom';
    fontSize: 'default' | 'large';
    bgColor: string;
    status: 'pending' | 'published' | 'archived' | 'deleted' | 'expired';
  }> = [];

  for (let i = 1; i <= total; i++) {
    const lf = lookingFors[i % lookingFors.length];
    const city = cities[i % cities.length];
    const country = countries[i % countries.length];
    const prof = professions[i % professions.length];
    const edu = educations[i % educations.length];
    const trait = traits[i % traits.length];
    const height = heights[i % heights.length];
    const age = 24 + (i % 12); // 24..35

    const subjectNoun = lf === 'bride' ? 'boy' : 'girl';
    const seekingNoun = lf === 'bride' ? 'girl' : 'boy';

    const email = `dummy_${i}_${lf}@example.com`;
    const content = [
      `${trait} ${subjectNoun}, ${age} years, ${height} height from ${city}.`,
      `Working as ${prof}, ${edu}.`,
      i % 3 === 0 ? `NRI, based in ${country}.` : `Open to relocate to ${country}.`,
      `I am looking for ${seekingNoun} with ${edu} background${i % 2 === 0 ? ' and good family values' : ''}.`
    ].join(' ');

    data.push({
      email,
      content,
      lookingFor: lf,
      fontSize: fontSizes[i % fontSizes.length],
      bgColor: bgColors[i % bgColors.length],
      status: 'published',
    });
  }

  return data;
}

async function seedExtraPosts(total: number = 100) {
  try {
    console.log(`Seeding ${total} extra dummy posts...`);

    const extraPosts = buildDummyData(total);

    // Create users first (unique emails)
    const createdUsers: any[] = [];
    for (const p of extraPosts) {
      const hashedPassword = await bcrypt.hash('password123', 10);
      const [user] = await db.insert(users)
        .values({ email: p.email, password: hashedPassword })
        .returning();
      createdUsers.push(user);
    }

    // Create posts with userId references and 30-day expiry
    const postsWithUsers = extraPosts.map((p, idx) => ({
      ...p,
      userId: createdUsers[idx].id,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    }));

    await db.insert(posts).values(postsWithUsers);

    console.log(`✅ Successfully seeded ${postsWithUsers.length} extra posts.`);
    console.log('Sample:', postsWithUsers[0]);
    process.exit(0);
  } catch (err) {
    console.error('❌ Error seeding extra posts:', err);
    process.exit(1);
  }
}

seedExtraPosts(120); 