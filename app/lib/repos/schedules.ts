import 'server-only';
import type {
  GeneratedShift,
} from '@/app/lib/scheduling/types';
import { sql } from '@/app/lib/db';
import type { ShiftRow } from '@/app/lib/repos/shifts';

export const SCHEDULE_STATUSES = [
  'draft',
  'published',
  'archived',
] as const;

export const SCHEDULE_GENERATION_METHODS = [
  'automatic',
  'manual',
  'ai_assisted',
] as const;

export type ScheduleStatus =
  (typeof SCHEDULE_STATUSES)[number];

export type ScheduleGenerationMethod =
  (typeof SCHEDULE_GENERATION_METHODS)[number];

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | {
      [key: string]: JsonValue;
    };

export type JsonObject = {
  [key: string]: JsonValue;
};

export type ScheduleRow = {
  id: number;
  organization_id: number;
  week_start_date: string | Date;
  status: ScheduleStatus;
  revision: number;
  created_by_user_id: number;
  generation_method: ScheduleGenerationMethod;
  generation_summary: JsonObject;
  published_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

export type ScheduleWithShifts = {
  schedule: ScheduleRow;
  shifts: ShiftRow[];
};

/**
 * Finds one schedule by ID.
 *
 * organizationId is required so that a schedule belonging to
 * another organization cannot be returned accidentally.
 */
export async function findScheduleById({
  scheduleId,
  organizationId,
}: {
  scheduleId: number;
  organizationId: number;
}): Promise<ScheduleRow | undefined> {
  const result = await sql<ScheduleRow[]>`
    SELECT
      id,
      organization_id,
      week_start_date,
      status,
      revision,
      created_by_user_id,
      generation_method,
      generation_summary,
      published_at,
      created_at,
      updated_at
    FROM schedules
    WHERE id = ${scheduleId}
      AND organization_id = ${organizationId}
    LIMIT 1;
  `;

  return result[0];
}

/**
 * Finds the current draft for an organization and week.
 *
 * The database should only permit one draft for the same
 * organization and week, but ordering by revision gives us
 * an additional layer of protection.
 */
export async function findDraftSchedule({
  organizationId,
  weekStartDate,
}: {
  organizationId: number;
  weekStartDate: string;
}): Promise<ScheduleRow | undefined> {
  const result = await sql<ScheduleRow[]>`
    SELECT
      id,
      organization_id,
      week_start_date,
      status,
      revision,
      created_by_user_id,
      generation_method,
      generation_summary,
      published_at,
      created_at,
      updated_at
    FROM schedules
    WHERE organization_id = ${organizationId}
      AND week_start_date = ${weekStartDate}
      AND status = 'draft'
    ORDER BY revision DESC
    LIMIT 1;
  `;

  return result[0];
}

/**
 * Finds the published schedule for an organization and week.
 */
export async function findPublishedSchedule({
  organizationId,
  weekStartDate,
}: {
  organizationId: number;
  weekStartDate: string;
}): Promise<ScheduleRow | undefined> {
  const result = await sql<ScheduleRow[]>`
    SELECT
      id,
      organization_id,
      week_start_date,
      status,
      revision,
      created_by_user_id,
      generation_method,
      generation_summary,
      published_at,
      created_at,
      updated_at
    FROM schedules
    WHERE organization_id = ${organizationId}
      AND week_start_date = ${weekStartDate}
      AND status = 'published'
    ORDER BY revision DESC
    LIMIT 1;
  `;

  return result[0];
}

/**
 * Returns one schedule and all shifts belonging to it.
 *
 * This should be used by the manager schedule page instead
 * of loading every organization shift in the date range.
 * Doing so prevents archived revisions from being mixed
 * together on the calendar.
 */
export async function findScheduleWithShifts({
  scheduleId,
  organizationId,
}: {
  scheduleId: number;
  organizationId: number;
}): Promise<ScheduleWithShifts | undefined> {
  const schedule = await findScheduleById({
    scheduleId,
    organizationId,
  });

  if (!schedule) {
    return undefined;
  }

  const shifts = await sql<ShiftRow[]>`
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
    WHERE schedule_id = ${scheduleId}
      AND organization_id = ${organizationId}
    ORDER BY
      shift_date ASC,
      start_time ASC,
      employee_id ASC;
  `;

  return {
    schedule,
    shifts,
  };
}

/**
 * Archives the existing draft for the week and creates a new
 * draft revision with its generated shifts.
 *
 * Everything runs inside one transaction. If any schedule or
 * shift insert fails, the existing draft remains unchanged.
 */
export async function replaceDraftSchedule({
  organizationId,
  createdByUserId,
  weekStartDate,
  generationMethod = 'automatic',
  generationSummary,
  shifts,
}: {
  organizationId: number;
  createdByUserId: number;
  weekStartDate: string;
  generationMethod?: ScheduleGenerationMethod;
  generationSummary: JsonObject;
  shifts: GeneratedShift[];
}): Promise<ScheduleWithShifts> {
  const serializedSummary = JSON.stringify(
    generationSummary,
  );

  return sql.begin(async (transaction) => {
    /*
     * Archive the current draft first.
     *
     * If a later operation fails, the transaction rolls this
     * update back and restores the previous draft.
     */
    await transaction`
      UPDATE schedules
      SET
        status = 'archived',
        updated_at = NOW()
      WHERE organization_id = ${organizationId}
        AND week_start_date = ${weekStartDate}
        AND status = 'draft';
    `;

    const revisionResult = await transaction<
      {
        next_revision: number;
      }[]
    >`
      SELECT
        (
          COALESCE(MAX(revision), 0) + 1
        )::INTEGER AS next_revision
      FROM schedules
      WHERE organization_id = ${organizationId}
        AND week_start_date = ${weekStartDate};
    `;

    const nextRevision =
      revisionResult[0]?.next_revision ?? 1;

    /*
     * Insert through a SELECT from users so that the schedule
     * is only created when the creator is a manager belonging
     * to this organization.
     */
    const scheduleResult =
      await transaction<ScheduleRow[]>`
        INSERT INTO schedules (
          organization_id,
          week_start_date,
          status,
          revision,
          created_by_user_id,
          generation_method,
          generation_summary
        )
        SELECT
          ${organizationId},
          ${weekStartDate},
          'draft',
          ${nextRevision},
          manager.id,
          ${generationMethod},
          ${serializedSummary}::JSONB
        FROM users AS manager
        WHERE manager.id = ${createdByUserId}
          AND manager.role = 'manager'
          AND manager.organization_id =
            ${organizationId}
        RETURNING
          id,
          organization_id,
          week_start_date,
          status,
          revision,
          created_by_user_id,
          generation_method,
          generation_summary,
          published_at,
          created_at,
          updated_at;
      `;

    const schedule = scheduleResult[0];

    if (!schedule) {
      throw new Error(
        'The draft schedule could not be created. The manager or organization was invalid.',
      );
    }

    const insertedShifts: ShiftRow[] = [];

    for (const shift of shifts) {
      /*
       * This query verifies that:
       *
       * - The user is an employee.
       * - The employee belongs to this organization.
       * - The organization role belongs to this organization.
       * - The role is assigned to the employee.
       * - The shift date falls inside the schedule week.
       */
      const shiftResult =
        await transaction<ShiftRow[]>`
          INSERT INTO shifts (
            schedule_id,
            organization_id,
            employee_id,
            organization_role_id,
            created_by_user_id,
            notes,
            shift_date,
            start_time,
            end_time,
            status
          )
          SELECT
            ${schedule.id},
            ${organizationId},
            employee.id,
            organization_role.id,
            ${createdByUserId},
            ${shift.notes ?? null},
            ${shift.shiftDate},
            ${shift.startTime},
            ${shift.endTime},
            'scheduled'
          FROM users AS employee
          JOIN user_organization_roles
            AS employee_role
            ON employee_role.user_id =
              employee.id
          JOIN organization_roles
            AS organization_role
            ON organization_role.id =
              employee_role.organization_role_id
          WHERE employee.id = ${shift.employeeId}
            AND employee.role = 'employee'
            AND employee.organization_id =
              ${organizationId}
            AND organization_role.id =
              ${shift.organizationRoleId}
            AND organization_role.organization_id =
              ${organizationId}
            AND ${shift.shiftDate}::DATE >=
              ${weekStartDate}::DATE
            AND ${shift.shiftDate}::DATE <
              (
                ${weekStartDate}::DATE
                + INTERVAL '7 days'
              )
          RETURNING
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
            updated_at;
        `;

      const insertedShift = shiftResult[0];

      if (!insertedShift) {
        throw new Error(
          `Unable to create a shift for employee ${shift.employeeId}. Check the employee, role assignment, organization, and shift date.`,
        );
      }

      insertedShifts.push(insertedShift);
    }

    return {
      schedule,
      shifts: insertedShifts,
    };
  });
}

/**
 * Publishes a draft schedule.
 *
 * If another schedule is already published for the same week,
 * that older schedule is archived first.
 */
export async function publishDraftSchedule({
  scheduleId,
  organizationId,
}: {
  scheduleId: number;
  organizationId: number;
}): Promise<ScheduleRow> {
  return sql.begin(async (transaction) => {
    /*
     * Lock the draft so that two publish requests cannot update
     * the same schedule simultaneously.
     */
    const draftResult =
      await transaction<ScheduleRow[]>`
        SELECT
          id,
          organization_id,
          week_start_date,
          status,
          revision,
          created_by_user_id,
          generation_method,
          generation_summary,
          published_at,
          created_at,
          updated_at
        FROM schedules
        WHERE id = ${scheduleId}
          AND organization_id = ${organizationId}
          AND status = 'draft'
        LIMIT 1
        FOR UPDATE;
      `;

    const draft = draftResult[0];

    if (!draft) {
      throw new Error(
        'The draft schedule was not found or has already been published.',
      );
    }

    /*
     * Archive the previously published schedule before
     * publishing the new one. This satisfies the unique
     * published-schedule-per-week index.
     */
    await transaction`
      UPDATE schedules
      SET
        status = 'archived',
        updated_at = NOW()
      WHERE organization_id = ${organizationId}
        AND week_start_date =
          ${draft.week_start_date}
        AND status = 'published';
    `;

    const publishedResult =
      await transaction<ScheduleRow[]>`
        UPDATE schedules
        SET
          status = 'published',
          published_at = NOW(),
          updated_at = NOW()
        WHERE id = ${scheduleId}
          AND organization_id = ${organizationId}
          AND status = 'draft'
        RETURNING
          id,
          organization_id,
          week_start_date,
          status,
          revision,
          created_by_user_id,
          generation_method,
          generation_summary,
          published_at,
          created_at,
          updated_at;
      `;

    const publishedSchedule =
      publishedResult[0];

    if (!publishedSchedule) {
      throw new Error(
        'The draft schedule could not be published.',
      );
    }

    return publishedSchedule;
  });
}