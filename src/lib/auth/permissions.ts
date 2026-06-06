// Centralized permission checking logic for RBAC system

export interface UserPermissions {
  dashboard: boolean;
  inbox: boolean;
  contacts: boolean;
  pipelines: boolean;
  broadcasts: boolean;
  automations: boolean;
  flows: boolean;
  settings_profile: boolean;
  settings_whatsapp: boolean;
  settings_templates: boolean;
  settings_tags: boolean;
  settings_appearance: boolean;
  settings_seo: boolean;
  settings_logs: boolean;
  settings_webhook_test: boolean;
  manage_roles: boolean;
  manage_users: boolean;
}

/**
 * Returns permissions for a user based on their email, account role, and custom role permissions.
 * Hardcodes wrteam.vimal@gmail.com as a super admin with full permissions.
 */
export function getPermissions(
  email: string | null | undefined,
  accountRole: string | null | undefined,
  rolePermissions: Record<string, boolean> | null | undefined
): UserPermissions {
  // Super admin override: wrteam.vimal@gmail.com gets full privileges across the application
  if (email === "wrteam.vimal@gmail.com") {
    return {
      dashboard: true,
      inbox: true,
      contacts: true,
      pipelines: true,
      broadcasts: true,
      automations: true,
      flows: true,
      settings_profile: true,
      settings_whatsapp: true,
      settings_templates: true,
      settings_tags: true,
      settings_appearance: true,
      settings_seo: true,
      settings_logs: true,
      settings_webhook_test: true,
      manage_roles: true,
      manage_users: true,
    };
  }

  // If the user has a custom role assigned, use its permissions toggles
  if (rolePermissions) {
    return {
      dashboard: !!rolePermissions.dashboard,
      inbox: !!rolePermissions.inbox,
      contacts: !!rolePermissions.contacts,
      pipelines: !!rolePermissions.pipelines,
      broadcasts: !!rolePermissions.broadcasts,
      automations: !!rolePermissions.automations,
      flows: !!rolePermissions.flows,
      settings_profile: !!rolePermissions.settings_profile,
      settings_whatsapp: !!rolePermissions.settings_whatsapp,
      settings_templates: !!rolePermissions.settings_templates,
      settings_tags: !!rolePermissions.settings_tags,
      settings_appearance: !!rolePermissions.settings_appearance,
      settings_seo: !!rolePermissions.settings_seo,
      settings_logs: !!rolePermissions.settings_logs,
      settings_webhook_test: !!rolePermissions.settings_webhook_test,
      manage_roles: !!rolePermissions.manage_roles,
      manage_users: !!rolePermissions.manage_users,
    };
  }

  // Fallback default permissions based on account_role
  const isAdminOrOwner = accountRole === "owner" || accountRole === "admin";
  const isAgent = accountRole === "agent";

  return {
    dashboard: isAdminOrOwner || isAgent,
    inbox: isAdminOrOwner || isAgent,
    contacts: isAdminOrOwner || isAgent,
    pipelines: isAdminOrOwner || isAgent,
    broadcasts: isAdminOrOwner || isAgent,
    automations: isAdminOrOwner || isAgent,
    flows: isAdminOrOwner || isAgent,
    settings_profile: true, // Profile is always editable by self
    settings_whatsapp: isAdminOrOwner,
    settings_templates: isAdminOrOwner || isAgent,
    settings_tags: isAdminOrOwner || isAgent,
    settings_appearance: isAdminOrOwner,
    settings_seo: isAdminOrOwner,
    settings_logs: isAdminOrOwner,
    settings_webhook_test: isAdminOrOwner,
    manage_roles: isAdminOrOwner,
    manage_users: isAdminOrOwner,
  };
}
