import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function main() {
  const { sql } = await import('@/app/lib/db');

  await sql`
    ALTER TABLE shifts
    ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER;
  `;

  await sql`
    ALTER TABLE shifts
    ADD COLUMN IF NOT EXISTS notes TEXT;
  `;

  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'shifts_created_by_user_id_fkey'
      ) THEN
        ALTER TABLE shifts
        ADD CONSTRAINT shifts_created_by_user_id_fkey
        FOREIGN KEY (created_by_user_id)
        REFERENCES users(id)
        ON DELETE RESTRICT;
      END IF;
    END
    $$;
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS shifts_created_by_user_idx
    ON shifts (
      created_by_user_id
    );
  `;

  console.log('Shift creation fields added');
  process.exit(0);
}

main().catch((error) => {
  console.error(
    'Failed to add shift creation fields:',
    error,
  );

  process.exit(1);
});