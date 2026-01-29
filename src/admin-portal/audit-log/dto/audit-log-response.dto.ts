import { Expose, Type, Transform } from 'class-transformer';
import { AdminRole } from '@prisma/client';

/**
 * User info (nested in audit log)
 */
export class AuditLogUserDto {
  @Expose()
  id: string;

  @Expose()
  email: string;

  @Expose()
  firstName: string;

  @Expose()
  lastName: string;
}

/**
 * Audit log entry
 */
export class AuditLogDto {
  @Expose()
  id: string;

  @Expose()
  userId: string;

  @Expose()
  role: AdminRole;

  @Expose()
  actionType: string;

  @Expose()
  module: string;

  @Expose()
  description: string;

  @Expose()
  ipAddress: string | null;

  @Expose()
  userAgent: string | null;

  @Expose()
  @Transform(({ value }) => value, { toClassOnly: true })
  beforeSnapshot: any | null;

  @Expose()
  @Transform(({ value }) => value, { toClassOnly: true })
  afterSnapshot: any | null;

  @Expose()
  entityId: string | null;

  @Expose()
  entityType: string | null;

  @Expose()
  timestamp: Date;

  @Expose()
  @Type(() => AuditLogUserDto)
  user: AuditLogUserDto;
}

/**
 * Pagination info
 */
export class PaginationDto {
  @Expose()
  page: number;

  @Expose()
  limit: number;

  @Expose()
  total: number;

  @Expose()
  totalPages: number;
}

/**
 * Response: List audit logs
 * GET /admin-api/logs
 */
export class ListLogsResponseDto {
  @Expose()
  @Type(() => AuditLogDto)
  logs: AuditLogDto[];

  @Expose()
  @Type(() => PaginationDto)
  pagination: PaginationDto;
}

/**
 * Response: Get log by ID
 * GET /admin-api/logs/:id
 */
export class GetLogByIdResponseDto extends AuditLogDto {}

/**
 * Export log entry (for CSV)
 */
export class ExportLogDto {
  @Expose()
  id: string;

  @Expose()
  timestamp: string;

  @Expose()
  user: string;

  @Expose()
  email: string;

  @Expose()
  role: AdminRole;

  @Expose()
  action: string;

  @Expose()
  module: string;

  @Expose()
  description: string;

  @Expose()
  entityType: string;

  @Expose()
  entityId: string;

  @Expose()
  ipAddress: string;
}

/**
 * Response: Export logs
 * GET /admin-api/logs/export
 */
export class ExportLogsResponseDto {
  @Expose()
  @Type(() => ExportLogDto)
  logs: ExportLogDto[];
}

/**
 * Response: List archived files
 * GET /admin-api/logs/archive
 */
export class ListArchivedFilesResponseDto {
  @Expose()
  files: string[];
}

/**
 * Response: Get archived logs
 * GET /admin-api/logs/archive/:dateKey
 */
export class GetArchivedLogsResponseDto {
  @Expose()
  logs: any[] | null;

  @Expose()
  count: number;
}

/**
 * Response: Trigger archival
 * POST /admin-api/logs/archive/trigger
 */
export class TriggerArchivalResponseDto {
  @Expose()
  archived: number;
}
