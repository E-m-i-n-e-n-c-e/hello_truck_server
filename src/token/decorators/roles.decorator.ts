import { SetMetadata } from '@nestjs/common';
import { UserType } from '../../common/types/user-session.types';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserType[]) => SetMetadata(ROLES_KEY, roles);