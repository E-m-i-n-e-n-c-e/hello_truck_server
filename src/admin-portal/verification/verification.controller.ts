/**
 * Verification Controller
 *
 * Endpoints for driver verification workflow:
 * - GET /admin-api/verifications - List verifications with filters
 * - GET /admin-api/verifications/:id - Get verification details
 * - POST /admin-api/verifications - Create new verification request
 * - PATCH /admin-api/verifications/:id/assign - Assign to agent
 * - POST /admin-api/verifications/:id/documents/:field/action - Approve/Reject document
 * - POST /admin-api/verifications/:id/approve - Approve entire verification
 * - POST /admin-api/verifications/:id/reject - Reject entire verification
 * - POST /admin-api/verifications/:id/revert-request - Request revert (within buffer)
 * - POST /admin-api/verifications/:id/revert-decision - Approve/Reject revert (Admin only)
 */
import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import { VerificationService, DocumentField } from './verification.service';
import {
  CreateVerificationRequestDto,
  ListVerificationsRequestDto,
  DocumentActionRequestDto,
  AssignVerificationRequestDto,
  RevertRequestDto,
  RevertDecisionRequestDto,
  RejectVerificationRequestDto,
} from './dto/verification-request.dto';
import {
  ListPendingDriversResponseDto,
  ListPendingDocumentsResponseDto,
  ListVerificationsResponseDto,
  GetVerificationResponseDto,
  GetDriverForVerificationResponseDto,
  CreateVerificationResponseDto,
  AssignVerificationResponseDto,
  DocumentActionResponseDto,
  ApproveVerificationResponseDto,
  RejectVerificationResponseDto,
  RevertRequestResponseDto,
  RevertDecisionResponseDto,
} from './dto/verification-response.dto';
import { AdminAuthGuard } from '../auth/guards/admin-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentAdminUser } from '../auth/decorators/current-admin-user.decorator';
import { AdminJwtPayload } from '../auth/admin-auth.service';
import { AuditLog } from '../audit-log/decorators/audit-log.decorator';
import { AuditActionTypes, AuditModules } from '../audit-log/audit-log.service';
import { Serialize } from '../common/interceptors/serialize.interceptor';

@ApiTags('Verifications')
@Controller('admin-api/verifications')
@UseGuards(AdminAuthGuard, RolesGuard)
@ApiBearerAuth()
export class VerificationController {
  constructor(private readonly verificationService: VerificationService) {}

  @Get('pending-drivers')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  @Serialize(ListPendingDriversResponseDto)
  @ApiOperation({ summary: 'List drivers with PENDING verification status (NEW drivers) - Admin only' })
  @ApiResponse({ status: 200, description: 'Returns paginated drivers with PENDING status and their verification requests' })
  async listPendingVerificationDrivers(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
  ): Promise<ListPendingDriversResponseDto> {
    return this.verificationService.listPendingVerificationDrivers(
      page ? Number(page) : 1,
      limit ? Number(limit) : 20,
      search,
    );
  }

  @Get('pending-documents')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  @Serialize(ListPendingDocumentsResponseDto)
  @ApiOperation({ summary: 'List VERIFIED drivers with PENDING documents (RE-VERIFICATION) - Admin only' })
  @ApiResponse({ status: 200, description: 'Returns paginated drivers with VERIFIED status but PENDING documents and their verification requests' })
  async listDriversWithPendingDocuments(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
  ): Promise<ListPendingDocumentsResponseDto> {
    return this.verificationService.listDriversWithPendingDocuments(
      page ? Number(page) : 1,
      limit ? Number(limit) : 20,
      search,
    );
  }

  @Get('my-assignments')
  @Roles(AdminRole.AGENT, AdminRole.FIELD_AGENT)
  @Serialize(ListVerificationsResponseDto)
  @ApiOperation({ summary: 'List verifications assigned to current user (Agent/Field Agent only)' })
  @ApiResponse({ status: 200, description: 'Returns paginated verifications assigned to the current user' })
  async listMyAssignments(
    @Query() query: ListVerificationsRequestDto,
    @CurrentAdminUser() user: AdminJwtPayload,
  ): Promise<ListVerificationsResponseDto> {
    // Force assignedToId to current user for agents
    return this.verificationService.listVerifications({
      ...query,
      assignedToId: user.sub,
    });
  }

  @Get()
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  @Serialize(ListVerificationsResponseDto)
  @ApiOperation({ summary: 'List all verification requests with filters - Admin only' })
  @ApiResponse({ status: 200, description: 'Returns paginated verification requests' })
  async listVerifications(@Query() query: ListVerificationsRequestDto): Promise<ListVerificationsResponseDto> {
    return this.verificationService.listVerifications(query);
  }

