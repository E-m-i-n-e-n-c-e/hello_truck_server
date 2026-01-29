/**
 * Admin Users Service
 *
 * Handles admin user CRUD operations with role hierarchy:
 * - SUPER_ADMIN: Can manage ADMIN, AGENT, FIELD_AGENT, CUSTOMER_SUPPORT (not other SUPER_ADMINs)
 * - ADMIN: Can manage AGENT, FIELD_AGENT, CUSTOMER_SUPPORT
 * - Others: Cannot create users
 */
import { Injectable, ConflictException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AdminAuthService } from '../auth/admin-auth.service';
import { AdminRole, Prisma } from '@prisma/client';
import { CreateUserRequestDto, UpdateUserRequestDto, ListUsersRequestDto } from './dto/user-request.dto';
import { AUDIT_METADATA_KEY } from '../audit-log/decorators/audit-log.decorator';

// Define role hierarchy
const ROLE_HIERARCHY: Record<AdminRole, AdminRole[]> = {
  [AdminRole.SUPER_ADMIN]: [AdminRole.ADMIN, AdminRole.AGENT, AdminRole.FIELD_AGENT, AdminRole.CUSTOMER_SUPPORT],
  [AdminRole.ADMIN]: [AdminRole.AGENT, AdminRole.FIELD_AGENT, AdminRole.CUSTOMER_SUPPORT],
  [AdminRole.AGENT]: [],
  [AdminRole.FIELD_AGENT]: [],
  [AdminRole.CUSTOMER_SUPPORT]: [],
};

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AdminAuthService,
  ) {}

  /**
   * Check if a role can create/manage another role
   */
  private canManageRole(creatorRole: AdminRole, targetRole: AdminRole): boolean {
    const allowedRoles: AdminRole[] = ROLE_HIERARCHY[creatorRole] || [];
    return allowedRoles.includes(targetRole);
  }

  /**
   * List all admin users with optional filters
   */
  async listUsers(filters: ListUsersRequestDto) {
    const { role, search, isActive, page = 1, limit = 20 } = filters;

    const where: Prisma.AdminUserWhereInput = {};

    if (role) {
      where.role = role;
    }

    if (typeof isActive === 'boolean') {
      where.isActive = isActive;
    }

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      this.prisma.adminUser.findMany({
        where,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.adminUser.count({ where }),
    ]);

    return {
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get a single admin user by ID
   */
  async getUserById(id: string) {
    const user = await this.prisma.adminUser.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  /**
   * Create a new admin user
   */
  async createUser(dto: CreateUserRequestDto, creatorRole: AdminRole) {
    // Check if creator can create this role
    if (!this.canManageRole(creatorRole, dto.role)) {
      throw new ForbiddenException(
        `${creatorRole} cannot create users with role ${dto.role}. Allowed roles: ${ROLE_HIERARCHY[creatorRole].join(', ')}`
      );
    }

    // Check if email already exists
    const existingUser = await this.prisma.adminUser.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });

    if (existingUser) {
      throw new ConflictException('Email already in use');
    }

    // Hash password
    const passwordHash = await this.authService.hashPassword(dto.password);

    // Create user
    const user = await this.prisma.adminUser.create({
      data: {
        email: dto.email.toLowerCase().trim(),
        passwordHash,
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        role: dto.role,
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return {
      message: 'User created successfully',
      user,
    };
  }

  /**
   * Update an admin user
   */
  async updateUser(id: string, dto: UpdateUserRequestDto, currentUserId: string, currentUserRole: AdminRole) {
    // Cannot update your own role
    if (id === currentUserId && dto.role) {
      throw new ForbiddenException('Cannot change your own role');
    }

    const user = await this.prisma.adminUser.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // If changing role, check if current user can manage both old and new roles
    if (dto.role && dto.role !== user.role) {
      if (!this.canManageRole(currentUserRole, user.role)) {
        throw new ForbiddenException(`You cannot manage users with role ${user.role}`);
      }
      if (!this.canManageRole(currentUserRole, dto.role)) {
        throw new ForbiddenException(`You cannot assign role ${dto.role}`);
      }
    }

    // Capture before state
    const beforeSnapshot = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      isActive: user.isActive,
    };

    // Prepare update data
    const updateData: Prisma.AdminUserUpdateInput = {};

    if (dto.firstName) updateData.firstName = dto.firstName.trim();
    if (dto.lastName) updateData.lastName = dto.lastName.trim();
    if (dto.role) updateData.role = dto.role;

    if (dto.password) {
      updateData.passwordHash = await this.authService.hashPassword(dto.password);
    }

    // Update user
    const updatedUser = await this.prisma.adminUser.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Capture after state
    const afterSnapshot = {
      id: updatedUser.id,
      email: updatedUser.email,
      firstName: updatedUser.firstName,
      lastName: updatedUser.lastName,
      role: updatedUser.role,
      isActive: updatedUser.isActive,
    };

    return {
      message: 'User updated successfully',
      user: updatedUser,
      [AUDIT_METADATA_KEY]: {
        beforeSnapshot,
        afterSnapshot,
        entityId: id,
      },
    };
  }

  /**
   * Deactivate an admin user (soft delete)
   */
  async deactivateUser(id: string, currentUserId: string, currentUserRole: AdminRole) {
    // Cannot deactivate yourself
    if (id === currentUserId) {
      throw new ForbiddenException('Cannot deactivate your own account');
    }

    const user = await this.prisma.adminUser.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if current user can manage this user's role
    if (!this.canManageRole(currentUserRole, user.role)) {
      throw new ForbiddenException(`You cannot manage users with role ${user.role}`);
    }

    // Capture before state
    const beforeSnapshot = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      isActive: user.isActive,
    };

    // Soft delete by setting isActive to false
    const updatedUser = await this.prisma.adminUser.update({
      where: { id },
      data: { isActive: false },
    });

    // Capture after state
    const afterSnapshot = {
      id: updatedUser.id,
      email: updatedUser.email,
      firstName: updatedUser.firstName,
      lastName: updatedUser.lastName,
      role: updatedUser.role,
      isActive: updatedUser.isActive,
    };

    // TODO: Also invalidate all sessions for this user
    // await this.sessionService.deleteAllUserSessions(id);

    return {
      message: 'User deactivated successfully',
      [AUDIT_METADATA_KEY]: {
        beforeSnapshot,
        afterSnapshot,
        entityId: id,
      },
    };
  }

  /**
   * Reactivate a deactivated user
   */
  async reactivateUser(id: string) {
    const user = await this.prisma.adminUser.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Capture before state
    const beforeSnapshot = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      isActive: user.isActive,
    };

    const updatedUser = await this.prisma.adminUser.update({
      where: { id },
      data: { isActive: true },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Capture after state
    const afterSnapshot = {
      id: updatedUser.id,
      email: updatedUser.email,
      firstName: updatedUser.firstName,
      lastName: updatedUser.lastName,
      role: updatedUser.role,
      isActive: updatedUser.isActive,
    };

    return {
      message: 'User reactivated successfully',
      user: updatedUser,
      [AUDIT_METADATA_KEY]: {
        beforeSnapshot,
        afterSnapshot,
        entityId: id,
      },
    };
  }
}
