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
import { VerificationStatus } from '@prisma/client';

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
  @Get('drivers/pending-documents')
  getDriversWithPendingDocuments(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('search') search?: string,
  ) {
    return this.adminService.getDriversWithPendingDocuments(page, limit, search);
  }


  /**
   * Get specific driver details
   */
  @UseGuards(AdminAuthGuard)
  @Get('drivers/:id')
  getDriverDetails(@Param('id') id: string) {
    return this.adminService.getDriverDetails(id);
  }

  /**
   * Update driver verification status and optionally set expiry dates
   */
  @UseGuards(AdminAuthGuard)
  @Patch('drivers/:id/verification')
  updateDriverVerification(
    @Param('id') id: string,
    @Body()
    body: {
      status: VerificationStatus;
      licenseExpiry?: string;
      fcExpiry?: string;
      insuranceExpiry?: string;
    },
  ) {
    const expiryDates = {
      licenseExpiry: body.licenseExpiry ? new Date(body.licenseExpiry) : undefined,
      fcExpiry: body.fcExpiry ? new Date(body.fcExpiry) : undefined,
      insuranceExpiry: body.insuranceExpiry
        ? new Date(body.insuranceExpiry)
        : undefined,
    };

    return this.adminService.updateDriverVerification(id, body.status, expiryDates);
  }
}
