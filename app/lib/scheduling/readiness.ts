import type {
  DatedStaffingRequirement,
  SchedulingEmployee,
  SchedulingInput,
} from '@/app/lib/scheduling/types';

export type SchedulingReadinessIssueSeverity =
  | 'error'
  | 'warning';

export type SchedulingReadinessIssueCode =
  | 'invalid-schedule-week'
  | 'missing-working-hours'
  | 'duplicate-working-hours'
  | 'invalid-working-hours'
  | 'no-employees'
  | 'no-role-assignments'
  | 'no-availability'
  | 'no-staffing-requirements'
  | 'invalid-staffing-requirement'
  | 'requirement-outside-working-hours'
  | 'employee-missing-roles'
  | 'employee-missing-availability'
  | 'employee-missing-preferred-hours'
  | 'requirement-no-qualified-employee'
  | 'requirement-no-available-employee';

export type SchedulingReadinessIssue = {
  code: SchedulingReadinessIssueCode;
  severity: SchedulingReadinessIssueSeverity;
  message: string;

  employeeId?: number;
  employeeName?: string;

  requirementId?: number;
  roleId?: number;
  roleName?: string;
  date?: string;
};

export type SchedulingReadinessSummary = {
  employeeCount: number;
  employeesWithRoles: number;
  employeesWithAvailability: number;
  employeesWithPreferredHours: number;

  configuredWorkingDays: number;
  openWorkingDays: number;

  requirementCount: number;
  totalRequiredAssignments: number;

  requirementsWithoutQualifiedEmployees: number;
  requirementsWithoutAvailableEmployees: number;
};

export type SchedulingReadinessResult = {
  ready: boolean;
  errors: SchedulingReadinessIssue[];
  warnings: SchedulingReadinessIssue[];
  summary: SchedulingReadinessSummary;
};

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