  @Get(':id')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.AGENT, AdminRole.FIELD_AGENT)
  @Serialize(GetVerificationResponseDto)
  @ApiOperation({ summary: 'Get verification details by ID' })
  @ApiResponse({ status: 200, description: 'Returns full verification details with documents and timeline' })
  @ApiResponse({ status: 403, description: 'Forbidden - Agent/Field Agent can only view assigned verifications' })
  async getVerificationById(
    @Param('id') id: string,
    @CurrentAdminUser() user: AdminJwtPayload,
  ): Promise<GetVerificationResponseDto> {
    return this.verificationService.getVerificationById(id, user.sub, user.role);
  }

  @Get('drivers/:driverId/details')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.AGENT, AdminRole.FIELD_AGENT)
  @Serialize(GetDriverForVerificationResponseDto)
  @ApiOperation({ summary: 'Get driver details for verification (auto-creates request if needed)' })
  @ApiResponse({ status: 200, description: 'Returns driver with verification request and documents' })
  @ApiResponse({ status: 403, description: 'Forbidden - Agent/Field Agent can only view assigned drivers' })
  async getDriverForVerification(
    @Param('driverId') driverId: string,
    @CurrentAdminUser() user: AdminJwtPayload,
  ): Promise<GetDriverForVerificationResponseDto> {
    return this.verificationService.getDriverForVerification(driverId, user.sub, user.role);
  }

  @Post()
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  @Serialize(CreateVerificationResponseDto)
  @AuditLog({
    action: AuditActionTypes.VERIFICATION_CREATED,
    module: AuditModules.VERIFICATION,
    description: 'Created verification request',
    entityType: 'DRIVER',
    captureRequest: true,
    captureResponse: true,
  })
  @ApiOperation({ summary: 'Create new verification request' })
  @ApiResponse({ status: 201, description: 'Verification request created' })
  async createVerification(@Body() dto: CreateVerificationRequestDto): Promise<CreateVerificationResponseDto> {
    return this.verificationService.createVerification(dto);
  }

  @Patch(':id/assign')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  @Serialize(AssignVerificationResponseDto)
  @AuditLog({
    action: AuditActionTypes.VERIFICATION_ASSIGNED,
    module: AuditModules.VERIFICATION,
    description: 'Assigned verification to agent',
    entityType: 'VERIFICATION',
    captureRequest: true,
  })
  @ApiOperation({ summary: 'Assign verification to an agent' })
  @ApiResponse({ status: 200, description: 'Verification assigned' })
  async assignVerification(
    @Param('id') id: string,
    @Body() dto: AssignVerificationRequestDto,
    @CurrentAdminUser() user: AdminJwtPayload,
  ): Promise<AssignVerificationResponseDto> {
    return this.verificationService.assignVerification(id, dto, user.sub);
  }

  @Post(':id/documents/:field/action')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.AGENT)
  @HttpCode(HttpStatus.OK)
  @Serialize(DocumentActionResponseDto)
  @ApiParam({ name: 'field', description: 'Document field: license, rcBook, fc, insurance, aadhar, selfie' })
  @ApiOperation({ summary: 'Approve or reject a specific document' })
  @ApiResponse({ status: 200, description: 'Document action recorded' })
  async documentAction(
    @Param('id') id: string,
    @Param('field') field: DocumentField,
    @Body() dto: DocumentActionRequestDto,
    @CurrentAdminUser() user: AdminJwtPayload,
  ): Promise<DocumentActionResponseDto> {
    return this.verificationService.documentAction(id, field, dto, user.sub);
  }

  @Post(':id/approve')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @Serialize(ApproveVerificationResponseDto)
  @AuditLog({
    action: AuditActionTypes.VERIFICATION_APPROVED,
    module: AuditModules.VERIFICATION,
    description: 'Approved verification (buffer started)',
    entityType: 'VERIFICATION',
    captureResponse: true,
  })
  @ApiOperation({ summary: 'Approve entire verification (starts 1-hour buffer)' })
  @ApiResponse({ status: 200, description: 'Verification approved, buffer started' })
  async approveVerification(
    @Param('id') id: string,
    @CurrentAdminUser() user: AdminJwtPayload,
  ): Promise<ApproveVerificationResponseDto> {
    return this.verificationService.approveVerification(id, user.sub);
  }

  @Post(':id/reject')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @Serialize(RejectVerificationResponseDto)
  @AuditLog({
    action: AuditActionTypes.VERIFICATION_REJECTED,
    module: AuditModules.VERIFICATION,
    description: 'Rejected verification',
    entityType: 'VERIFICATION',
    captureRequest: true,
  })
  @ApiOperation({ summary: 'Reject entire verification' })
  @ApiResponse({ status: 200, description: 'Verification rejected' })
  async rejectVerification(
    @Param('id') id: string,
    @Body() dto: RejectVerificationRequestDto,
    @CurrentAdminUser() user: AdminJwtPayload,
  ): Promise<RejectVerificationResponseDto> {
    return this.verificationService.rejectVerification(id, dto.reason, user.sub);
  }

  @Post(':id/revert-request')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.AGENT)
  @HttpCode(HttpStatus.OK)
  @Serialize(RevertRequestResponseDto)
  @AuditLog({
    action: AuditActionTypes.REVERT_REQUESTED,
    module: AuditModules.VERIFICATION,
    description: 'Requested verification revert',
    entityType: 'VERIFICATION',
    captureRequest: true,
  })
  @ApiOperation({ summary: 'Request revert (only within buffer window)' })
  @ApiResponse({ status: 200, description: 'Revert request submitted' })
  @ApiResponse({ status: 400, description: 'Buffer window expired or invalid status' })
  async requestRevert(
    @Param('id') id: string,
    @Body() dto: RevertRequestDto,
    @CurrentAdminUser() user: AdminJwtPayload,
  ): Promise<RevertRequestResponseDto> {
    return this.verificationService.requestRevert(id, dto, user.sub);
  }

  @Post(':id/revert-decision')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @Serialize(RevertDecisionResponseDto)
  @AuditLog({
    action: AuditActionTypes.REVERT_APPROVED,
    module: AuditModules.VERIFICATION,
    description: 'Handled revert request',
    entityType: 'VERIFICATION',
    captureRequest: true,
  })
  @ApiOperation({ summary: 'Approve or reject revert request (Admin only)' })
  @ApiResponse({ status: 200, description: 'Revert decision applied' })
  async handleRevertDecision(
    @Param('id') id: string,
    @Body() dto: RevertDecisionRequestDto,
    @CurrentAdminUser() user: AdminJwtPayload,
  ): Promise<RevertDecisionResponseDto> {
    return this.verificationService.handleRevertRequest(id, dto.approve, user.sub, user.role);
  }
}
