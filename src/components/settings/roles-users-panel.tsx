'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  AlertTriangle,
  KeyRound,
  Loader2,
  Plus,
  Shield,
  Trash2,
  User,
  UserCheck,
  UserCog,
  UsersRound,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/use-auth';

interface Role {
  id: string;
  name: string;
  permissions: Record<string, boolean>;
  created_at: string;
}

interface UserProfile {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
  account_role: string;
  role_id: string | null;
  created_at: string;
  roles?: Role | Role[] | null;
}

const MODULES = [
  { key: 'dashboard', label: 'Dashboard', desc: 'Overview metrics and analytics dashboard' },
  { key: 'inbox', label: 'Inbox', desc: 'Chat interface and customer communication' },
  { key: 'contacts', label: 'Contacts', desc: 'Contact lists and database management' },
  { key: 'pipelines', label: 'Pipelines', desc: 'Deals, pipeline boards, and sales stages' },
  { key: 'broadcasts', label: 'Broadcasts', desc: 'Bulk WhatsApp broadcasts and campaigns' },
  { key: 'automations', label: 'Automations', desc: 'Visual automated flows and chat routing rules' },
  { key: 'flows', label: 'Flows', desc: 'Flow logic builder and WhatsApp interactive menus' },
];

const SETTINGS_MODULES = [
  { key: 'settings_profile', label: 'Profile Settings', desc: 'Edit personal credentials and settings' },
  { key: 'settings_whatsapp', label: 'WhatsApp Configuration', desc: 'Manage phone numbers and business profile setup' },
  { key: 'settings_templates', label: 'Templates Settings', desc: 'View, create, and submit Meta template approvals' },
  { key: 'settings_tags', label: 'Tags Settings', desc: 'Create and assign system tags for segmentation' },
  { key: 'settings_appearance', label: 'Appearance Settings', desc: 'Adjust primary colors, logos, and storage types' },
  { key: 'settings_seo', label: 'SEO Settings', desc: 'Configure search optimization headers and meta scripts' },
  { key: 'settings_logs', label: 'System Logs', desc: 'Access system operation logs and webhook execution histories' },
  { key: 'settings_webhook_test', label: 'Webhook Test', desc: 'Access the webhook simulation and diagnostic tools' },
  { key: 'manage_roles', label: 'Manage Roles', desc: 'Create, edit, and delete custom workspace roles' },
  { key: 'manage_users', label: 'Manage Users', desc: 'Create, edit, and delete workspace user accounts' },
];

