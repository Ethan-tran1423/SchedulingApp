//'use client';

import { requireEmployee } from "@/app/lib/utils/auth/require-employee";
import {getEmployees} from '@/app/lib/repos/view-employees';



export default async function ViewEmployeesPage() {

  const employee = await requireEmployee();

  const employees = await getEmployees(employee.organization_id);

  return (
    <section>
        <div className="mb-8">
      <h1 className="text-3xl font-bold text-black">View Employees</h1>
        <p className="mt-2 text-gray-600">
            View the employees in your organization.
        </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_420px]"> </div>
            <div className="rounded-xl border border-gray-300 bg-white p-6 shadow-sm">
                <table className="min-w-full">
                    <thead className="bg-gray-100">
                        <tr>
                          <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                            Name
                          </th>

                          <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                            Email
                          </th>

                          <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                            Role
                          </th>

                          <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                            Organization
                          </th>
                        </tr>
                    </thead>

                      <tbody>
                        {employees.map((employee) => (
                          <tr
                            key={employee.email}
                            className="border-t border-gray-200"
                          >
                            <td className="px-6 py-4 text-sm text-gray-700">{employee.name}</td>

                            <td className="px-6 py-4 text-sm text-gray-700">{employee.email}</td>

                            <td className="px-6 py-4 text-sm text-gray-700">{employee.role}</td>

                            <td className="px-6 py-4 text-sm text-gray-700">{employee.organization}</td>
                          </tr>
                        ))}
                      </tbody>
                </table>
          </div>
      </section>
  );
}