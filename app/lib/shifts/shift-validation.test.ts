import { describe, expect, it } from 'vitest';
import {
  doShiftTimesOverlap,
  isValidShiftDate,
  isValidShiftTime,
  validateSameDayShiftTimes,
} from './shift-validation';

describe('isValidShiftDate', () => {
  it('accepts a valid calendar date', () => {
    expect(isValidShiftDate('2026-08-15')).toBe(true);
  });

  it('rejects an impossible calendar date', () => {
    expect(isValidShiftDate('2026-02-30')).toBe(false);
  });

  it('rejects an incorrectly formatted date', () => {
    expect(isValidShiftDate('08/15/2026')).toBe(false);
  });
});

describe('isValidShiftTime', () => {
  it('accepts a valid 24-hour time', () => {
    expect(isValidShiftTime('09:30')).toBe(true);
  });

  it('rejects an invalid time', () => {
    expect(isValidShiftTime('25:00')).toBe(false);
  });
});

describe('validateSameDayShiftTimes', () => {
  it('accepts a normal same-day shift', () => {
    expect(
      validateSameDayShiftTimes('09:00', '17:00'),
    ).toEqual({
      success: true,
    });
  });

  it('rejects an overnight shift', () => {
    expect(
      validateSameDayShiftTimes('22:00', '06:00'),
    ).toEqual({
      success: false,
      error:
        'Shifts must start and end on the same day, and the end time must be later than the start time.',
    });
  });

  it('rejects a zero-length shift', () => {
    expect(
      validateSameDayShiftTimes('09:00', '09:00'),
    ).toEqual({
      success: false,
      error:
        'Shifts must start and end on the same day, and the end time must be later than the start time.',
    });
  });
});

describe('doShiftTimesOverlap', () => {
  it('detects overlapping shifts', () => {
    expect(
      doShiftTimesOverlap(
        '09:00',
        '13:00',
        '12:00',
        '16:00',
      ),
    ).toBe(true);
  });

  it('allows back-to-back shifts', () => {
    expect(
      doShiftTimesOverlap(
        '09:00',
        '13:00',
        '13:00',
        '17:00',
      ),
    ).toBe(false);
  });

  it('detects a shift fully inside another shift', () => {
    expect(
      doShiftTimesOverlap(
        '09:00',
        '17:00',
        '11:00',
        '14:00',
      ),
    ).toBe(true);
  });
});