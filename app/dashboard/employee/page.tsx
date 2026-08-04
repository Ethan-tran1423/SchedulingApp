import { requireEmployee } from '@/app/lib/utils/auth/require-employee';


export default async function EmployeeDashboardPage() {
  const employee = await requireEmployee();

  return (
    <section>
      <div className="mb-8 flex justify-start">
        
      </div>

      <h1 className="text-3xl font-bold text-black">
        Employee Dashboard
      </h1>

      <p className="mt-2 text-gray-600">
        Welcome back.
      </p>
    </section>
  );
}