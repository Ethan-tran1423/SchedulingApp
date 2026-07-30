// app/dashboard/employee/request-time-off/page.tsx

import { requireEmployee } from '@/app/lib/utils/auth/require-employee';
import { findTimeOffRequestsForEmployee } from '@/app/lib/repos/time-off-requests';
import TimeOffRequestForm from '@/app/ui/time-off/time-off-request-form';
import TimeOffRequestList from '@/app/ui/time-off/time-off-request-list';

export default async function RequestTimeOffPage() {
  const employee = await requireEmployee();

  const requests = await findTimeOffRequestsForEmployee(
    employee.id,
  );

  return (
    <section className="mx-auto w-full max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-black">
          Request Time Off
        </h1>

        <p className="mt-2 text-gray-600">
          Submit a request and track its approval status.
        </p>
      </div>

      <div className="grid gap-8">
        <TimeOffRequestForm />
        <TimeOffRequestList requests={requests} />
      </div>
    </section>
  );
}