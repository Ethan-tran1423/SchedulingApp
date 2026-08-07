import {
  describe,
  expect,
  it,
} from 'vitest';

import { generateSchedule } from './generate-schedule';

import type {
  AvailabilityWindow,
  DatedStaffingRequirement,
  OrganizationWorkingHours,
  SchedulingEmployee,
  SchedulingInput,
} from './types';

const WEEK_START_DATE = '2026-08-09';
const WEEK_END_DATE = '2026-08-15';

const MONDAY = '2026-08-10';
const TUESDAY = '2026-08-11';

const CASHIER_ROLE_ID = 1;
const STOCKER_ROLE_ID = 2;

const DEFAULT_WORKING_HOURS:
  OrganizationWorkingHours[] = Array.from(
    {
      length: 7,
    },
    (_, dayOfWeek) => ({
      dayOfWeek,
      isClosed: false,
      startTime: '08:00',
      endTime: '18:00',
    }),
  );

function createAvailability({
  dayOfWeek,
  startTime = '08:00',
  endTime = '18:00',
}: {
  dayOfWeek: number;
  startTime?: string;
  endTime?: string;
}): AvailabilityWindow {
  return {
    dayOfWeek,
    startTime,
    endTime,
  };
}

function createEmployee({
  id,
  name = `Employee ${id}`,
  roleIds = [CASHIER_ROLE_ID],
  preferredWeeklyHours = 40,
  availability = [
    createAvailability({
      dayOfWeek: 1,
    }),
    createAvailability({
      dayOfWeek: 2,
    }),
  ],
  approvedTimeOff = [],
}: {
  id: number;
  name?: string;
  roleIds?: number[];
  preferredWeeklyHours?: number | null;
  availability?: AvailabilityWindow[];
  approvedTimeOff?: SchedulingEmployee['approvedTimeOff'];
}): SchedulingEmployee {
  return {
    id,
    name,
    roleIds,
    preferredWeeklyHours,
    availability,
    approvedTimeOff,
  };
}

function createRequirement({
  id,
  roleId = CASHIER_ROLE_ID,
  roleName = 'Cashier',
  date = MONDAY,
  dayOfWeek = 1,
  startTime = '09:00',
  endTime = '13:00',
  requiredCount = 1,
}: {
  id: number;
  roleId?: number;
  roleName?: string;
  date?: string;
  dayOfWeek?: number;
  startTime?: string;
  endTime?: string;
  requiredCount?: number;
}): DatedStaffingRequirement {
  return {
    id,
    roleId,
    roleName,
    date,
    dayOfWeek,
    startTime,
    endTime,
    requiredCount,
  };
}

function createInput({
  employees,
  requirements,
  workingHours = DEFAULT_WORKING_HOURS,
}: {
  employees: SchedulingEmployee[];
  requirements: DatedStaffingRequirement[];
  workingHours?: OrganizationWorkingHours[];
}): SchedulingInput {
  return {
    organizationId: 1,
    weekStartDate: WEEK_START_DATE,
    weekEndDate: WEEK_END_DATE,
    employees,
    workingHours,
    requirements,
  };
}

