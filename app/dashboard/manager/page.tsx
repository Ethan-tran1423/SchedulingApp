import ProfileForm from '@/app/ui/profile/profile-form';
import { requireManager } from '@/app/lib/utils/auth/require-manager';
import {
  findUserEligibleRoles,
  findUserProfileById,
} from '@/app/lib/repos/profile';

export default async function ManagerProfilePage() {
  const manager = await requireManager();

  const [profile, eligibleRoles] = await Promise.all([
    findUserProfileById(manager.id),
    findUserEligibleRoles(manager.id),
  ]);

  if (!profile) {
    throw new Error('Profile not found.');
  }

  return (
    <section>
      <ProfileForm
        profile={{
          name: profile.name,
          email: profile.email,
          phoneNumber: profile.phone_number ?? '',
          accountRole: profile.role,
          organizationName: profile.organization_name,
        }}
        eligibleRoles={eligibleRoles}
      />
    </section>
  );
}