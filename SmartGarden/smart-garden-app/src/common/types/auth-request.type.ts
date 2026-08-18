import type { Role } from './role.type';

export interface AuthUser {
  sub: string;
  email: string;
  role: Role;
}

export interface AuthRequest {
  user?: AuthUser;
}
