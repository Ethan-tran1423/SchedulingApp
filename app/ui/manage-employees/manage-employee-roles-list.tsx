'use client';

import { useActionState } from 'react';
import {
  saveEmployeeRoleAssignments,
  type RoleActionState,
} from '@/app/lib/roles/org-role-actions';

type EmployeeViewModel = {
  id: number;
  name: string;
  email: string;
  role: string;
  organization: string;
  assignedRoleIds: number[];
};

type RoleViewModel = {
  id: number;
  name: string;
  description: string | null;
};

type ManageEmployeeRolesListProps = {
  employees: EmployeeViewModel[];
  roles: RoleViewModel[];
};

const initialState: RoleActionState = {
  error: '',
  success: '',
};

function EmployeeRoleDropdown({
  employee,
  roles,
}: {
  employee: EmployeeViewModel;
  roles: RoleViewModel[];
}) {
  const [state, formAction, isPending] = useActionState(
    saveEmployeeRoleAssignments,
    initialState,
  );

  return (
    <details className="group">
      <summary className="cursor-pointer list-none rounded-md bg-purple-500 px-3 py-2 text-center text-sm font-semibold text-white hover:bg-purple-600">
        View Roles
      </summary>

      <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-4 shadow-sm">
        <form action={formAction}>
          <input
            type="hidden"
            name="userId"
            value={employee.id}
          />

          {roles.length === 0 ? (
            <p className="text-sm text-gray-500">
              No organization roles have been created yet.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {roles.map((role) => (
                <label
                  key={role.id}
                  className="flex items-start gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
                  title={role.description ?? undefined}
                >
                  <input
                    type="checkbox"
                    name="roleIds"
                    value={role.id}
                    defaultChecked={employee.assignedRoleIds.includes(
                      role.id,
                    )}
                    className="mt-0.5 h-4 w-4"
                  />

                  <span>
                    <span className="font-medium text-black">
                      {role.name}
                    </span>

                    {role.description && (
                      <span className="block text-xs text-gray-500">
                        {role.description}
                      </span>
                    )}
                  </span>
                </label>
              ))}
            </div>
          )}

          {state?.error && (
            <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              {state.error}
            </p>
          )}

          {state?.success && (
            <p className="mt-3 rounded-md bg-green-50 px-3 py-2 text-sm font-medium text-green-700">
              {state.success}
            </p>
          )}

          <button
            type="submit"
            disabled={isPending || roles.length === 0}
            className="mt-4 rounded-md bg-purple-500 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-600 disabled:cursor-not-allowed disabled:bg-purple-300"
          >
            {isPending ? 'Saving...' : 'Save Roles'}
          </button>
        </form>
      </div>
    </details>
  );
}

export default function ManageEmployeeRolesList({
  employees,
  roles,
}: ManageEmployeeRolesListProps) {
  return (
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
              Account Type
            </th>

            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
              Organization
            </th>

            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
              Roles
            </th>
          </tr>
        </thead>

        <tbody>
          {employees.map((employee) => (
            <tr
              key={employee.id}
              className="border-t border-gray-200 align-top"
            >
              <td className="px-6 py-4 text-sm font-medium text-gray-700">
                {employee.name}
              </td>

              <td className="px-6 py-4 text-sm text-gray-700">
                {employee.email}
              </td>

              <td className="px-6 py-4 text-sm capitalize text-gray-700">
                {employee.role}
              </td>

              <td className="px-6 py-4 text-sm text-gray-700">
                {employee.organization}
              </td>

              <td className="w-72 px-6 py-4 text-sm text-gray-700">
                <EmployeeRoleDropdown
                  employee={employee}
                  roles={roles}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {employees.length === 0 && (
        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-center">
          <p className="text-sm text-gray-500">
            No employees were found in this organization.
          </p>
        </div>
      )}
    </div>
  );
}