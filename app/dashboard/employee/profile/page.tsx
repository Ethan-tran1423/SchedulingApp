import ProfileForm from '@/app/ui/profile/profile-form';
import { requireEmployee } from '@/app/lib/utils/auth/require-employee';
import {
  findUserEligibleRoles,
  findUserProfileById,
} from '@/app/lib/repos/profile';

export default async function EmployeeProfilePage() {
  const employee = await requireEmployee();

  const [profile, eligibleRoles] = await Promise.all([
    findUserProfileById(employee.id),
    findUserEligibleRoles(employee.id),
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