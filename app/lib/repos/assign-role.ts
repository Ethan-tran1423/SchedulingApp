import { sql } from '@/app/lib/db';

export type AssignEmployeeToRoleResult =
  | {
      success: true;
      status: 'assigned';
    }
  | {
      success: false;
      status: 'already-assigned' | 'invalid-selection';
    };

export type EmployeeRoleAssignmentRow = {
  user_id: number;
  organization_role_id: number;
};

/**
 * Assigns an employee to an organization role.
 *
 * The query verifies that:
 * - The user exists.
 * - The user is an employee.
 * - The employee belongs to the manager's organization.
 * - The organization role belongs to the manager's organization.
 * - The assignment does not already exist.
 */
export async function assignEmployeeToRole(
  organizationId: number,
  userId: number,
  organizationRoleId: number,
): Promise<AssignEmployeeToRoleResult> {
  const result = await sql<
    {
      is_valid: boolean;
      was_inserted: boolean;
    }[]
  >`
    WITH valid_assignment AS (
      SELECT
        employee.id AS user_id,
        organization_role.id AS organization_role_id
      FROM users employee
      JOIN organization_roles organization_role
        ON organization_role.id = ${organizationRoleId}
      WHERE employee.id = ${userId}
        AND employee.role = 'employee'
        AND employee.organization_id = ${organizationId}
        AND organization_role.organization_id = ${organizationId}
    ),
    inserted_assignment AS (
      INSERT INTO user_organization_roles (
        user_id,
        organization_role_id
      )
      SELECT
        user_id,
        organization_role_id
      FROM valid_assignment
      ON CONFLICT (
        user_id,
        organization_role_id
      )
      DO NOTHING
      RETURNING user_id
    )
    SELECT
      EXISTS (
        SELECT 1
        FROM valid_assignment
      ) AS is_valid,
      EXISTS (
        SELECT 1
        FROM inserted_assignment
      ) AS was_inserted;
  `;

  const assignmentResult = result[0];

  if (!assignmentResult?.is_valid) {
    return {
      success: false,
      status: 'invalid-selection',
    };
  }

  if (!assignmentResult.was_inserted) {
    return {
      success: false,
      status: 'already-assigned',
    };
  }

  return {
    success: true,
    status: 'assigned',
  };
}

export async function findEmployeeRoleAssignments(
  organizationId: number,
): Promise<EmployeeRoleAssignmentRow[]> {
  const result = await sql<EmployeeRoleAssignmentRow[]>`
    SELECT
      user_organization_roles.user_id,
      user_organization_roles.organization_role_id
    FROM user_organization_roles
    JOIN users
      ON users.id = user_organization_roles.user_id
    JOIN organization_roles
      ON organization_roles.id =
        user_organization_roles.organization_role_id
    WHERE users.organization_id = ${organizationId}
      AND users.role = 'employee'
      AND organization_roles.organization_id = ${organizationId}
    ORDER BY
      users.name ASC,
      organization_roles.name ASC;
  `;

  return result;
}

export async function replaceEmployeeRoleAssignments({
  organizationId,
  userId,
  roleIds,
}: {
  organizationId: number;
  userId: number;
  roleIds: number[];
}): Promise<void> {
  await sql.begin(async (transaction) => {
    const employeeRows = await transaction<{ id: number }[]>`
      SELECT id
      FROM users
      WHERE id = ${userId}
        AND organization_id = ${organizationId}
        AND role = 'employee'
      LIMIT 1;
    `;

    if (!employeeRows[0]) {
      throw new Error('Employee not found in this organization.');
    }

    await transaction`
      DELETE FROM user_organization_roles
      USING organization_roles
      WHERE user_organization_roles.organization_role_id =
        organization_roles.id
        AND user_organization_roles.user_id = ${userId}
        AND organization_roles.organization_id = ${organizationId};
    `;

    for (const roleId of roleIds) {
      const insertedRows = await transaction<{ user_id: number }[]>`
        INSERT INTO user_organization_roles (
          user_id,
          organization_role_id
        )
        SELECT
          ${userId},
          organization_roles.id
        FROM organization_roles
        WHERE organization_roles.id = ${roleId}
          AND organization_roles.organization_id = ${organizationId}
        ON CONFLICT (
          user_id,
          organization_role_id
        )
        DO NOTHING
        RETURNING user_id;
      `;

      if (!insertedRows[0]) {
        throw new Error(
          'One of the selected roles was not found in this organization.',
        );
      }
    }
  });
}