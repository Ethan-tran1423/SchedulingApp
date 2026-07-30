// this file will keep direct postgres query operations inside app/lib/repos 

import 'server-only';

import { sql } from '@/app/lib/db';

export const TIME_OFF_REQUEST_TYPES = [
  'vacation',
  'sick',
  'personal',
  'unpaid',
  'other',
] as const;

export const TIME_OFF_REQUEST_STATUSES = [
  'pending',
  'approved',
  'denied',
  'cancelled',
] as const;

export type TimeOffRequestType =
  (typeof TIME_OFF_REQUEST_TYPES)[number];

export type TimeOffRequestStatus =
  (typeof TIME_OFF_REQUEST_STATUSES)[number];

export type TimeOffRequestRow = {
  id: number;
  user_id: number;
  organization_id: number;
  request_type: TimeOffRequestType;
  start_date: Date;
  end_date: Date;
  employee_note: string | null;
  status: TimeOffRequestStatus;
  reviewed_by_user_id: number | null;
  manager_note: string | null;
  reviewed_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

export type OrganizationTimeOffRequestRow =
  TimeOffRequestRow & {
    employee_name: string;
    employee_email: string;
    reviewer_name: string | null;
  };

export async function createTimeOffRequest({
  userId,
  organizationId,
  requestType,
  startDate,
  endDate,
  employeeNote,
}: {
  userId: number;
  organizationId: number;
  requestType: TimeOffRequestType;
  startDate: string;
  endDate: string;
  employeeNote: string | null;
}): Promise<TimeOffRequestRow> {
  const result = await sql<TimeOffRequestRow[]>`
    INSERT INTO time_off_requests (
      user_id,
      organization_id,
      request_type,
      start_date,
      end_date,
      employee_note
    )
    VALUES (
      ${userId},
      ${organizationId},
      ${requestType},
      ${startDate},
      ${endDate},
      ${employeeNote}
    )
    RETURNING
      id,
      user_id,
      organization_id,
      request_type,
      start_date,
      end_date,
      employee_note,
      status,
      reviewed_by_user_id,
      manager_note,
      reviewed_at,
      created_at,
      updated_at;
  `;

  const request = result[0];

  if (!request) {
    throw new Error('Failed to create time-off request.');
  }

  return request;
}

export async function findTimeOffRequestsForEmployee(
  userId: number,
): Promise<TimeOffRequestRow[]> {
  return sql<TimeOffRequestRow[]>`
    SELECT
      id,
      user_id,
      organization_id,
      request_type,
      start_date,
      end_date,
      employee_note,
      status,
      reviewed_by_user_id,
      manager_note,
      reviewed_at,
      created_at,
      updated_at
    FROM time_off_requests
    WHERE user_id = ${userId}
    ORDER BY
      created_at DESC,
      start_date DESC;
  `;
}

export async function findOverlappingTimeOffRequest({
  userId,
  startDate,
  endDate,
}: {
  userId: number;
  startDate: string;
  endDate: string;
}): Promise<TimeOffRequestRow | undefined> {
  const result = await sql<TimeOffRequestRow[]>`
    SELECT
      id,
      user_id,
      organization_id,
      request_type,
      start_date,
      end_date,
      employee_note,
      status,
      reviewed_by_user_id,
      manager_note,
      reviewed_at,
      created_at,
      updated_at
    FROM time_off_requests
    WHERE user_id = ${userId}
      AND status IN ('pending', 'approved')
      AND start_date <= ${endDate}
      AND end_date >= ${startDate}
    ORDER BY created_at DESC
    LIMIT 1;
  `;

  return result[0];
}

export async function cancelPendingTimeOffRequest({
  requestId,
  userId,
  organizationId,
}: {
  requestId: number;
  userId: number;
  organizationId: number;
}): Promise<TimeOffRequestRow | undefined> {
  const result = await sql<TimeOffRequestRow[]>`
    UPDATE time_off_requests
    SET
      status = 'cancelled',
      updated_at = NOW()
    WHERE id = ${requestId}
      AND user_id = ${userId}
      AND organization_id = ${organizationId}
      AND status = 'pending'
    RETURNING
      id,
      user_id,
      organization_id,
      request_type,
      start_date,
      end_date,
      employee_note,
      status,
      reviewed_by_user_id,
      manager_note,
      reviewed_at,
      created_at,
      updated_at;
  `;

  return result[0];
}

export async function findTimeOffRequestsForOrganization(
  organizationId: number,
): Promise<OrganizationTimeOffRequestRow[]> {
  return sql<OrganizationTimeOffRequestRow[]>`
    SELECT
      time_off_requests.id,
      time_off_requests.user_id,
      time_off_requests.organization_id,
      time_off_requests.request_type,
      time_off_requests.start_date,
      time_off_requests.end_date,
      time_off_requests.employee_note,
      time_off_requests.status,
      time_off_requests.reviewed_by_user_id,
      time_off_requests.manager_note,
      time_off_requests.reviewed_at,
      time_off_requests.created_at,
      time_off_requests.updated_at,
      employees.name AS employee_name,
      employees.email AS employee_email,
      reviewers.name AS reviewer_name
    FROM time_off_requests
    INNER JOIN users AS employees
      ON employees.id = time_off_requests.user_id
    LEFT JOIN users AS reviewers
      ON reviewers.id = time_off_requests.reviewed_by_user_id
    WHERE time_off_requests.organization_id = ${organizationId}
    ORDER BY
      CASE
        WHEN time_off_requests.status = 'pending' THEN 0
        ELSE 1
      END,
      time_off_requests.created_at DESC;
  `;
}