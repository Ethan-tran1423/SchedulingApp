'use client';

import { useState } from 'react';
import {
  type TimeOffRequestRow,
  type TimeOffRequestStatus,
  type TimeOffRequestType,
} from '@/app/lib/repos/time-off-requests';
import { cancelTimeOffRequestAction } from '@/app/lib/time-off/employee-time-off-actions';

type TimeOffRequestListProps = {
  requests: TimeOffRequestRow[];
};

const REQUEST_TYPE_LABELS: Record<
  TimeOffRequestType,
  string
> = {
  vacation: 'Vacation',
  sick: 'Sick leave',
  personal: 'Personal',
  unpaid: 'Unpaid time off',
  other: 'Other',
};

const STATUS_LABELS: Record<
  TimeOffRequestStatus,
  string
> = {
  pending: 'Pending',
  approved: 'Approved',
  denied: 'Denied',
  cancelled: 'Cancelled',
};

const STATUS_CLASSES: Record<
  TimeOffRequestStatus,
  string
> = {
  pending:
    'border-yellow-200 bg-yellow-50 text-yellow-800',
  approved:
    'border-green-200 bg-green-50 text-green-700',
  denied:
    'border-red-200 bg-red-50 text-red-700',
  cancelled:
    'border-gray-200 bg-gray-100 text-gray-600',
};

function getDateKey(value: Date | string) {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return value;
}

function formatDate(value: Date | string) {
  const dateKey = getDateKey(value);

  const [year, month, day] = dateKey
    .split('-')
    .map(Number);

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(year, month - 1, day));
}

function formatDateRange(
  startDate: Date | string,
  endDate: Date | string,
) {
  if (getDateKey(startDate) === getDateKey(endDate)) {
    return formatDate(startDate);
  }

  return `${formatDate(startDate)} – ${formatDate(endDate)}`;
}

function formatCreatedAt(value: Date | string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}

export default function TimeOffRequestList({
  requests,
}: TimeOffRequestListProps) {
  const [hideCancelled, setHideCancelled] = useState(false);

  const visibleRequests = hideCancelled
    ? requests.filter(
        (request) => request.status !== 'cancelled',
      )
    : requests;

  return (
    <section className="rounded-xl border border-gray-300 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-gray-200 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-black">
            Request History
          </h2>

          <p className="mt-1 text-sm text-gray-600">
            Review the status of your submitted requests.
          </p>
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-gray-700">
          <input
            type="checkbox"
            checked={hideCancelled}
            onChange={(event) =>
              setHideCancelled(event.target.checked)
            }
            className="h-4 w-4 accent-purple-500"
          />

          Hide cancelled requests
        </label>
      </div>

      {visibleRequests.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <p className="font-medium text-gray-700">
            {hideCancelled && requests.length > 0
              ? 'No active requests to display.'
              : 'You have not submitted any time-off requests.'}
          </p>

          <p className="mt-1 text-sm text-gray-500">
            {hideCancelled && requests.length > 0
              ? 'Turn off the filter to view cancelled requests.'
              : 'New requests will appear here after submission.'}
          </p>
        </div>
      ) : (
        <div className="max-h-[500px] overflow-auto">
          <table className="w-full min-w-[800px] text-left">
            <thead className="sticky top-0 z-10 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-6 py-3 font-semibold">
                  Dates
                </th>

                <th className="px-6 py-3 font-semibold">
                  Type
                </th>

                <th className="px-6 py-3 font-semibold">
                  Note
                </th>

                <th className="px-6 py-3 font-semibold">
                  Submitted
                </th>

                <th className="px-6 py-3 font-semibold">
                  Status
                </th>

                <th className="px-6 py-3 text-right font-semibold">
                  Action
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-200">
              {visibleRequests.map((request) => (
                <tr
                  key={request.id}
                  className="align-top text-sm text-gray-700"
                >
                  <td className="whitespace-nowrap px-6 py-4 font-medium text-black">
                    {formatDateRange(
                      request.start_date,
                      request.end_date,
                    )}
                  </td>

                  <td className="whitespace-nowrap px-6 py-4">
                    {
                      REQUEST_TYPE_LABELS[
                        request.request_type
                      ]
                    }
                  </td>

                  <td className="max-w-xs px-6 py-4">
                    <p className="line-clamp-3">
                      {request.employee_note || '—'}
                    </p>

                    {request.manager_note && (
                      <div className="mt-2 rounded-md bg-gray-50 p-2">
                        <p className="text-xs font-semibold uppercase text-gray-500">
                          Manager response
                        </p>

                        <p className="mt-1 text-sm text-gray-700">
                          {request.manager_note}
                        </p>
                      </div>
                    )}
                  </td>

                  <td className="whitespace-nowrap px-6 py-4">
                    {formatCreatedAt(request.created_at)}
                  </td>

                  <td className="whitespace-nowrap px-6 py-4">
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${
                        STATUS_CLASSES[request.status]
                      }`}
                    >
                      {STATUS_LABELS[request.status]}
                    </span>
                  </td>

                  <td className="whitespace-nowrap px-6 py-4 text-right">
                    {request.status === 'pending' ? (
                      <form
                        action={cancelTimeOffRequestAction}
                      >
                        <input
                          type="hidden"
                          name="requestId"
                          value={request.id}
                        />

                        <button
                          type="submit"
                          className="rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50"
                        >
                          Cancel
                        </button>
                      </form>
                    ) : (
                      <span className="text-gray-400">
                        —
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}