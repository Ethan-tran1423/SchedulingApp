import WeeklyAvailabilityForm from '@/app/ui/availability/weekly-availability-form';
import { requireRoleFromCookie } from '@/app/lib/utils/cookie';
import { findWeeklyAvailability } from '@/app/lib/repos/employee-availability';
import { findEmployeeSchedulingPreference } from '@/app/lib/repos/employee-scheduling-preferences';

function formatPreferredWeeklyHours(
  value: string | null | undefined,
): string {
  if (!value) {
    return '';
  }

  return Number(value).toFixed(1);
}

function formatTimeForInput(time: string) {
  return time.slice(0, 5);
}

export default async function SetPreferredAvailabilityPage() {
  const employee = await requireRoleFromCookie('employee');

  const [preference, savedAvailability] = await Promise.all([
    findEmployeeSchedulingPreference(employee.id),
    findWeeklyAvailability(employee.id),
  ]);

  const initialAvailability = savedAvailability.map((window) => ({
    id: window.id,
    dayOfWeek: window.day_of_week,
    startTime: formatTimeForInput(String(window.start_time)),
    endTime: formatTimeForInput(String(window.end_time)),
  }));

  return (
    <section>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-black">
          Set Preferred Availability
        </h1>

        <p className="mt-2 text-gray-600">
          Set the days and times you are usually available to work.
        </p>
      </div>

      <WeeklyAvailabilityForm
        initialAvailability={initialAvailability}
        initialPreferredWeeklyHours={formatPreferredWeeklyHours(
          preference?.preferred_weekly_hours,
        )}
      />
    </section>
  );
}