describe('generateSchedule', () => {
  it(
    'fills a requirement using distinct eligible employees',
    () => {
      const input = createInput({
        employees: [
          createEmployee({
            id: 1,
            name: 'Alex',
          }),
          createEmployee({
            id: 2,
            name: 'Jordan',
          }),
        ],
        requirements: [
          createRequirement({
            id: 1,
            requiredCount: 2,
          }),
        ],
      });

      const result = generateSchedule(input);

      expect(result.shifts).toHaveLength(2);

      expect(
        result.shifts.map(
          (shift) => shift.employeeId,
        ),
      ).toEqual([1, 2]);

      expect(result.summary).toMatchObject({
        totalRequiredAssignments: 2,
        filledAssignments: 2,
        unfilledAssignments: 0,
        coveragePercentage: 100,
        unfilledRequirements: [],
      });
    },
  );

  it(
    'does not schedule an employee during approved time off',
    () => {
      const input = createInput({
        employees: [
          createEmployee({
            id: 1,
            name: 'Alex',
            approvedTimeOff: [
              {
                startDate: MONDAY,
                endDate: MONDAY,
              },
            ],
          }),
          createEmployee({
            id: 2,
            name: 'Jordan',
          }),
        ],
        requirements: [
          createRequirement({
            id: 1,
          }),
        ],
      });

      const result = generateSchedule(input);

      expect(result.shifts).toHaveLength(1);

      expect(
        result.shifts[0]?.employeeId,
      ).toBe(2);

      expect(
        result.shifts[0]?.employeeName,
      ).toBe('Jordan');
    },
  );

  it(
    'only assigns employees qualified for the required role',
    () => {
      const input = createInput({
        employees: [
          createEmployee({
            id: 1,
            name: 'Alex',
            roleIds: [STOCKER_ROLE_ID],
          }),
          createEmployee({
            id: 2,
            name: 'Jordan',
            roleIds: [CASHIER_ROLE_ID],
          }),
        ],
        requirements: [
          createRequirement({
            id: 1,
            roleId: CASHIER_ROLE_ID,
            roleName: 'Cashier',
          }),
        ],
      });

      const result = generateSchedule(input);

      expect(result.shifts).toHaveLength(1);

      expect(
        result.shifts[0]?.employeeId,
      ).toBe(2);

      expect(
        result.shifts[0]
          ?.organizationRoleId,
      ).toBe(CASHIER_ROLE_ID);
    },
  );

  it(
    'requires availability to cover the entire shift window',
    () => {
      const input = createInput({
        employees: [
          createEmployee({
            id: 1,
            name: 'Alex',
            availability: [
              createAvailability({
                dayOfWeek: 1,
                startTime: '10:00',
                endTime: '17:00',
              }),
            ],
          }),
        ],
        requirements: [
          createRequirement({
            id: 1,
            startTime: '09:00',
            endTime: '13:00',
          }),
        ],
      });

      const result = generateSchedule(input);

      expect(result.shifts).toHaveLength(0);

      expect(
        result.summary.unfilledAssignments,
      ).toBe(1);

      expect(
        result.summary
          .unfilledRequirements[0]
          ?.reason,
      ).toContain(
        'available for the entire time window',
      );
    },
  );

  it(
    'does not assign overlapping shifts to one employee',
    () => {
      const input = createInput({
        employees: [
          createEmployee({
            id: 1,
            name: 'Alex',
            roleIds: [
              CASHIER_ROLE_ID,
              STOCKER_ROLE_ID,
            ],
          }),
        ],
        requirements: [
          createRequirement({
            id: 1,
            roleId: CASHIER_ROLE_ID,
            roleName: 'Cashier',
            startTime: '09:00',
            endTime: '13:00',
          }),
          createRequirement({
            id: 2,
            roleId: STOCKER_ROLE_ID,
            roleName: 'Stocker',
            startTime: '11:00',
            endTime: '15:00',
          }),
        ],
      });

      const result = generateSchedule(input);

      expect(result.shifts).toHaveLength(1);

      expect(
        result.shifts[0]?.roleName,
      ).toBe('Cashier');

      expect(
        result.summary.unfilledAssignments,
      ).toBe(1);

      expect(
        result.summary
          .unfilledRequirements[0]
          ?.reason,
      ).toContain('overlapping generated shift');
    },
  );

  it(
    'allows back-to-back shifts for one employee',
    () => {
      const input = createInput({
        employees: [
          createEmployee({
            id: 1,
            name: 'Alex',
            roleIds: [
              CASHIER_ROLE_ID,
              STOCKER_ROLE_ID,
            ],
          }),
        ],
        requirements: [
          createRequirement({
            id: 1,
            roleId: CASHIER_ROLE_ID,
            roleName: 'Cashier',
            startTime: '09:00',
            endTime: '13:00',
          }),
          createRequirement({
            id: 2,
            roleId: STOCKER_ROLE_ID,
            roleName: 'Stocker',
            startTime: '13:00',
            endTime: '17:00',
          }),
        ],
      });

      const result = generateSchedule(input);

      expect(result.shifts).toHaveLength(2);

      expect(
        result.shifts.every(
          (shift) => shift.employeeId === 1,
        ),
      ).toBe(true);

      expect(
        result.summary.coveragePercentage,
      ).toBe(100);
    },
  );

  it(
    'schedules constrained requirements before flexible requirements',
    () => {
      const input = createInput({
        employees: [
          createEmployee({
            id: 1,
            name: 'Flexible Employee',
            roleIds: [
              CASHIER_ROLE_ID,
              STOCKER_ROLE_ID,
            ],
          }),
          createEmployee({
            id: 2,
            name: 'Cashier Only',
            roleIds: [CASHIER_ROLE_ID],
          }),
        ],
        requirements: [
          createRequirement({
            id: 1,
            roleId: CASHIER_ROLE_ID,
            roleName: 'Cashier',
            startTime: '09:00',
            endTime: '13:00',
          }),
          createRequirement({
            id: 2,
            roleId: STOCKER_ROLE_ID,
            roleName: 'Stocker',
            startTime: '09:00',
            endTime: '13:00',
          }),
        ],
      });

      const result = generateSchedule(input);

      const employeeByRole = new Map(
        result.shifts.map((shift) => [
          shift.organizationRoleId,
          shift.employeeId,
        ]),
      );

      expect(result.shifts).toHaveLength(2);

      expect(
        employeeByRole.get(
          STOCKER_ROLE_ID,
        ),
      ).toBe(1);

      expect(
        employeeByRole.get(
          CASHIER_ROLE_ID,
        ),
      ).toBe(2);

      expect(
        result.summary.coveragePercentage,
      ).toBe(100);
    },
  );

  it(
    'distributes equivalent shifts between employees',
    () => {
      const input = createInput({
        employees: [
          createEmployee({
            id: 1,
            name: 'Alex',
          }),
          createEmployee({
            id: 2,
            name: 'Jordan',
          }),
        ],
        requirements: [
          createRequirement({
            id: 1,
            date: MONDAY,
            dayOfWeek: 1,
          }),
          createRequirement({
            id: 2,
            date: TUESDAY,
            dayOfWeek: 2,
          }),
        ],
      });

      const result = generateSchedule(input);

      const mondayShift =
        result.shifts.find(
          (shift) =>
            shift.shiftDate === MONDAY,
        );

      const tuesdayShift =
        result.shifts.find(
          (shift) =>
            shift.shiftDate === TUESDAY,
        );

      expect(
        mondayShift?.employeeId,
      ).toBe(1);

      expect(
        tuesdayShift?.employeeId,
      ).toBe(2);
    },
  );

  it(
    'prioritizes an employee who is further below preferred hours',
    () => {
      const input = createInput({
        employees: [
          createEmployee({
            id: 1,
            name: 'Alex',
            preferredWeeklyHours: 4,
          }),
          createEmployee({
            id: 2,
            name: 'Jordan',
            preferredWeeklyHours: 12,
          }),
        ],
        requirements: [
          createRequirement({
            id: 1,
            startTime: '09:00',
            endTime: '13:00',
          }),
        ],
      });

      const result = generateSchedule(input);

      expect(result.shifts).toHaveLength(1);

      expect(
        result.shifts[0]?.employeeId,
      ).toBe(2);

      const jordanSummary =
        result.summary.employeeHours.find(
          (employee) =>
            employee.employeeId === 2,
        );

      expect(jordanSummary).toMatchObject({
        employeeName: 'Jordan',
        scheduledHours: 4,
        preferredHours: 12,
        difference: -8,
      });
    },
  );

  it(
    'returns partial coverage when demand exceeds eligible employees',
    () => {
      const input = createInput({
        employees: [
          createEmployee({
            id: 1,
            name: 'Alex',
          }),
        ],
        requirements: [
          createRequirement({
            id: 1,
            requiredCount: 2,
          }),
        ],
      });

      const result = generateSchedule(input);

      expect(result.shifts).toHaveLength(1);

      expect(result.summary).toMatchObject({
        totalRequiredAssignments: 2,
        filledAssignments: 1,
        unfilledAssignments: 1,
        coveragePercentage: 50,
      });

      expect(
        result.summary
          .unfilledRequirements[0],
      ).toMatchObject({
        requirementId: 1,
        requiredCount: 2,
        assignedCount: 1,
        missingCount: 1,
      });
    },
  );
});