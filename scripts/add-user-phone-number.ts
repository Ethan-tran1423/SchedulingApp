import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function main() {
  const { sql } = await import('@/app/lib/db');

  await sql`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS phone_number TEXT;
  `;

  console.log('User phone number column added');
  process.exit(0);
}

main().catch((error) => {
  console.error('Failed to add user phone number column:', error);
  process.exit(1);
});