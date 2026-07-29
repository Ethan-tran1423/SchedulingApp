const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export type ShiftTimeValidationResult =
  | {
      success: true;
    }
  | {
      success: false;
      error: string;
    };

export function convertTimeToMinutes(
  time: string,
): number {
  const [hours, minutes] = time.split(':').map(Number);

  return hours * 60 + minutes;
}

export function isValidShiftDate(
  shiftDate: string,
): boolean {
  if (!DATE_PATTERN.test(shiftDate)) {
    return false;
  }

  const [year, month, day] = shiftDate
    .split('-')
    .map(Number);

  const parsedDate = new Date(
    Date.UTC(year, month - 1, day),
  );

  return (
    parsedDate.getUTCFullYear() === year &&
    parsedDate.getUTCMonth() === month - 1 &&
    parsedDate.getUTCDate() === day
  );
}

export function isValidShiftTime(
  time: string,
): boolean {
  return TIME_PATTERN.test(time);
}

/**
 * Shift MVP rule:
 * A shift must begin and end on the same calendar day.
 *
 * Because the database stores one shift_date with separate
 * start_time and end_time values, an end time earlier than
 * or equal to the start time would represent an overnight
 * or zero-length shift and is rejected.
 */
export function validateSameDayShiftTimes(
  startTime: string,
  endTime: string,
): ShiftTimeValidationResult {
  if (
    !isValidShiftTime(startTime) ||
    !isValidShiftTime(endTime)
  ) {
    return {
      success: false,
      error:
        'The shift must have valid start and end times.',
    };
  }

  if (
    convertTimeToMinutes(startTime) >=
    convertTimeToMinutes(endTime)
  ) {
    return {
      success: false,
      error:
        'Shifts must start and end on the same day, and the end time must be later than the start time.',
    };
  }

  return {
    success: true,
  };
}

export function doShiftTimesOverlap(
  firstStartTime: string,
  firstEndTime: string,
  secondStartTime: string,
  secondEndTime: string,
): boolean {
  const firstStart =
    convertTimeToMinutes(firstStartTime);

  const firstEnd =
    convertTimeToMinutes(firstEndTime);

  const secondStart =
    convertTimeToMinutes(secondStartTime);

  const secondEnd =
    convertTimeToMinutes(secondEndTime);

  return (
    firstStart < secondEnd &&
    secondStart < firstEnd
  );
}