'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  User,
  Key,
  Monitor,
  Bell,
  Smartphone,
  Mail,
  Tag,
  Palette,
  Search,
  Terminal,
  Shield,
  Users,
  MessageSquare,
  ListOrdered,
  Sliders,
  ArrowRight,
  Globe,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent } from '@/components/ui/card';

interface SettingCard {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: any;
  iconBg: string;
  permissionKey?: string;
}

export default function SettingsDashboardPage() {
  const { permissions, profile } = useAuth();
  const [orderedCards, setOrderedCards] = useState<SettingCard[]>([]);

  const settingsCards: SettingCard[] = [
    {
      id: 'profile',
      title: 'Profile Settings',
      description: 'Manage your personal profile, credentials, and details.',
      href: '/settings/profile',
      icon: User,
      iconBg: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    },
    {
      id: 'password',
      title: 'Password',
      description: 'Update your password and login credentials.',
      href: '/settings/password',
      icon: Key,
      iconBg: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    },
    {
      id: 'sessions',
      title: 'Active Sessions',
      description: 'Manage and sign out of active device sessions.',
      href: '/settings/sessions',
      icon: Monitor,
      iconBg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    },
    {
      id: 'fcm-tokens',
      title: 'FCM Push Tokens',
      description: 'Manage Firebase tokens for push notifications.',
      href: '/settings/fcm-tokens',
      icon: Bell,
      iconBg: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    },
    {
      id: 'whatsapp',
      title: 'WhatsApp Configuration',
      description: 'Set up and manage your WhatsApp Business API integration.',
      href: '/settings/whatsapp',
      icon: Smartphone,
      iconBg: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
      permissionKey: 'settings_whatsapp',
    },
    {
      id: 'templates',
      title: 'Message Templates',
      description: 'Manage templates for WhatsApp broadcasts and replies.',
      href: '/settings/templates',
      icon: Mail,
      iconBg: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
      permissionKey: 'settings_templates',
    },
    {
      id: 'tags',
      title: 'Tags Manager',
      description: 'Create and edit tags to organize your contacts.',
      href: '/settings/tags',
      icon: Tag,
      iconBg: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
      permissionKey: 'settings_tags',
    },
    {
      id: 'appearance',
      title: 'Appearance Settings',
      description: 'Customize UI look, brand logos, and clear cache.',
      href: '/settings/appearance',
      icon: Palette,
      iconBg: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
      permissionKey: 'settings_appearance',
    },
    {
      id: 'seo',
      title: 'SEO Settings',
      description: 'Configure meta tags and Open Graph parameters.',
      href: '/settings/seo',
      icon: Search,
      iconBg: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
      permissionKey: 'settings_seo',
    },
    {
      id: 'logs',
      title: 'Logs & Diagnostics',
      description: 'View system errors, webhook logs, and simulate webhooks.',
      href: '/settings/logs',
      icon: Terminal,
      iconBg: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
      permissionKey: 'settings_logs',
    },
    {
      id: 'roles',
      title: 'Roles Management',
      description: 'Create permission roles and manage access levels.',
      href: '/settings/roles',
      icon: Shield,
      iconBg: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
      permissionKey: 'manage_roles',
    },
    {
      id: 'users',
      title: 'Users Directory',
      description: 'Manage workspace user access and assign roles.',
      href: '/settings/users',
      icon: Users,
      iconBg: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
      permissionKey: 'manage_users',
    },
    {
      id: 'quick-messages',
      title: 'Quick Messages',
      description: 'Create and save WhatsApp quick message templates.',
      href: '/settings/quick-messages',
      icon: MessageSquare,
      iconBg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    },
    {
      id: 'menu-order',
      title: 'Sidebar Menu Order',
      description: 'Re-order navigation menu items for your view.',
      href: '/settings/menu-order',
      icon: ListOrdered,
      iconBg: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    },
    {
      id: 'settings-order',
      title: 'Settings Card Order',
      description: 'Re-order settings items on this dashboard view.',
      href: '/settings/settings-order',
      icon: Sliders,
      iconBg: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    },
    {
      id: 'countries',
      title: 'Countries & Dial Codes',
      description: 'Manage country names and code prefixes for phone numbers.',
      href: '/settings/countries',
      icon: Globe,
      iconBg: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    },
  ];

  useEffect(() => {
    if (profile?.id) {
      const stored = localStorage.getItem(`wacrm-settings-order-${profile.id}`);
      if (stored) {
        try {
          const order = JSON.parse(stored) as string[];
          const sorted = [...settingsCards].sort((a, b) => {
            const indexA = order.indexOf(a.id);
            const indexB = order.indexOf(b.id);
            if (indexA === -1 && indexB === -1) return 0;
            if (indexA === -1) return 1;
            if (indexB === -1) return -1;
            return indexA - indexB;
          });
          setOrderedCards(sorted);
          return;
        } catch (err) {
          console.error('Failed to parse settings order:', err);
        }
      }
    }
    setOrderedCards(settingsCards);
  }, [profile?.id, permissions]);

  return (
    <div className="space-y-6 mt-4 font-sans text-white">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {orderedCards.map((card) => {
          // Check permission if key is defined
          if (
            card.permissionKey &&
            permissions &&
            permissions[card.permissionKey as keyof typeof permissions] === false
          ) {
            return null;
          }

          const IconComponent = card.icon;

          return (
            <Link key={card.href} href={card.href} className="group outline-none">
              <Card className="bg-slate-900/40 border-slate-800 hover:border-slate-700 hover:bg-slate-850/30 transition-all duration-300 ring-0 ring-transparent h-full flex flex-col justify-center select-none">
                <CardContent className="p-3.5 flex items-center gap-3">
                  <div
                    className={`size-9 rounded-lg border flex items-center justify-center shrink-0 ${card.iconBg}`}
                  >
                    <IconComponent className="size-4.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-white group-hover:text-primary transition-colors text-sm truncate">
                      {card.title}
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5 truncate leading-relaxed">
                      {card.description}
                    </p>
                  </div>
                  <ArrowRight className="size-4 text-slate-500 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
