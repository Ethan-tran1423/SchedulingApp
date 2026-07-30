'use client';

import { useActionState, useRef } from 'react';
import {
  submitTimeOffRequestAction,
  type TimeOffRequestActionState,
} from '@/app/lib/time-off/employee-time-off-actions';

const initialState: TimeOffRequestActionState = {
  error: '',
  success: '',
  fieldErrors: {},
};

function getTodayDateKey() {
  const today = new Date();

  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export default function TimeOffRequestForm() {
  const formRef = useRef<HTMLFormElement>(null);

  const [state, formAction, isPending] = useActionState(
    async (
      previousState: TimeOffRequestActionState,
      formData: FormData,
    ) => {
      const result = await submitTimeOffRequestAction(
        previousState,
        formData,
      );

      if (result.success) {
        formRef.current?.reset();
      }

      return result;
    },
    initialState,
  );

  const today = getTodayDateKey();

  return (
    <form
      ref={formRef}
      action={formAction}
      className="rounded-xl border border-gray-300 bg-white p-6 shadow-sm"
    >
      <div className="mb-6">
        <h2 className="text-xl font-bold text-black">
          New Request
        </h2>

        <p className="mt-1 text-sm text-gray-600">
          Submit the dates you need away from work. Your manager
          will review the request.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="md:col-span-2">
          <label
            htmlFor="requestType"
            className="mb-2 block text-sm font-semibold text-gray-800"
          >
            Request type
          </label>

          <select
            id="requestType"
            name="requestType"
            defaultValue=""
            aria-describedby={
              state.fieldErrors?.requestType
                ? 'request-type-error'
                : undefined
            }
            className="h-11 w-full rounded-md border border-gray-300 bg-white px-3 text-black outline-none focus:border-purple-500"
          >
            <option value="" disabled>
              Select a request type
            </option>

            <option value="vacation">Vacation</option>
            <option value="sick">Sick leave</option>
            <option value="personal">Personal</option>
            <option value="unpaid">Unpaid time off</option>
            <option value="other">Other</option>
          </select>

          {state.fieldErrors?.requestType && (
            <p
              id="request-type-error"
              className="mt-1 text-sm font-medium text-red-600"
            >
              {state.fieldErrors.requestType}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="startDate"
            className="mb-2 block text-sm font-semibold text-gray-800"
          >
            Start date
          </label>

          <input
            id="startDate"
            name="startDate"
            type="date"
            min={today}
            aria-describedby={
              state.fieldErrors?.startDate
                ? 'start-date-error'
                : undefined
            }
            className="h-11 w-full rounded-md border border-gray-300 bg-white px-3 text-black outline-none focus:border-purple-500"
          />

          {state.fieldErrors?.startDate && (
            <p
              id="start-date-error"
              className="mt-1 text-sm font-medium text-red-600"
            >
              {state.fieldErrors.startDate}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="endDate"
            className="mb-2 block text-sm font-semibold text-gray-800"
          >
            End date
          </label>

          <input
            id="endDate"
            name="endDate"
            type="date"
            min={today}
            aria-describedby={
              state.fieldErrors?.endDate
                ? 'end-date-error'
                : undefined
            }
            className="h-11 w-full rounded-md border border-gray-300 bg-white px-3 text-black outline-none focus:border-purple-500"
          />

          {state.fieldErrors?.endDate && (
            <p
              id="end-date-error"
              className="mt-1 text-sm font-medium text-red-600"
            >
              {state.fieldErrors.endDate}
            </p>
          )}
        </div>

        <div className="md:col-span-2">
          <div className="mb-2 flex items-center justify-between gap-3">
            <label
              htmlFor="employeeNote"
              className="text-sm font-semibold text-gray-800"
            >
              Note
            </label>

            <span className="text-xs text-gray-500">
              Optional · 500 characters maximum
            </span>
          </div>

          <textarea
            id="employeeNote"
            name="employeeNote"
            rows={4}
            maxLength={500}
            placeholder="Add any details your manager should know."
            aria-describedby={
              state.fieldErrors?.employeeNote
                ? 'employee-note-error'
                : undefined
            }
            className="w-full resize-y rounded-md border border-gray-300 bg-white px-3 py-2 text-black outline-none focus:border-purple-500"
          />

          {state.fieldErrors?.employeeNote && (
            <p
              id="employee-note-error"
              className="mt-1 text-sm font-medium text-red-600"
            >
              {state.fieldErrors.employeeNote}
            </p>
          )}
        </div>
      </div>

      {state.error && (
        <div
          role="alert"
          className="mt-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
        >
          {state.error}
        </div>
      )}

      {state.success && (
        <div
          role="status"
          className="mt-5 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700"
        >
          {state.success}
        </div>
      )}

      <div className="mt-6 flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-purple-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-purple-600 disabled:cursor-not-allowed disabled:bg-purple-300"
        >
          {isPending ? 'Submitting...' : 'Submit Request'}
        </button>
      </div>
    </form>
  );
}