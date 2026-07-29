import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function main() {
  const { sql } = await import('@/app/lib/db');

  // -------------------------------------------------------
  // Organizations
  // -------------------------------------------------------

  await sql`
    CREATE TABLE IF NOT EXISTS organizations (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `;

  // -------------------------------------------------------
  // Users
  // -------------------------------------------------------

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,

      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      phone_number TEXT,
      password_hash TEXT NOT NULL,

      role TEXT NOT NULL
        CHECK (role IN ('manager', 'employee')),

      organization_id INTEGER NOT NULL
        REFERENCES organizations(id)
        ON DELETE CASCADE,

      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `;

  // -------------------------------------------------------
  // Organization roles
  // -------------------------------------------------------

  await sql`
    CREATE TABLE IF NOT EXISTS organization_roles (
      id SERIAL PRIMARY KEY,

      organization_id INTEGER NOT NULL
        REFERENCES organizations(id)
        ON DELETE CASCADE,

      name TEXT NOT NULL,
      description TEXT,

      created_at TIMESTAMP NOT NULL DEFAULT NOW(),

      CONSTRAINT unique_organization_role_name
        UNIQUE (
          organization_id,
          name
        )
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS user_organization_roles (
      user_id INTEGER NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

      organization_role_id INTEGER NOT NULL
        REFERENCES organization_roles(id)
        ON DELETE CASCADE,

      created_at TIMESTAMP NOT NULL DEFAULT NOW(),

      PRIMARY KEY (
        user_id,
        organization_role_id
      )
    );
  `;

  // -------------------------------------------------------
  // Employee preferred availability
  // -------------------------------------------------------

  await sql`
    CREATE TABLE IF NOT EXISTS employee_weekly_availability (
      id SERIAL PRIMARY KEY,

      user_id INTEGER NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

      day_of_week SMALLINT NOT NULL
        CHECK (day_of_week BETWEEN 0 AND 6),

      start_time TIME NOT NULL,
      end_time TIME NOT NULL,

      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

      CONSTRAINT valid_availability_time_range
        CHECK (start_time < end_time),

      CONSTRAINT unique_employee_availability_window
        UNIQUE (
          user_id,
          day_of_week,
          start_time,
          end_time
        )
    );
  `;

  // -------------------------------------------------------
  // Employee scheduling preferences
  // -------------------------------------------------------

  await sql`
    CREATE TABLE IF NOT EXISTS employee_scheduling_preferences (
      id SERIAL PRIMARY KEY,

      user_id INTEGER NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

      preferred_weekly_hours NUMERIC(4, 1) NOT NULL
        CHECK (
          preferred_weekly_hours >= 0
          AND preferred_weekly_hours <= 80
        ),

      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

      CONSTRAINT unique_employee_scheduling_preference
        UNIQUE (user_id)
    );
  `;

  // -------------------------------------------------------
  // Organization weekly working hours
  // -------------------------------------------------------

  await sql`
    CREATE TABLE IF NOT EXISTS organization_weekly_hours (
      id SERIAL PRIMARY KEY,

      organization_id INTEGER NOT NULL
        REFERENCES organizations(id)
        ON DELETE CASCADE,

      day_of_week SMALLINT NOT NULL
        CHECK (day_of_week BETWEEN 0 AND 6),

      is_closed BOOLEAN NOT NULL DEFAULT FALSE,

      start_time TIME,
      end_time TIME,

      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

      CONSTRAINT valid_organization_working_hours
        CHECK (
          (
            is_closed = TRUE
            AND start_time IS NULL
            AND end_time IS NULL
          )
          OR
          (
            is_closed = FALSE
            AND start_time IS NOT NULL
            AND end_time IS NOT NULL
            AND start_time < end_time
          )
        ),

      CONSTRAINT unique_organization_working_day
        UNIQUE (
          organization_id,
          day_of_week
        )
    );
  `;

  // -------------------------------------------------------
  // Organization staffing requirements
  // -------------------------------------------------------

  await sql`
    CREATE TABLE IF NOT EXISTS organization_role_requirements (
      id SERIAL PRIMARY KEY,

      organization_id INTEGER NOT NULL
        REFERENCES organizations(id)
        ON DELETE CASCADE,

      organization_role_id INTEGER NOT NULL
        REFERENCES organization_roles(id)
        ON DELETE CASCADE,

      day_of_week SMALLINT NOT NULL
        CHECK (day_of_week BETWEEN 0 AND 6),

      start_time TIME NOT NULL,
      end_time TIME NOT NULL,

      required_count INTEGER NOT NULL
        CHECK (required_count > 0),

      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

      CONSTRAINT valid_role_requirement_time_range
        CHECK (start_time < end_time),

      CONSTRAINT unique_role_requirement_window
        UNIQUE (
          organization_id,
          organization_role_id,
          day_of_week,
          start_time,
          end_time
        )
    );
  `;

  // -------------------------------------------------------
  // Shifts
  // -------------------------------------------------------

  await sql`
    CREATE TABLE IF NOT EXISTS shifts (
      id SERIAL PRIMARY KEY,

      organization_id INTEGER NOT NULL
        REFERENCES organizations(id)
        ON DELETE CASCADE,

      employee_id INTEGER NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

      organization_role_id INTEGER
        REFERENCES organization_roles(id)
        ON DELETE SET NULL,
      
      created_by_user_id INTEGER
      REFERENCES users(id)
      ON DELETE RESTRICT,

      notes TEXT,

      shift_date DATE NOT NULL,

      start_time TIME NOT NULL,
      end_time TIME NOT NULL,

      status TEXT NOT NULL DEFAULT 'scheduled'
        CHECK (
          status IN (
            'scheduled',
            'sub_requested',
            'covered',
            'cancelled'
          )
        ),

      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

      CONSTRAINT valid_shift_time_range
        CHECK (start_time < end_time)
    );
  `;

  // -------------------------------------------------------
  // Shift sub requests
  // -------------------------------------------------------

  await sql`
    CREATE TABLE IF NOT EXISTS shift_sub_requests (
      id SERIAL PRIMARY KEY,

      shift_id INTEGER NOT NULL
        REFERENCES shifts(id)
        ON DELETE CASCADE,

      requested_by_user_id INTEGER NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

      picked_up_by_user_id INTEGER
        REFERENCES users(id)
        ON DELETE SET NULL,

      status TEXT NOT NULL DEFAULT 'open'
        CHECK (
          status IN (
            'open',
            'picked_up',
            'approved',
            'denied',
            'cancelled'
          )
        ),

      reason TEXT,

      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `;

  // -------------------------------------------------------
  // Indexes
  // -------------------------------------------------------

  await sql`
    CREATE INDEX IF NOT EXISTS employee_weekly_availability_user_day_idx
    ON employee_weekly_availability (
      user_id,
      day_of_week
    );
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS employee_scheduling_preferences_user_idx
    ON employee_scheduling_preferences (
      user_id
    );
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS organization_roles_organization_idx
    ON organization_roles (
      organization_id
    );
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS user_organization_roles_user_idx
    ON user_organization_roles (
      user_id
    );
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS user_organization_roles_role_idx
    ON user_organization_roles (
      organization_role_id
    );
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS organization_weekly_hours_org_day_idx
    ON organization_weekly_hours (
      organization_id,
      day_of_week
    );
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS organization_role_requirements_org_day_idx
    ON organization_role_requirements (
      organization_id,
      day_of_week
    );
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS organization_role_requirements_role_day_idx
    ON organization_role_requirements (
      organization_role_id,
      day_of_week
    );
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS shifts_org_date_idx
    ON shifts (
      organization_id,
      shift_date
    );
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS shifts_employee_date_idx
    ON shifts (
      employee_id,
      shift_date
    );
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS shift_sub_requests_status_idx
    ON shift_sub_requests (
      status
    );
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS shift_sub_requests_shift_idx
    ON shift_sub_requests (
      shift_id
    );
  `;

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS shift_sub_requests_active_shift_idx
    ON shift_sub_requests (
      shift_id
    )
    WHERE status IN (
      'open',
      'picked_up'
    );
  `;

  console.log('Database initialized');
  process.exit(0);
}

main().catch((error) => {
  console.error('Database initialization failed:', error);
  process.exit(1);
});