export interface AdminPreferences {
  sidebarCollapsed: boolean;
  compactTables: boolean;
  showHints: boolean;
  defaultSection: string;
  pageSize: number;
  reduceAdminMotion: boolean;
}

export const DEFAULT_ADMIN_PREFERENCES: AdminPreferences = {
  sidebarCollapsed: false,
  compactTables: false,
  showHints: true,
  defaultSection: 'overview',
  pageSize: 12,
  reduceAdminMotion: false,
};

const STORAGE_KEY = 'ec_admin_preferences_v1';

export function readAdminPreferences(): AdminPreferences {
  if (typeof window === 'undefined') return DEFAULT_ADMIN_PREFERENCES;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_ADMIN_PREFERENCES;
    const parsed = JSON.parse(raw) as Partial<AdminPreferences>;
    return {
      ...DEFAULT_ADMIN_PREFERENCES,
      ...parsed,
      pageSize: Math.max(5, Math.min(100, Number(parsed.pageSize) || 12)),
    };
  } catch {
    return DEFAULT_ADMIN_PREFERENCES;
  }
}

export function writeAdminPreferences(preferences: AdminPreferences): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    window.dispatchEvent(new CustomEvent('ec-admin-prefs-changed'));
  } catch {
    /* localStorage can be unavailable in private mode */
  }
}
