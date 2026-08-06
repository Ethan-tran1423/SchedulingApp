import { findOrganizationRoles } from '@/app/lib/repos/org-roles';
import {
  findScheduleWithShifts,
} from '@/app/lib/repos/schedules';
import { getEmployees } from '@/app/lib/repos/view-employees';
import { requireManager } from '@/app/lib/utils/auth/require-manager';

import AutomaticSchedulingClient, {
  type SchedulePreview,
} from './automatic-scheduling-client';

type PageProps = {
  searchParams: Promise<{
    scheduleId?: string | string[];
    weekStartDate?: string | string[];
  }>;
};

type UnknownRecord = Record<string, unknown>;

function getSingleSearchParameter(
  value: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function parseScheduleId(
  value: string | undefined,
): number | null {
  if (!value) {
    return null;
  }

  const scheduleId = Number(value);

  if (
    !Number.isInteger(scheduleId) ||
    scheduleId <= 0
  ) {
    return null;
  }

  return scheduleId;
}

function formatDatabaseDate(
  value: string | Date,
): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return String(value).slice(0, 10);
}

function formatDatabaseTime(
  value: string,
): string {
  return String(value).slice(0, 5);
}

function getCurrentWeekStartDate(): string {
  const currentDate = new Date();

  const sunday = new Date(
    Date.UTC(
      currentDate.getUTCFullYear(),
      currentDate.getUTCMonth(),
      currentDate.getUTCDate(),
    ),
  );

  sunday.setUTCDate(
    sunday.getUTCDate() -
      sunday.getUTCDay(),
  );

  return sunday.toISOString().slice(0, 10);
}

function asRecord(
  value: unknown,
): UnknownRecord | null {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value)
  ) {
    return null;
  }

  return value as UnknownRecord;
}

function readNumber(
  value: unknown,
  fallback = 0,
): number {
  if (
    typeof value === 'number' &&
    Number.isFinite(value)
  ) {
    return value;
  }

  return fallback;
}

function readString(
  value: unknown,
  fallback = '',
): string {
  return typeof value === 'string'
    ? value
    : fallback;
}

function readIssueList(
  value: unknown,
): SchedulePreview['warnings'] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    const issue = asRecord(item);

    if (!issue) {
      return [];
    }

    const message = readString(
      issue.message,
    );

    if (!message) {
      return [];
    }

    return [
      {
        code: readString(
          issue.code,
          'warning',
        ),
        message,
      },
    ];
  });
}

function readUnfilledRequirements(
  value: unknown,
): SchedulePreview['unfilledRequirements'] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    const requirement = asRecord(item);

    if (!requirement) {
      return [];
    }

    return [
      {
        requirementId: readNumber(
          requirement.requirementId,
        ),

        organizationRoleId: readNumber(
          requirement.organizationRoleId,
        ),

        roleName: readString(
          requirement.roleName,
          'Unknown role',
        ),

        shiftDate: readString(
          requirement.shiftDate,
        ),

        startTime: readString(
          requirement.startTime,
        ),

        endTime: readString(
          requirement.endTime,
        ),

        requiredCount: readNumber(
          requirement.requiredCount,
        ),

        assignedCount: readNumber(
          requirement.assignedCount,
        ),

        missingCount: readNumber(
          requirement.missingCount,
        ),

        reason: readString(
          requirement.reason,
          'Not enough eligible employees were available.',
        ),
      },
    ];
  });
}

