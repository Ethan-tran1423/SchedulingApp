import ManageEmployeeRolesList from '@/app/ui/manage-employees/manage-employee-roles-list';
import { findEmployeeRoleAssignments } from '@/app/lib/repos/assign-role';
import { findOrganizationRoles } from '@/app/lib/repos/org-roles';
import { getEmployees } from '@/app/lib/repos/view-employees';
import { requireManager } from '@/app/lib/utils/auth/require-manager';

export default async function ManageEmployeesPage() {
  const manager = await requireManager();

  const [employees, roles, assignments] = await Promise.all([
    getEmployees(manager.organization_id),
    findOrganizationRoles(manager.organization_id),
    findEmployeeRoleAssignments(manager.organization_id),
  ]);

  const employeesWithRoles = employees.map((employee) => ({
    id: Number(employee.id),
    name: employee.name,
    email: employee.email,
    role: employee.role,
    organization: employee.organization,
    assignedRoleIds: assignments
      .filter((assignment) => {
        return Number(assignment.user_id) === Number(employee.id);
      })
      .map((assignment) => {
        return Number(assignment.organization_role_id);
      }),
  }));

  const roleOptions = roles.map((role) => ({
    id: Number(role.id),
    name: role.name,
    description: role.description,
  }));

  return (
    <section>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-black">
          Manage Employees
        </h1>

        <p className="mt-2 text-gray-600">
          View employees in your organization and assign the roles
          they are eligible to work.
        </p>
      </div>

      <ManageEmployeeRolesList
        employees={employeesWithRoles}
        roles={roleOptions}
      />
    </section>
  );
}