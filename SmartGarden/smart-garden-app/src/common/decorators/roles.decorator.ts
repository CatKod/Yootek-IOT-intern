import { SetMetadata } from '@nestjs/common';
import { APP_ROLES, type AppRole } from '../types/role.type';

export const ROLES_KEY = 'roles';

export { APP_ROLES };
export type Role = AppRole;

export const Roles = (...roles: AppRole[]) => SetMetadata(ROLES_KEY, roles);
