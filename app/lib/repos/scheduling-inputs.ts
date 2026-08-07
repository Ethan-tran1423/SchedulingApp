import 'server-only';

import { sql } from '@/app/lib/db';
import type {
  AvailabilityWindow,
  DatedStaffingRequirement,
  EmployeeTimeOffRange,
  OrganizationWorkingHours,
  SchedulingEmployee,
  SchedulingInput,
} from '@/app/lib/scheduling/types';

type EmployeeRow = {
  id: number;
  name: string;
  preferred_weekly_hours: string | null;
};

type EmployeeRoleRow = {
  user_id: number;
  organization_role_id: number;
};

type EmployeeAvailabilityRow = {
  user_id: number;
  day_of_week: number;
  start_time: string;
  end_time: string;
};

type EmployeeTimeOffRow = {
  user_id: number;
  start_date: string | Date;
  end_date: string | Date;
};

type OrganizationWorkingHoursRow = {
  day_of_week: number;
  is_closed: boolean;
  start_time: string | null;
  end_time: string | null;
};

type OrganizationRequirementRow = {
  id: number;
  organization_role_id: number;
  role_name: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  required_count: number;
};

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Formats a PostgreSQL DATE value as YYYY-MM-DD.
 */
function formatDatabaseDate(
  value: string | Date,
): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return String(value).slice(0, 10);
}

/**
 * Formats a PostgreSQL TIME value as HH:MM.
 *
 * PostgreSQL commonly returns values such as 09:00:00,
 * while the scheduling engine only needs hours and minutes.
 */
function formatDatabaseTime(
  value: string,
): string {
  return String(value).slice(0, 5);
}

function parseDateKeyAsUtc(
  dateKey: string,
): Date {
  if (!DATE_KEY_PATTERN.test(dateKey)) {
    throw new Error(
      'The schedule week must use YYYY-MM-DD format.',
    );
  }

  const [year, month, day] = dateKey
    .split('-')
    .map(Number);

  const parsedDate = new Date(
    Date.UTC(year, month - 1, day),
  );

  const formattedDate =
    parsedDate.toISOString().slice(0, 10);

  if (formattedDate !== dateKey) {
    throw new Error(
      'The schedule week contains an invalid date.',
    );
  }

  return parsedDate;
}

function addDaysToDateKey(
  dateKey: string,
  numberOfDays: number,
): string {
  const date = parseDateKeyAsUtc(dateKey);

  date.setUTCDate(
    date.getUTCDate() + numberOfDays,
  );

  return date.toISOString().slice(0, 10);
}

/**
 * Schedule weeks in this application begin on Sunday.
 */
function validateWeekStartDate(
  weekStartDate: string,
): void {
  const parsedDate =
    parseDateKeyAsUtc(weekStartDate);

  if (parsedDate.getUTCDay() !== 0) {
    throw new Error(
      'The schedule week must begin on a Sunday.',
    );
  }
}

function parsePreferredWeeklyHours(
  value: string | null,
): number | null {
  if (value === null) {
    return null;
  }

  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue)) {
    throw new Error(
      'An employee has invalid preferred weekly hours.',
    );
  }

  return parsedValue;
}

/**
 * Loads every database input needed to generate one weekly
 * schedule.
 *
 * The returned week covers Sunday through Saturday.
 */