function isValidDateKey(
  dateKey: string,
): boolean {
  if (!DATE_KEY_PATTERN.test(dateKey)) {
    return false;
  }

  const [year, month, day] = dateKey
    .split('-')
    .map(Number);

  const date = new Date(
    Date.UTC(year, month - 1, day),
  );

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function addDaysToDateKey(
  dateKey: string,
  numberOfDays: number,
): string {
  const [year, month, day] = dateKey
    .split('-')
    .map(Number);

  const date = new Date(
    Date.UTC(year, month - 1, day),
  );

  date.setUTCDate(
    date.getUTCDate() + numberOfDays,
  );

  return date.toISOString().slice(0, 10);
}

function getDayOfWeek(
  dateKey: string,
): number {
  const [year, month, day] = dateKey
    .split('-')
    .map(Number);

  return new Date(
    Date.UTC(year, month - 1, day),
  ).getUTCDay();
}

function isValidTime(
  time: string | null,
): time is string {
  return (
    typeof time === 'string' &&
    TIME_PATTERN.test(time)
  );
}

function convertTimeToMinutes(
  time: string,
): number {
  const [hours, minutes] = time
    .split(':')
    .map(Number);

  return hours * 60 + minutes;
}

function isDateInsideTimeOffRange({
  date,
  startDate,
  endDate,
}: {
  date: string;
  startDate: string;
  endDate: string;
}): boolean {
  /*
   * YYYY-MM-DD strings sort chronologically, so these
   * comparisons are safe without creating local-time dates.
   */
  return (
    date >= startDate &&
    date <= endDate
  );
}

function employeeHasApprovedTimeOff({
  employee,
  date,
}: {
  employee: SchedulingEmployee;
  date: string;
}): boolean {
  return employee.approvedTimeOff.some(
    (timeOff) =>
      isDateInsideTimeOffRange({
        date,
        startDate: timeOff.startDate,
        endDate: timeOff.endDate,
      }),
  );
}

function employeeAvailabilityCoversRequirement({
  employee,
  requirement,
}: {
  employee: SchedulingEmployee;
  requirement: DatedStaffingRequirement;
}): boolean {
  const requirementStart =
    convertTimeToMinutes(
      requirement.startTime,
    );

  const requirementEnd =
    convertTimeToMinutes(
      requirement.endTime,
    );

  return employee.availability.some(
    (availability) => {
      if (
        availability.dayOfWeek !==
        requirement.dayOfWeek
      ) {
        return false;
      }

      if (
        !isValidTime(
          availability.startTime,
        ) ||
        !isValidTime(
          availability.endTime,
        )
      ) {
        return false;
      }

      const availabilityStart =
        convertTimeToMinutes(
          availability.startTime,
        );

      const availabilityEnd =
        convertTimeToMinutes(
          availability.endTime,
        );

      return (
        availabilityStart <=
          requirementStart &&
        availabilityEnd >= requirementEnd
      );
    },
  );
}

function employeeCanPotentiallyFillRequirement({
  employee,
  requirement,
}: {
  employee: SchedulingEmployee;
  requirement: DatedStaffingRequirement;
}): boolean {
  if (
    !employee.roleIds.includes(
      requirement.roleId,
    )
  ) {
    return false;
  }

  if (
    employeeHasApprovedTimeOff({
      employee,
      date: requirement.date,
    })
  ) {
    return false;
  }

  return employeeAvailabilityCoversRequirement({
    employee,
    requirement,
  });
}

/**
 * Checks whether the organization has enough valid setup data
 * to attempt automatic schedule generation.
 *
 * Errors prevent generation.
 *
 * Warnings do not prevent generation. They describe incomplete
 * preferences or coverage problems that may cause the algorithm
 * to return an incomplete draft.
 */
export function validateSchedulingReadiness(
  input: SchedulingInput,
): SchedulingReadinessResult {
  const errors: SchedulingReadinessIssue[] =
    [];

  const warnings:
    SchedulingReadinessIssue[] = [];

  // -------------------------------------------------------
  // Validate schedule week
  // -------------------------------------------------------

  if (
    !isValidDateKey(input.weekStartDate) ||
    !isValidDateKey(input.weekEndDate)
  ) {
    errors.push({
      code: 'invalid-schedule-week',
      severity: 'error',
      message:
        'The selected schedule week contains an invalid date.',
    });
  } else {
    const expectedWeekEndDate =
      addDaysToDateKey(
        input.weekStartDate,
        6,
      );

    if (
      getDayOfWeek(input.weekStartDate) !==
        0 ||
      input.weekEndDate !==
        expectedWeekEndDate
    ) {
      errors.push({
        code: 'invalid-schedule-week',
        severity: 'error',
        message:
          'The schedule must cover one Sunday-through-Saturday week.',
      });
    }
  }

  // -------------------------------------------------------
  // Validate organization working hours
  // -------------------------------------------------------

  const workingHoursByDay = new Map(
    input.workingHours.map((hours) => [
      hours.dayOfWeek,
      hours,
    ]),
  );

  const configuredDays = new Set<number>();

  for (const hours of input.workingHours) {
    if (
      !Number.isInteger(hours.dayOfWeek) ||
      hours.dayOfWeek < 0 ||
      hours.dayOfWeek > 6
    ) {
      errors.push({
        code: 'invalid-working-hours',
        severity: 'error',
        message:
          'Organization working hours contain an invalid weekday.',
      });

      continue;
    }

    if (configuredDays.has(hours.dayOfWeek)) {
      errors.push({
        code: 'duplicate-working-hours',
        severity: 'error',
        message:
          'Organization working hours contain the same weekday more than once.',
      });
    }

    configuredDays.add(hours.dayOfWeek);

    if (hours.isClosed) {
      if (
        hours.startTime !== null ||
        hours.endTime !== null
      ) {
        errors.push({
          code: 'invalid-working-hours',
          severity: 'error',
          message:
            'Closed organization days cannot contain opening or closing times.',
        });
      }

      continue;
    }

    if (
      !isValidTime(hours.startTime) ||
      !isValidTime(hours.endTime)
    ) {
      errors.push({
        code: 'invalid-working-hours',
        severity: 'error',
        message:
          'Every open organization day must have valid opening and closing times.',
      });

      continue;
    }

    if (
      convertTimeToMinutes(
        hours.startTime,
      ) >=
      convertTimeToMinutes(hours.endTime)
    ) {
      errors.push({
        code: 'invalid-working-hours',
        severity: 'error',
        message:
          'Organization opening time must be earlier than closing time.',
      });
    }
  }

  if (
    input.workingHours.length !== 7 ||
    configuredDays.size !== 7
  ) {
    errors.push({
      code: 'missing-working-hours',
      severity: 'error',
      message:
        'Organization working hours must include all seven days of the week.',
    });
  }

  // -------------------------------------------------------
  // Validate employees
  // -------------------------------------------------------

  if (input.employees.length === 0) {
    errors.push({
      code: 'no-employees',
      severity: 'error',
      message:
        'The organization does not have any employees available to schedule.',
    });
  }

  const employeesWithRoles =
    input.employees.filter(
      (employee) =>
        employee.roleIds.length > 0,
    );

  const employeesWithAvailability =
    input.employees.filter(
      (employee) =>
        employee.availability.length > 0,
    );

  const employeesWithPreferredHours =
    input.employees.filter(
      (employee) =>
        employee.preferredWeeklyHours !==
        null,
    );

  if (
    input.employees.length > 0 &&
    employeesWithRoles.length === 0
  ) {
    errors.push({
      code: 'no-role-assignments',
      severity: 'error',
      message:
        'No employees have been assigned an organization role.',
    });
  }

  if (
    input.employees.length > 0 &&
    employeesWithAvailability.length === 0
  ) {
    errors.push({
      code: 'no-availability',
      severity: 'error',
      message:
        'No employees have entered weekly availability.',
    });
  }

  for (const employee of input.employees) {
    if (employee.roleIds.length === 0) {
      warnings.push({
        code: 'employee-missing-roles',
        severity: 'warning',
        message:
          `${employee.name} has not been assigned any organization roles.`,
        employeeId: employee.id,
        employeeName: employee.name,
      });
    }

    if (
      employee.availability.length === 0
    ) {
      warnings.push({
        code:
          'employee-missing-availability',
        severity: 'warning',
        message:
          `${employee.name} has not entered weekly availability.`,
        employeeId: employee.id,
        employeeName: employee.name,
      });
    }

    if (
      employee.preferredWeeklyHours ===
        null
    ) {
      warnings.push({
        code:
          'employee-missing-preferred-hours',
        severity: 'warning',
        message:
          `${employee.name} has not entered preferred weekly hours.`,
        employeeId: employee.id,
        employeeName: employee.name,
      });
    }
  }

  // -------------------------------------------------------
  // Validate staffing requirements
  // -------------------------------------------------------

  if (input.requirements.length === 0) {
    errors.push({
      code: 'no-staffing-requirements',
      severity: 'error',
      message:
        'The organization does not have any staffing requirements configured.',
    });
  }

  let requirementsWithoutQualifiedEmployees =
    0;

  let requirementsWithoutAvailableEmployees =
    0;

  for (const requirement of input.requirements) {
    const requirementStartIsValid =
      isValidTime(requirement.startTime);

    const requirementEndIsValid =
      isValidTime(requirement.endTime);

    if (
      !Number.isInteger(
        requirement.requiredCount,
      ) ||
      requirement.requiredCount <= 0 ||
      !requirementStartIsValid ||
      !requirementEndIsValid ||
      !Number.isInteger(
        requirement.dayOfWeek,
      ) ||
      requirement.dayOfWeek < 0 ||
      requirement.dayOfWeek > 6 ||
      !isValidDateKey(requirement.date)
    ) {
      errors.push({
        code:
          'invalid-staffing-requirement',
        severity: 'error',
        message:
          `The ${requirement.roleName} staffing requirement contains invalid information.`,
        requirementId: requirement.id,
        roleId: requirement.roleId,
        roleName: requirement.roleName,
        date: requirement.date,
      });

      continue;
    }

    if (
      getDayOfWeek(requirement.date) !==
      requirement.dayOfWeek
    ) {
      errors.push({
        code:
          'invalid-staffing-requirement',
        severity: 'error',
        message:
          `The ${requirement.roleName} requirement date does not match its configured weekday.`,
        requirementId: requirement.id,
        roleId: requirement.roleId,
        roleName: requirement.roleName,
        date: requirement.date,
      });

      continue;
    }

    const requirementStart =
      convertTimeToMinutes(
        requirement.startTime,
      );

    const requirementEnd =
      convertTimeToMinutes(
        requirement.endTime,
      );

    if (
      requirementStart >= requirementEnd
    ) {
      errors.push({
        code:
          'invalid-staffing-requirement',
        severity: 'error',
        message:
          `The ${requirement.roleName} staffing requirement must end after it begins.`,
        requirementId: requirement.id,
        roleId: requirement.roleId,
        roleName: requirement.roleName,
        date: requirement.date,
      });

      continue;
    }

    const workingHours =
      workingHoursByDay.get(
        requirement.dayOfWeek,
      );

    if (
      !workingHours ||
      workingHours.isClosed ||
      !isValidTime(
        workingHours.startTime,
      ) ||
      !isValidTime(workingHours.endTime)
    ) {
      errors.push({
        code:
          'requirement-outside-working-hours',
        severity: 'error',
        message:
          `The ${requirement.roleName} requirement on ${requirement.date} is assigned to a closed or unconfigured day.`,
        requirementId: requirement.id,
        roleId: requirement.roleId,
        roleName: requirement.roleName,
        date: requirement.date,
      });

      continue;
    }

    const openingTime =
      convertTimeToMinutes(
        workingHours.startTime,
      );

    const closingTime =
      convertTimeToMinutes(
        workingHours.endTime,
      );

    if (
      requirementStart < openingTime ||
      requirementEnd > closingTime
    ) {
      errors.push({
        code:
          'requirement-outside-working-hours',
        severity: 'error',
        message:
          `The ${requirement.roleName} requirement on ${requirement.date} falls outside organization working hours.`,
        requirementId: requirement.id,
        roleId: requirement.roleId,
        roleName: requirement.roleName,
        date: requirement.date,
      });

      continue;
    }

    const roleQualifiedEmployees =
      input.employees.filter(
        (employee) =>
          employee.roleIds.includes(
            requirement.roleId,
          ),
      );

    if (
      roleQualifiedEmployees.length === 0
    ) {
      requirementsWithoutQualifiedEmployees +=
        1;

      warnings.push({
        code:
          'requirement-no-qualified-employee',
        severity: 'warning',
        message:
          `No employee is assigned the ${requirement.roleName} role needed on ${requirement.date}.`,
        requirementId: requirement.id,
        roleId: requirement.roleId,
        roleName: requirement.roleName,
        date: requirement.date,
      });

      continue;
    }

    const potentiallyAvailableEmployees =
      roleQualifiedEmployees.filter(
        (employee) =>
          employeeCanPotentiallyFillRequirement({
            employee,
            requirement,
          }),
      );

    if (
      potentiallyAvailableEmployees.length ===
      0
    ) {
      requirementsWithoutAvailableEmployees +=
        1;

      warnings.push({
        code:
          'requirement-no-available-employee',
        severity: 'warning',
        message:
          `No qualified employee is available for the ${requirement.roleName} requirement on ${requirement.date} from ${requirement.startTime} to ${requirement.endTime}.`,
        requirementId: requirement.id,
        roleId: requirement.roleId,
        roleName: requirement.roleName,
        date: requirement.date,
      });
    }
  }

  const summary: SchedulingReadinessSummary =
    {
      employeeCount:
        input.employees.length,

      employeesWithRoles:
        employeesWithRoles.length,

      employeesWithAvailability:
        employeesWithAvailability.length,

      employeesWithPreferredHours:
        employeesWithPreferredHours.length,

      configuredWorkingDays:
        configuredDays.size,

      openWorkingDays:
        input.workingHours.filter(
          (hours) => !hours.isClosed,
        ).length,

      requirementCount:
        input.requirements.length,

      totalRequiredAssignments:
        input.requirements.reduce(
          (total, requirement) =>
            total +
            requirement.requiredCount,
          0,
        ),

      requirementsWithoutQualifiedEmployees,

      requirementsWithoutAvailableEmployees,
    };

  return {
    ready: errors.length === 0,
    errors,
    warnings,
    summary,
  };
}