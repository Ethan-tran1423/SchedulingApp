import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function main() {
  const { sql } = await import('@/app/lib/db');

  await sql`
    CREATE TABLE IF NOT EXISTS time_off_requests (
      id SERIAL PRIMARY KEY,

      user_id INTEGER NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

      organization_id INTEGER NOT NULL
        REFERENCES organizations(id)
        ON DELETE CASCADE,

      request_type TEXT NOT NULL
        CHECK (
          request_type IN (
            'vacation',
            'sick',
            'personal',
            'unpaid',
            'other'
          )
        ),

      start_date DATE NOT NULL,
      end_date DATE NOT NULL,

      employee_note TEXT,

      status TEXT NOT NULL DEFAULT 'pending'
        CHECK (
          status IN (
            'pending',
            'approved',
            'denied',
            'cancelled'
          )
        ),

      reviewed_by_user_id INTEGER
        REFERENCES users(id)
        ON DELETE SET NULL,

      manager_note TEXT,
      reviewed_at TIMESTAMP,

      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

      CONSTRAINT valid_time_off_date_range
        CHECK (start_date <= end_date)
    );
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS time_off_requests_user_idx
    ON time_off_requests (
      user_id,
      created_at
    );
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS time_off_requests_org_status_idx
    ON time_off_requests (
      organization_id,
      status
    );
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS time_off_requests_user_dates_idx
    ON time_off_requests (
      user_id,
      start_date,
      end_date
    );
  `;

  console.log('Time-off requests table created.');
  process.exit(0);
}

main().catch((error) => {
  console.error('Failed to create time-off requests table:', error);
  process.exit(1);
});

// must run command npx tsx scripts/add-time-off-requests-table.ts in terminal to create the table in the database later