export function RolesUsersPanel({ mode }: { mode?: 'roles' | 'users' }) {
  const { user: currentUser, permissions } = useAuth();
  const [activeTab, setActiveTab] = useState(mode || 'roles');

  useEffect(() => {
    if (mode) {
      setActiveTab(mode);
    }
  }, [mode]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // Role Modals state
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [roleName, setRoleName] = useState('');
  const [rolePermissions, setRolePermissions] = useState<Record<string, boolean>>({});
  const [deletingRole, setDeletingRole] = useState<Role | null>(null);

  // User Modals state
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [userRoleId, setUserRoleId] = useState<string>('none');
  const [deletingUser, setDeletingUser] = useState<UserProfile | null>(null);

  // Action status loader
  const [actionLoading, setActionLoading] = useState(false);

  // Fetch roles and users list
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [rolesRes, usersRes] = await Promise.all([
        fetch('/api/roles', { cache: 'no-store' }),
        fetch('/api/users', { cache: 'no-store' }),
      ]);

      if (rolesRes.ok) {
        const data = await rolesRes.json();
        setRoles(data.roles);
      }
      if (usersRes.ok) {
        const data = await usersRes.json();
        setUsers(data.users);
      }
    } catch (err) {
      console.error('Error loading RBAC settings:', err);
      toast.error('Failed to load roles or users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Open role create/edit dialog
  const handleOpenRoleDialog = (role?: Role) => {
    if (role) {
      setEditingRole(role);
      setRoleName(role.name);
      setRolePermissions(role.permissions || {});
    } else {
      setEditingRole(null);
      setRoleName('');
      // Default all to false when creating a new role (switches start off)
      const defaults: Record<string, boolean> = {};
      [...MODULES, ...SETTINGS_MODULES].forEach((m) => {
        defaults[m.key] = false;
      });
      setRolePermissions(defaults);
    }
    setRoleDialogOpen(true);
  };

  // Save Role
  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleName.trim()) {
      toast.error('Role name is required');
      return;
    }

    setActionLoading(true);
    try {
      const url = editingRole ? `/api/roles/${editingRole.id}` : '/api/roles';
      const method = editingRole ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: roleName,
          permissions: rolePermissions,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to save role');
        return;
      }

      toast.success(editingRole ? 'Role updated successfully' : 'Role created successfully');
      setRoleDialogOpen(false);
      void loadData();
    } catch (err) {
      console.error('Save role error:', err);
      toast.error('An error occurred while saving the role');
    } finally {
      setActionLoading(false);
    }
  };

  // Delete Role
  const handleDeleteRole = async () => {
    if (!deletingRole) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/roles/${deletingRole.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Failed to delete role');
        return;
      }
      toast.success('Role deleted successfully');
      setDeletingRole(null);
      void loadData();
    } catch (err) {
      console.error('Delete role error:', err);
      toast.error('An error occurred while deleting the role');
    } finally {
      setActionLoading(false);
    }
  };

  // Open User dialog
  const handleOpenUserDialog = (usr?: UserProfile) => {
    if (usr) {
      setEditingUser(usr);
      setUserName(usr.full_name || '');
      setUserEmail(usr.email);
      setUserPassword('');
      setUserRoleId(usr.role_id || 'none');
    } else {
      setEditingUser(null);
      setUserName('');
      setUserEmail('');
      setUserPassword('');
      setUserRoleId('none');
    }
    setUserDialogOpen(true);
  };

  // Save User
  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName.trim() || !userEmail.trim()) {
      toast.error('Name and email are required');
      return;
    }
    if (!editingUser && !userPassword.trim()) {
      toast.error('Password is required for new users');
      return;
    }

    setActionLoading(true);
    try {
      const url = editingUser ? `/api/users/${editingUser.user_id}` : '/api/users';
      const method = editingUser ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: userName,
          email: userEmail,
          password: userPassword || undefined,
          role_id: userRoleId === 'none' ? null : userRoleId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to save user');
        return;
      }

      toast.success(editingUser ? 'User updated successfully' : 'User created successfully');
      setUserDialogOpen(false);
      void loadData();
    } catch (err) {
      console.error('Save user error:', err);
      toast.error('An error occurred while saving the user');
    } finally {
      setActionLoading(false);
    }
  };

  // Delete User
  const handleDeleteUser = async () => {
    if (!deletingUser) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/users/${deletingUser.user_id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || 'Failed to delete user');
        return;
      }
      toast.success('User deleted successfully');
      setDeletingUser(null);
      void loadData();
    } catch (err) {
      console.error('Delete user error:', err);
      toast.error('An error occurred while deleting the user');
    } finally {
      setActionLoading(false);
    }
  };

  // Helper to extract role name associated with a profile user
  const getUserRoleName = (usr: UserProfile) => {
    if (usr.email === 'wrteam.vimal@gmail.com') return 'Super Admin';
    if (usr.account_role === 'owner') return 'Account Owner';

    const associatedRole = Array.isArray(usr.roles) ? usr.roles[0] : usr.roles;
    if (associatedRole) return associatedRole.name;

    // Fallback labels
    if (usr.account_role === 'admin') return 'Default Admin';
    if (usr.account_role === 'agent') return 'Default Agent';
    if (usr.account_role === 'viewer') return 'Default Viewer';
    return 'No Role';
  };

  const togglePermission = (key: string) => {
    setRolePermissions((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSelectAllPermissions = () => {
    const nextPerms: Record<string, boolean> = {};
    [...MODULES, ...SETTINGS_MODULES].forEach((m) => {
      nextPerms[m.key] = true;
    });
    setRolePermissions(nextPerms);
  };

  const handleClearAllPermissions = () => {
    const nextPerms: Record<string, boolean> = {};
    [...MODULES, ...SETTINGS_MODULES].forEach((m) => {
      nextPerms[m.key] = false;
    });
    setRolePermissions(nextPerms);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 mt-4">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        {!mode && (
          <TabsList className="bg-slate-900 border border-slate-800 p-1 rounded-lg">
            <TabsTrigger value="roles" className="text-slate-400 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Shield className="size-4 mr-2" />
              Roles Management
            </TabsTrigger>
            <TabsTrigger value="users" className="text-slate-400 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <UsersRound className="size-4 mr-2" />
              Users & Members
            </TabsTrigger>
          </TabsList>
        )}

        {/* Roles Management Tab */}
        <TabsContent value="roles" className="space-y-4 outline-none">
          <div className="flex justify-between items-center mt-4">
            <div>
              <h3 className="text-lg font-semibold text-white">Custom Account Roles</h3>
              <p className="text-sm text-slate-400">
                Configure custom granular permissions for different modules and settings.
              </p>
            </div>
            {permissions.manage_roles && (
              <Button onClick={() => handleOpenRoleDialog()} className="bg-primary text-primary-foreground hover:bg-primary/95">
                <Plus className="size-4 mr-1" />
                Create Custom Role
              </Button>
            )}
          </div>

          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-0">
              {roles.length === 0 ? (
                <div className="flex flex-col items-center py-12 text-slate-500">
                  <Shield className="size-8 mb-2" />
                  <p>No custom roles created yet.</p>
                  <p className="text-xs">Click create button to define your first user role.</p>
                </div>
              ) : (
                <ul className="divide-y divide-slate-800">
                  {roles.map((role) => (
                    <li key={role.id} className="flex items-center justify-between p-4 hover:bg-slate-950/20">
                      <div className="flex items-center gap-3">
                        <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                          <UserCog className="size-4" />
                        </div>
                        <div>
                          <span className="text-sm font-medium text-white block">{role.name}</span>
                          <span className="text-xs text-slate-500">
                            {Object.values(role.permissions).filter(Boolean).length} / {MODULES.length + SETTINGS_MODULES.length} permissions enabled
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {permissions.manage_roles ? (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenRoleDialog(role)}
                              className="border-slate-800 bg-slate-850 hover:bg-slate-800 text-slate-300"
                            >
                              Configure
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setDeletingRole(role)}
                              className="border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/25"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </>
                        ) : (
                          <span className="text-xs text-slate-600 font-medium">Read-Only</span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Users Management Tab */}
        <TabsContent value="users" className="space-y-4 outline-none">
          <div className="flex justify-between items-center mt-4">
            <div>
              <h3 className="text-lg font-semibold text-white">Users Directory</h3>
              <p className="text-sm text-slate-400">
                Manage members and assign them custom or system roles.
              </p>
            </div>
            {permissions.manage_users && (
              <Button onClick={() => handleOpenUserDialog()} className="bg-primary text-primary-foreground hover:bg-primary/95">
                <Plus className="size-4 mr-1" />
                Add User
              </Button>
            )}
          </div>

          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-0">
              <ul className="divide-y divide-slate-800">
                {users.map((usr) => {
                  const roleNameStr = getUserRoleName(usr);
                  const isSelf = usr.user_id === currentUser?.id;
                  const isSuperAdmin = usr.email === 'wrteam.vimal@gmail.com';
                  const isOwner = usr.account_role === 'owner';

                  return (
                    <li key={usr.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="size-10 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center font-semibold border border-slate-700">
                          {isSuperAdmin ? '👑' : (usr.full_name || usr.email || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-white truncate">{usr.full_name || 'Unnamed'}</span>
                            {isSelf && (
                              <span className="px-1.5 py-0.5 text-[10px] bg-slate-800 text-slate-400 border border-slate-700 rounded-md font-semibold uppercase tracking-wider">
                                You
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-slate-500 block truncate">{usr.email}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-4 sm:justify-end">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md border ${isSuperAdmin
                          ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                          : isOwner
                            ? 'bg-purple-500/10 text-purple-300 border-purple-500/30'
                            : 'bg-slate-800 text-slate-350 border-slate-700'
                          }`}>
                          {isSuperAdmin ? '👑' : <UserCheck className="size-3" />}
                          {roleNameStr}
                        </span>

                        <div className="flex items-center gap-2">
                          {permissions.manage_users ? (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={isSuperAdmin}
                                onClick={() => handleOpenUserDialog(usr)}
                                className="border-slate-800 bg-slate-850 hover:bg-slate-800 text-slate-300 disabled:opacity-50"
                              >
                                Edit
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={isSelf || isSuperAdmin || isOwner}
                                onClick={() => setDeletingUser(usr)}
                                className="border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/25 disabled:opacity-30"
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </>
                          ) : (
                            <span className="text-xs text-slate-600 font-medium">Read-Only</span>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* CREATE/EDIT ROLE MODAL */}
      <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <DialogContent className="bg-slate-900 border border-slate-800 text-slate-100 sm:max-w-4xl overflow-y-auto max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Shield className="size-5 text-primary" />
              {editingRole ? 'Update Role Permissions' : 'Create Custom Role'}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Provide a name and configure access levels toggles. Enabled items will display in navigation.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveRole} className="space-y-6 py-2">
            <div className="space-y-2">
              <Label htmlFor="role-name" className="text-slate-300 text-sm font-medium">Role Name *</Label>
              <Input
                id="role-name"
                value={roleName}
                onChange={(e) => setRoleName(e.target.value)}
                placeholder="e.g. Sales Representative, Support Tier 2"
                className="bg-slate-950 border-slate-800 focus-visible:ring-primary focus-visible:border-primary text-white"
                required
              />
            </div>

            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs text-slate-400 font-medium">Granular Permission Switches</span>
              <div className="flex items-center gap-3 text-xs">
                <button
                  type="button"
                  onClick={handleSelectAllPermissions}
                  className="text-primary hover:text-primary/95 transition-colors font-semibold"
                >
                  Select All
                </button>
                <span className="text-slate-700">|</span>
                <button
                  type="button"
                  onClick={handleClearAllPermissions}
                  className="text-slate-400 hover:text-slate-200 transition-colors font-semibold"
                >
                  Clear All
                </button>
              </div>
            </div>

            {/* Core Modules Permissions */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-white border-b border-slate-800 pb-1">Primary Modules</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {MODULES.map((m) => (
                  <div key={m.key} className="flex items-center justify-between p-3 rounded-lg bg-slate-950/45 border border-slate-800/60">
                    <div className="space-y-0.5 pr-2">
                      <Label htmlFor={`perm-${m.key}`} className="text-xs font-semibold text-slate-200 cursor-pointer">{m.label}</Label>
                      <p className="text-[10px] text-slate-500">{m.desc}</p>
                    </div>
                    <Switch
                      id={`perm-${m.key}`}
                      checked={!!rolePermissions[m.key]}
                      onCheckedChange={() => togglePermission(m.key)}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Settings Sub-Modules Permissions */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-white border-b border-slate-800 pb-1">Settings Permissions</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {SETTINGS_MODULES.map((m) => (
                  <div key={m.key} className="flex items-center justify-between p-3 rounded-lg bg-slate-950/45 border border-slate-800/60">
                    <div className="space-y-0.5 pr-2">
                      <Label htmlFor={`perm-${m.key}`} className="text-xs font-semibold text-slate-200 cursor-pointer">{m.label}</Label>
                      <p className="text-[10px] text-slate-500">{m.desc}</p>
                    </div>
                    <Switch
                      id={`perm-${m.key}`}
                      checked={!!rolePermissions[m.key]}
                      onCheckedChange={() => togglePermission(m.key)}
                    />
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter className="pt-2 border-t border-slate-800">
              <Button
                type="button"
                variant="outline"
                onClick={() => setRoleDialogOpen(false)}
                className="border-slate-800 text-slate-400 hover:bg-slate-800"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={actionLoading} className="bg-primary text-primary-foreground hover:bg-primary/95">
                {actionLoading && <Loader2 className="size-4 mr-1 animate-spin" />}
                {editingRole ? 'Update Role' : 'Create Role'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DELETE ROLE WARNING MODAL */}
      <Dialog open={deletingRole !== null} onOpenChange={(o) => !o && setDeletingRole(null)}>
        <DialogContent className="bg-slate-900 border border-slate-800 text-slate-100 sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <AlertTriangle className="size-5 text-amber-500" />
              Delete Custom Role?
            </DialogTitle>
            <DialogDescription className="text-slate-400 mt-2">
              Are you sure you want to delete <span className="font-semibold text-white">&quot;{deletingRole?.name}&quot;</span>? Users currently assigned to this role will default to general member capabilities.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => setDeletingRole(null)}
              className="border-slate-800 text-slate-400 hover:bg-slate-800"
            >
              Cancel
            </Button>
            <Button onClick={handleDeleteRole} disabled={actionLoading} className="bg-red-600 hover:bg-red-700 text-white">
              {actionLoading && <Loader2 className="size-4 mr-1 animate-spin" />}
              Delete Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CREATE/EDIT USER MODAL */}
      <Dialog open={userDialogOpen} onOpenChange={setUserDialogOpen}>
        <DialogContent className="bg-slate-900 border border-slate-800 text-slate-100 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <User className="size-5 text-primary" />
              {editingUser ? 'Update User Details' : 'Add New User'}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Create credentials and link user to custom permissions roles.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveUser} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="usr-name" className="text-slate-350 text-xs">Full Name *</Label>
              <Input
                id="usr-name"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="e.g. Vimal Patel"
                className="bg-slate-950 border-slate-800 text-white focus-visible:ring-primary"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="usr-email" className="text-slate-350 text-xs">Email Address *</Label>
              <Input
                id="usr-email"
                type="email"
                disabled={!!editingUser}
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
                placeholder="e.g. user@example.com"
                className="bg-slate-950 border-slate-800 text-white disabled:opacity-55 focus-visible:ring-primary"
                required
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="usr-pass" className="text-slate-350 text-xs">
                  Password {editingUser && '(Leave blank to keep current)'}
                </Label>
                {editingUser && <KeyRound className="size-3 text-slate-500" />}
              </div>
              <Input
                id="usr-pass"
                type="password"
                value={userPassword}
                onChange={(e) => setUserPassword(e.target.value)}
                placeholder={editingUser ? '••••••••' : 'Password (min 6 chars)'}
                className="bg-slate-950 border-slate-800 text-white focus-visible:ring-primary"
                required={!editingUser}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="usr-role" className="text-slate-350 text-xs">Role Assignment</Label>
              <Select value={userRoleId} onValueChange={(val) => setUserRoleId(val || 'none')}>
                <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                  <SelectItem value="none">Default Role (Member)</SelectItem>
                  {roles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="pt-4 border-t border-slate-800">
              <Button
                type="button"
                variant="outline"
                onClick={() => setUserDialogOpen(false)}
                className="border-slate-800 text-slate-400 hover:bg-slate-800"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={actionLoading} className="bg-primary text-primary-foreground hover:bg-primary/95">
                {actionLoading && <Loader2 className="size-4 mr-1 animate-spin" />}
                {editingUser ? 'Save Changes' : 'Create User'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DELETE USER WARNING MODAL */}
      <Dialog open={deletingUser !== null} onOpenChange={(o) => !o && setDeletingUser(null)}>
        <DialogContent className="bg-slate-900 border border-slate-800 text-slate-100 sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <AlertTriangle className="size-5 text-red-500" />
              Delete User account?
            </DialogTitle>
            <DialogDescription className="text-slate-400 mt-2">
              Are you sure you want to delete <span className="font-semibold text-white">&quot;{deletingUser?.full_name}&quot;</span>? This will permanently disable their login and remove their access to this workspace. This action is irreversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => setDeletingUser(null)}
              className="border-slate-800 text-slate-400 hover:bg-slate-800"
            >
              Cancel
            </Button>
            <Button onClick={handleDeleteUser} disabled={actionLoading} className="bg-red-600 hover:bg-red-700 text-white">
              {actionLoading && <Loader2 className="size-4 mr-1 animate-spin" />}
              Delete Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
