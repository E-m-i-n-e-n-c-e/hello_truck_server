/**
 * Admin Notifications Controller
 *
 * Endpoints for managing admin in-app notifications:
 * - List notifications
 * - Mark as read
 * - Get unread count
 */
import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
  ParseBoolPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AdminNotificationsService } from './admin-notifications.service';
import { AdminAuthGuard } from '../auth/guards/admin-auth.guard';
import { CurrentAdminUser } from '../auth/decorators/current-admin-user.decorator';
import { AdminUser } from '@prisma/client';

@ApiTags('Admin Notifications')
@ApiBearerAuth()
@UseGuards(AdminAuthGuard)
@Controller('admin-api/notifications')
export class AdminNotificationsController {
  constructor(private readonly notificationsService: AdminNotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Get notifications for current user' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'unreadOnly', required: false, type: Boolean })
  async getNotifications(
    @CurrentAdminUser() user: AdminUser,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('unreadOnly', new DefaultValuePipe(false), ParseBoolPipe) unreadOnly: boolean,
  ) {
    return this.notificationsService.getNotifications(user.id, { page, limit, unreadOnly });
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notification count' })
  async getUnreadCount(@CurrentAdminUser() user: AdminUser) {
    const count = await this.notificationsService.getUnreadCount(user.id);
    return { count };
  }

  @Post(':id/read')
  @ApiOperation({ summary: 'Mark notification as read' })
  async markAsRead(
    @Param('id') id: string,
    @CurrentAdminUser() user: AdminUser,
  ) {
    await this.notificationsService.markAsRead(id, user.id);
    return { success: true };
  }

  @Post('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  async markAllAsRead(@CurrentAdminUser() user: AdminUser) {
    await this.notificationsService.markAllAsRead(user.id);
    return { success: true };
  }
}
