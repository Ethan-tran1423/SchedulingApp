// Script to add schedule-version support.
//
// Creates:
// - schedules
//
// Updates:
// - shifts.schedule_id
//
// A schedule groups all shifts for one organization and one week.
// This allows generated shifts to remain drafts until a manager
// publishes the schedule.

import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function main() {
  const { sql } = await import('@/app/lib/db');

  // -------------------------------------------------------
  // Schedules
  // -------------------------------------------------------

  await sql`
    CREATE TABLE IF NOT EXISTS schedules (
      id SERIAL PRIMARY KEY,

      organization_id INTEGER NOT NULL
        REFERENCES organizations(id)
        ON DELETE CASCADE,

      week_start_date DATE NOT NULL,

      status TEXT NOT NULL DEFAULT 'draft'
        CHECK (
          status IN (
            'draft',
            'published',
            'archived'
          )
        ),

      revision INTEGER NOT NULL DEFAULT 1
        CHECK (revision > 0),

      created_by_user_id INTEGER NOT NULL
        REFERENCES users(id)
        ON DELETE RESTRICT,

      generation_method TEXT NOT NULL DEFAULT 'automatic'
        CHECK (
          generation_method IN (
            'automatic',
            'manual',
            'ai_assisted'
          )
        ),

      generation_summary JSONB NOT NULL
        DEFAULT '{}'::JSONB,

      published_at TIMESTAMP,

      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

      CONSTRAINT valid_schedule_week_start
        CHECK (
          EXTRACT(DOW FROM week_start_date) = 0
        ),

      CONSTRAINT valid_schedule_published_at
        CHECK (
          status <> 'published'
          OR published_at IS NOT NULL
        ),

      CONSTRAINT unique_schedule_revision
        UNIQUE (
          organization_id,
          week_start_date,
          revision
        ),

      CONSTRAINT unique_schedule_id_organization
        UNIQUE (
          id,
          organization_id
        )
    );
  `;

  // -------------------------------------------------------
  // Add schedule reference to shifts
  // -------------------------------------------------------

  await sql`
    ALTER TABLE shifts
    ADD COLUMN IF NOT EXISTS schedule_id INTEGER;
  `;

  /*
   * The composite foreign key ensures that a shift cannot
   * accidentally reference a schedule belonging to another
   * organization.
   *
   * Existing manually created shifts may keep schedule_id NULL.
   */
  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname =
          'shifts_schedule_organization_fkey'
      ) THEN
        ALTER TABLE shifts
        ADD CONSTRAINT
          shifts_schedule_organization_fkey
        FOREIGN KEY (
          schedule_id,
          organization_id
        )
        REFERENCES schedules (
          id,
          organization_id
        )
        ON DELETE CASCADE;
      END IF;
    END
    $$;
  `;

  // -------------------------------------------------------
  // Schedule indexes
  // -------------------------------------------------------

  await sql`
    CREATE INDEX IF NOT EXISTS
      schedules_organization_week_idx
    ON schedules (
      organization_id,
      week_start_date
    );
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS
      schedules_organization_status_idx
    ON schedules (
      organization_id,
      status
    );
  `;

  /*
   * Only one current draft may exist for an organization
   * during a given week. Older drafts should be archived
   * before a replacement draft is created.
   */
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS
      schedules_one_draft_per_week_idx
    ON schedules (
      organization_id,
      week_start_date
    )
    WHERE status = 'draft';
  `;

  /*
   * Only one published schedule may exist for an organization
   * during a given week.
   */
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS
      schedules_one_published_per_week_idx
    ON schedules (
      organization_id,
      week_start_date
    )
    WHERE status = 'published';
  `;

  // -------------------------------------------------------
  // Shift indexes
  // -------------------------------------------------------

  await sql`
    CREATE INDEX IF NOT EXISTS
      shifts_schedule_idx
    ON shifts (
      schedule_id
    );
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS
      shifts_schedule_organization_idx
    ON shifts (
      schedule_id,
      organization_id
    );
  `;

  console.log(
    'Schedules table and shift schedule reference created',
  );

  process.exit(0);
}

main().catch((error) => {
  console.error(
    'Failed to create schedules table:',
    error,
  );

  process.exit(1);
});