function createSchedulePreview({
  scheduleWithShifts,
  employees,
  roles,
}: {
  scheduleWithShifts: NonNullable<
    Awaited<
      ReturnType<
        typeof findScheduleWithShifts
      >
    >
  >;

  employees: Awaited<
    ReturnType<typeof getEmployees>
  >;

  roles: Awaited<
    ReturnType<
      typeof findOrganizationRoles
    >
  >;
}): SchedulePreview {
  const {
    schedule,
    shifts,
  } = scheduleWithShifts;

  const employeeNames = new Map(
    employees.map((employee) => [
      employee.id,
      employee.name,
    ]),
  );

  const roleNames = new Map(
    roles.map((role) => [
      role.id,
      role.name,
    ]),
  );

  const summary =
    asRecord(
      schedule.generation_summary,
    ) ?? {};

  const generation =
    asRecord(summary.generation) ?? {};

  const readiness =
    asRecord(summary.readiness) ?? {};

  const filledAssignments =
    readNumber(
      generation.filledAssignments,
      shifts.length,
    );

  const totalRequiredAssignments =
    readNumber(
      generation.totalRequiredAssignments,
      filledAssignments,
    );

  const unfilledAssignments =
    readNumber(
      generation.unfilledAssignments,
      Math.max(
        0,
        totalRequiredAssignments -
          filledAssignments,
      ),
    );

  const coveragePercentage =
    readNumber(
      generation.coveragePercentage,
      totalRequiredAssignments === 0
        ? 100
        : Math.round(
            (
              filledAssignments /
              totalRequiredAssignments
            ) * 1000,
          ) / 10,
    );

  return {
    id: schedule.id,

    status: schedule.status,

    revision: schedule.revision,

    weekStartDate:
      formatDatabaseDate(
        schedule.week_start_date,
      ),

    generationMethod:
      schedule.generation_method,

    publishedAt:
      schedule.published_at
        ? schedule.published_at.toISOString()
        : null,
    employees: employees.map(
      (employee) => ({
        id: employee.id,
        name: employee.name,
      }),
    ),

    filledAssignments,

    totalRequiredAssignments,

    unfilledAssignments,

    coveragePercentage,

    warnings: readIssueList(
      readiness.warnings,
    ),

    unfilledRequirements:
      readUnfilledRequirements(
        generation.unfilledRequirements,
      ),

    shifts: shifts.map((shift) => ({
      id: shift.id,

      employeeId: shift.employee_id,

      employeeName:
        employeeNames.get(
          shift.employee_id,
        ) ??
        `Employee #${shift.employee_id}`,

      organizationRoleId:
        shift.organization_role_id,

      roleName:
        shift.organization_role_id ===
        null
          ? 'No role'
          : roleNames.get(
                shift.organization_role_id,
              ) ??
            `Role #${shift.organization_role_id}`,

      shiftDate:
        formatDatabaseDate(
          shift.shift_date,
        ),

      startTime:
        formatDatabaseTime(
          shift.start_time,
        ),

      endTime:
        formatDatabaseTime(
          shift.end_time,
        ),

      notes: shift.notes,
    })),
  };
}

export default async function AutomaticSchedulingPage({
  searchParams,
}: PageProps) {
  const manager = await requireManager();

  const parameters = await searchParams;

  const requestedScheduleId =
    parseScheduleId(
      getSingleSearchParameter(
        parameters.scheduleId,
      ),
    );

  const requestedWeekStartDate =
    getSingleSearchParameter(
      parameters.weekStartDate,
    );

  let schedulePreview:
    SchedulePreview | null = null;

  let scheduleNotFound = false;

  if (requestedScheduleId !== null) {
    const [
      scheduleWithShifts,
      employees,
      roles,
    ] = await Promise.all([
      findScheduleWithShifts({
        scheduleId:
          requestedScheduleId,

        organizationId:
          manager.organization_id,
      }),

      getEmployees(
        manager.organization_id,
      ),

      findOrganizationRoles(
        manager.organization_id,
      ),
    ]);

    if (scheduleWithShifts) {
      schedulePreview =
        createSchedulePreview({
          scheduleWithShifts,
          employees,
          roles,
        });
    } else {
      scheduleNotFound = true;
    }
  }

  const selectedWeekStartDate =
    schedulePreview?.weekStartDate ??
    requestedWeekStartDate ??
    getCurrentWeekStartDate();

  return (
    <section>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-black">
          Automatic Scheduling
        </h1>

        <p className="mt-2 max-w-3xl text-gray-600">
          Generate a weekly draft from employee
          availability, roles, preferred hours,
          approved time off, and organization
          staffing requirements.
        </p>
      </div>

      <AutomaticSchedulingClient
        selectedWeekStartDate={
          selectedWeekStartDate
        }
        schedulePreview={
          schedulePreview
        }
        scheduleNotFound={
          scheduleNotFound
        }
      />
    </section>
  );
}