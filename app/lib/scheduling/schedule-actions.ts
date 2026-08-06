'use server';

import { revalidatePath } from 'next/cache';

import { loadSchedulingInputs } from '@/app/lib/repos/scheduling-inputs';
import {
  publishDraftSchedule,
  replaceDraftSchedule,
  type JsonObject,
} from '@/app/lib/repos/schedules';
import { requireManager } from '@/app/lib/utils/auth/require-manager';

import { generateSchedule } from './generate-schedule';
import { validateSchedulingReadiness } from './readiness';

import type {
  UnfilledRequirement,
} from './types';

const DATE_KEY_PATTERN =
  /^\d{4}-\d{2}-\d{2}$/;

const MANAGER_SCHEDULE_PATH =
  '/dashboard/manager/automatic-scheduling';

const EMPLOYEE_SCHEDULE_PATH =
  '/dashboard/employee/schedule';

export type ScheduleActionIssue = {
  code: string;
  message: string;
};

export type GenerateScheduleActionState = {
  error?: string;
  success?: string;

  scheduleId?: number;
  revision?: number;

  weekStartDate?: string;
  weekEndDate?: string;

  filledAssignments?: number;
  totalRequiredAssignments?: number;
  coveragePercentage?: number;

  readinessErrors?: ScheduleActionIssue[];
  readinessWarnings?: ScheduleActionIssue[];

  unfilledRequirements?:
    UnfilledRequirement[];
};

export type PublishScheduleActionState = {
  error?: string;
  success?: string;

  scheduleId?: number;
  weekStartDate?: string;
};

