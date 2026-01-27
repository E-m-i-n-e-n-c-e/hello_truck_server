/**
 * Admin Users Controller
 *
 * User management endpoints (Super Admin only):
 * - GET /admin-api/users - List users with filters
 * - GET /admin-api/users/:id - Get user by ID
 * - POST /admin-api/users - Create new user
 * - PATCH /admin-api/users/:id - Update user
 * - DELETE /admin-api/users/:id - Deactivate user
 * - POST /admin-api/users/:id/reactivate - Reactivate user
 */
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import { AdminUsersService } from './admin-users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ListUsersDto } from './dto/list-users.dto';
import { AdminAuthGuard } from '../auth/guards/admin-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentAdminUser } from '../auth/decorators/current-admin-user.decorator';
import { AdminJwtPayload } from '../auth/admin-auth.service';

@ApiTags('Admin Users')
@Controller('admin-api/users')
@UseGuards(AdminAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AdminUsersController {
  constructor(private readonly usersService: AdminUsersService) {}

  @Get()
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  @ApiOperation({ summary: 'List all admin users' })
  @ApiResponse({ status: 200, description: 'Returns list of users with pagination' })
  async listUsers(@Query() query: ListUsersDto) {
    return this.usersService.listUsers(query);
  }

  @Get(':id')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  @ApiOperation({ summary: 'Get admin user by ID' })
  @ApiResponse({ status: 200, description: 'Returns user details' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUserById(@Param('id') id: string) {
    return this.usersService.getUserById(id);
  }

  @Post()
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  @ApiOperation({ summary: 'Create new admin user' })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  @ApiResponse({ status: 409, description: 'Email already in use' })
  async createUser(
    @Body() dto: CreateUserDto,
    @CurrentAdminUser() currentUser: AdminJwtPayload,
  ) {
    return this.usersService.createUser(dto, currentUser.role);
  }

  @Patch(':id')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  @ApiOperation({ summary: 'Update admin user' })
  @ApiResponse({ status: 200, description: 'User updated successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async updateUser(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentAdminUser() currentUser: AdminJwtPayload,
  ) {
    return this.usersService.updateUser(id, dto, currentUser.sub, currentUser.role);
  }

  @Delete(':id')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deactivate admin user (soft delete)' })
  @ApiResponse({ status: 200, description: 'User deactivated successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 403, description: 'Cannot deactivate yourself' })
  async deactivateUser(
    @Param('id') id: string,
    @CurrentAdminUser() currentUser: AdminJwtPayload,
  ) {
    return this.usersService.deactivateUser(id, currentUser.sub, currentUser.role);
  }

  @Post(':id/reactivate')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  @ApiOperation({ summary: 'Reactivate a deactivated user' })
  @ApiResponse({ status: 200, description: 'User reactivated successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async reactivateUser(@Param('id') id: string) {
    return this.usersService.reactivateUser(id);
  }
}
