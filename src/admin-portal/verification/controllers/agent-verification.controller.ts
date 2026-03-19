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
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import { AgentVerificationService } from '../services/agent-verification.service';
import {
  DocumentActionRequestDto,
  ListVerificationsRequestDto,
  RevertDocumentRejectionRequestDto,
  VerificationRevertRequestDto,
} from '../dto/verification-request.dto';
import {
  ApproveVerificationResponseDto,
  DocumentActionResponseDto,
  ListVerificationsResponseDto,
  RevertRequestResponseDto,
  VerificationDetailResponseDto,
} from '../dto/verification-response.dto';
import {
  GetSignedUrlRequestDto,
  UploadPhotosRequestDto,
} from '../dto/field-verification-request.dto';
import {
  GetSignedUrlResponseDto,
  UploadPhotosResponseDto,
} from '../dto/field-verification-response.dto';
import { AdminAuthGuard } from '../../auth/guards/admin-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentAdminUser } from '../../auth/decorators/current-admin-user.decorator';
import { AdminJwtPayload } from '../../auth/admin-auth.service';
import { Serialize } from '../../common/interceptors/serialize.interceptor';
import { AuditLog } from '../../audit-log/decorators/audit-log.decorator';
import { AuditActionTypes, AuditModules } from '../../audit-log/audit-log.service';
import { DocumentField } from '../utils/verification.constants';

@ApiTags('Agent Verifications')
@Controller('admin-api/verifications')
@UseGuards(AdminAuthGuard, RolesGuard)
@ApiBearerAuth()
@Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.AGENT, AdminRole.FIELD_AGENT)
export class AgentVerificationController {
  constructor(private readonly agentVerificationService: AgentVerificationService) {}

  @Get('requests')
  @Serialize(ListVerificationsResponseDto)
  @ApiOperation({ summary: 'List verification requests' })
  async listRequests(
    @Query() query: ListVerificationsRequestDto,
    @CurrentAdminUser() user: AdminJwtPayload,
  ): Promise<ListVerificationsResponseDto> {
    return this.agentVerificationService.listRequests(query, user.sub, user.role);
  }

  @Get('requests/:requestId/details')
  @Serialize(VerificationDetailResponseDto)
  @ApiOperation({ summary: 'Get verification details by request id' })
  async getVerificationByRequest(
    @Param('requestId') requestId: string,
    @CurrentAdminUser() user: AdminJwtPayload,
  ): Promise<VerificationDetailResponseDto> {
    return this.agentVerificationService.getVerificationByRequest(requestId, user.sub, user.role);
  }

  @Post('requests/:id/documents/:field/action')
  @HttpCode(HttpStatus.OK)
  @Serialize(DocumentActionResponseDto)
  @ApiParam({ name: 'field', description: 'Document field: license, rcBook, fc, insurance, aadhar, selfie' })
  @ApiOperation({ summary: 'Approve or reject a specific document' })
  @AuditLog({
    action: AuditActionTypes.DOCUMENT_APPROVED,
    module: AuditModules.VERIFICATION,
    description: 'Document :field action performed for verification :id',
    entityType: 'VERIFICATION_REQUEST',
    captureSnapshots: true,
  })
  async documentAction(
    @Param('id') id: string,
    @Param('field') field: DocumentField,
    @Body() dto: DocumentActionRequestDto,
    @CurrentAdminUser() user: AdminJwtPayload,
  ): Promise<DocumentActionResponseDto> {
    return this.agentVerificationService.documentAction(id, field, dto, user.sub);
  }

  @Post('requests/:id/documents/:field/revert')
  @HttpCode(HttpStatus.OK)
  @Serialize(DocumentActionResponseDto)
  @ApiOperation({ summary: 'Revert individual document review decision' })
  @AuditLog({
    action: AuditActionTypes.DOCUMENT_DECISION_REVERTED,
    module: AuditModules.VERIFICATION,
    description: 'Document :field review decision reverted for verification :id',
    entityType: 'VERIFICATION_REQUEST',
    captureSnapshots: true,
  })
  async revertDocumentRejection(
    @Param('id') id: string,
    @Param('field') field: DocumentField,
    @Body() dto: RevertDocumentRejectionRequestDto,
    @CurrentAdminUser() user: AdminJwtPayload,
  ): Promise<DocumentActionResponseDto> {
    return this.agentVerificationService.revertDocumentDecision(id, field, dto, user.sub);
  }

  @Post('requests/:id/approve')
  @HttpCode(HttpStatus.OK)
  @Serialize(ApproveVerificationResponseDto)
  @ApiOperation({ summary: 'Approve verification and start buffer timer' })
  @AuditLog({
    action: AuditActionTypes.VERIFICATION_APPROVED,
    module: AuditModules.VERIFICATION,
    description: 'Verification :id approved',
    entityType: 'VERIFICATION_REQUEST',
    captureSnapshots: true,
  })
  async approveVerification(
    @Param('id') id: string,
    @CurrentAdminUser() user: AdminJwtPayload,
  ): Promise<ApproveVerificationResponseDto> {
    return this.agentVerificationService.approveVerification(id, user.sub);
  }

  @Post('requests/:id/revert-request')
  @HttpCode(HttpStatus.OK)
  @Serialize(RevertRequestResponseDto)
  @ApiOperation({ summary: 'Request revert during active buffer' })
  @AuditLog({
    action: AuditActionTypes.REVERT_REQUESTED,
    module: AuditModules.VERIFICATION,
    description: 'Revert requested for verification :id',
    entityType: 'VERIFICATION_REQUEST',
    captureSnapshots: true,
  })
  async requestRevert(
    @Param('id') id: string,
    @Body() dto: VerificationRevertRequestDto,
    @CurrentAdminUser() user: AdminJwtPayload,
  ): Promise<RevertRequestResponseDto> {
    return this.agentVerificationService.requestRevert(id, dto, user.sub);
  }

  @Get('requests/:id/photos/signed-url')
  @HttpCode(HttpStatus.OK)
  @Serialize(GetSignedUrlResponseDto)
  @ApiOperation({ summary: 'Get signed upload URL for field photo' })
  async getSignedUploadUrl(
    @Param('id') id: string,
    @Query() dto: GetSignedUrlRequestDto,
    @CurrentAdminUser() user: AdminJwtPayload,
  ): Promise<GetSignedUrlResponseDto> {
    return this.agentVerificationService.getSignedUploadUrl(
      id,
      dto.photoType,
      dto.contentType,
      dto.fileName,
      user.sub,
      user.role,
    );
  }

  @Post('requests/:id/photos')
  @HttpCode(HttpStatus.OK)
  @Serialize(UploadPhotosResponseDto)
  @ApiOperation({ summary: 'Upload or replace field photos' })
  async uploadPhotos(
    @Param('id') id: string,
    @Body() dto: UploadPhotosRequestDto,
    @CurrentAdminUser() user: AdminJwtPayload,
  ): Promise<UploadPhotosResponseDto> {
    return this.agentVerificationService.uploadPhotos(id, dto, user.sub, user.role);
  }
}
