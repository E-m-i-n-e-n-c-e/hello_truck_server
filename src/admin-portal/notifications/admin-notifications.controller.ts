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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AdminNotificationsService } from './admin-notifications.service';
import { AdminAuthGuard } from '../auth/guards/admin-auth.guard';
import { CurrentAdminUser } from '../auth/decorators/current-admin-user.decorator';
import { AdminUser } from '@prisma/client';
import { GetNotificationsRequestDto } from './dto/notification-request.dto';
import {
  GetNotificationsResponseDto,
  GetUnreadCountResponseDto,
  MarkAsReadResponseDto,
  MarkAllAsReadResponseDto,
} from './dto/notification-response.dto';
import { Serialize } from '../common/interceptors/serialize.interceptor';

@ApiTags('Admin Notifications')
@ApiBearerAuth()
@UseGuards(AdminAuthGuard)
@Controller('admin-api/notifications')
export class AdminNotificationsController {
  constructor(private readonly notificationsService: AdminNotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Get notifications for current user' })
  @Serialize(GetNotificationsResponseDto)
  async getNotifications(
    @CurrentAdminUser() user: AdminUser,
    @Query() query: GetNotificationsRequestDto,
  ): Promise<GetNotificationsResponseDto> {
    return this.notificationsService.getNotifications(user.id, query);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notification count' })
  @Serialize(GetUnreadCountResponseDto)
  async getUnreadCount(@CurrentAdminUser() user: AdminUser): Promise<GetUnreadCountResponseDto> {
    const count = await this.notificationsService.getUnreadCount(user.id);
    return { count };
  }

  @Post(':id/read')
  @ApiOperation({ summary: 'Mark notification as read' })
  @Serialize(MarkAsReadResponseDto)
  async markAsRead(
    @Param('id') id: string,
    @CurrentAdminUser() user: AdminUser,
  ): Promise<MarkAsReadResponseDto> {
    await this.notificationsService.markAsRead(id, user.id);
    return { success: true };
  }

  @Post('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  @Serialize(MarkAllAsReadResponseDto)
  async markAllAsRead(@CurrentAdminUser() user: AdminUser): Promise<MarkAllAsReadResponseDto> {
    await this.notificationsService.markAllAsRead(user.id);
    return { success: true };
  }
}
