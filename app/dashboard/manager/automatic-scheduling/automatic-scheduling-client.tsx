'use client';

import {
  useActionState,
  useEffect,
  useMemo,
  useRef,
} from 'react';

import { useRouter } from 'next/navigation';

import {
  generateScheduleDraft,
  publishScheduleDraft,
  type GenerateScheduleActionState,
  type PublishScheduleActionState,
  type ScheduleActionIssue,
} from '@/app/lib/scheduling/schedule-actions';

import type {
  UnfilledRequirement,
} from '@/app/lib/scheduling/types';

export type SchedulePreviewShift = {
  id: number;

  employeeId: number;
  employeeName: string;

  organizationRoleId: number | null;
  roleName: string;

  shiftDate: string;
  startTime: string;
  endTime: string;

  notes: string | null;
};

export type SchedulePreview = {
  id: number;

  status:
    | 'draft'
    | 'published'
    | 'archived';

  revision: number;

  weekStartDate: string;

  generationMethod:
    | 'automatic'
    | 'manual'
    | 'ai_assisted';

  publishedAt: string | null;

  filledAssignments: number;
  totalRequiredAssignments: number;
  unfilledAssignments: number;
  coveragePercentage: number;

  warnings: ScheduleActionIssue[];

  unfilledRequirements:
    UnfilledRequirement[];

  shifts: SchedulePreviewShift[];
};

type AutomaticSchedulingClientProps = {
  selectedWeekStartDate: string;
  schedulePreview: SchedulePreview | null;
  scheduleNotFound: boolean;
};

const MANAGER_SCHEDULE_PATH =
  '/dashboard/manager/automatic-scheduling';

const initialGenerateState:
  GenerateScheduleActionState = {};

const initialPublishState:
  PublishScheduleActionState = {};

function formatDateLabel(
  dateKey: string,
): string {
  const [year, month, day] = dateKey
    .split('-')
    .map(Number);

  const date = new Date(
    Date.UTC(year, month - 1, day),
  );

  return new Intl.DateTimeFormat(
    'en-US',
    {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    },
  ).format(date);
}

function formatTime(
  time: string,
): string {
  const [hoursValue, minutes] =
    time.split(':');

  const hours = Number(hoursValue);

  if (!Number.isFinite(hours)) {
    return time;
  }

  const suffix =
    hours >= 12 ? 'PM' : 'AM';

  const displayHours =
    hours % 12 || 12;

  return `${displayHours}:${minutes} ${suffix}`;
}

function getStatusClasses(
  status: SchedulePreview['status'],
): string {
  if (status === 'published') {
    return (
      'border-green-300 bg-green-100 ' +
      'text-green-700'
    );
  }

  if (status === 'archived') {
    return (
      'border-gray-300 bg-gray-100 ' +
      'text-gray-700'
    );
  }

  return (
    'border-amber-300 bg-amber-100 ' +
    'text-amber-700'
  );
}

