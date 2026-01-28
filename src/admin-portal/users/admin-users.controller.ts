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
import { AdminAuthGuard } from '../auth/guards/admin-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentAdminUser } from '../auth/decorators/current-admin-user.decorator';
import { AdminJwtPayload } from '../auth/admin-auth.service';
import { Serialize } from '../common/interceptors/serialize.interceptor';
import {
  CreateUserRequestDto,
  UpdateUserRequestDto,
  ListUsersRequestDto,
} from './dto/user-request.dto';
import {
  ListUsersResponseDto,
  GetUserResponseDto,
  CreateUserResponseDto,
  UpdateUserResponseDto,
  DeactivateUserResponseDto,
  ReactivateUserResponseDto,
} from './dto/user-response.dto';

@ApiTags('Admin Users')
@Controller('admin-api/users')
@UseGuards(AdminAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AdminUsersController {
  constructor(private readonly usersService: AdminUsersService) {}

  @Get()
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  @Serialize(ListUsersResponseDto)
  @ApiOperation({ summary: 'List all admin users' })
  @ApiResponse({ status: 200, description: 'Returns list of users with pagination', type: ListUsersResponseDto })
  async listUsers(@Query() query: ListUsersRequestDto): Promise<ListUsersResponseDto> {
    return this.usersService.listUsers(query);
  }

  @Get(':id')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  @Serialize(GetUserResponseDto)
  @ApiOperation({ summary: 'Get admin user by ID' })
  @ApiResponse({ status: 200, description: 'Returns user details', type: GetUserResponseDto })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUserById(@Param('id') id: string): Promise<GetUserResponseDto> {
    return this.usersService.getUserById(id);
  }

  @Post()
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  @Serialize(CreateUserResponseDto)
  @ApiOperation({ summary: 'Create new admin user' })
  @ApiResponse({ status: 201, description: 'User created successfully', type: CreateUserResponseDto })
  @ApiResponse({ status: 409, description: 'Email already in use' })
  async createUser(
    @Body() dto: CreateUserRequestDto,
    @CurrentAdminUser() currentUser: AdminJwtPayload,
  ): Promise<CreateUserResponseDto> {
    return this.usersService.createUser(dto, currentUser.role);
  }

  @Patch(':id')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  @Serialize(UpdateUserResponseDto)
  @ApiOperation({ summary: 'Update admin user' })
  @ApiResponse({ status: 200, description: 'User updated successfully', type: UpdateUserResponseDto })
  @ApiResponse({ status: 404, description: 'User not found' })
  async updateUser(
    @Param('id') id: string,
    @Body() dto: UpdateUserRequestDto,
    @CurrentAdminUser() currentUser: AdminJwtPayload,
  ): Promise<UpdateUserResponseDto> {
    return this.usersService.updateUser(id, dto, currentUser.sub, currentUser.role);
  }

  @Delete(':id')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @Serialize(DeactivateUserResponseDto)
  @ApiOperation({ summary: 'Deactivate admin user (soft delete)' })
  @ApiResponse({ status: 200, description: 'User deactivated successfully', type: DeactivateUserResponseDto })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 403, description: 'Cannot deactivate yourself' })
  async deactivateUser(
    @Param('id') id: string,
    @CurrentAdminUser() currentUser: AdminJwtPayload,
  ): Promise<DeactivateUserResponseDto> {
    return this.usersService.deactivateUser(id, currentUser.sub, currentUser.role);
  }

  @Post(':id/reactivate')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  @Serialize(ReactivateUserResponseDto)
  @ApiOperation({ summary: 'Reactivate a deactivated user' })
  @ApiResponse({ status: 200, description: 'User reactivated successfully', type: ReactivateUserResponseDto })
  @ApiResponse({ status: 404, description: 'User not found' })
  async reactivateUser(@Param('id') id: string): Promise<ReactivateUserResponseDto> {
    return this.usersService.reactivateUser(id);
  }
}
