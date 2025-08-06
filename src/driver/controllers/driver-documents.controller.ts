import { Controller, UseGuards, Get, Put, Delete, Body, Query } from '@nestjs/common';
import { Serialize } from 'src/common/interceptors/serialize.interceptor';
import { Roles } from 'src/token/decorators/roles.decorator';
import { AccessTokenGuard } from 'src/token/guards/access-token.guard';
import { RolesGuard } from 'src/token/guards/roles.guard';
import { User } from 'src/token/decorators/user.decorator';
import { DocumentsService } from '../documents/documents.service';
import { DriverDocumentsResponseDto, ExpiryAlertsResponseDto, UpdateDriverDocumentsDto, UploadUrlResponseDto, uploadUrlDto } from '../dtos/documents.dto';

@Controller('driver/documents')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('driver')
export class DriverDocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  @Serialize(DriverDocumentsResponseDto)
  async getDocuments(
    @User('userId') userId: string,
  ): Promise<DriverDocumentsResponseDto> {
    return this.documentsService.getDocuments(userId);
  }

  @Put()
  @Serialize(DriverDocumentsResponseDto)
  async updateDocuments(
    @User('userId') userId: string,
    @Body() updateDocumentsDto: UpdateDriverDocumentsDto,
  ) {
    return this.documentsService.updateDocuments(userId, updateDocumentsDto);
  }

  @Get('expiry-alerts')
  @Serialize(ExpiryAlertsResponseDto)
  async getExpiryAlerts(
    @User('userId') userId: string,
  ): Promise<ExpiryAlertsResponseDto> {
    return this.documentsService.getExpiryAlerts(userId);
  }

  @Get('upload-url')
  @Serialize(UploadUrlResponseDto)
  async getUploadUrl(
    @User('userId') userId: string,
    @Query() uploadUrlDto: uploadUrlDto,
  ): Promise<UploadUrlResponseDto> {
    return this.documentsService.getUploadUrl(userId, uploadUrlDto);
  }
}