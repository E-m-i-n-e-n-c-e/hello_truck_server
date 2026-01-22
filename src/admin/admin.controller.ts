import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminAuthGuard } from './guards/admin-auth.guard';
import {
  DriverResponseDto,
  AdminDriverListResponseDto,
  UpdateDriverVerificationDto,
} from './dtos/admin.dto';
import { Serialize } from 'src/common/interceptors/serialize.interceptor';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post('auth/login')
  login(@Body() body: { username: string; password: string }) {
    return this.adminService.login(body.username, body.password);
  }

  /**
   * Get all drivers with PENDING verification status
   */
  @UseGuards(AdminAuthGuard)
  @Serialize(AdminDriverListResponseDto)
  @Get('drivers/pending-verification')
  getPendingVerificationDrivers(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('search') search?: string,
  ) {
    return this.adminService.getPendingVerificationDrivers(page, limit, search);
  }

  /**
   * Get drivers who are VERIFIED but have PENDING documents
   */
  @UseGuards(AdminAuthGuard)
  @Serialize(AdminDriverListResponseDto)
  @Get('drivers/pending-documents')
  getDriversWithPendingDocuments(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('search') search?: string,
  ) {
    return this.adminService.getDriversWithPendingDocuments(
      page,
      limit,
      search,
    );
  }

  /**
   * Get specific driver details
   */
  @UseGuards(AdminAuthGuard)
  @Serialize(DriverResponseDto)
  @Get('drivers/:id')
  getDriverDetails(@Param('id') id: string) {
    return this.adminService.getDriverDetails(id);
  }

  /**
   * Update driver verification status and optionally set expiry dates
   */
  @UseGuards(AdminAuthGuard)
  @Serialize(DriverResponseDto)
  @Patch('drivers/:id/verification')
  updateDriverVerification(
    @Param('id') id: string,
    @Body() dto: UpdateDriverVerificationDto,
  ) {
    return this.adminService.updateDriverVerification(id, dto);
  }
}
