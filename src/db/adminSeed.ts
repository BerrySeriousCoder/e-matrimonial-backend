import { db } from './index';
import { admins } from './schema';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';

async function seedAdmin() {
  try {
    // Check if admin already exists
    const existingAdmin = await db.select().from(admins).where(eq(admins.email, 'admin@matrimonial.com'));
    
    if (existingAdmin.length > 0) {
      console.log('Admin already exists.');
      process.exit(0);
    }

    // Create admin user
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    await db.insert(admins).values({
      email: 'admin@matrimonial.com',
      password: hashedPassword
    });

    console.log('Admin user created successfully!');
    console.log('Email: admin@matrimonial.com');
    console.log('Password: admin123');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding admin:', error);
    process.exit(1);
  }
}

seedAdmin(); 