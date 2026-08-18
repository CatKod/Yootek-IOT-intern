export const APP_ROLES = ['admin', 'user'] as const;
export type AppRole = (typeof APP_ROLES)[number];
export type Role = AppRole;
