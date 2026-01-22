import {
  Controller,
  UseGuards,
  Get,
  Put,
  Delete,
  Body,
  Query,
} from '@nestjs/common';
import { Serialize } from 'src/common/interceptors/serialize.interceptor';
import { Roles } from 'src/token/decorators/roles.decorator';
import { AccessTokenGuard } from 'src/token/guards/access-token.guard';
import { RolesGuard } from 'src/token/guards/roles.guard';
import { User } from 'src/token/decorators/user.decorator';
import { DocumentsService } from '../documents/documents.service';
import {
  DriverDocumentsResponseDto,
  UpdateDriverDocumentsDto,
} from '../dtos/documents.dto';
import {
  UploadUrlResponseDto,
  uploadUrlDto,
} from 'src/common/dtos/upload-url.dto';

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

  @Get('upload-url')
  @Serialize(UploadUrlResponseDto)
  async getUploadUrl(
    @User('userId') userId: string,
    @Query() uploadUrlDto: uploadUrlDto,
  ): Promise<UploadUrlResponseDto> {
    return this.documentsService.getUploadUrl(userId, uploadUrlDto);
  }

  @Get('validate-aadhar')
  async validateAadhar(
    @User('userId') userId: string,
    @Query('aadharNumber') aadharNumber: string,
  ): Promise<{ isAvailable: boolean }> {
    return this.documentsService.validateAadharNumber(aadharNumber, userId);
  }

  @Get('validate-pan')
  async validatePan(
    @User('userId') userId: string,
    @Query('panNumber') panNumber: string,
  ): Promise<{ isAvailable: boolean }> {
    return this.documentsService.validatePanNumber(panNumber, userId);
  }
}
