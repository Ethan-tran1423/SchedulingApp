'use client';

import Link from 'next/link';
import {
  type FormEvent,
  useActionState,
  useMemo,
  useState,
  useTransition,
} from 'react';
import {
  saveOrganizationSettings,
  type OrganizationSettingsActionState,
} from '@/app/lib/organization-settings/organization-settings-actions';

type OrganizationRoleOption = {
  id: number;
  name: string;
  description: string | null;
};

type InitialWorkingHours = {
  id?: number;
  dayOfWeek: number;
  isClosed: boolean;
  startTime: string;
  endTime: string;
};

type InitialRoleRequirement = {
  id?: number;
  organizationRoleId: number;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  requiredCount: number;
};

type OrganizationSettingsFormProps = {
  roles: OrganizationRoleOption[];
  initialWorkingHours: InitialWorkingHours[];
  initialRoleRequirements: InitialRoleRequirement[];
};

type EditableWorkingHours = {
  dayOfWeek: number;
  isClosed: boolean;
  startTime: string;
  endTime: string;
};

type EditableRoleRequirement = {
  clientId: string;
  organizationRoleId: number;
  startTime: string;
  endTime: string;
  requiredCount: string;
};

type WorkingHoursByDay = Record<number, EditableWorkingHours>;

type RequirementsByDay = Record<
  number,
  EditableRoleRequirement[]
>;

const DAYS = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

const initialActionState: OrganizationSettingsActionState = {
  error: '',
  success: '',
};

let clientIdCounter = 0;

function createClientId(prefix = 'requirement'): string {
  clientIdCounter += 1;

  return `${prefix}-${Date.now()}-${clientIdCounter}`;
}

function getDefaultWorkingHours(
  dayOfWeek: number,
): EditableWorkingHours {
  const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;

  return {
    dayOfWeek,
    isClosed: !isWeekday,
    startTime: '09:00',
    endTime: '17:00',
  };
}

function buildWorkingHoursByDay(
  initialWorkingHours: InitialWorkingHours[],
): WorkingHoursByDay {
  const workingHoursByDay: WorkingHoursByDay = {};

  for (const day of DAYS) {
    workingHoursByDay[day.value] =
      getDefaultWorkingHours(day.value);
  }

  for (const savedHours of initialWorkingHours) {
    const dayOfWeek = Number(savedHours.dayOfWeek);

    if (
      !Number.isInteger(dayOfWeek) ||
      dayOfWeek < 0 ||
      dayOfWeek > 6
    ) {
      continue;
    }

    workingHoursByDay[dayOfWeek] = {
      dayOfWeek,
      isClosed: savedHours.isClosed === true,
      startTime: savedHours.startTime || '09:00',
      endTime: savedHours.endTime || '17:00',
    };
  }

  return workingHoursByDay;
}

function buildRequirementsByDay(
  initialRoleRequirements: InitialRoleRequirement[],
): RequirementsByDay {
  const requirementsByDay: RequirementsByDay = {};

  for (const day of DAYS) {
    requirementsByDay[day.value] = [];
  }

  for (const savedRequirement of initialRoleRequirements) {
    const dayOfWeek = Number(savedRequirement.dayOfWeek);
    const organizationRoleId = Number(
      savedRequirement.organizationRoleId,
    );

    if (
      !Number.isInteger(dayOfWeek) ||
      dayOfWeek < 0 ||
      dayOfWeek > 6 ||
      !Number.isInteger(organizationRoleId) ||
      organizationRoleId <= 0
    ) {
      continue;
    }

    requirementsByDay[dayOfWeek].push({
      clientId: savedRequirement.id
        ? `saved-requirement-${savedRequirement.id}`
        : createClientId('saved-requirement'),
      organizationRoleId,
      startTime: savedRequirement.startTime,
      endTime: savedRequirement.endTime,
      requiredCount: String(savedRequirement.requiredCount),
    });
  }

  return requirementsByDay;
}

