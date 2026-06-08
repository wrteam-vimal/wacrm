'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  ArrowUp,
  ArrowDown,
  GripVertical,
  RotateCcw,
  Save,
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
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface SettingItem {
  id: string;
  label: string;
  icon: any;
  permissionKey?: string;
}

const SETTINGS_ICONS: Record<string, any> = {
  profile: User,
  password: Key,
  sessions: Monitor,
  'fcm-tokens': Bell,
  whatsapp: Smartphone,
  templates: Mail,
  tags: Tag,
  appearance: Palette,
  seo: Search,
  logs: Terminal,
  roles: Shield,
  users: Users,
  'quick-messages': MessageSquare,
  'menu-order': ListOrdered,
  'settings-order': Sliders,
};

const DEFAULT_SETTINGS_ITEMS: SettingItem[] = [
  { id: 'profile', label: 'Profile Settings', icon: User },
  { id: 'password', label: 'Password', icon: Key },
  { id: 'sessions', label: 'Active Sessions', icon: Monitor },
  { id: 'fcm-tokens', label: 'FCM Push Tokens', icon: Bell },
  { id: 'whatsapp', label: 'WhatsApp Configuration', icon: Smartphone, permissionKey: 'settings_whatsapp' },
  { id: 'templates', label: 'Message Templates', icon: Mail, permissionKey: 'settings_templates' },
  { id: 'tags', label: 'Tags Manager', icon: Tag, permissionKey: 'settings_tags' },
  { id: 'appearance', label: 'Appearance Settings', icon: Palette, permissionKey: 'settings_appearance' },
  { id: 'seo', label: 'SEO Settings', icon: Search, permissionKey: 'settings_seo' },
  { id: 'logs', label: 'Logs & Diagnostics', icon: Terminal, permissionKey: 'settings_logs' },
  { id: 'roles', label: 'Roles Management', icon: Shield, permissionKey: 'manage_roles' },
  { id: 'users', label: 'Users Directory', icon: Users, permissionKey: 'manage_users' },
  { id: 'quick-messages', label: 'Quick Messages', icon: MessageSquare },
  { id: 'menu-order', label: 'Sidebar Menu Order', icon: ListOrdered },
  { id: 'settings-order', label: 'Settings Card Order', icon: Sliders },
];

export default function SettingsOrderPage() {
  const { profile, permissions } = useAuth();
  const [items, setItems] = useState<SettingItem[]>([]);

  useEffect(() => {
    // Filter items based on user permissions first
    const allowed = DEFAULT_SETTINGS_ITEMS.filter((item) => {
      if (!item.permissionKey) return true;
      if (!permissions) return true;
      return permissions[item.permissionKey as keyof typeof permissions] !== false;
    });

    if (profile?.id) {
      const stored = localStorage.getItem(`wacrm-settings-order-${profile.id}`);
      if (stored) {
        try {
          const order = JSON.parse(stored) as string[];
          const sorted = [...allowed].sort((a, b) => {
            const indexA = order.indexOf(a.id);
            const indexB = order.indexOf(b.id);
            if (indexA === -1 && indexB === -1) return 0;
            if (indexA === -1) return 1;
            if (indexB === -1) return -1;
            return indexA - indexB;
          });
          setItems(sorted);
          return;
        } catch (err) {
          console.error('Failed to parse stored settings order:', err);
        }
      }
    }
    setItems(allowed);
  }, [profile?.id, permissions]);

  const moveUp = (index: number) => {
    if (index === 0) return;
    const newItems = [...items];
    const temp = newItems[index];
    newItems[index] = newItems[index - 1];
    newItems[index - 1] = temp;
    setItems(newItems);
  };

  const moveDown = (index: number) => {
    if (index === items.length - 1) return;
    const newItems = [...items];
    const temp = newItems[index];
    newItems[index] = newItems[index + 1];
    newItems[index + 1] = temp;
    setItems(newItems);
  };

  const handleSave = () => {
    if (!profile?.id) return;
    const order = items.map((item) => item.id);
    localStorage.setItem(`wacrm-settings-order-${profile.id}`, JSON.stringify(order));
    toast.success('Settings dashboard card order saved successfully!');
  };

  const handleReset = () => {
    const allowed = DEFAULT_SETTINGS_ITEMS.filter((item) => {
      if (!item.permissionKey) return true;
      if (!permissions) return true;
      return permissions[item.permissionKey as keyof typeof permissions] !== false;
    });
    setItems(allowed);
    if (profile?.id) {
      localStorage.removeItem(`wacrm-settings-order-${profile.id}`);
      toast.success('Reset settings cards order to defaults.');
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mt-4 font-sans text-white">
      <div>
        <h2 className="text-lg font-semibold text-white">Settings Card Order</h2>
        <p className="text-sm text-slate-400">
          Customize the order of the cards displayed on the main Settings dashboard grid. This configuration is saved per-user.
        </p>
      </div>

      <Card className="bg-slate-900/40 border-slate-800 ring-0 ring-transparent">
        <CardContent className="pt-6 space-y-4">
          <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl overflow-hidden bg-slate-950/20">
            {items.map((item, index) => {
              const IconComponent = SETTINGS_ICONS[item.id] || User;
              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3.5 bg-slate-900/20 hover:bg-slate-800/10 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <GripVertical className="size-4 text-slate-600 shrink-0 cursor-grab" />
                    <div className="size-8 rounded-lg bg-slate-850 border border-slate-800 flex items-center justify-center text-slate-400">
                      <IconComponent className="size-4" />
                    </div>
                    <span className="text-sm font-medium text-slate-200">{item.label}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={index === 0}
                      onClick={() => moveUp(index)}
                      className="size-8 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30"
                      title="Move Up"
                    >
                      <ArrowUp className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={index === items.length - 1}
                      onClick={() => moveDown(index)}
                      className="size-8 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30"
                      title="Move Down"
                    >
                      <ArrowDown className="size-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-2">
            <Button
              variant="outline"
              onClick={handleReset}
              className="border-slate-800 text-slate-400 hover:text-white hover:bg-slate-850"
            >
              <RotateCcw className="size-4 mr-2" />
              Reset Defaults
            </Button>
            <Button
              onClick={handleSave}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
            >
              <Save className="size-4 mr-2" />
              Save Order
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
