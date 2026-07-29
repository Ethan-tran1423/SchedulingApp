'use client';

import { useActionState } from 'react';
import {
  saveProfile,
  type ProfileActionState,
} from '@/app/lib/profile/profile-actions';

type ProfileRole = {
  id: number;
  name: string;
  description: string | null;
};

type ProfileFormProps = {
  profile: {
    name: string;
    email: string;
    phoneNumber: string;
    accountRole: string;
    organizationName: string;
  };
  eligibleRoles: ProfileRole[];
};

const initialActionState: ProfileActionState = {
  error: '',
  success: '',
};

function formatAccountRole(role: string) {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

export default function ProfileForm({
  profile,
  eligibleRoles,
}: ProfileFormProps) {
  const [state, formAction, isPending] = useActionState(
    saveProfile,
    initialActionState,
  );

  return (
    <form action={formAction} className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-purple-500 text-3xl font-bold text-white">
              {profile.name
                ? profile.name.charAt(0).toUpperCase()
                : 'P'}
            </div>

            <div>
              <h2 className="text-2xl font-bold text-black">
                My Profile
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Manage your personal account information.
              </p>

              <p className="mt-2 text-sm font-medium text-gray-700">
                {formatAccountRole(profile.accountRole)} ·{' '}
                {profile.organizationName}
              </p>
            </div>
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="rounded-md bg-purple-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-purple-600 disabled:cursor-not-allowed disabled:bg-purple-300"
          >
            {isPending ? 'Saving...' : 'Save Changes'}
          </button>
        </div>

        {state?.error && (
          <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            {state.error}
          </p>
        )}

        {state?.success && (
          <p className="mt-4 rounded-md bg-green-50 px-3 py-2 text-sm font-medium text-green-700">
            {state.success}
          </p>
        )}
      </div>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-black">
              Personal Information
            </h3>

            <p className="mt-1 text-sm text-gray-500">
              Update your name, email, and phone number.
            </p>
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <label className="block">
            <span className="text-sm font-semibold text-gray-700">
              Full Name
            </span>

            <input
              name="name"
              type="text"
              defaultValue={profile.name}
              className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-black outline-none transition focus:border-purple-500"
            />
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-gray-700">
              Email Address
            </span>

            <input
              name="email"
              type="email"
              defaultValue={profile.email}
              className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-black outline-none transition focus:border-purple-500"
            />
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-gray-700">
              Phone Number
            </span>

            <input
              name="phoneNumber"
              type="tel"
              defaultValue={profile.phoneNumber}
              placeholder="Optional"
              className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-black outline-none transition focus:border-purple-500"
            />
          </label>

          <div>
            <span className="text-sm font-semibold text-gray-700">
              Account Type
            </span>

            <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium capitalize text-gray-700">
              {profile.accountRole}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-5">
          <h3 className="text-lg font-bold text-black">
            Eligible Roles
          </h3>

          <p className="mt-1 text-sm text-gray-500">
            These roles are managed by your organization manager.
          </p>
        </div>

        {eligibleRoles.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {eligibleRoles.map((role) => (
              <span
                key={role.id}
                className="rounded-full border border-purple-200 bg-purple-50 px-3 py-1 text-sm font-medium text-purple-700"
                title={role.description ?? undefined}
              >
                {role.name}
              </span>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-5 text-sm text-gray-500">
            No eligible roles have been assigned yet.
          </div>
        )}
      </section>
    </form>
  );
}