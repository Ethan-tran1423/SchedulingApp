'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/app/lib/utils/auth/require-user';
import { updateUserProfile } from '@/app/lib/repos/profile';

export type ProfileActionState = {
  error?: string;
  success?: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getRequiredString(
  formData: FormData,
  key: string,
) {
  const value = formData.get(key);

  if (typeof value !== 'string') {
    return '';
  }

  return value.trim();
}

export async function saveProfile(
  _previousState: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const user = await requireUser();

  const name = getRequiredString(formData, 'name');
  const email = getRequiredString(formData, 'email').toLowerCase();
  const phoneNumberInput = getRequiredString(formData, 'phoneNumber');

  if (name.length < 1) {
    return {
      error: 'Name is required.',
    };
  }

  if (name.length > 80) {
    return {
      error: 'Name must be 80 characters or fewer.',
    };
  }

  if (!EMAIL_PATTERN.test(email)) {
    return {
      error: 'Enter a valid email address.',
    };
  }

  if (phoneNumberInput.length > 30) {
    return {
      error: 'Phone number must be 30 characters or fewer.',
    };
  }

  const phoneNumber =
    phoneNumberInput.length > 0 ? phoneNumberInput : null;

  try {
    await updateUserProfile({
      userId: user.id,
      name,
      email,
      phoneNumber,
    });
  } catch (error) {
    console.error('Failed to save profile:', error);

    return {
      error:
        'Unable to save profile. The email may already be in use.',
    };
  }

  revalidatePath('/dashboard/employee/profile');
  revalidatePath('/dashboard/manager/profile');
  revalidatePath('/dashboard/employee');
  revalidatePath('/dashboard/manager');

  return {
    success: 'Profile saved.',
  };
}