export default function OrganizationSettingsForm({
  roles,
  initialWorkingHours,
  initialRoleRequirements,
}: OrganizationSettingsFormProps) {
  const [state, submitAction, actionPending] = useActionState(
    saveOrganizationSettings,
    initialActionState,
  );

  const [transitionPending, startTransition] = useTransition();

  const isPending = actionPending || transitionPending;

  const [workingHoursByDay, setWorkingHoursByDay] = useState(
    () => buildWorkingHoursByDay(initialWorkingHours),
  );

  const [requirementsByDay, setRequirementsByDay] = useState(
    () => buildRequirementsByDay(initialRoleRequirements),
  );

  const [copyFromDay, setCopyFromDay] = useState(1);
  const [copyToDay, setCopyToDay] = useState('all');

  

  const serializedSettings = useMemo(() => {
    const workingHours = DAYS.map((day) => {
      const hours = workingHoursByDay[day.value];

      return {
        dayOfWeek: day.value,
        isClosed: hours.isClosed,
        startTime: hours.isClosed ? null : hours.startTime,
        endTime: hours.isClosed ? null : hours.endTime,
      };
    });

    const roleRequirements = DAYS.flatMap((day) => {
      const hours = workingHoursByDay[day.value];

      if (hours.isClosed) {
        return [];
      }

      return requirementsByDay[day.value].map(
        (requirement) => ({
          organizationRoleId:
            requirement.organizationRoleId,
          dayOfWeek: day.value,
          startTime: requirement.startTime,
          endTime: requirement.endTime,
          requiredCount: Number(requirement.requiredCount),
        }),
      );
    });

    return JSON.stringify({
      workingHours,
      roleRequirements,
    });
  }, [workingHoursByDay, requirementsByDay]);

  function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): void {
    event.preventDefault();

    const formData = new FormData();

    /*
     * Build FormData directly from current React state.
     * This avoids the browser resetting the form after
     * the server action completes.
     */
    formData.set('settings', serializedSettings);

    startTransition(() => {
      submitAction(formData);
    });
  }

  function toggleDayClosed(
    dayOfWeek: number,
    isClosed: boolean,
  ): void {
    setWorkingHoursByDay((current) => {
      const currentHours = current[dayOfWeek];

      return {
        ...current,
        [dayOfWeek]: {
          ...currentHours,
          isClosed,
          startTime: currentHours.startTime || '09:00',
          endTime: currentHours.endTime || '17:00',
        },
      };
    });

    if (isClosed) {
      setRequirementsByDay((current) => ({
        ...current,
        [dayOfWeek]: [],
      }));
    }
  }

  function updateWorkingHours(
    dayOfWeek: number,
    field: 'startTime' | 'endTime',
    value: string,
  ): void {
    setWorkingHoursByDay((current) => ({
      ...current,
      [dayOfWeek]: {
        ...current[dayOfWeek],
        [field]: value,
      },
    }));
  }

  function addRequirement(dayOfWeek: number): void {
    const hours = workingHoursByDay[dayOfWeek];
    const firstRole = roles[0];

    if (hours.isClosed || !firstRole) {
      return;
    }

    setRequirementsByDay((current) => ({
      ...current,
      [dayOfWeek]: [
        ...current[dayOfWeek],
        {
          clientId: createClientId(),
          organizationRoleId: Number(firstRole.id),
          startTime: hours.startTime || '09:00',
          endTime: hours.endTime || '17:00',
          requiredCount: '1',
        },
      ],
    }));
  }

  function updateRequirement(
    dayOfWeek: number,
    clientId: string,
    changes: Partial<EditableRoleRequirement>,
  ): void {
    setRequirementsByDay((current) => ({
      ...current,
      [dayOfWeek]: current[dayOfWeek].map(
        (requirement) =>
          requirement.clientId === clientId
            ? {
                ...requirement,
                ...changes,
              }
            : requirement,
      ),
    }));
  }

  function removeRequirement(
    dayOfWeek: number,
    clientId: string,
  ): void {
    setRequirementsByDay((current) => ({
      ...current,
      [dayOfWeek]: current[dayOfWeek].filter(
        (requirement) =>
          requirement.clientId !== clientId,
      ),
    }));
  }

  function copyDaySettings(): void {
    const targetDays =
      copyToDay === 'all'
        ? DAYS.map((day) => day.value).filter(
            (dayOfWeek) => dayOfWeek !== copyFromDay,
          )
        : [Number(copyToDay)];

    if (
      targetDays.length === 1 &&
      targetDays[0] === copyFromDay
    ) {
      return;
    }

    const sourceHours = workingHoursByDay[copyFromDay];
    const sourceRequirements =
      requirementsByDay[copyFromDay];

    setWorkingHoursByDay((current) => {
      const updatedHours = {
        ...current,
      };

      for (const targetDay of targetDays) {
        updatedHours[targetDay] = {
          ...sourceHours,
          dayOfWeek: targetDay,
        };
      }

      return updatedHours;
    });

    setRequirementsByDay((current) => {
      const updatedRequirements = {
        ...current,
      };

      for (const targetDay of targetDays) {
        updatedRequirements[targetDay] =
          sourceHours.isClosed
            ? []
            : sourceRequirements.map((requirement) => ({
                ...requirement,
                clientId: createClientId(
                  'copied-requirement',
                ),
              }));
      }

      return updatedRequirements;
    });
  }

  const copyTargetMatchesSource =
    copyToDay !== 'all' &&
    Number(copyToDay) === copyFromDay;

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-6">
          <div className="rounded-xl border border-gray-300 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-black">
              Weekly Working Hours
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Set when your organization is normally open each
              day.
            </p>

            <div className="mt-6 flex flex-col gap-5">
              {DAYS.map((day) => {
                const hours =
                  workingHoursByDay[day.value];

                const requirements =
                  requirementsByDay[day.value];

                return (
                  <div
                    key={day.value}
                    className="rounded-lg border border-gray-200 bg-gray-50 p-4"
                  >
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                      <div>
                        <h3 className="font-semibold text-black">
                          {day.label}
                        </h3>

                        <p className="text-sm text-gray-500">
                          {hours.isClosed
                            ? 'Organization closed'
                            : `${hours.startTime} to ${hours.endTime}`}
                        </p>
                      </div>

                      <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                        <input
                          type="checkbox"
                          checked={hours.isClosed}
                          onChange={(event) =>
                            toggleDayClosed(
                              day.value,
                              event.target.checked,
                            )
                          }
                        />

                        Closed
                      </label>
                    </div>

                    {!hours.isClosed && (
                      <>
                        <div className="mt-4 grid gap-4 sm:grid-cols-2">
                          <div className="flex flex-col gap-1">
                            <label
                              htmlFor={`opening-time-${day.value}`}
                              className="text-sm font-medium text-black"
                            >
                              Opening Time
                            </label>

                            <input
                              id={`opening-time-${day.value}`}
                              type="time"
                              required
                              value={hours.startTime}
                              onChange={(event) =>
                                updateWorkingHours(
                                  day.value,
                                  'startTime',
                                  event.target.value,
                                )
                              }
                              className="h-10 rounded-md border border-gray-300 bg-white px-3 text-black outline-none focus:border-purple-500"
                            />
                          </div>

                          <div className="flex flex-col gap-1">
                            <label
                              htmlFor={`closing-time-${day.value}`}
                              className="text-sm font-medium text-black"
                            >
                              Closing Time
                            </label>

                            <input
                              id={`closing-time-${day.value}`}
                              type="time"
                              required
                              value={hours.endTime}
                              onChange={(event) =>
                                updateWorkingHours(
                                  day.value,
                                  'endTime',
                                  event.target.value,
                                )
                              }
                              className="h-10 rounded-md border border-gray-300 bg-white px-3 text-black outline-none focus:border-purple-500"
                            />
                          </div>
                        </div>

                        <div className="mt-6 border-t border-gray-200 pt-5">
                          <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                            <div>
                              <h4 className="font-semibold text-black">
                                Staffing Requirements
                              </h4>

                              <p className="text-sm text-gray-500">
                                Set the minimum employees needed by
                                role.
                              </p>
                            </div>

                            {roles.length > 0 && (
                              <button
                                type="button"
                                onClick={() =>
                                  addRequirement(day.value)
                                }
                                className="w-fit rounded-md border border-purple-500 px-3 py-2 text-sm font-medium text-purple-600 hover:bg-purple-50"
                              >
                                Add Requirement
                              </button>
                            )}
                          </div>

                          {roles.length === 0 ? (
                            <div className="rounded-md border border-dashed border-gray-300 bg-white p-4">
                              <p className="text-sm text-gray-600">
                                Create organization roles before
                                adding staffing requirements.
                              </p>

                              <Link
                                href="/dashboard/manager/set-org-roles"
                                className="mt-3 inline-block text-sm font-medium text-purple-600 hover:underline"
                              >
                                Go to Set Org Roles
                              </Link>
                            </div>
                          ) : requirements.length === 0 ? (
                            <div className="rounded-md border border-dashed border-gray-300 bg-white p-4 text-center">
                              <p className="text-sm text-gray-500">
                                No staffing requirements added for
                                this day.
                              </p>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-3">
                              {requirements.map(
                                (requirement) => (
                                  <div
                                    key={
                                      requirement.clientId
                                    }
                                    className="rounded-md border border-gray-200 bg-white p-4"
                                  >
                                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                      <div className="flex flex-col gap-1">
                                        <label
                                          htmlFor={`role-${requirement.clientId}`}
                                          className="text-sm font-medium text-black"
                                        >
                                          Role
                                        </label>

                                        <select
                                          id={`role-${requirement.clientId}`}
                                          value={
                                            requirement.organizationRoleId
                                          }
                                          onChange={(event) =>
                                            updateRequirement(
                                              day.value,
                                              requirement.clientId,
                                              {
                                                organizationRoleId:
                                                  Number(
                                                    event.target
                                                      .value,
                                                  ),
                                              },
                                            )
                                          }
                                          className="h-10 rounded-md border border-gray-300 bg-white px-3 text-black outline-none focus:border-purple-500"
                                        >
                                          {roles.map((role) => (
                                            <option
                                              key={role.id}
                                              value={Number(
                                                role.id,
                                              )}
                                            >
                                              {role.name}
                                            </option>
                                          ))}
                                        </select>
                                      </div>

                                      <div className="flex flex-col gap-1">
                                        <label
                                          htmlFor={`requirement-start-${requirement.clientId}`}
                                          className="text-sm font-medium text-black"
                                        >
                                          Start Time
                                        </label>

                                        <input
                                          id={`requirement-start-${requirement.clientId}`}
                                          type="time"
                                          required
                                          min={
                                            hours.startTime
                                          }
                                          max={hours.endTime}
                                          value={
                                            requirement.startTime
                                          }
                                          onChange={(event) =>
                                            updateRequirement(
                                              day.value,
                                              requirement.clientId,
                                              {
                                                startTime:
                                                  event.target
                                                    .value,
                                              },
                                            )
                                          }
                                          className="h-10 rounded-md border border-gray-300 bg-white px-3 text-black outline-none focus:border-purple-500"
                                        />
                                      </div>

                                      <div className="flex flex-col gap-1">
                                        <label
                                          htmlFor={`requirement-end-${requirement.clientId}`}
                                          className="text-sm font-medium text-black"
                                        >
                                          End Time
                                        </label>

                                        <input
                                          id={`requirement-end-${requirement.clientId}`}
                                          type="time"
                                          required
                                          min={
                                            hours.startTime
                                          }
                                          max={hours.endTime}
                                          value={
                                            requirement.endTime
                                          }
                                          onChange={(event) =>
                                            updateRequirement(
                                              day.value,
                                              requirement.clientId,
                                              {
                                                endTime:
                                                  event.target
                                                    .value,
                                              },
                                            )
                                          }
                                          className="h-10 rounded-md border border-gray-300 bg-white px-3 text-black outline-none focus:border-purple-500"
                                        />
                                      </div>

                                      <div className="flex flex-col gap-1">
                                        <label
                                          htmlFor={`required-count-${requirement.clientId}`}
                                          className="text-sm font-medium text-black"
                                        >
                                          Employees Needed
                                        </label>

                                        <input
                                          id={`required-count-${requirement.clientId}`}
                                          type="number"
                                          required
                                          min={1}
                                          step={1}
                                          value={
                                            requirement.requiredCount
                                          }
                                          onChange={(event) =>
                                            updateRequirement(
                                              day.value,
                                              requirement.clientId,
                                              {
                                                requiredCount:
                                                  event.target
                                                    .value,
                                              },
                                            )
                                          }
                                          className="h-10 rounded-md border border-gray-300 bg-white px-3 text-black outline-none focus:border-purple-500"
                                        />
                                      </div>
                                    </div>

                                    <div className="mt-3 flex justify-end">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          removeRequirement(
                                            day.value,
                                            requirement.clientId,
                                          )
                                        }
                                        className="rounded-md px-3 py-2 text-sm font-medium text-red-500 hover:bg-red-100"
                                      >
                                        Remove
                                      </button>
                                    </div>
                                  </div>
                                ),
                              )}
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <aside className="h-fit rounded-xl border border-gray-300 bg-white p-6 shadow-sm lg:sticky lg:top-6">
          <h2 className="text-xl font-semibold text-black">
            Save Changes
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Copy one day’s setup, review your settings, and
            save.
          </p>

          <div className="mt-6 flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label
                htmlFor="copy-from-day"
                className="text-sm font-medium text-black"
              >
                Copy From
              </label>

              <select
                id="copy-from-day"
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
              <label
                htmlFor="copy-to-day"
                className="text-sm font-medium text-black"
              >
                Copy To
              </label>

              <select
                id="copy-to-day"
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
              disabled={copyTargetMatchesSource}
              onClick={copyDaySettings}
              className="rounded-md border border-gray-300 px-4 py-2 font-medium text-black hover:bg-gray-100 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
            >
              Copy Day Settings
            </button>
          </div>

          <div className="my-6 border-t border-gray-200" />

          <div className="flex flex-col gap-4">
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
                : 'Save Organization Settings'}
            </button>
          </div>
        </aside>
      </div>
    </form>
  );
}