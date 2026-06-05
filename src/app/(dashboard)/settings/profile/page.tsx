'use client';

import { ProfileForm } from '@/components/settings/profile-form';
import { PasswordForm } from '@/components/settings/password-form';
import { SessionsCard } from '@/components/settings/sessions-card';

export default function ProfileSettingsPage() {
  return (
    <div className="space-y-6">
      <ProfileForm />
      <PasswordForm />
      <SessionsCard />
    </div>
  );
}
