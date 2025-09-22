import { db } from './index';
import { sql } from 'drizzle-orm';

async function main() {
  try {
    console.log('Removing ui_texts key="filterAll" ...');
    const res: any = await db.execute(sql`DELETE FROM ui_texts WHERE "key" = 'filterAll' RETURNING "key"`);
    const count = Array.isArray(res?.rows) ? res.rows.length : (typeof res?.rowCount === 'number' ? res.rowCount : 0);
    console.log(`Removed rows: ${count}`);
    process.exit(0);
  } catch (err) {
    console.error('Failed to remove ui_texts key="filterAll"', err);
    process.exit(1);
  }
}

main(); 