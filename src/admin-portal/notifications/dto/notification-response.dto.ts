import { Expose, Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

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
