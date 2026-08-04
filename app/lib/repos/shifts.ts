import { sql } from '@/app/lib/db';

export type ShiftStatus =
  | 'scheduled'
  | 'sub_requested'
  | 'covered'
  | 'cancelled';

export type ShiftRow = {
  id: number;
  schedule_id: number | null;
  organization_id: number;
  employee_id: number;
  organization_role_id: number | null;
  created_by_user_id: number | null;
  notes: string | null;
  shift_date: string | Date;
  start_time: string;
  end_time: string;
  status: ShiftStatus;
  created_at: Date;
  updated_at: Date;
};

/**
 * Returns shifts visible to an employee.
 *
 * Existing manually created shifts may have schedule_id NULL.
 * Generated shifts are only visible once their parent schedule
 * has been published.
 */
export async function findEmployeeShiftsInDateRange({
  employeeId,
  startDate,
  endDate,
}: {
  employeeId: number;
  startDate: string;
  endDate: string;
}): Promise<ShiftRow[]> {
  const result = await sql<ShiftRow[]>`
    SELECT
      shift.id,
      shift.schedule_id,
      shift.organization_id,
      shift.employee_id,
      shift.organization_role_id,
      shift.created_by_user_id,
      shift.notes,
      shift.shift_date,
      shift.start_time,
      shift.end_time,
      shift.status,
      shift.created_at,
      shift.updated_at
    FROM shifts AS shift
    LEFT JOIN schedules AS schedule
      ON schedule.id = shift.schedule_id
      AND schedule.organization_id =
        shift.organization_id
    WHERE shift.employee_id = ${employeeId}
      AND shift.shift_date >= ${startDate}
      AND shift.shift_date <= ${endDate}
      AND (
        shift.schedule_id IS NULL
        OR schedule.status = 'published'
      )
    ORDER BY
      shift.shift_date ASC,
      shift.start_time ASC;
  `;

  return result;
}

/**
 * Returns all organization shifts in a date range.
 *
 * Managers may see draft and published shifts. Later, the
 * manager scheduling page should use schedule-specific queries
 * to avoid combining multiple revisions.
 */
export async function findOrganizationShiftsInDateRange({
  organizationId,
  startDate,
  endDate,
}: {
  organizationId: number;
  startDate: string;
  endDate: string;
}): Promise<ShiftRow[]> {
  const result = await sql<ShiftRow[]>`
    SELECT
      id,
      schedule_id,
      organization_id,
      employee_id,
      organization_role_id,
      created_by_user_id,
      notes,
      shift_date,
      start_time,
      end_time,
      status,
      created_at,
      updated_at
    FROM shifts
    WHERE organization_id = ${organizationId}
      AND shift_date >= ${startDate}
      AND shift_date <= ${endDate}
    ORDER BY
      shift_date ASC,
      start_time ASC;
  `;

  return result;
}

export async function findShiftById(
  shiftId: number,
): Promise<ShiftRow | undefined> {
  const result = await sql<ShiftRow[]>`
    SELECT
      id,
      schedule_id,
      organization_id,
      employee_id,
      organization_role_id,
      created_by_user_id,
      notes,
      shift_date,
      start_time,
      end_time,
      status,
      created_at,
      updated_at
    FROM shifts
    WHERE id = ${shiftId}
    LIMIT 1;
  `;

  return result[0];
}