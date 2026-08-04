'use client';

import { useActionState, useMemo, useState } from 'react';

import {
  saveEmployeeAvailability,
  type EmployeeAvailabilityActionState,
} from '@/app/lib/availability/employee-availability-actions';

import PreferredWeeklyHoursForm from '@/app/ui/scheduling-preferences/preferred-weekly-hours-form';

type AvailabilityWindow = {
  id: number;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

type EditableAvailabilityWindow = {
  id: string;
  startTime: string;
  endTime: string;
};

type WeeklyAvailabilityFormProps = {
  initialAvailability: AvailabilityWindow[];
  initialPreferredWeeklyHours: string;
};

const DAYS = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

const initialState: EmployeeAvailabilityActionState = {
  error: '',
  success: '',
};

function createWindow(
  startTime = '09:00',
  endTime = '17:00',
): EditableAvailabilityWindow {
  return {
    id: `${Date.now()}-${Math.random()}`,
    startTime,
    endTime,
  };
}

function buildAvailabilityByDay(
  initialAvailability: AvailabilityWindow[],
) {
  const availabilityByDay: Record<
    number,
    EditableAvailabilityWindow[]
  > = {
    0: [],
    1: [],
    2: [],
    3: [],
    4: [],
    5: [],
    6: [],
  };

  for (const window of initialAvailability) {
    availabilityByDay[window.dayOfWeek].push({
      id: `${window.id}`,
      startTime: window.startTime,
      endTime: window.endTime,
    });
  }

  return availabilityByDay;
}

export default function WeeklyAvailabilityForm({
  initialAvailability,
  initialPreferredWeeklyHours,
}: WeeklyAvailabilityFormProps) {
  const [state, formAction, isPending] = useActionState(
    saveEmployeeAvailability,
    initialState,
  );

  const [availabilityByDay, setAvailabilityByDay] = useState(() =>
    buildAvailabilityByDay(initialAvailability),
  );

  const [copyFromDay, setCopyFromDay] = useState(1);
  const [copyToDay, setCopyToDay] = useState('all');

  const serializedAvailability = useMemo(() => {
    const windows = [];

    for (const day of DAYS) {
      for (const window of availabilityByDay[day.value]) {
        windows.push({
          dayOfWeek: day.value,
          startTime: window.startTime,
          endTime: window.endTime,
        });
      }
    }

    return JSON.stringify(windows);
  }, [availabilityByDay]);

  function addWindow(dayOfWeek: number) {
    setAvailabilityByDay((current) => ({
      ...current,
      [dayOfWeek]: [
        ...current[dayOfWeek],
        createWindow(),
      ],
    }));
  }

  function removeWindow(
    dayOfWeek: number,
    windowId: string,
  ) {
    setAvailabilityByDay((current) => ({
      ...current,
      [dayOfWeek]: current[dayOfWeek].filter(
        (window) => window.id !== windowId,
      ),
    }));
  }

  function updateWindow(
    dayOfWeek: number,
    windowId: string,
    field: 'startTime' | 'endTime',
    value: string,
  ) {
    setAvailabilityByDay((current) => ({
      ...current,
      [dayOfWeek]: current[dayOfWeek].map((window) =>
        window.id === windowId
          ? { ...window, [field]: value }
          : window,
      ),
    }));
  }

  function toggleUnavailable(
    dayOfWeek: number,
    isUnavailable: boolean,
  ) {
    setAvailabilityByDay((current) => ({
      ...current,
      [dayOfWeek]: isUnavailable
        ? []
        : [createWindow()],
    }));
  }

  function copyDayAvailability() {
    const sourceWindows =
      availabilityByDay[copyFromDay].map((window) => ({
        ...window,
        id: `${Date.now()}-${Math.random()}`,
      }));

    const targetDays =
      copyToDay === 'all'
        ? DAYS.map((day) => day.value).filter(
            (day) => day !== copyFromDay,
          )
        : [Number(copyToDay)];

    setAvailabilityByDay((current) => {
      const updated = { ...current };

      for (const targetDay of targetDays) {
        updated[targetDay] = sourceWindows.map(
          (window) => ({
            ...window,
            id: `${Date.now()}-${Math.random()}-${targetDay}`,
          }),
        );
      }

      return updated;
    });
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <div className="rounded-xl border border-gray-300 bg-white p-6 shadow-sm">
        <h2 className="mb-1 text-xl font-semibold text-black">
          Weekly Availability
        </h2>

        <p className="mb-6 text-sm text-gray-500">
          Add one or more availability windows for each
          day.
        </p>

        <div className="flex flex-col gap-5">
          {DAYS.map((day) => {
            const dayWindows =
              availabilityByDay[day.value];

            const isUnavailable =
              dayWindows.length === 0;

            return (
              <div
                key={day.value}
                className="rounded-lg border border-gray-200 bg-gray-50 p-4"
              >
                <div className="mb-4 flex items-center justify-between gap-4">
                  <div>
                    <h3 className="font-semibold text-black">
                      {day.label}
                    </h3>

                    <p className="text-sm text-gray-500">
                      {isUnavailable
                        ? 'Marked unavailable'
                        : `${dayWindows.length} availability window${
                            dayWindows.length === 1
                              ? ''
                              : 's'
                          }`}
                    </p>
                  </div>

                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={isUnavailable}
                      onChange={(event) =>
                        toggleUnavailable(
                          day.value,
                          event.target.checked,
                        )
                      }
                    />

                    Unavailable
                  </label>
                </div>

                {!isUnavailable && (
                  <div className="flex flex-col gap-3">
                    {dayWindows.map((window) => (
                      <div
                        key={window.id}
                        className="flex flex-col gap-3 rounded-md border border-gray-200 bg-white p-3 sm:flex-row sm:items-end"
                      >
                        <div className="flex flex-1 flex-col gap-1">
                          <label className="text-sm font-medium text-black">
                            Start Time
                          </label>

                          <input
                            type="time"
                            value={window.startTime}
                            onChange={(event) =>
                              updateWindow(
                                day.value,
                                window.id,
                                'startTime',
                                event.target.value,
                              )
                            }
                            className="h-10 rounded-md border border-gray-300 bg-white px-3 text-black outline-none focus:border-purple-500"
                          />
                        </div>

                        <div className="flex flex-1 flex-col gap-1">
                          <label className="text-sm font-medium text-black">
                            End Time
                          </label>

                          <input
                            type="time"
                            value={window.endTime}
                            onChange={(event) =>
                              updateWindow(
                                day.value,
                                window.id,
                                'endTime',
                                event.target.value,
                              )
                            }
                            className="h-10 rounded-md border border-gray-300 bg-white px-3 text-black outline-none focus:border-purple-500"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            removeWindow(
                              day.value,
                              window.id,
                            )
                          }
                          className="rounded-md px-3 py-2 text-sm text-red-500 hover:bg-red-100"
                        >
                          Remove
                        </button>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={() =>
                        addWindow(day.value)
                      }
                      className="w-fit rounded-md border border-purple-500 px-3 py-2 text-sm font-medium text-purple-600 hover:bg-purple-50"
                    >
                      Add Time Window
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex h-fit flex-col gap-6">
        <div className="rounded-xl border border-gray-300 bg-white p-6 shadow-sm">
          <h2 className="mb-1 text-xl font-semibold text-black">
            Save Changes
          </h2>

          <p className="mb-6 text-sm text-gray-500">
            Copy one day to other days, then save your
            weekly availability.
          </p>

          <div className="mb-6 flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-black">
                Copy From
              </label>

              <select
                value={copyFromDay}
                onChange={(event) =>
                  setCopyFromDay(
                    Number(event.target.value),
                  )
                }
                className="h-10 rounded-md border border-gray-300 bg-white px-3 text-black outline-none focus:border-purple-500"
              >
                {DAYS.map((day) => (
                  <option
                    key={day.value}
                    value={day.value}
                  >
                    {day.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-black">
                Copy To
              </label>

              <select
                value={copyToDay}
                onChange={(event) =>
                  setCopyToDay(event.target.value)
                }
                className="h-10 rounded-md border border-gray-300 bg-white px-3 text-black outline-none focus:border-purple-500"
              >
                <option value="all">
                  All other days
                </option>

                {DAYS.map((day) => (
                  <option
                    key={day.value}
                    value={day.value}
                  >
                    {day.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={copyDayAvailability}
              className="rounded-md border border-gray-300 px-4 py-2 font-medium text-black hover:bg-gray-100"
            >
              Copy Availability
            </button>
          </div>

          <form
            action={formAction}
            className="flex flex-col gap-4"
          >
            <input
              type="hidden"
              name="availability"
              value={serializedAvailability}
            />

            {state?.error && (
              <div className="rounded-md border border-red-300 bg-red-100 px-3 py-2">
                <p className="text-sm font-medium text-red-700">
                  {state.error}
                </p>
              </div>
            )}

            {state?.success && (
              <div className="rounded-md border border-green-300 bg-green-100 px-3 py-2">
                <p className="text-sm font-medium text-green-700">
                  {state.success}
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={isPending}
              className="rounded-md bg-purple-500 px-4 py-2 font-medium text-white hover:bg-purple-600 disabled:cursor-not-allowed disabled:bg-purple-300"
            >
              {isPending
                ? 'Saving...'
                : 'Save Weekly Availability'}
            </button>
          </form>
        </div>

        <PreferredWeeklyHoursForm
          initialPreferredWeeklyHours={
            initialPreferredWeeklyHours
          }
        />
      </div>
    </div>
  );
}