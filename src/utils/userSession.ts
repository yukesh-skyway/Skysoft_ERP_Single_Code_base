/**
 * User Session Utility
 * Provides helper functions to access current user session data
 * for audit trails, logging, and user tracking across the application.
 */

import { CURRENT_USER_ENDPOINT } from '../config/urls';

export interface UserSession {
  id: number;
  username: string;
  email: string;
  role: string;
  roles?: Array<{
    role_id: string | number;
    role_name: string;
  }>;
}

/**
 * Fetch current user session from backend
 * This should be called when you need fresh user data
 */
export const getCurrentUser = async (): Promise<UserSession | null> => {
  try {
    const response = await fetch(CURRENT_USER_ENDPOINT, {
      method: 'GET',
      credentials: 'include', // CRITICAL: Include session cookies
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (response.ok) {
      const data = await response.json();
      if (data.success && data.user) {
        return data.user;
      }
    }
    return null;
  } catch (error) {
    console.error('Failed to get current user:', error);
    return null;
  }
};

/**
 * Get user ID for backend operations
 * Returns the user ID or null if not available
 */
export const getUserId = (user: UserSession | null): number | null => {
  return user?.id || null;
};

/**
 * Get username for display purposes
 * Returns the username or 'Unknown' if not available
 */
export const getUsername = (user: UserSession | null): string => {
  return user?.username || 'Unknown';
};

/**
 * Get user email
 * Returns the email or empty string if not available
 */
export const getUserEmail = (user: UserSession | null): string => {
  return user?.email || '';
};

/**
 * Check if user has a specific role
 */
export const hasRole = (user: UserSession | null, roleId: number | string): boolean => {
  if (!user?.role) return false;
  const roleIds = user.role.split(',').map(r => r.trim());
  return roleIds.includes(String(roleId));
};

/**
 * Get all role names for the user
 */
export const getRoleNames = (user: UserSession | null): string[] => {
  if (!user?.roles) return [];
  return user.roles.map(r => r.role_name);
};
