'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  ArrowUp,
  ArrowDown,
  GripVertical,
  RotateCcw,
  Save,
  LayoutDashboard,
  MessageSquare,
  Users,
  GitBranch,
  Radio,
  Zap,
  Workflow,
  Settings,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface MenuItem {
  id: string;
  label: string;
  icon: any;
}

const MENU_ICONS: Record<string, any> = {
  dashboard: LayoutDashboard,
  inbox: MessageSquare,
  contacts: Users,
  pipelines: GitBranch,
  broadcasts: Radio,
  automations: Zap,
  flows: Workflow,
  settings: Settings,
};

const DEFAULT_MENU_ITEMS: MenuItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'inbox', label: 'Inbox', icon: MessageSquare },
  { id: 'contacts', label: 'Contacts', icon: Users },
  { id: 'pipelines', label: 'Pipelines', icon: GitBranch },
  { id: 'broadcasts', label: 'Broadcasts', icon: Radio },
  { id: 'automations', label: 'Automations', icon: Zap },
  { id: 'flows', label: 'Flows', icon: Workflow },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export default function MenuOrderSettingsPage() {
  const { profile } = useAuth();
  const [items, setItems] = useState<MenuItem[]>(DEFAULT_MENU_ITEMS);

  useEffect(() => {
    if (profile?.id) {
      const stored = localStorage.getItem(`wacrm-menu-order-${profile.id}`);
      if (stored) {
        try {
          const order = JSON.parse(stored) as string[];
          const sorted = [...DEFAULT_MENU_ITEMS].sort((a, b) => {
            const indexA = order.indexOf(a.id);
            const indexB = order.indexOf(b.id);
            if (indexA === -1 && indexB === -1) return 0;
            if (indexA === -1) return 1;
            if (indexB === -1) return -1;
            return indexA - indexB;
          });
          setItems(sorted);
        } catch (err) {
          console.error('Failed to parse stored menu order:', err);
        }
      }
    }
  }, [profile?.id]);

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
    localStorage.setItem(`wacrm-menu-order-${profile.id}`, JSON.stringify(order));
    toast.success('Sidebar menu order saved successfully!');
    
    // Dispatch custom event to immediately update sidebar
    window.dispatchEvent(new Event('wacrm-menu-order-changed'));
  };

  const handleReset = () => {
    setItems(DEFAULT_MENU_ITEMS);
    if (profile?.id) {
      localStorage.removeItem(`wacrm-menu-order-${profile.id}`);
      toast.success('Reset sidebar menu order to defaults.');
      window.dispatchEvent(new Event('wacrm-menu-order-changed'));
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mt-4 font-sans text-white">
      <div>
        <h2 className="text-lg font-semibold text-white">Sidebar Menu Order</h2>
        <p className="text-sm text-slate-400">
          Customize the order of links displayed in your main navigation sidebar. This configuration is saved per-user.
        </p>
      </div>

      <Card className="bg-slate-900/40 border-slate-800 ring-0 ring-transparent">
        <CardContent className="pt-6 space-y-4">
          <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl overflow-hidden bg-slate-950/20">
            {items.map((item, index) => {
              const IconComponent = MENU_ICONS[item.id] || LayoutDashboard;
              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-4 bg-slate-900/20 hover:bg-slate-800/10 transition-colors"
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
