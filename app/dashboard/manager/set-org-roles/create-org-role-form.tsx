'use client';

import { useActionState } from 'react';
import { createOrganizationRole } from '@/app/lib/roles/org-role-actions';

const initialState = {
  error: '',
  success: '',
};

export default function CreateOrgRoleForm() {
  const [state, formAction, isPending] = useActionState(
    createOrganizationRole,
    initialState,
  );

  return (
    <div className="rounded-xl border border-gray-300 bg-white p-6 shadow-sm">
      <h2 className="mb-1 text-xl font-semibold text-black">
        Add New Role
      </h2>

      <p className="mb-6 text-sm text-gray-500">
        Define a role employees can be scheduled under. Employees
        can be assigned to roles from the Manage Employees page.
      </p>

      <form action={formAction} className="flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <label htmlFor="name" className="text-sm font-medium text-black">
            Role
          </label>

          <input
            id="name"
            name="name"
            type="text"
            placeholder="Example: Shift Lead"
            className="h-10 rounded-md border border-gray-300 bg-white px-3 text-black outline-none focus:border-purple-500"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label
            htmlFor="description"
            className="text-sm font-medium text-black"
          >
            Description
          </label>

          <textarea
            id="description"
            name="description"
            placeholder="Example: Responsible for leading employees during a shift."
            rows={5}
            className="resize-none rounded-md border border-gray-300 bg-white px-3 py-2 text-black outline-none focus:border-purple-500"
          />
        </div>

        {state?.error && (
          <div className="rounded-md border border-red-300 bg-red-100 px-3 py-2">
            <p className="text-sm font-medium text-red-700">
              {state.error}
            </p>
          </div>
        )}

        {state?.success && (
          <div className="rounded-md border border-green-300 bg-green-100 px-3 py-2">
            <p className="text-sm font-medium text-green-700">
              {state.success}
            </p>
          </div>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-purple-500 px-4 py-2 font-medium text-white hover:bg-purple-600 disabled:cursor-not-allowed disabled:bg-purple-300"
        >
          {isPending ? 'Adding...' : 'Submit'}
        </button>
      </form>
    </div>
  );
}