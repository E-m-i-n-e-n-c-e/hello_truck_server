import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
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
import { AdminSupportService } from '../services/admin-support.service';
import { Serialize } from '../../common/interceptors/serialize.interceptor';
import {
  RejectSupportRefundRequestDto,
  SupportRefundRevertDecisionRequestDto,
  AdminCancelBookingDto,
} from '../dto/support-request.dto';
import { SupportRefundRequestResponseDto } from '../dto/support-response.dto';

@ApiTags('Admin Support')
@Controller('admin-api/support')
@UseGuards(AdminAuthGuard, RolesGuard)
@ApiBearerAuth()
@Roles(AdminRole.ADMIN, AdminRole.SUPER_ADMIN)
export class AdminSupportController {
  constructor(private readonly adminSupportService: AdminSupportService) {}

  @Post('refunds/:id/approve')
  @HttpCode(HttpStatus.OK)
  @Serialize(SupportRefundRequestResponseDto)
  @ApiOperation({ summary: 'Approve refund request and start buffer' })
  @ApiResponse({ status: 200, description: 'Refund approved' })
  @AuditLog({
    action: AuditActionTypes.REFUND_APPROVED,
    module: AuditModules.REFUND,
    description: 'Refund request :id approved',
    entityType: 'REFUND_REQUEST',
    captureSnapshots: true,
  })
  async approveRefund(
    @Param('id') id: string,
    @CurrentAdminUser() user: AdminJwtPayload,
  ) {
    return this.adminSupportService.approveRefund(id, user.sub, user.role);
  }

  @Post('refunds/:id/reject')
  @HttpCode(HttpStatus.OK)
  @Serialize(SupportRefundRequestResponseDto)
  @ApiOperation({ summary: 'Reject refund request' })
  @ApiResponse({ status: 200, description: 'Refund rejected' })
  @AuditLog({
    action: AuditActionTypes.REFUND_REJECTED,
    module: AuditModules.REFUND,
    description: 'Refund request :id rejected',
    entityType: 'REFUND_REQUEST',
    captureSnapshots: true,
  })
  async rejectRefund(
    @Param('id') id: string,
    @Body() dto: RejectSupportRefundRequestDto,
    @CurrentAdminUser() user: AdminJwtPayload,
  ) {
    return this.adminSupportService.rejectRefund(id, dto.reason, user.sub, user.role);
  }

  @Post('refunds/:id/revert-decision')
  @HttpCode(HttpStatus.OK)
  @Serialize(SupportRefundRequestResponseDto)
  @ApiOperation({ summary: 'Approve or reject a refund revert request' })
  @ApiResponse({ status: 200, description: 'Revert decision made' })
  @AuditLog({
    action: AuditActionTypes.UNRESOLVED,
    module: AuditModules.REFUND,
    description: 'Refund revert decision recorded for :id',
    entityType: 'REFUND_REQUEST',
    captureSnapshots: true,
  })
  async handleRevertDecision(
    @Param('id') id: string,
    @Body() dto: SupportRefundRevertDecisionRequestDto,
    @CurrentAdminUser() user: AdminJwtPayload,
  ) {
    return this.adminSupportService.handleRevertDecision(id, dto.approve, user.sub, user.role);
  }

  @Post('bookings/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Force cancel a booking (admin only)' })
  @AuditLog({
    action: AuditActionTypes.BOOKING_CANCELLED,
    module: AuditModules.SUPPORT,
    description: 'Booking :id cancelled by admin',
    entityType: 'BOOKING',
    captureSnapshots: true,
  })
  async cancelBooking(
    @Param('id') id: string,
    @Body() dto: AdminCancelBookingDto,
  ) {
    return this.adminSupportService.cancelBooking(id, dto.reason);
  }
}
