import 'dotenv/config';
import { db } from './index';
import { posts } from './schema';
import { sql, eq } from 'drizzle-orm';

async function main() {
  // Set all posts to published and extend expiresAt safely to two weeks from now
  const now = new Date();
  const twoWeeksMs = 14 * 24 * 60 * 60 * 1000;
  const newExpiry = new Date(now.getTime() + twoWeeksMs);

  // Use a single update; preserve other fields
  await db.update(posts)
    .set({ 
      expiresAt: sql`NOW() + INTERVAL '14 days'`,
      status: 'published'
    })
    .where(sql`true`);

  // Verify count updated
  const res = await db.execute(sql`SELECT COUNT(*)::int AS count FROM posts WHERE expires_at > NOW()`);
  // eslint-disable-next-line no-console
  console.log('Posts with future expiry:', res.rows?.[0]?.count);
}

main().then(() => {
  // eslint-disable-next-line no-console
  console.log('Expiry reset complete.');
  process.exit(0);
}).catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Error resetting expiry:', err);
  process.exit(1);
});




