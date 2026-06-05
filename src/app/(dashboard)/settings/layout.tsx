'use client';

import { usePathname } from 'next/navigation';

interface HeaderContent {
  title: string;
  description: string;
}

const PAGE_HEADERS: Record<string, HeaderContent> = {
  '/settings/profile': {
    title: 'Profile Settings',
    description: 'Manage your personal profile, account password, and active sessions.',
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
  '/settings/members': {
    title: 'Members & Sharing',
    description: 'Manage account members, roles, and pending team invitations.',
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
