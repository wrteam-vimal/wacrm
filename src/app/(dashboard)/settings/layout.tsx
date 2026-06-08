'use client';

import { usePathname } from 'next/navigation';

interface HeaderContent {
  title: string;
  description: string;
}

const PAGE_HEADERS: Record<string, HeaderContent> = {
  '/settings/profile': {
    title: 'Profile Settings',
    description: 'Manage your personal profile, credentials, and details.',
  },
  '/settings/password': {
    title: 'Password Settings',
    description: 'Update your password and login credentials.',
  },
  '/settings/sessions': {
    title: 'Active Sessions',
    description: 'Manage and sign out of active device sessions.',
  },
  '/settings/fcm-tokens': {
    title: 'FCM Push Notification Tokens',
    description: 'Manage Firebase tokens for push notifications.',
  },
  '/settings/whatsapp': {
    title: 'WhatsApp Configuration',
    description: 'Set up and manage your WhatsApp Business API integration and registration.',
  },
  '/settings/templates': {
    title: 'Message Templates',
    description: 'Manage templates for WhatsApp broadcasts and quick responses.',
  },
  '/settings/tags': {
    title: 'Tag Manager',
    description: 'Create and edit tags to organize your contacts and pipelines.',
  },
  '/settings/appearance': {
    title: 'Appearance Settings',
    description: 'Customize the look and feel, brand assets, loading loaders, and clear system cache.',
  },
  '/settings/seo': {
    title: 'Search Engine Optimization (SEO)',
    description: 'Configure meta tags, Open Graph parameters, and header script injections.',
  },
  '/settings/logs': {
    title: 'Logs & Diagnostics',
    description: 'Trace system events, webhook payloads, and diagnose communication issues.',
  },
  '/settings/members': {
    title: 'Members & Sharing',
    description: 'Manage account members, roles, and pending team invitations.',
  },
  '/settings/roles': {
    title: 'Roles Management',
    description: 'Create custom permission roles and manage granular access levels.',
  },
  '/settings/users': {
    title: 'Users Directory',
    description: 'Manage workspace user access and assign permission roles.',
  },
  '/settings/quick-messages': {
    title: 'Quick Messages',
    description: 'Manage predefined WhatsApp response templates and shortcuts.',
  },
  '/settings/menu-order': {
    title: 'Sidebar Menu Order',
    description: 'Re-order navigation menu items for your workspace view.',
  },
  '/settings/settings-order': {
    title: 'Settings Card Order',
    description: 'Customize the placement order of settings dashboard panels.',
  },
};

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const header = PAGE_HEADERS[pathname] || {
    title: 'Settings',
    description: 'Manage your settings, integrations, and preferences.',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">{header.title}</h1>
        <p className="text-sm text-slate-400 mt-1">{header.description}</p>
      </div>

      <div className="text-sm outline-none">
        {children}
      </div>
    </div>
  );
}
