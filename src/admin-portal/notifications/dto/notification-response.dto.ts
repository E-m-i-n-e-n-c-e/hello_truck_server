import { Expose, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Notification Response DTO
 */
export class NotificationResponseDto {
  @ApiProperty()
  @Expose()
  id: string;

  @ApiProperty()
  @Expose()
  userId: string;

  @ApiProperty()
  @Expose()
  title: string;

  @ApiProperty()
  @Expose()
  message: string;

  @ApiProperty()
  @Expose()
  entityId: string | null;

  @ApiProperty()
  @Expose()
  entityType: string | null;

  @ApiProperty()
  @Expose()
  driverId: string | null;

  @ApiProperty()
  @Expose()
  actionUrl: string | null;

  @ApiProperty()
  @Expose()
  isRead: boolean;

  @ApiProperty()
  @Expose()
  createdAt: Date;
}

/**
 * Pagination Response DTO
 */
export class PaginationResponseDto {
  @ApiProperty()
  @Expose()
  page: number;

  @ApiProperty()
  @Expose()
  limit: number;

  @ApiProperty()
  @Expose()
  total: number;

  @ApiProperty()
  @Expose()
  totalPages: number;
}

/**
 * Get Notifications Response DTO
 */
export class GetNotificationsResponseDto {
  @ApiProperty({ type: [NotificationResponseDto] })
  @Expose()
  @Type(() => NotificationResponseDto)
  notifications: NotificationResponseDto[];

  @ApiProperty()
  @Expose()
  unreadCount: number;

  @ApiProperty({ type: PaginationResponseDto })
  @Expose()
  @Type(() => PaginationResponseDto)
  pagination: PaginationResponseDto;
}

/**
 * Get Unread Count Response DTO
 */
export class GetUnreadCountResponseDto {
  @ApiProperty()
  @Expose()
  count: number;
}

/**
 * Mark As Read Response DTO
 */
export class MarkAsReadResponseDto {
  @ApiProperty()
  @Expose()
  success: boolean;
}

/**
 * Mark All As Read Response DTO
 */
export class MarkAllAsReadResponseDto {
  @ApiProperty()
  @Expose()
  success: boolean;
}

// ─── Dashboard Summary DTOs ───────────────────────────────────────────────────

/**
 * Dashboard Stats DTO
 * Consolidated stats for both ADMIN and AGENT roles
 */
export class DashboardStatsDto {
  @ApiPropertyOptional({ description: 'All requests with an active status' })
  @Expose()
  totalActive?: number;

  @ApiPropertyOptional({ description: 'Active requests with no assignee' })
  @Expose()
  unassigned?: number;

  @ApiPropertyOptional({ description: 'Requests in IN_REVIEW status' })
  @Expose()
  inReview?: number;

  @ApiPropertyOptional({ description: 'Requests in REVERTED status' })
  @Expose()
  reverted?: number;

  @ApiPropertyOptional({ description: 'Requests in REVERT_REQUESTED status' })
  @Expose()
  revertRequested?: number;

  @ApiPropertyOptional({ description: 'Requests assigned specifically to this admin' })
  @Expose()
  myAssignments?: number;

  @ApiPropertyOptional({ description: 'All active requests assigned to me' })
  @Expose()
  myActive?: number;

  @ApiPropertyOptional({ description: 'Latest refund requests in PENDING status' })
  @Expose()
  pendingRefundRequests?: number;

  @ApiPropertyOptional({ description: 'Latest refund requests in REVERT_REQUESTED status' })
  @Expose()
  refundRevertRequests?: number;
}

/**
 * Dashboard Summary Response DTO
 * `role` discriminates the stats shape on the frontend.
 */
export class DashboardSummaryResponseDto {
  @ApiProperty({ enum: ['admin', 'agent', 'support'], description: 'Identifies which stats shape is returned' })
  @Expose()
  role: 'admin' | 'agent' | 'support';

  @ApiProperty({ description: 'Role-specific verification stats', type: DashboardStatsDto })
  @Expose()
  @Type(() => DashboardStatsDto)
  stats: DashboardStatsDto;

  @ApiProperty({ type: [NotificationResponseDto], description: '5 most recent notifications for this user' })
  @Expose()
  @Type(() => NotificationResponseDto)
  recentNotifications: NotificationResponseDto[];

  @ApiProperty()
  @Expose()
  unreadNotifications: number;
}

