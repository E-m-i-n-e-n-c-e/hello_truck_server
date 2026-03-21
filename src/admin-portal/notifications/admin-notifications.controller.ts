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
import { AdminJwtPayload } from '../auth/admin-auth.service';
import { GetNotificationsRequestDto } from './dto/notification-request.dto';
import {
  GetNotificationsResponseDto,
  GetUnreadCountResponseDto,
  MarkAsReadResponseDto,
  MarkAllAsReadResponseDto,
  DashboardSummaryResponseDto,
} from './dto/notification-response.dto';
import { Serialize } from '../common/interceptors/serialize.interceptor';

@ApiTags('Admin Notifications')
@ApiBearerAuth()
@UseGuards(AdminAuthGuard)
@Controller('admin-api/notifications')
export class AdminNotificationsController {
  constructor(private readonly notificationsService: AdminNotificationsService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Dashboard summary — role-differentiated stats + recent notifications' })
  @Serialize(DashboardSummaryResponseDto)
  async getSummary(
    @CurrentAdminUser() user: AdminJwtPayload,
  ): Promise<DashboardSummaryResponseDto> {
    return this.notificationsService.getSummary(user.sub, user.role) as any;
  }

  @Get()
  @ApiOperation({ summary: 'Get notifications for current user' })
  @Serialize(GetNotificationsResponseDto)
  async getNotifications(
    @CurrentAdminUser() user: AdminJwtPayload,
    @Query() query: GetNotificationsRequestDto,
  ): Promise<GetNotificationsResponseDto> {
    return this.notificationsService.getNotifications(user.sub, query);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notification count' })
  @Serialize(GetUnreadCountResponseDto)
  async getUnreadCount(@CurrentAdminUser() user: AdminJwtPayload): Promise<GetUnreadCountResponseDto> {
    const count = await this.notificationsService.getUnreadCount(user.sub);
    return { count };
  }

  @Post(':id/read')
  @ApiOperation({ summary: 'Mark notification as read' })
  @Serialize(MarkAsReadResponseDto)
  async markAsRead(
    @Param('id') id: string,
    @CurrentAdminUser() user: AdminJwtPayload,
  ): Promise<MarkAsReadResponseDto> {
    await this.notificationsService.markAsRead(id, user.sub);
    return { success: true };
  }

  @Post('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  @Serialize(MarkAllAsReadResponseDto)
  async markAllAsRead(@CurrentAdminUser() user: AdminJwtPayload): Promise<MarkAllAsReadResponseDto> {
    await this.notificationsService.markAllAsRead(user.sub);
    return { success: true };
  }
}