export async function loadSchedulingInputs({
  organizationId,
  weekStartDate,
}: {
  organizationId: number;
  weekStartDate: string;
}): Promise<SchedulingInput> {
  if (
    !Number.isInteger(organizationId) ||
    organizationId <= 0
  ) {
    throw new Error(
      'A valid organization is required.',
    );
  }

  validateWeekStartDate(weekStartDate);

  const weekEndDate = addDaysToDateKey(
    weekStartDate,
    6,
  );

  const [
    employeeRows,
    employeeRoleRows,
    availabilityRows,
    approvedTimeOffRows,
    workingHoursRows,
    requirementRows,
  ] = await Promise.all([
    /*
     * Load every employee, including employees who have not
     * entered roles, availability, or preferred hours yet.
     *
     * Keeping those employees in the result allows the
     * readiness checker to report incomplete setup.
     */
    sql<EmployeeRow[]>`
      SELECT
        employee.id,
        employee.name,
        preference.preferred_weekly_hours
      FROM users AS employee
      LEFT JOIN employee_scheduling_preferences
        AS preference
        ON preference.user_id = employee.id
      WHERE employee.organization_id =
          ${organizationId}
        AND employee.role = 'employee'
      ORDER BY
        employee.name ASC,
        employee.id ASC;
    `,

    /*
     * Load each role that employees are allowed to work.
     */
    sql<EmployeeRoleRow[]>`
      SELECT
        assignment.user_id,
        assignment.organization_role_id
      FROM user_organization_roles AS assignment
      JOIN users AS employee
        ON employee.id = assignment.user_id
      JOIN organization_roles AS organization_role
        ON organization_role.id =
          assignment.organization_role_id
      WHERE employee.organization_id =
          ${organizationId}
        AND employee.role = 'employee'
        AND organization_role.organization_id =
          ${organizationId}
      ORDER BY
        assignment.user_id ASC,
        assignment.organization_role_id ASC;
    `,

    /*
     * Load recurring weekly availability.
     */
    sql<EmployeeAvailabilityRow[]>`
      SELECT
        availability.user_id,
        availability.day_of_week,
        availability.start_time,
        availability.end_time
      FROM employee_weekly_availability
        AS availability
      JOIN users AS employee
        ON employee.id = availability.user_id
      WHERE employee.organization_id =
          ${organizationId}
        AND employee.role = 'employee'
      ORDER BY
        availability.user_id ASC,
        availability.day_of_week ASC,
        availability.start_time ASC;
    `,

    /*
     * Only approved time off is a hard scheduling restriction.
     *
     * Requests are included when any portion of their date
     * range overlaps the selected schedule week.
     */
    sql<EmployeeTimeOffRow[]>`
      SELECT
        request.user_id,
        request.start_date,
        request.end_date
      FROM time_off_requests AS request
      JOIN users AS employee
        ON employee.id = request.user_id
        AND employee.organization_id =
          request.organization_id
      WHERE request.organization_id =
          ${organizationId}
        AND employee.role = 'employee'
        AND request.status = 'approved'
        AND request.start_date <= ${weekEndDate}
        AND request.end_date >= ${weekStartDate}
      ORDER BY
        request.user_id ASC,
        request.start_date ASC;
    `,

    /*
     * Load all seven organization working-hour entries.
     */
    sql<OrganizationWorkingHoursRow[]>`
      SELECT
        day_of_week,
        is_closed,
        start_time,
        end_time
      FROM organization_weekly_hours
      WHERE organization_id = ${organizationId}
      ORDER BY day_of_week ASC;
    `,

    /*
     * Load recurring staffing requirements and their role
     * names. They are converted to actual calendar dates below.
     */
    sql<OrganizationRequirementRow[]>`
      SELECT
        requirement.id,
        requirement.organization_role_id,
        organization_role.name AS role_name,
        requirement.day_of_week,
        requirement.start_time,
        requirement.end_time,
        requirement.required_count
      FROM organization_role_requirements
        AS requirement
      JOIN organization_roles AS organization_role
        ON organization_role.id =
          requirement.organization_role_id
        AND organization_role.organization_id =
          requirement.organization_id
      WHERE requirement.organization_id =
          ${organizationId}
      ORDER BY
        requirement.day_of_week ASC,
        requirement.start_time ASC,
        organization_role.name ASC;
    `,
  ]);

  const employeesById = new Map<
    number,
    SchedulingEmployee
  >();

  for (const employeeRow of employeeRows) {
    employeesById.set(employeeRow.id, {
      id: employeeRow.id,
      name: employeeRow.name,
      roleIds: [],
      preferredWeeklyHours:
        parsePreferredWeeklyHours(
          employeeRow.preferred_weekly_hours,
        ),
      availability: [],
      approvedTimeOff: [],
    });
  }

  for (const roleRow of employeeRoleRows) {
    const employee = employeesById.get(
      roleRow.user_id,
    );

    if (!employee) {
      continue;
    }

    employee.roleIds.push(
      roleRow.organization_role_id,
    );
  }

  for (const availabilityRow of availabilityRows) {
    const employee = employeesById.get(
      availabilityRow.user_id,
    );

    if (!employee) {
      continue;
    }

    const availabilityWindow:
      AvailabilityWindow = {
        dayOfWeek:
          availabilityRow.day_of_week,
        startTime: formatDatabaseTime(
          availabilityRow.start_time,
        ),
        endTime: formatDatabaseTime(
          availabilityRow.end_time,
        ),
      };

    employee.availability.push(
      availabilityWindow,
    );
  }

  for (const timeOffRow of approvedTimeOffRows) {
    const employee = employeesById.get(
      timeOffRow.user_id,
    );

    if (!employee) {
      continue;
    }

    const timeOffRange:
      EmployeeTimeOffRange = {
        startDate: formatDatabaseDate(
          timeOffRow.start_date,
        ),
        endDate: formatDatabaseDate(
          timeOffRow.end_date,
        ),
      };

    employee.approvedTimeOff.push(
      timeOffRange,
    );
  }

  const workingHours:
    OrganizationWorkingHours[] =
      workingHoursRows.map((row) => ({
        dayOfWeek: row.day_of_week,
        isClosed: row.is_closed,
        startTime:
          row.start_time === null
            ? null
            : formatDatabaseTime(
                row.start_time,
              ),
        endTime:
          row.end_time === null
            ? null
            : formatDatabaseTime(
                row.end_time,
              ),
      }));

  /*
   * Because the application week starts on Sunday and
   * day_of_week uses 0 through 6, the weekday value is also
   * the number of days to add to weekStartDate.
   */
  const requirements:
    DatedStaffingRequirement[] =
      requirementRows.map((row) => ({
        id: row.id,
        roleId: row.organization_role_id,
        roleName: row.role_name,
        date: addDaysToDateKey(
          weekStartDate,
          row.day_of_week,
        ),
        dayOfWeek: row.day_of_week,
        startTime: formatDatabaseTime(
          row.start_time,
        ),
        endTime: formatDatabaseTime(
          row.end_time,
        ),
        requiredCount: row.required_count,
      }));

  return {
    organizationId,
    weekStartDate,
    weekEndDate,
    employees: Array.from(
      employeesById.values(),
    ),
    workingHours,
    requirements,
  };
}