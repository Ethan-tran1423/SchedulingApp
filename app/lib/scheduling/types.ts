export type AvailabilityWindow = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

export type EmployeeTimeOffRange = {
  startDate: string;
  endDate: string;
};

export type SchedulingEmployee = {
  id: number;
  name: string;

  /**
   * Organization-role IDs the employee is qualified to work.
   */
  roleIds: number[];

  /**
   * Null means the employee has not entered a preference.
   * It should not be treated as zero desired hours.
   */
  preferredWeeklyHours: number | null;

  availability: AvailabilityWindow[];

  /**
   * Only approved time-off requests should be included here.
   */
  approvedTimeOff: EmployeeTimeOffRange[];
};

export type OrganizationWorkingHours = {
  dayOfWeek: number;
  isClosed: boolean;
  startTime: string | null;
  endTime: string | null;
};

/**
 * Recurring staffing requirement stored in the database.
 *
 * Example:
 * Monday, 9:00–17:00, Cashier, required count 2.
 */
export type WeeklyStaffingRequirement = {
  id: number;
  roleId: number;
  roleName: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  requiredCount: number;
};

/**
 * Staffing requirement expanded to an actual calendar date
 * for the selected schedule week.
 */
export type DatedStaffingRequirement = {
  id: number;
  roleId: number;
  roleName: string;
  date: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  requiredCount: number;
};

export type SchedulingInput = {
  organizationId: number;
  weekStartDate: string;
  weekEndDate: string;
  employees: SchedulingEmployee[];
  workingHours: OrganizationWorkingHours[];
  requirements: DatedStaffingRequirement[];
};

export type GeneratedShift = {
  employeeId: number;
  employeeName: string;
  organizationRoleId: number;
  roleName: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  notes?: string | null;
};

export type UnfilledRequirement = {
  requirementId: number;
  organizationRoleId: number;
  roleName: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  requiredCount: number;
  assignedCount: number;
  missingCount: number;
  reason: string;
};

export type EmployeeHoursSummary = {
  employeeId: number;
  employeeName: string;
  scheduledHours: number;
  preferredHours: number | null;
  difference: number | null;
};

export type ScheduleGenerationSummary = {
  totalRequiredAssignments: number;
  filledAssignments: number;
  unfilledAssignments: number;
  coveragePercentage: number;
  employeeHours: EmployeeHoursSummary[];
  unfilledRequirements: UnfilledRequirement[];
};

export type ScheduleGenerationResult = {
  shifts: GeneratedShift[];
  summary: ScheduleGenerationSummary;
};