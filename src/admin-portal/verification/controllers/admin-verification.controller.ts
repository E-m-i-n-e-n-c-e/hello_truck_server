import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import { AdminVerificationService } from '../services/admin-verification.service';
import {
  AssignVerificationRequestDto,
  CreateVerificationRequestDto,
  ListVerificationDriversRequestDto,
  RejectVerificationRequestDto,
  RevertDecisionRequestDto,
} from '../dto/verification-request.dto';
import {
  AssignVerificationResponseDto,
  CreateVerificationResponseDto,
  ListVerificationDriversResponseDto,
  RejectVerificationResponseDto,
  RevertDecisionResponseDto,
  VerificationDetailResponseDto,
} from '../dto/verification-response.dto';
import { AdminAuthGuard } from '../../auth/guards/admin-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentAdminUser } from '../../auth/decorators/current-admin-user.decorator';
import { AdminJwtPayload } from '../../auth/admin-auth.service';
import { Serialize } from '../../common/interceptors/serialize.interceptor';
import { AuditLog } from '../../audit-log/decorators/audit-log.decorator';
import { AuditActionTypes, AuditModules } from '../../audit-log/audit-log.service';

@ApiTags('Admin Verifications')
@Controller('admin-api/verifications')
@UseGuards(AdminAuthGuard, RolesGuard)
@ApiBearerAuth()
@Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
export class AdminVerificationController {
  constructor(private readonly adminVerificationService: AdminVerificationService) {}

  @Get('drivers')
  @Serialize(ListVerificationDriversResponseDto)
  @ApiOperation({ summary: 'List drivers for admin verification search' })
  async listDrivers(
    @Query() query: ListVerificationDriversRequestDto,
  ): Promise<ListVerificationDriversResponseDto> {
    return this.adminVerificationService.listDrivers(query);
  }

  @Get('drivers/:driverId/details')
  @Serialize(VerificationDetailResponseDto)
  @ApiOperation({ summary: 'Get verification details by driver id (admin only)' })
  async getDriverForVerification(
    @Param('driverId') driverId: string,
  ): Promise<VerificationDetailResponseDto> {
    return this.adminVerificationService.getDriverForVerification(driverId);
  }

  @Post('requests')
  @HttpCode(HttpStatus.OK)
  @Serialize(CreateVerificationResponseDto)
  @ApiOperation({ summary: 'Create verification request for a driver (idempotent)' })
  @AuditLog({
    action: AuditActionTypes.VERIFICATION_REQUEST_CREATED,
    module: AuditModules.VERIFICATION,
    description: 'Verification request created for driver',
    entityType: 'VERIFICATION_REQUEST',
    captureSnapshots: true,
  })
  async createVerificationRequest(
    @Body() dto: CreateVerificationRequestDto,
  ): Promise<CreateVerificationResponseDto> {
    return this.adminVerificationService.createVerificationRequest(dto);
  }

  @Patch('requests/:id/assign')
  @Serialize(AssignVerificationResponseDto)
  @ApiOperation({ summary: 'Assign verification request' })
  @AuditLog({
    action: AuditActionTypes.VERIFICATION_ASSIGNED,
    module: AuditModules.VERIFICATION,
    description: 'Verification request :id assigned',
    entityType: 'VERIFICATION_REQUEST',
    captureSnapshots: true,
  })
  async assignVerification(
    @Param('id') id: string,
    @Body() dto: AssignVerificationRequestDto,
    @CurrentAdminUser() user: AdminJwtPayload,
  ): Promise<AssignVerificationResponseDto> {
    return this.adminVerificationService.assignVerification(id, dto, user.sub);
  }

  @Post('requests/:id/reject-driver')
  @HttpCode(HttpStatus.OK)
  @Serialize(RejectVerificationResponseDto)
  @ApiOperation({ summary: 'Reject whole driver verification' })
  @AuditLog({
    action: AuditActionTypes.VERIFICATION_REJECTED,
    module: AuditModules.VERIFICATION,
    description: 'Driver verification :id rejected',
    entityType: 'VERIFICATION_REQUEST',
    captureSnapshots: true,
  })
  async rejectDriver(
    @Param('id') id: string,
    @Body() dto: RejectVerificationRequestDto,
    @CurrentAdminUser() user: AdminJwtPayload,
  ): Promise<RejectVerificationResponseDto> {
    return this.adminVerificationService.rejectDriver(id, dto.reason, user.sub);
  }

  @Post('drivers/:driverId/revert-rejection')
  @HttpCode(HttpStatus.OK)
  @Serialize(CreateVerificationResponseDto)
  @ApiOperation({ summary: 'Revert rejected driver and ensure active request exists' })
  @ApiResponse({ status: 200, description: 'Rejected driver reverted' })
  @AuditLog({
    action: AuditActionTypes.DRIVER_REJECTION_REVERTED,
    module: AuditModules.VERIFICATION,
    description: 'Rejected driver :driverId restored and active request ensured',
    entityType: 'DRIVER',
    captureSnapshots: true,
  })
  async revertRejectedDriver(
    @Param('driverId') driverId: string,
    @CurrentAdminUser() user: AdminJwtPayload,
  ): Promise<CreateVerificationResponseDto> {
    return this.adminVerificationService.revertRejectedDriver(driverId, user.sub);
  }

  @Post('requests/:id/revert-decision')
  @HttpCode(HttpStatus.OK)
  @Serialize(RevertDecisionResponseDto)
  @ApiOperation({ summary: 'Approve or reject revert request (admin only)' })
  @AuditLog({
    action: AuditActionTypes.REVERT_APPROVED,
    module: AuditModules.VERIFICATION,
    description: 'Revert decision recorded for verification :id',
    entityType: 'VERIFICATION_REQUEST',
    captureSnapshots: true,
  })
  async handleRevertDecision(
    @Param('id') id: string,
    @Body() dto: RevertDecisionRequestDto,
    @CurrentAdminUser() user: AdminJwtPayload,
  ): Promise<RevertDecisionResponseDto> {
    return this.adminVerificationService.handleRevertDecision(id, dto, user.sub, user.role);
  }
}