function IssueList({
  title,
  issues,
  tone,
}: {
  title: string;
  issues: ScheduleActionIssue[];
  tone: 'error' | 'warning';
}) {
  if (issues.length === 0) {
    return null;
  }

  const classes =
    tone === 'error'
      ? 'border-red-300 bg-red-50 text-red-800'
      : 'border-amber-300 bg-amber-50 text-amber-800';

  return (
    <div
      className={`rounded-lg border p-4 ${classes}`}
    >
      <h3 className="font-semibold">
        {title}
      </h3>

      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
        {issues.map((issue, index) => (
          <li
            key={`${issue.code}-${index}`}
          >
            {issue.message}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function AutomaticSchedulingClient({
  selectedWeekStartDate,
  schedulePreview,
  scheduleNotFound,
}: AutomaticSchedulingClientProps) {
  const router = useRouter();

  const handledPublishedScheduleId =
    useRef<number | null>(null);

  const [
    generateState,
    generateAction,
    isGenerating,
  ] = useActionState(
    generateScheduleDraft,
    initialGenerateState,
  );

  const [
    publishState,
    publishAction,
    isPublishing,
  ] = useActionState(
    publishScheduleDraft,
    initialPublishState,
  );

  useEffect(() => {
    if (
      !generateState.scheduleId ||
      !generateState.weekStartDate
    ) {
      return;
    }

    if (
      schedulePreview?.id ===
      generateState.scheduleId
    ) {
      return;
    }

    const parameters =
      new URLSearchParams({
        scheduleId: String(
          generateState.scheduleId,
        ),

        weekStartDate:
          generateState.weekStartDate,
      });

    router.replace(
      `${MANAGER_SCHEDULE_PATH}?${parameters.toString()}`,
      {
        scroll: false,
      },
    );
  }, [
    generateState.scheduleId,
    generateState.weekStartDate,
    router,
    schedulePreview?.id,
  ]);

  useEffect(() => {
    if (!publishState.scheduleId) {
      return;
    }

    if (
      handledPublishedScheduleId.current ===
      publishState.scheduleId
    ) {
      return;
    }

    handledPublishedScheduleId.current =
      publishState.scheduleId;

    router.refresh();
  }, [
    publishState.scheduleId,
    router,
  ]);

  const shiftsByDate = useMemo(() => {
    const groupedShifts =
      new Map<
        string,
        SchedulePreviewShift[]
      >();

    for (
      const shift of
      schedulePreview?.shifts ?? []
    ) {
      const currentShifts =
        groupedShifts.get(
          shift.shiftDate,
        ) ?? [];

      currentShifts.push(shift);

      groupedShifts.set(
        shift.shiftDate,
        currentShifts,
      );
    }

    return Array.from(
      groupedShifts.entries(),
    );
  }, [schedulePreview]);

  return (
    <div className="grid gap-8 xl:grid-cols-[360px_minmax(0,1fr)]">
      <aside className="space-y-6">
        <div className="rounded-xl border border-gray-300 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-black">
            Generate Schedule
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Choose the Sunday that begins
            the schedule week.
          </p>

          <form
            action={generateAction}
            className="mt-6 space-y-5"
          >
            <div className="flex flex-col gap-1">
              <label
                htmlFor="weekStartDate"
                className="text-sm font-medium text-black"
              >
                Week beginning
              </label>

              <input
                id="weekStartDate"
                name="weekStartDate"
                type="date"
                required
                defaultValue={
                  selectedWeekStartDate
                }
                className="h-10 rounded-md border border-gray-300 bg-white px-3 text-black outline-none focus:border-purple-500"
              />

              <p className="text-xs text-gray-500">
                The selected date must be a
                Sunday.
              </p>
            </div>

            <button
              type="submit"
              disabled={isGenerating}
              className="w-full rounded-md bg-purple-500 px-4 py-2 font-medium text-white transition hover:bg-purple-600 disabled:cursor-not-allowed disabled:bg-purple-300"
            >
              {isGenerating
                ? 'Generating...'
                : schedulePreview
                  ? 'Generate New Revision'
                  : 'Generate Draft'}
            </button>
          </form>

          {generateState.error && (
            <div className="mt-5 rounded-md border border-red-300 bg-red-100 px-3 py-2">
              <p className="text-sm font-medium text-red-700">
                {generateState.error}
              </p>
            </div>
          )}

          {generateState.success && (
            <div className="mt-5 rounded-md border border-green-300 bg-green-100 px-3 py-2">
              <p className="text-sm font-medium text-green-700">
                {generateState.success}
              </p>
            </div>
          )}
        </div>

        <IssueList
          title="Setup problems"
          issues={
            generateState.readinessErrors ??
            []
          }
          tone="error"
        />

        <IssueList
          title="Generation warnings"
          issues={
            generateState.readinessWarnings ??
            []
          }
          tone="warning"
        />

        {schedulePreview && (
          <div className="rounded-xl border border-gray-300 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-black">
                Schedule Status
              </h2>

              <span
                className={`rounded-full border px-3 py-1 text-xs font-semibold capitalize ${getStatusClasses(
                  schedulePreview.status,
                )}`}
              >
                {schedulePreview.status}
              </span>
            </div>

            <dl className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500">
                  Week
                </dt>

                <dd className="font-medium text-black">
                  {
                    schedulePreview.weekStartDate
                  }
                </dd>
              </div>

              <div className="flex justify-between gap-4">
                <dt className="text-gray-500">
                  Revision
                </dt>

                <dd className="font-medium text-black">
                  {schedulePreview.revision}
                </dd>
              </div>

              <div className="flex justify-between gap-4">
                <dt className="text-gray-500">
                  Method
                </dt>

                <dd className="font-medium capitalize text-black">
                  {schedulePreview.generationMethod.replace(
                    '_',
                    ' ',
                  )}
                </dd>
              </div>
            </dl>

            {schedulePreview.status ===
              'draft' && (
              <form
                action={publishAction}
                className="mt-6"
              >
                <input
                  type="hidden"
                  name="scheduleId"
                  value={schedulePreview.id}
                />

                <button
                  type="submit"
                  disabled={isPublishing}
                  className="w-full rounded-md bg-green-600 px-4 py-2 font-medium text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-green-300"
                >
                  {isPublishing
                    ? 'Publishing...'
                    : 'Publish Schedule'}
                </button>

                <p className="mt-2 text-xs text-gray-500">
                  Employees cannot see
                  generated shifts until the
                  schedule is published.
                </p>
              </form>
            )}

            {publishState.error && (
              <div className="mt-5 rounded-md border border-red-300 bg-red-100 px-3 py-2">
                <p className="text-sm font-medium text-red-700">
                  {publishState.error}
                </p>
              </div>
            )}

            {publishState.success && (
              <div className="mt-5 rounded-md border border-green-300 bg-green-100 px-3 py-2">
                <p className="text-sm font-medium text-green-700">
                  {publishState.success}
                </p>
              </div>
            )}
          </div>
        )}
      </aside>

      <main className="space-y-6">
        {scheduleNotFound && (
          <div className="rounded-xl border border-red-300 bg-red-50 p-5 text-red-800">
            The selected schedule could not
            be found or does not belong to
            your organization.
          </div>
        )}

        {!schedulePreview ? (
          <div className="flex min-h-[420px] items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center shadow-sm">
            <div className="max-w-md">
              <h2 className="text-xl font-semibold text-black">
                No schedule selected
              </h2>

              <p className="mt-2 text-sm text-gray-500">
                Select a week and generate a
                draft. The generated shifts
                will appear here for review
                before publishing.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border border-gray-300 bg-white p-5 shadow-sm">
                <p className="text-sm text-gray-500">
                  Coverage
                </p>

                <p className="mt-2 text-3xl font-bold text-black">
                  {
                    schedulePreview.coveragePercentage
                  }
                  %
                </p>
              </div>

              <div className="rounded-xl border border-gray-300 bg-white p-5 shadow-sm">
                <p className="text-sm text-gray-500">
                  Filled
                </p>

                <p className="mt-2 text-3xl font-bold text-black">
                  {
                    schedulePreview.filledAssignments
                  }
                </p>
              </div>

              <div className="rounded-xl border border-gray-300 bg-white p-5 shadow-sm">
                <p className="text-sm text-gray-500">
                  Required
                </p>

                <p className="mt-2 text-3xl font-bold text-black">
                  {
                    schedulePreview.totalRequiredAssignments
                  }
                </p>
              </div>

              <div className="rounded-xl border border-gray-300 bg-white p-5 shadow-sm">
                <p className="text-sm text-gray-500">
                  Unfilled
                </p>

                <p className="mt-2 text-3xl font-bold text-black">
                  {
                    schedulePreview.unfilledAssignments
                  }
                </p>
              </div>
            </div>

            {schedulePreview.status ===
              'published' && (
              <div className="rounded-xl border border-green-300 bg-green-50 p-5 text-green-800">
                <p className="font-semibold">
                  This schedule is published.
                </p>

                <p className="mt-1 text-sm">
                  Employees can now see these
                  shifts on their calendars.
                </p>
              </div>
            )}

            <div className="rounded-xl border border-gray-300 bg-white p-6 shadow-sm">
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-black">
                  Weekly Shift Preview
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  {
                    schedulePreview.shifts
                      .length
                  }{' '}
                  generated shift
                  {schedulePreview.shifts
                    .length === 1
                    ? ''
                    : 's'}
                  .
                </p>
              </div>

              {shiftsByDate.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
                  <p className="text-sm text-gray-500">
                    No shifts were generated.
                  </p>
                </div>
              ) : (
                <div className="space-y-7">
                  {shiftsByDate.map(
                    ([date, shifts]) => (
                      <section key={date}>
                        <h3 className="mb-3 border-b border-gray-200 pb-2 font-semibold text-black">
                          {formatDateLabel(
                            date,
                          )}
                        </h3>

                        <div className="grid gap-3 md:grid-cols-2">
                          {shifts.map(
                            (shift) => (
                              <article
                                key={
                                  shift.id
                                }
                                className="rounded-lg border border-gray-200 bg-gray-50 p-4"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <h4 className="font-semibold text-black">
                                      {
                                        shift.employeeName
                                      }
                                    </h4>

                                    <p className="mt-1 text-sm font-medium text-purple-600">
                                      {
                                        shift.roleName
                                      }
                                    </p>
                                  </div>

                                  <span className="rounded-md bg-white px-2 py-1 text-xs font-medium text-gray-600">
                                    #
                                    {
                                      shift.id
                                    }
                                  </span>
                                </div>

                                <p className="mt-4 text-sm text-gray-700">
                                  {formatTime(
                                    shift.startTime,
                                  )}{' '}
                                  –{' '}
                                  {formatTime(
                                    shift.endTime,
                                  )}
                                </p>

                                {shift.notes && (
                                  <p className="mt-2 text-xs text-gray-500">
                                    {
                                      shift.notes
                                    }
                                  </p>
                                )}
                              </article>
                            ),
                          )}
                        </div>
                      </section>
                    ),
                  )}
                </div>
              )}
            </div>

            <IssueList
              title="Saved readiness warnings"
              issues={
                schedulePreview.warnings
              }
              tone="warning"
            />

            {schedulePreview
              .unfilledRequirements.length >
              0 && (
              <div className="rounded-xl border border-red-300 bg-red-50 p-6 text-red-800">
                <h2 className="text-lg font-semibold">
                  Unfilled Requirements
                </h2>

                <div className="mt-4 space-y-3">
                  {schedulePreview.unfilledRequirements.map(
                    (
                      requirement,
                      index,
                    ) => (
                      <article
                        key={`${requirement.requirementId}-${requirement.shiftDate}-${index}`}
                        className="rounded-lg border border-red-200 bg-white p-4"
                      >
                        <p className="font-semibold text-red-800">
                          {
                            requirement.roleName
                          }{' '}
                          on{' '}
                          {formatDateLabel(
                            requirement.shiftDate,
                          )}
                        </p>

                        <p className="mt-1 text-sm">
                          {formatTime(
                            requirement.startTime,
                          )}{' '}
                          –{' '}
                          {formatTime(
                            requirement.endTime,
                          )}
                        </p>

                        <p className="mt-2 text-sm">
                          Assigned{' '}
                          {
                            requirement.assignedCount
                          }{' '}
                          of{' '}
                          {
                            requirement.requiredCount
                          }
                          . Missing{' '}
                          {
                            requirement.missingCount
                          }
                          .
                        </p>

                        <p className="mt-2 text-sm">
                          {
                            requirement.reason
                          }
                        </p>
                      </article>
                    ),
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}