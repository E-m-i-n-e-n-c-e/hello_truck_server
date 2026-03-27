import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import { AdminAuthGuard } from '../../auth/guards/admin-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentAdminUser } from '../../auth/decorators/current-admin-user.decorator';
import { AdminJwtPayload } from '../../auth/admin-auth.service';
import { AuditLog } from '../../audit-log/decorators/audit-log.decorator';
import { AuditActionTypes, AuditModules } from '../../audit-log/audit-log.service';
import { SupportService } from '../services/support.service';
import { Serialize } from '../../common/interceptors/serialize.interceptor';
import {
  CreateSupportNoteRequestDto,
  CreateSupportRefundRequestDto,
  ListSupportRefundsRequestDto,
  SearchBookingsRequestDto,
  SupportRefundRevertRequestDto,
} from '../dto/support-request.dto';
import {
  ListSupportRefundsResponseDto,
  SearchBookingsResponseDto,
  SupportBookingDetailResponseDto,
  SupportLiveTrackingResponseDto,
  SupportNoteResponseDto,
  SupportRefundRequestResponseDto,
} from '../dto/support-response.dto';

@ApiTags('Support')
@Controller('admin-api/support')
@UseGuards(AdminAuthGuard, RolesGuard)
@ApiBearerAuth()
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Get('bookings')
  @Serialize(SearchBookingsResponseDto)
  @Roles(AdminRole.CUSTOMER_SUPPORT, AdminRole.ADMIN, AdminRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Search bookings with filters' })
  async searchBookings(@Query() query: SearchBookingsRequestDto) {
    return this.supportService.searchBookings(query);
  }

  @Get('bookings/:id')
  @Serialize(SupportBookingDetailResponseDto)
  @Roles(AdminRole.CUSTOMER_SUPPORT, AdminRole.ADMIN, AdminRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get complete booking details' })
  async getBookingDetails(@Param('id') id: string) {
    return this.supportService.getBookingDetails(id);
  }

  @Get('customers/:identifier')
  @Roles(AdminRole.CUSTOMER_SUPPORT, AdminRole.ADMIN, AdminRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get customer details by ID or phone' })
  async getCustomerDetails(@Param('identifier') identifier: string) {
    return this.supportService.getCustomerDetails(identifier);
  }

  @Get('drivers/:identifier')
  @Roles(AdminRole.CUSTOMER_SUPPORT, AdminRole.ADMIN, AdminRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get driver details by ID or phone' })
  async getDriverDetails(@Param('identifier') identifier: string) {
    return this.supportService.getDriverDetails(identifier);
  }

  @Get('bookings/:bookingId/tracking')
  @Serialize(SupportLiveTrackingResponseDto)
  @Roles(AdminRole.CUSTOMER_SUPPORT, AdminRole.ADMIN, AdminRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Fetch live tracking for a booking (logged)' })
  async getBookingTracking(
    @Param('bookingId') bookingId: string,
    @CurrentAdminUser() user: AdminJwtPayload,
  ) {
    return this.supportService.getBookingTracking(bookingId, user.sub, user.role);
  }

  @Post('notes')
  @Serialize(SupportNoteResponseDto)
  @Roles(AdminRole.CUSTOMER_SUPPORT, AdminRole.ADMIN, AdminRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create support note for a booking' })
  @AuditLog({
    action: AuditActionTypes.SUPPORT_NOTE_ADDED,
    module: AuditModules.SUPPORT,
    description: 'Support note added to booking',
    entityType: 'BOOKING',
    captureSnapshots: true,
  })
  async createNote(
    @Body() dto: CreateSupportNoteRequestDto,
    @CurrentAdminUser() user: AdminJwtPayload,
  ) {
    return this.supportService.createNote(dto, user.sub, user.email);
  }

  @Get('notes/:bookingId')
  @Serialize(SupportNoteResponseDto)
  @Roles(AdminRole.CUSTOMER_SUPPORT, AdminRole.ADMIN, AdminRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get notes for a booking' })
  async getNotes(@Param('bookingId') bookingId: string) {
    return this.supportService.getNotes(bookingId);
  }

  @Post('refunds')
  @Serialize(SupportRefundRequestResponseDto)
  @Roles(AdminRole.CUSTOMER_SUPPORT, AdminRole.ADMIN, AdminRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a new refund request' })
  @ApiResponse({ status: 201, description: 'Refund request created' })
  @AuditLog({
    action: AuditActionTypes.REFUND_CREATED,
    module: AuditModules.REFUND,
    description: 'Refund request created for booking',
    entityType: 'REFUND_REQUEST',
    captureSnapshots: true,
  })
  async createRefund(
    @Body() dto: CreateSupportRefundRequestDto,
    @CurrentAdminUser() user: AdminJwtPayload,
  ) {
    return this.supportService.createRefund(dto, user.sub, user.role);
  }

  @Get('refunds')
  @Serialize(ListSupportRefundsResponseDto)
  @Roles(AdminRole.CUSTOMER_SUPPORT, AdminRole.ADMIN, AdminRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'List refund requests with filters' })
  async listRefunds(
    @Query() query: ListSupportRefundsRequestDto,
    @CurrentAdminUser() user: AdminJwtPayload,
  ) {
    return this.supportService.listRequests(query, user.sub, user.role);
  }

  @Get('refunds/:id')
  @Serialize(SupportRefundRequestResponseDto)
  @Roles(AdminRole.CUSTOMER_SUPPORT, AdminRole.ADMIN, AdminRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get refund request by ID' })
  async getRefundById(
    @Param('id') id: string,
    @CurrentAdminUser() user: AdminJwtPayload,
  ) {
    return this.supportService.getRefundById(id, user.sub, user.role);
  }

  @Post('refunds/:id/revert')
  @Roles(AdminRole.CUSTOMER_SUPPORT, AdminRole.ADMIN, AdminRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @Serialize(SupportRefundRequestResponseDto)
  @ApiOperation({ summary: 'Request revert during active buffer' })
  @AuditLog({
    action: AuditActionTypes.REFUND_REVERT_REQUESTED,
    module: AuditModules.REFUND,
    description: 'Revert requested for refund :id',
    entityType: 'REFUND_REQUEST',
    captureSnapshots: true,
  })
  async requestRevert(
    @Param('id') id: string,
    @Body() dto: SupportRefundRevertRequestDto,
    @CurrentAdminUser() user: AdminJwtPayload,
  ) {
    return this.supportService.requestRevert(id, dto.reason, user.sub, user.role);
  }
}