function parseDateKeyAsUtc(
  dateKey: string,
): Date | null {
  if (!DATE_KEY_PATTERN.test(dateKey)) {
    return null;
  }

  const [year, month, day] = dateKey
    .split('-')
    .map(Number);

  const date = new Date(
    Date.UTC(year, month - 1, day),
  );

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

function validateWeekStartDate(
  value: FormDataEntryValue | null,
):
  | {
      success: true;
      weekStartDate: string;
    }
  | {
      success: false;
      error: string;
    } {
  if (typeof value !== 'string') {
    return {
      success: false,
      error:
        'Select a week before generating the schedule.',
    };
  }

  const weekStartDate = value.trim();
  const parsedDate =
    parseDateKeyAsUtc(weekStartDate);

  if (!parsedDate) {
    return {
      success: false,
      error:
        'The selected schedule week is not a valid date.',
    };
  }

  if (parsedDate.getUTCDay() !== 0) {
    return {
      success: false,
      error:
        'The schedule week must begin on a Sunday.',
    };
  }

  return {
    success: true,
    weekStartDate,
  };
}

function validateScheduleId(
  value: FormDataEntryValue | null,
):
  | {
      success: true;
      scheduleId: number;
    }
  | {
      success: false;
      error: string;
    } {
  if (typeof value !== 'string') {
    return {
      success: false,
      error:
        'A draft schedule was not selected.',
    };
  }

  const scheduleId = Number(value);

  if (
    !Number.isInteger(scheduleId) ||
    scheduleId <= 0
  ) {
    return {
      success: false,
      error:
        'The selected draft schedule is invalid.',
    };
  }

  return {
    success: true,
    scheduleId,
  };
}

function formatDatabaseDate(
  value: string | Date,
): string {
  if (value instanceof Date) {
    return value
      .toISOString()
      .slice(0, 10);
  }

  return String(value).slice(0, 10);
}

/**
 * Converts a known serializable object into the JsonObject
 * type expected by the schedules repository.
 */
function toJsonObject(
  value: unknown,
): JsonObject {
  const serialized = JSON.stringify(value);

  if (serialized === undefined) {
    throw new Error(
      'The schedule summary could not be serialized.',
    );
  }

  const parsedValue: unknown =
    JSON.parse(serialized);

  if (
    typeof parsedValue !== 'object' ||
    parsedValue === null ||
    Array.isArray(parsedValue)
  ) {
    throw new Error(
      'The schedule summary must be a JSON object.',
    );
  }

  return parsedValue as JsonObject;
}

function createIssueList(
  issues: {
    code: string;
    message: string;
  }[],
): ScheduleActionIssue[] {
  return issues.map((issue) => ({
    code: issue.code,
    message: issue.message,
  }));
}

/**
 * Loads the organization's scheduling information, validates
 * it, generates a deterministic schedule, and stores it as a
 * new draft revision.
 */
export async function generateScheduleDraft(
  _previousState:
    GenerateScheduleActionState,
  formData: FormData,
): Promise<GenerateScheduleActionState> {
  const manager = await requireManager();

  const weekValidation =
    validateWeekStartDate(
      formData.get('weekStartDate'),
    );

  if (!weekValidation.success) {
    return {
      error: weekValidation.error,
    };
  }

  const { weekStartDate } =
    weekValidation;

  try {
    const input =
      await loadSchedulingInputs({
        organizationId:
          manager.organization_id,
        weekStartDate,
      });

    const readiness =
      validateSchedulingReadiness(input);

    const readinessErrors =
      createIssueList(readiness.errors);

    const readinessWarnings =
      createIssueList(readiness.warnings);

    if (!readiness.ready) {
      return {
        error:
          readiness.errors[0]?.message ??
          'The organization is not ready to generate a schedule.',

        weekStartDate:
          input.weekStartDate,

        weekEndDate:
          input.weekEndDate,

        readinessErrors,
        readinessWarnings,
      };
    }

    const generationResult =
      generateSchedule(input);

    /*
     * Save both the generation results and readiness warnings.
     * This allows the manager page to explain why coverage is
     * incomplete when the draft is loaded later.
     */
    const generationSummary =
      toJsonObject({
        algorithmVersion:
          'deterministic-greedy-v1',

        generatedAt:
          new Date().toISOString(),

        weekStartDate:
          input.weekStartDate,

        weekEndDate:
          input.weekEndDate,

        readiness: {
          warnings:
            readinessWarnings,

          summary:
            readiness.summary,
        },

        generation:
          generationResult.summary,
      });

    const savedDraft =
      await replaceDraftSchedule({
        organizationId:
          manager.organization_id,

        createdByUserId:
          manager.id,

        weekStartDate:
          input.weekStartDate,

        generationMethod:
          'automatic',

        generationSummary,

        shifts:
          generationResult.shifts,
      });

    revalidatePath(
      MANAGER_SCHEDULE_PATH,
    );

    const {
      filledAssignments,
      totalRequiredAssignments,
      coveragePercentage,
      unfilledRequirements,
    } = generationResult.summary;

    return {
      success:
        `Draft schedule generated with ` +
        `${filledAssignments} of ` +
        `${totalRequiredAssignments} ` +
        `assignments filled ` +
        `(${coveragePercentage}% coverage).`,

      scheduleId:
        savedDraft.schedule.id,

      revision:
        savedDraft.schedule.revision,

      weekStartDate:
        input.weekStartDate,

      weekEndDate:
        input.weekEndDate,

      filledAssignments,

      totalRequiredAssignments,

      coveragePercentage,

      readinessWarnings,

      unfilledRequirements,
    };
  } catch (error) {
    console.error(
      'Failed to generate schedule:',
      error,
    );

    return {
      error:
        'Unable to generate the schedule. Please review the organization settings and try again.',

      weekStartDate,
    };
  }
}

/**
 * Publishes a draft schedule. Employees cannot see generated
 * shifts until this action succeeds.
 */
export async function publishScheduleDraft(
  _previousState:
    PublishScheduleActionState,
  formData: FormData,
): Promise<PublishScheduleActionState> {
  const manager = await requireManager();

  const scheduleValidation =
    validateScheduleId(
      formData.get('scheduleId'),
    );

  if (!scheduleValidation.success) {
    return {
      error:
        scheduleValidation.error,
    };
  }

  try {
    const publishedSchedule =
      await publishDraftSchedule({
        scheduleId:
          scheduleValidation.scheduleId,

        organizationId:
          manager.organization_id,
      });

    const weekStartDate =
      formatDatabaseDate(
        publishedSchedule.week_start_date,
      );

    /*
     * Revalidate both views because publication makes the
     * generated shifts visible to employees.
     */
    revalidatePath(
      MANAGER_SCHEDULE_PATH,
    );

    revalidatePath(
      EMPLOYEE_SCHEDULE_PATH,
    );

    revalidatePath(
      '/dashboard/employee',
    );

    return {
      success:
        'The schedule was published successfully.',

      scheduleId:
        publishedSchedule.id,

      weekStartDate,
    };
  } catch (error) {
    console.error(
      'Failed to publish schedule:',
      error,
    );

    return {
      error:
        'Unable to publish the draft schedule. It may have already been published or replaced.',
    };
  }
}