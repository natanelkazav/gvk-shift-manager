import { useAuth } from '../auth/AuthContext';
import type {
  PermissionKey,
} from '../types/auth';

interface UsePermissionsResult {
  permissions: PermissionKey[];

  hasPermission: (
    permission: PermissionKey,
  ) => boolean;

  hasAnyPermission: (
    permissions: PermissionKey[],
  ) => boolean;

  hasAllPermissions: (
    permissions: PermissionKey[],
  ) => boolean;

  refreshPermissions:
    () => Promise<void>;
}

export function usePermissions():
  UsePermissionsResult {
  const {
    permissions,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    refreshPermissions,
  } = useAuth();

  return {
    permissions,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    refreshPermissions,
  };
}