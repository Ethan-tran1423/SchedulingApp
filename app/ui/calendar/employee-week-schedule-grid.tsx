export type EmployeeScheduleGridEmployee = {
  id: number;
  name: string;
};

export type EmployeeScheduleGridShift = {
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

type EmployeeWeekScheduleGridProps = {
  weekStartDate: string;

  status:
    | 'draft'
    | 'published'
    | 'archived';

  employees: EmployeeScheduleGridEmployee[];
  shifts: EmployeeScheduleGridShift[];
};

const ROLE_STYLES = [
  'border-blue-300 bg-blue-100 text-blue-950',
  'border-amber-300 bg-amber-100 text-amber-950',
  'border-emerald-300 bg-emerald-100 text-emerald-950',
  'border-rose-300 bg-rose-100 text-rose-950',
  'border-violet-300 bg-violet-100 text-violet-950',
  'border-cyan-300 bg-cyan-100 text-cyan-950',
  'border-orange-300 bg-orange-100 text-orange-950',
];

function parseDateKey(
  dateKey: string,
): Date {
  const [year, month, day] = dateKey
    .split('-')
    .map(Number);

  return new Date(
    Date.UTC(year, month - 1, day),
  );
}

function addDaysToDateKey(
  dateKey: string,
  numberOfDays: number,
): string {
  const date = parseDateKey(dateKey);

  date.setUTCDate(
    date.getUTCDate() + numberOfDays,
  );

  return date.toISOString().slice(0, 10);
}

function formatDayName(
  dateKey: string,
): string {
  return new Intl.DateTimeFormat(
    'en-US',
    {
      weekday: 'short',
      timeZone: 'UTC',
    },
  ).format(parseDateKey(dateKey));
}

function formatMonthAndDay(
  dateKey: string,
): string {
  return new Intl.DateTimeFormat(
    'en-US',
    {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    },
  ).format(parseDateKey(dateKey));
}

function formatTime(
  time: string,
): string {
  const [hourValue, minuteValue] =
    time.split(':');

  const hour = Number(hourValue);

  if (!Number.isFinite(hour)) {
    return time;
  }

  const suffix =
    hour >= 12 ? 'PM' : 'AM';

  const displayHour =
    hour % 12 || 12;

  return `${displayHour}:${minuteValue} ${suffix}`;
}

function getEmployeeInitials(
  name: string,
): string {
  const nameParts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (nameParts.length === 0) {
    return '?';
  }

  return nameParts
    .slice(0, 2)
    .map((part) =>
      part.charAt(0).toUpperCase(),
    )
    .join('');
}

function getRoleStyle(
  roleName: string,
): string {
  let hash = 0;

  for (
    let index = 0;
    index < roleName.length;
    index += 1
  ) {
    hash =
      roleName.charCodeAt(index) +
      ((hash << 5) - hash);
  }

  const styleIndex =
    Math.abs(hash) %
    ROLE_STYLES.length;

  return ROLE_STYLES[styleIndex];
}

function getStatusClasses(
  status:
    EmployeeWeekScheduleGridProps['status'],
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

export default function EmployeeWeekScheduleGrid({
  weekStartDate,
  status,
  employees,
  shifts,
}: EmployeeWeekScheduleGridProps) {
  const todayDateKey =
    new Date().toISOString().slice(0, 10);

  const weekDays = Array.from(
    {
      length: 7,
    },
    (_, dayOffset) =>
      addDaysToDateKey(
        weekStartDate,
        dayOffset,
      ),
  );

  const sortedEmployees = [
    ...employees,
  ].sort((first, second) =>
    first.name.localeCompare(second.name),
  );

  const shiftsByEmployeeAndDate =
    new Map<
      string,
      EmployeeScheduleGridShift[]
    >();

  for (const shift of shifts) {
    const key =
      `${shift.employeeId}-${shift.shiftDate}`;

    const currentShifts =
      shiftsByEmployeeAndDate.get(key) ??
      [];

    currentShifts.push(shift);

    shiftsByEmployeeAndDate.set(
      key,
      currentShifts,
    );
  }

  for (
    const groupedShifts of
    shiftsByEmployeeAndDate.values()
  ) {
    groupedShifts.sort(
      (first, second) =>
        first.startTime.localeCompare(
          second.startTime,
        ),
    );
  }

  const gridColumns =
    '220px repeat(7, minmax(150px, 1fr))';

  return (
    <section className="overflow-hidden rounded-xl border border-gray-300 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-gray-200 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-black">
            Weekly Schedule
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Employees are shown by row and
            schedule days are shown by column.
          </p>
        </div>

        <span
          className={`w-fit rounded-full border px-3 py-1 text-xs font-semibold capitalize ${getStatusClasses(
            status,
          )}`}
        >
          {status}
        </span>
      </div>

      {sortedEmployees.length === 0 ? (
        <div className="p-10 text-center text-sm text-gray-500">
          No employees were found for this
          organization.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[1280px]">
            <div
              className="sticky top-0 z-30 grid border-b border-gray-200 bg-white"
              style={{
                gridTemplateColumns:
                  gridColumns,
              }}
            >
              <div className="sticky left-0 z-40 flex items-center border-r border-gray-200 bg-gray-50 px-5 py-4">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Employee
                </span>
              </div>

              {weekDays.map((dateKey) => {
                const isToday =
                  dateKey === todayDateKey;

                return (
                  <div
                    key={dateKey}
                    className={`border-r border-gray-200 px-3 py-3 text-center ${
                      isToday
                        ? 'bg-purple-50'
                        : 'bg-gray-50'
                    }`}
                  >
                    <p
                      className={`text-xs font-semibold uppercase ${
                        isToday
                          ? 'text-purple-600'
                          : 'text-gray-500'
                      }`}
                    >
                      {formatDayName(dateKey)}
                    </p>

                    <p className="mt-1 text-sm font-semibold text-black">
                      {formatMonthAndDay(
                        dateKey,
                      )}
                    </p>
                  </div>
                );
              })}
            </div>

            {sortedEmployees.map(
              (employee, employeeIndex) => (
                <div
                  key={employee.id}
                  className="grid border-b border-gray-200 last:border-b-0"
                  style={{
                    gridTemplateColumns:
                      gridColumns,
                  }}
                >
                  <div
                    className={`sticky left-0 z-20 flex min-h-32 items-center gap-3 border-r border-gray-200 px-5 py-4 ${
                      employeeIndex % 2 === 0
                        ? 'bg-white'
                        : 'bg-gray-50'
                    }`}
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-purple-100 text-sm font-bold text-purple-700">
                      {getEmployeeInitials(
                        employee.name,
                      )}
                    </div>

                    <div className="min-w-0">
                      <p className="truncate font-semibold text-black">
                        {employee.name}
                      </p>

                      <p className="mt-1 text-xs text-gray-500">
                        Employee
                      </p>
                    </div>
                  </div>

                  {weekDays.map((dateKey) => {
                    const key =
                      `${employee.id}-${dateKey}`;

                    const dayShifts =
                      shiftsByEmployeeAndDate.get(
                        key,
                      ) ?? [];

                    const isToday =
                      dateKey === todayDateKey;

                    return (
                      <div
                        key={dateKey}
                        className={`min-h-32 space-y-2 border-r border-gray-200 p-2 ${
                          isToday
                            ? 'bg-purple-50/40'
                            : employeeIndex %
                                  2 ===
                                0
                              ? 'bg-white'
                              : 'bg-gray-50/60'
                        }`}
                      >
                        {dayShifts.map(
                          (shift) => (
                            <article
                              key={shift.id}
                              title={
                                shift.notes ??
                                undefined
                              }
                              className={`rounded-lg border border-l-4 p-3 shadow-sm ${getRoleStyle(
                                shift.roleName,
                              )}`}
                            >
                              <p className="truncate text-sm font-semibold">
                                {
                                  shift.roleName
                                }
                              </p>

                              <p className="mt-2 whitespace-nowrap text-xs font-medium opacity-80">
                                {formatTime(
                                  shift.startTime,
                                )}{' '}
                                –{' '}
                                {formatTime(
                                  shift.endTime,
                                )}
                              </p>
                            </article>
                          ),
                        )}
                      </div>
                    );
                  })}
                </div>
              ),
            )}
          </div>
        </div>
      )}
    </section>
  );
}