import { sql } from '@/app/lib/db';

export type UserProfileRow = {
  id: number;
  name: string;
  email: string;
  phone_number: string | null;
  role: string;
  organization_id: number;
  organization_name: string;
  created_at: Date;
};

export type EligibleRoleRow = {
  id: number;
  name: string;
  description: string | null;
};

export async function findUserProfileById(
  userId: number,
): Promise<UserProfileRow | undefined> {
  const result = await sql<UserProfileRow[]>`
    SELECT
      users.id,
      users.name,
      users.email,
      users.phone_number,
      users.role,
      users.organization_id,
      organizations.name AS organization_name,
      users.created_at
    FROM users
    JOIN organizations
      ON organizations.id = users.organization_id
    WHERE users.id = ${userId}
    LIMIT 1;
  `;

  return result[0];
}

export async function findUserEligibleRoles(
  userId: number,
): Promise<EligibleRoleRow[]> {
  const result = await sql<EligibleRoleRow[]>`
    SELECT
      organization_roles.id,
      organization_roles.name,
      organization_roles.description
    FROM user_organization_roles
    JOIN organization_roles
      ON organization_roles.id =
        user_organization_roles.organization_role_id
    JOIN users
      ON users.id = user_organization_roles.user_id
    WHERE user_organization_roles.user_id = ${userId}
      AND organization_roles.organization_id =
        users.organization_id
    ORDER BY organization_roles.name ASC;
  `;

  return result;
}

export async function updateUserProfile({
  userId,
  name,
  email,
  phoneNumber,
}: {
  userId: number;
  name: string;
  email: string;
  phoneNumber: string | null;
}): Promise<UserProfileRow> {
  const result = await sql<UserProfileRow[]>`
    UPDATE users
    SET
      name = ${name},
      email = ${email},
      phone_number = ${phoneNumber}
    WHERE id = ${userId}
    RETURNING
      id,
      name,
      email,
      phone_number,
      role,
      organization_id,
      (
        SELECT organizations.name
        FROM organizations
        WHERE organizations.id = users.organization_id
      ) AS organization_name,
      created_at;
  `;

  const updatedProfile = result[0];

  if (!updatedProfile) {
    throw new Error('Failed to update profile.');
  }

  return updatedProfile;
}