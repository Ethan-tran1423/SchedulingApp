import {
  convertTimeToMinutes,
  doShiftTimesOverlap,
} from '../shifts/shift-validation';

import type {
  DatedStaffingRequirement,
  EmployeeHoursSummary,
  GeneratedShift,
  SchedulingEmployee,
  SchedulingInput,
  ScheduleGenerationResult,
  UnfilledRequirement,
} from './types';

type CandidateScore = {
  employee: SchedulingEmployee;
  score: number;
};

type RequirementWithDifficulty = {
  requirement: DatedStaffingRequirement;
  initiallyEligibleEmployeeCount: number;
};

function roundHours(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundPercentage(value: number): number {
  return Math.round(value * 10) / 10;
}

function getShiftDurationHours({
  startTime,
  endTime,
}: {
  startTime: string;
  endTime: string;
}): number {
  const startMinutes =
    convertTimeToMinutes(startTime);

  const endMinutes =
    convertTimeToMinutes(endTime);

  return (endMinutes - startMinutes) / 60;
}

function isDateInsideRange({
  date,
  startDate,
  endDate,
}: {
  date: string;
  startDate: string;
  endDate: string;
}): boolean {
  /*
   * YYYY-MM-DD strings sort chronologically.
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
      isDateInsideRange({
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

function employeeHasOverlappingShift({
  employeeId,
  requirement,
  generatedShifts,
}: {
  employeeId: number;
  requirement: DatedStaffingRequirement;
  generatedShifts: GeneratedShift[];
}): boolean {
  return generatedShifts.some(
    (shift) =>
      shift.employeeId === employeeId &&
      shift.shiftDate ===
        requirement.date &&
      doShiftTimesOverlap(
        shift.startTime,
        shift.endTime,
        requirement.startTime,
        requirement.endTime,
      ),
  );
}

/**
 * Checks every hard employee-level scheduling rule except
 * overlap with already-generated shifts.
 */
function employeeCanWorkRequirementIgnoringOverlap({
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
 * Checks all hard employee-level scheduling rules.
 */
function employeeCanWorkRequirement({
  employee,
  requirement,
  generatedShifts,
}: {
  employee: SchedulingEmployee;
  requirement: DatedStaffingRequirement;
  generatedShifts: GeneratedShift[];
}): boolean {
  if (
    !employeeCanWorkRequirementIgnoringOverlap({
      employee,
      requirement,
    })
  ) {
    return false;
  }

  return !employeeHasOverlappingShift({
    employeeId: employee.id,
    requirement,
    generatedShifts,
  });
}

function isClosingRequirement({
  input,
  requirement,
}: {
  input: SchedulingInput;
  requirement: DatedStaffingRequirement;
}): boolean {
  const workingHours =
    input.workingHours.find(
      (hours) =>
        hours.dayOfWeek ===
        requirement.dayOfWeek,
    );

  if (
    !workingHours ||
    workingHours.isClosed ||
    workingHours.endTime === null
  ) {
    return false;
  }

  return (
    requirement.endTime ===
    workingHours.endTime
  );
}

/**
 * Calculates a soft-rule score.
 *
 * Lower scores are better.
 *
 * The score:
 * - strongly discourages going above preferred hours;
 * - rewards employees who remain below preferred hours;
 * - distributes total hours;
 * - distributes closing shifts.
 */
function calculateCandidateScore({
  employee,
  requirement,
  scheduledHours,
  closingShiftCount,
  isClosingShift,
}: {
  employee: SchedulingEmployee;
  requirement: DatedStaffingRequirement;
  scheduledHours: number;
  closingShiftCount: number;
  isClosingShift: boolean;
}): number {
  const shiftHours = getShiftDurationHours({
    startTime: requirement.startTime,
    endTime: requirement.endTime,
  });

  const projectedHours =
    scheduledHours + shiftHours;

  let score = 0;

  /*
   * General fairness:
   * employees with fewer scheduled hours are preferred.
   */
  score += projectedHours * 10;

  if (
    employee.preferredWeeklyHours !== null
  ) {
    const remainingPreferredHours =
      Math.max(
        0,
        employee.preferredWeeklyHours -
          scheduledHours,
      );

    const projectedOverage =
      Math.max(
        0,
        projectedHours -
          employee.preferredWeeklyHours,
      );

    /*
     * Reward assigning employees who still need hours.
     */
    score -= remainingPreferredHours * 4;

    /*
     * Strongly discourage exceeding preferred hours.
     * This remains a soft rule because coverage is more
     * important than matching a preference exactly.
     */
    score += projectedOverage * 100;
  }

  if (isClosingShift) {
    score += closingShiftCount * 20;
  }

  /*
   * Employee ID is used separately as the final tie-breaker,
   * so identical input always produces identical output.
   */
  return score;
}

function findEligibleCandidates({
  input,
  requirement,
  generatedShifts,
  scheduledHoursByEmployee,
  closingShiftsByEmployee,
}: {
  input: SchedulingInput;
  requirement: DatedStaffingRequirement;
  generatedShifts: GeneratedShift[];
  scheduledHoursByEmployee: Map<
    number,
    number
  >;
  closingShiftsByEmployee: Map<
    number,
    number
  >;
}): CandidateScore[] {
  const closingRequirement =
    isClosingRequirement({
      input,
      requirement,
    });

  return input.employees
    .filter((employee) =>
      employeeCanWorkRequirement({
        employee,
        requirement,
        generatedShifts,
      }),
    )
    .map((employee) => {
      const scheduledHours =
        scheduledHoursByEmployee.get(
          employee.id,
        ) ?? 0;

      const closingShiftCount =
        closingShiftsByEmployee.get(
          employee.id,
        ) ?? 0;

      return {
        employee,
        score: calculateCandidateScore({
          employee,
          requirement,
          scheduledHours,
          closingShiftCount,
          isClosingShift:
            closingRequirement,
        }),
      };
    })
    .sort((first, second) => {
      if (first.score !== second.score) {
        return first.score - second.score;
      }

      /*
       * Deterministic final tie-breaker.
       */
      return (
        first.employee.id -
        second.employee.id
      );
    });
}

/**
 * Requirements with fewer eligible employees are scheduled
 * first. This reduces the chance that a flexible employee gets
 * assigned to an easy requirement while a difficult one is
 * left uncovered.
 */
function sortRequirementsByDifficulty(
  input: SchedulingInput,
): RequirementWithDifficulty[] {
  return input.requirements
    .map((requirement) => {
      const initiallyEligibleEmployeeCount =
        input.employees.filter(
          (employee) =>
            employeeCanWorkRequirementIgnoringOverlap({
              employee,
              requirement,
            }),
        ).length;

      return {
        requirement,
        initiallyEligibleEmployeeCount,
      };
    })
    .sort((first, second) => {
      if (
        first.initiallyEligibleEmployeeCount !==
        second.initiallyEligibleEmployeeCount
      ) {
        return (
          first.initiallyEligibleEmployeeCount -
          second.initiallyEligibleEmployeeCount
        );
      }

      if (
        first.requirement.requiredCount !==
        second.requirement.requiredCount
      ) {
        return (
          second.requirement.requiredCount -
          first.requirement.requiredCount
        );
      }

      const firstDuration =
        getShiftDurationHours({
          startTime:
            first.requirement.startTime,
          endTime:
            first.requirement.endTime,
        });

      const secondDuration =
        getShiftDurationHours({
          startTime:
            second.requirement.startTime,
          endTime:
            second.requirement.endTime,
        });

      if (firstDuration !== secondDuration) {
        return secondDuration - firstDuration;
      }

      const dateComparison =
        first.requirement.date.localeCompare(
          second.requirement.date,
        );

      if (dateComparison !== 0) {
        return dateComparison;
      }

      const timeComparison =
        first.requirement.startTime.localeCompare(
          second.requirement.startTime,
        );

      if (timeComparison !== 0) {
        return timeComparison;
      }

      return (
        first.requirement.roleId -
        second.requirement.roleId
      );
    });
}

function explainUnfilledRequirement({
  input,
  requirement,
  generatedShifts,
  initiallyEligibleEmployeeCount,
}: {
  input: SchedulingInput;
  requirement: DatedStaffingRequirement;
  generatedShifts: GeneratedShift[];
  initiallyEligibleEmployeeCount: number;
}): string {
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
    return (
      `No employee is assigned the ` +
      `${requirement.roleName} role.`
    );
  }

  const employeesWithoutTimeOff =
    roleQualifiedEmployees.filter(
      (employee) =>
        !employeeHasApprovedTimeOff({
          employee,
          date: requirement.date,
        }),
    );

  if (
    employeesWithoutTimeOff.length === 0
  ) {
    return (
      `All employees assigned the ` +
      `${requirement.roleName} role have ` +
      `approved time off on this date.`
    );
  }

  const availableEmployees =
    employeesWithoutTimeOff.filter(
      (employee) =>
        employeeAvailabilityCoversRequirement({
          employee,
          requirement,
        }),
    );

  if (availableEmployees.length === 0) {
    return (
      `No employee with the ` +
      `${requirement.roleName} role is ` +
      `available for the entire time window.`
    );
  }

  const nonOverlappingEmployees =
    availableEmployees.filter(
      (employee) =>
        !employeeHasOverlappingShift({
          employeeId: employee.id,
          requirement,
          generatedShifts,
        }),
    );

  if (
    nonOverlappingEmployees.length === 0
  ) {
    return (
      `All otherwise eligible employees have ` +
      `an overlapping generated shift.`
    );
  }

  if (
    initiallyEligibleEmployeeCount <
    requirement.requiredCount
  ) {
    return (
      `Only ${initiallyEligibleEmployeeCount} ` +
      `qualified employee(s) are available, ` +
      `but ${requirement.requiredCount} are required.`
    );
  }

  return (
    `There were not enough eligible employees ` +
    `remaining to cover this requirement.`
  );
}

function createEmployeeHoursSummary({
  employees,
  scheduledHoursByEmployee,
}: {
  employees: SchedulingEmployee[];
  scheduledHoursByEmployee: Map<
    number,
    number
  >;
}): EmployeeHoursSummary[] {
  return employees
    .map((employee) => {
      const scheduledHours = roundHours(
        scheduledHoursByEmployee.get(
          employee.id,
        ) ?? 0,
      );

      return {
        employeeId: employee.id,
        employeeName: employee.name,
        scheduledHours,
        preferredHours:
          employee.preferredWeeklyHours,
        /*
         * Positive means above preference.
         * Negative means below preference.
         */
        difference:
          employee.preferredWeeklyHours ===
          null
            ? null
            : roundHours(
                scheduledHours -
                  employee.preferredWeeklyHours,
              ),
      };
    })
    .sort((first, second) =>
      first.employeeName.localeCompare(
        second.employeeName,
      ),
    );
}

/**
 * Generates a deterministic draft schedule.
 *
 * validateSchedulingReadiness() should be called before this
 * function. Coverage shortages are allowed and are reported as
 * unfilled requirements instead of creating invalid shifts.
 */
export function generateSchedule(
  input: SchedulingInput,
): ScheduleGenerationResult {
  const generatedShifts:
    GeneratedShift[] = [];

  const unfilledRequirements:
    UnfilledRequirement[] = [];

  const scheduledHoursByEmployee =
    new Map<number, number>();

  const closingShiftsByEmployee =
    new Map<number, number>();

  for (const employee of input.employees) {
    scheduledHoursByEmployee.set(
      employee.id,
      0,
    );

    closingShiftsByEmployee.set(
      employee.id,
      0,
    );
  }

  const orderedRequirements =
    sortRequirementsByDifficulty(input);

  for (
    const {
      requirement,
      initiallyEligibleEmployeeCount,
    } of orderedRequirements
  ) {
    let assignedCount = 0;

    for (
      let slotNumber = 0;
      slotNumber <
      requirement.requiredCount;
      slotNumber += 1
    ) {
      const candidates =
        findEligibleCandidates({
          input,
          requirement,
          generatedShifts,
          scheduledHoursByEmployee,
          closingShiftsByEmployee,
        });

      const selectedCandidate =
        candidates[0];

      if (!selectedCandidate) {
        break;
      }

      const selectedEmployee =
        selectedCandidate.employee;

      const shiftHours =
        getShiftDurationHours({
          startTime:
            requirement.startTime,
          endTime:
            requirement.endTime,
        });

      generatedShifts.push({
        employeeId:
          selectedEmployee.id,
        employeeName:
          selectedEmployee.name,
        organizationRoleId:
          requirement.roleId,
        roleName:
          requirement.roleName,
        shiftDate:
          requirement.date,
        startTime:
          requirement.startTime,
        endTime:
          requirement.endTime,
        notes:
          `Automatically generated from staffing requirement ${requirement.id}.`,
      });

      scheduledHoursByEmployee.set(
        selectedEmployee.id,
        roundHours(
          (
            scheduledHoursByEmployee.get(
              selectedEmployee.id,
            ) ?? 0
          ) + shiftHours,
        ),
      );

      if (
        isClosingRequirement({
          input,
          requirement,
        })
      ) {
        closingShiftsByEmployee.set(
          selectedEmployee.id,
          (
            closingShiftsByEmployee.get(
              selectedEmployee.id,
            ) ?? 0
          ) + 1,
        );
      }

      assignedCount += 1;
    }

    if (
      assignedCount <
      requirement.requiredCount
    ) {
      const missingCount =
        requirement.requiredCount -
        assignedCount;

      unfilledRequirements.push({
        requirementId:
          requirement.id,
        organizationRoleId:
          requirement.roleId,
        roleName:
          requirement.roleName,
        shiftDate:
          requirement.date,
        startTime:
          requirement.startTime,
        endTime:
          requirement.endTime,
        requiredCount:
          requirement.requiredCount,
        assignedCount,
        missingCount,
        reason:
          explainUnfilledRequirement({
            input,
            requirement,
            generatedShifts,
            initiallyEligibleEmployeeCount,
          }),
      });
    }
  }

  generatedShifts.sort(
    (first, second) => {
      const dateComparison =
        first.shiftDate.localeCompare(
          second.shiftDate,
        );

      if (dateComparison !== 0) {
        return dateComparison;
      }

      const timeComparison =
        first.startTime.localeCompare(
          second.startTime,
        );

      if (timeComparison !== 0) {
        return timeComparison;
      }

      const roleComparison =
        first.roleName.localeCompare(
          second.roleName,
        );

      if (roleComparison !== 0) {
        return roleComparison;
      }

      return (
        first.employeeId -
        second.employeeId
      );
    },
  );

  const totalRequiredAssignments =
    input.requirements.reduce(
      (total, requirement) =>
        total +
        requirement.requiredCount,
      0,
    );

  const filledAssignments =
    generatedShifts.length;

  const unfilledAssignments =
    Math.max(
      0,
      totalRequiredAssignments -
        filledAssignments,
    );

  const coveragePercentage =
    totalRequiredAssignments === 0
      ? 100
      : roundPercentage(
          (
            filledAssignments /
            totalRequiredAssignments
          ) * 100,
        );

  return {
    shifts: generatedShifts,
    summary: {
      totalRequiredAssignments,
      filledAssignments,
      unfilledAssignments,
      coveragePercentage,
      employeeHours:
        createEmployeeHoursSummary({
          employees: input.employees,
          scheduledHoursByEmployee,
        }),
      unfilledRequirements,
    },
  };
}