/**
 * Audit Log Controller
 *
 * Endpoints for viewing audit logs (Super Admin and Admin only):
 * - GET /admin-api/logs - List logs with filters
 * - GET /admin-api/logs/:id - Get log details
 * - GET /admin-api/logs/export - Export logs as CSV data
 * - GET /admin-api/logs/archive - List archived files
 * - GET /admin-api/logs/archive/:dateKey - Get archived logs for a date
 * - POST /admin-api/logs/archive/trigger - Manually trigger archival (Super Admin)
 */
import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import { AuditLogService } from './audit-log.service';
import { AuditLogArchiveService } from './audit-log-archive.service';
import { ListLogsRequestDto } from './dto/audit-log-request.dto';
import {
  ListLogsResponseDto,
  GetLogByIdResponseDto,
  ExportLogsResponseDto,
  ListArchivedFilesResponseDto,
  GetArchivedLogsResponseDto,
  TriggerArchivalResponseDto,
} from './dto/audit-log-response.dto';
import { AdminAuthGuard } from '../auth/guards/admin-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Serialize } from '../common/interceptors/serialize.interceptor';

@ApiTags('Audit Logs')
@Controller('admin-api/logs')
@UseGuards(AdminAuthGuard, RolesGuard)
@Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN) // Only Super Admin and Admin can view logs
@ApiBearerAuth()
export class AuditLogController {
  constructor(
    private readonly auditLogService: AuditLogService,
    private readonly archiveService: AuditLogArchiveService,
  ) {}

  @Get()
  @Serialize(ListLogsResponseDto)
  @ApiOperation({ summary: 'List audit logs with filters' })
  @ApiResponse({ status: 200, description: 'Returns paginated audit logs' })
  async listLogs(@Query() query: ListLogsRequestDto): Promise<ListLogsResponseDto> {
    return this.auditLogService.listLogs(query);
  }

  @Get('export')
  @Serialize(ExportLogsResponseDto)
  @ApiOperation({ summary: 'Export audit logs (last 30 days, max 10000 records)' })
  @ApiResponse({ status: 200, description: 'Returns logs data for CSV export' })
  async exportLogs(@Query() query: ListLogsRequestDto): Promise<ExportLogsResponseDto> {
    const logs = await this.auditLogService.exportLogs(query);
    return { logs };
  }

  @Get('archive')
  @Serialize(ListArchivedFilesResponseDto)
  @ApiOperation({ summary: 'List archived log files in Firebase Storage' })
  @ApiQuery({ name: 'year', required: false, description: 'Filter by year (e.g., 2026)' })
  @ApiQuery({ name: 'month', required: false, description: 'Filter by month (e.g., 01)' })
  @ApiResponse({ status: 200, description: 'Returns list of archived file paths' })
  async listArchivedFiles(
    @Query('year') year?: string,
    @Query('month') month?: string,
  ): Promise<ListArchivedFilesResponseDto> {
    const files = await this.archiveService.listArchivedFiles(year, month);
    return { files };
  }

  @Get('archive/:dateKey')
  @Serialize(GetArchivedLogsResponseDto)
  @ApiOperation({ summary: 'Get archived logs for a specific date (YYYY-MM-DD)' })
  @ApiResponse({ status: 200, description: 'Returns archived logs for the date' })
  async getArchivedLogs(@Param('dateKey') dateKey: string): Promise<GetArchivedLogsResponseDto> {
    const logs = await this.archiveService.getArchivedLogs(dateKey);
    return { logs, count: logs?.length || 0 };
  }

  @Post('archive/trigger')
  @Roles(AdminRole.SUPER_ADMIN) // Only Super Admin can manually trigger
  @HttpCode(HttpStatus.OK)
  @Serialize(TriggerArchivalResponseDto)
  @ApiOperation({ summary: 'Manually trigger log archival (Super Admin only)' })
  @ApiResponse({ status: 200, description: 'Returns count of archived logs' })
  async triggerArchival(): Promise<TriggerArchivalResponseDto> {
    return this.archiveService.triggerArchival();
  }

  @Get(':id')
  @Serialize(GetLogByIdResponseDto)
  @ApiOperation({ summary: 'Get audit log details by ID' })
  @ApiResponse({ status: 200, description: 'Returns full log details with snapshots' })
  async getLogById(@Param('id') id: string): Promise<GetLogByIdResponseDto | null> {
    return this.auditLogService.getLogById(id);
  }
}

