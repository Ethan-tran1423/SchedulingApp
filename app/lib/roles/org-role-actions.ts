'use server';

import { revalidatePath } from 'next/cache';
import {
  createOrganizationRoleRecord,
  deleteOrganizationRoleRecord,
  findOrganizationRoleByName,
} from '@/app/lib/repos/org-roles';
import { requireManager } from '@/app/lib/utils/auth/require-manager';
import { isValidOrganizationRoleName } from '@/app/lib/utils/validation';
import {
  assignEmployeeToRole,
  replaceEmployeeRoleAssignments,
} from '@/app/lib/repos/assign-role';

export type RoleActionState = {
  error?: string;
  success?: string;
};

function parsePositiveInteger(value: FormDataEntryValue | null) {
  if (typeof value !== 'string') {
    return null;
  }

  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    return null;
  }

  return parsedValue;
}

export async function createOrganizationRole(
  _previousState: RoleActionState,
  formData: FormData,
): Promise<RoleActionState> {
  const manager = await requireManager();

  const name = formData.get('name')?.toString().trim();
  const description = formData.get('description')?.toString().trim();

  if (!isValidOrganizationRoleName(name)) {
    return {
      error: 'Role name is required.',
    };
  }

  const existingRole = await findOrganizationRoleByName(
    manager.organization_id,
    name,
  );

  if (existingRole) {
    return {
      error: 'That role already exists.',
    };
  }

  await createOrganizationRoleRecord(
    manager.organization_id,
    name,
    description,
  );

  revalidatePath('/dashboard/manager/set-org-roles');
  revalidatePath('/dashboard/manager/manage-employees');

  return {
    success: 'Role added successfully.',
  };
}

export async function deleteOrganizationRole(formData: FormData) {
  const manager = await requireManager();
  const roleId = Number(formData.get('roleId'));

  if (!Number.isInteger(roleId) || roleId <= 0) {
    throw new Error('A valid role id is required.');
  }

  const deleted = await deleteOrganizationRoleRecord(
    manager.organization_id,
    roleId,
  );

  if (!deleted) {
    throw new Error(
      'The role was not found or does not belong to your organization.',
    );
  }

  revalidatePath('/dashboard/manager/set-org-roles');
  revalidatePath('/dashboard/manager/manage-employees');
}

export async function assignEmployeeRole(formData: FormData) {
  const manager = await requireManager();

  const employeeId = Number(formData.get('employeeId'));
  const roleId = Number(formData.get('roleId'));

  if (!Number.isInteger(employeeId) || employeeId <= 0) {
    throw new Error('A valid employee id is required.');
  }

  if (!Number.isInteger(roleId) || roleId <= 0) {
    throw new Error('A valid role id is required.');
  }

  await assignEmployeeToRole(
    manager.organization_id,
    employeeId,
    roleId,
  );

  revalidatePath('/dashboard/manager/set-org-roles');
  revalidatePath('/dashboard/manager/manage-employees');
}

export async function saveEmployeeRoleAssignments(
  _previousState: RoleActionState,
  formData: FormData,
): Promise<RoleActionState> {
  const manager = await requireManager();

  const userId = parsePositiveInteger(formData.get('userId'));

  if (!userId) {
    return {
      error: 'A valid employee is required.',
    };
  }

  const roleIds = Array.from(
    new Set(
      formData
        .getAll('roleIds')
        .map((value) => parsePositiveInteger(value))
        .filter((value): value is number => value !== null),
    ),
  );

  try {
    await replaceEmployeeRoleAssignments({
      organizationId: manager.organization_id,
      userId,
      roleIds,
    });
  } catch (error) {
    console.error('Failed to save employee roles:', error);

    return {
      error: 'Unable to save employee roles.',
    };
  }

  revalidatePath('/dashboard/manager/manage-employees');
  revalidatePath('/dashboard/manager/set-org-roles');

  return {
    success: 'Employee roles saved.',
  };
}