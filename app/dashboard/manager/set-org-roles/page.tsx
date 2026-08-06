import { findOrganizationRoles } from '@/app/lib/repos/org-roles';
import { requireManager } from '@/app/lib/utils/auth/require-manager';
import { deleteOrganizationRole } from '@/app/lib/roles/org-role-actions';
import CreateOrgRoleForm from './create-org-role-form';

export default async function SetOrgRolesPage() {
  const manager = await requireManager();

  const roles = await findOrganizationRoles(manager.organization_id);

  return (
    <section>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-black">
          Set Org Roles
        </h1>

        <p className="mt-2 text-gray-600">
          Create the roles employees can be assigned to in your organization.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_420px]">
        <div className="rounded-xl border border-gray-300 bg-white p-6 shadow-sm">
          <h2 className="mb-1 text-xl font-semibold text-black">
            Current Roles
          </h2>

          <p className="mb-6 text-sm text-gray-500">
            These are the roles currently available for your organization.
          </p>

          {roles.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-center">
              <p className="text-sm text-gray-500">
                No roles have been added yet.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {roles.map((role) => (
                <div
                  key={role.id}
                  className="flex items-start justify-between gap-4 rounded-lg border border-gray-200 bg-gray-50 p-4"
                >
                  <div>
                    <h3 className="font-semibold text-black">
                      {role.name}
                    </h3>

                    <p className="mt-1 text-sm text-gray-600">
                      {role.description || 'No description added.'}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <p className="text-sm font-medium text-black">
                      Assigned Employees:
                    </p>

                    {role.employees.length === 0 ? (
                      <p className="text-sm text-gray-500">
                        No employees assigned.
                      </p>
                    ) : (
                      <ul className="text-sm text-gray-500">
                        {role.employees.map((employee) => (
                          <li key={employee.id}>{employee.name}</li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <form action={deleteOrganizationRole}>
                    <input
                      type="hidden"
                      name="roleId"
                      value={role.id}
                    />

                    <button
                      type="submit"
                      className="rounded-md px-3 py-1 text-sm text-red-500 hover:bg-red-100"
                    >
                      Delete
                    </button>
                  </form>
                </div>
              ))}
            </div>
          )}
        </div>

        <CreateOrgRoleForm />
      </div>
    </section>
  );
}