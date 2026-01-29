/**
 * Field Verification Controller
 *
 * Endpoints for Field Agents
 */
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import { FieldVerificationService } from './field-verification.service';
import {
  UploadPhotosRequestDto,
  CompleteVerificationRequestDto,
  FieldVerificationRevertRequestDto,
  GetSignedUrlRequestDto,
} from './dto/field-verification-request.dto';
import {
  GetAssignedVerificationsResponseDto,
  GetVerificationDetailsResponseDto,
  GetDriverDocumentsResponseDto,
  UploadPhotosResponseDto,
  CompleteVerificationResponseDto,
  RevertResponseDto,
  GetSignedUrlResponseDto,
} from './dto/field-verification-response.dto';
import { AdminAuthGuard } from '../auth/guards/admin-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentAdminUser } from '../auth/decorators/current-admin-user.decorator';
import { Serialize } from '../common/interceptors/serialize.interceptor';

@ApiTags('Field Verification')
@Controller('admin-api/field-verification')
@UseGuards(AdminAuthGuard, RolesGuard)
@ApiBearerAuth()
export class FieldVerificationController {
  constructor(private readonly service: FieldVerificationService) {}

  @Get('assigned')
  @Roles(AdminRole.FIELD_AGENT, AdminRole.ADMIN, AdminRole.SUPER_ADMIN)
  @Serialize(GetAssignedVerificationsResponseDto)
  @ApiOperation({ summary: 'Get verifications assigned to current user' })
  async getAssignedVerifications(
    @CurrentAdminUser() user: { userId: string; role: AdminRole },
  ): Promise<GetAssignedVerificationsResponseDto> {
    const verifications = await this.service.getAssignedVerifications(user.userId);
    return { verifications };
  }

  @Get(':id')
  @Roles(AdminRole.FIELD_AGENT, AdminRole.ADMIN, AdminRole.SUPER_ADMIN)
  @Serialize(GetVerificationDetailsResponseDto)
  @ApiOperation({ summary: 'Get verification details' })
  async getVerificationDetails(
    @Param('id') id: string,
    @CurrentAdminUser() user: { userId: string; role: AdminRole },
  ): Promise<GetVerificationDetailsResponseDto> {
    return this.service.getVerificationDetails(id, user.userId);
  }

  @Get(':id/documents')
  @Roles(AdminRole.FIELD_AGENT, AdminRole.ADMIN, AdminRole.SUPER_ADMIN)
  @Serialize(GetDriverDocumentsResponseDto)
  @ApiOperation({ summary: 'Get driver documents for verification' })
  async getDriverDocuments(
    @Param('id') id: string,
    @CurrentAdminUser() user: { userId: string; role: AdminRole },
  ): Promise<GetDriverDocumentsResponseDto> {
    return this.service.getDriverDocuments(id, user.userId);
  }

  @Post(':id/photos')
  @Roles(AdminRole.FIELD_AGENT, AdminRole.ADMIN, AdminRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @Serialize(UploadPhotosResponseDto)
  @ApiOperation({ summary: 'Upload field verification photos' })
  async uploadPhotos(
    @Param('id') id: string,
    @Body() dto: UploadPhotosRequestDto,
    @CurrentAdminUser() user: { userId: string; role: AdminRole },
  ): Promise<UploadPhotosResponseDto> {
    dto.verificationId = id;
    return this.service.uploadPhotos(dto, user.userId, user.role);
  }

  @Post(':id/complete')
  @Roles(AdminRole.FIELD_AGENT, AdminRole.ADMIN, AdminRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @Serialize(CompleteVerificationResponseDto)
  @ApiOperation({ summary: 'Complete field verification' })
  async completeVerification(
    @Param('id') id: string,
    @Body() dto: CompleteVerificationRequestDto,
    @CurrentAdminUser() user: { userId: string; role: AdminRole },
  ): Promise<CompleteVerificationResponseDto> {
    return this.service.completeVerification(id, dto.notes, user.userId, user.role);
  }

  @Post(':id/revert')
  @Roles(AdminRole.FIELD_AGENT, AdminRole.ADMIN, AdminRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @Serialize(RevertResponseDto)
  @ApiOperation({ summary: 'Request revert for field verification' })
  async requestRevert(
    @Param('id') id: string,
    @Body() dto: FieldVerificationRevertRequestDto,
    @CurrentAdminUser() user: { userId: string; role: AdminRole },
  ): Promise<RevertResponseDto> {
    return this.service.requestRevert(id, dto.reason, user.userId, user.role);
  }

  @Post(':id/photos/signed-url')
  @Roles(AdminRole.FIELD_AGENT, AdminRole.ADMIN, AdminRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @Serialize(GetSignedUrlResponseDto)
  @ApiOperation({ summary: 'Get signed URL for photo upload' })
  @ApiResponse({
    status: 200,
    description: 'Signed URL generated successfully',
    schema: {
      type: 'object',
      properties: {
        signedUrl: { type: 'string', description: 'URL to upload the file to' },
        publicUrl: { type: 'string', description: 'Public URL to access the file after upload' },
        token: { type: 'string', description: 'Firebase storage download token' },
        filePath: { type: 'string', description: 'Path where file will be stored' },
      },
    },
  })
  async getSignedUploadUrl(
    @Param('id') id: string,
    @Body() dto: GetSignedUrlRequestDto,
    @CurrentAdminUser() user: { userId: string; role: AdminRole },
  ): Promise<GetSignedUrlResponseDto> {
    return this.service.getSignedUploadUrl(id, dto.photoType, dto.contentType, dto.fileName, user.userId);
  }
}
