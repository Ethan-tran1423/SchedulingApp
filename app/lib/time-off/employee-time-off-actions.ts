// this file will contain the action functions for the employee time off requests

'use server';

import { revalidatePath } from 'next/cache';
import {
  cancelPendingTimeOffRequest,
  createTimeOffRequest,
  findOverlappingTimeOffRequest,
  TIME_OFF_REQUEST_TYPES,
  type TimeOffRequestType,
} from '@/app/lib/repos/time-off-requests';
import { requireEmployee } from '@/app/lib/utils/auth/require-employee';

export type TimeOffRequestActionState = {
  error?: string;
  success?: string;
  fieldErrors?: {
    requestType?: string;
    startDate?: string;
    endDate?: string;
    employeeNote?: string;
  };
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_NOTE_LENGTH = 500;

function isTimeOffRequestType(
  value: string,
): value is TimeOffRequestType {
  return TIME_OFF_REQUEST_TYPES.some((type) => type === value);
}

function getDateString(value: FormDataEntryValue | null) {
  return typeof value === 'string' ? value.trim() : '';
}

function getTodayDateKey() {
  const today = new Date();

  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function isValidDateKey(value: string) {
  if (!DATE_PATTERN.test(value)) {
    return false;
  }

  const [yearText, monthText, dayText] = value.split('-');

  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  const date = new Date(year, month - 1, day);

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function parseRequestId(value: FormDataEntryValue | null) {
  if (typeof value !== 'string') {
    return null;
  }

  const requestId = Number(value);

  if (!Number.isInteger(requestId) || requestId <= 0) {
    return null;
  }

  return requestId;
}

export async function submitTimeOffRequestAction(
  _previousState: TimeOffRequestActionState,
  formData: FormData,
): Promise<TimeOffRequestActionState> {
  const employee = await requireEmployee();

  const rawRequestType = getDateString(
    formData.get('requestType'),
  );

  const startDate = getDateString(formData.get('startDate'));
  const endDate = getDateString(formData.get('endDate'));

  const employeeNoteValue = formData.get('employeeNote');

  const employeeNote =
    typeof employeeNoteValue === 'string'
      ? employeeNoteValue.trim()
      : '';

  const fieldErrors: NonNullable<
    TimeOffRequestActionState['fieldErrors']
  > = {};

  if (!isTimeOffRequestType(rawRequestType)) {
    fieldErrors.requestType = 'Select a valid request type.';
  }

  if (!isValidDateKey(startDate)) {
    fieldErrors.startDate = 'Select a valid start date.';
  }

  if (!isValidDateKey(endDate)) {
    fieldErrors.endDate = 'Select a valid end date.';
  }

  const today = getTodayDateKey();

  if (isValidDateKey(startDate) && startDate < today) {
    fieldErrors.startDate =
      'The start date cannot be in the past.';
  }

  if (
    isValidDateKey(startDate) &&
    isValidDateKey(endDate) &&
    startDate > endDate
  ) {
    fieldErrors.endDate =
      'The end date cannot be before the start date.';
  }

  if (employeeNote.length > MAX_NOTE_LENGTH) {
    fieldErrors.employeeNote =
      `Notes must be ${MAX_NOTE_LENGTH} characters or fewer.`;
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      error: 'Please correct the highlighted fields.',
      fieldErrors,
    };
  }

  // TypeScript does not infer the type guard across the
  // field-errors check, so validate it once more here.
  if (!isTimeOffRequestType(rawRequestType)) {
    return {
      error: 'Select a valid request type.',
    };
  }

  try {
    const overlappingRequest =
      await findOverlappingTimeOffRequest({
        userId: employee.id,
        startDate,
        endDate,
      });

    if (overlappingRequest) {
      return {
        error:
          'You already have a pending or approved request that overlaps these dates.',
      };
    }

    await createTimeOffRequest({
      userId: employee.id,
      organizationId: employee.organization_id,
      requestType: rawRequestType,
      startDate,
      endDate,
      employeeNote: employeeNote || null,
    });
  } catch (error) {
    console.error('Failed to submit time-off request:', error);

    return {
      error:
        'Unable to submit your time-off request. Please try again.',
    };
  }

  revalidatePath('/dashboard/employee/request-time-off');

  return {
    success: 'Your time-off request was submitted.',
  };
}

export async function cancelTimeOffRequestAction(
  formData: FormData,
) {
  const employee = await requireEmployee();

  const requestId = parseRequestId(formData.get('requestId'));

  if (!requestId) {
    throw new Error('Invalid time-off request.');
  }

  const cancelledRequest = await cancelPendingTimeOffRequest({
    requestId,
    userId: employee.id,
    organizationId: employee.organization_id,
  });

  if (!cancelledRequest) {
    throw new Error(
      'This request could not be cancelled. It may have already been reviewed.',
    );
  }

  revalidatePath('/dashboard/employee/request-time-off');
}