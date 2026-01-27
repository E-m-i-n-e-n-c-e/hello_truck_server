/**
 * Support Controller
 *
 * Endpoints for Customer Support Dashboard
 */
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import { SupportService } from './support.service';
import { SearchBookingDto } from './dto/search-booking.dto';
import { CreateNoteDto } from './dto/create-note.dto';
import { AdminAuthGuard } from '../auth/guards/admin-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentAdminUser } from '../auth/decorators/current-admin-user.decorator';

@ApiTags('Customer Support')
@Controller('admin-api/support')
@UseGuards(AdminAuthGuard, RolesGuard)
@ApiBearerAuth()
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Get('bookings')
  @Roles(AdminRole.CUSTOMER_SUPPORT, AdminRole.ADMIN, AdminRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Search bookings with filters' })
  async searchBookings(@Query() query: SearchBookingDto) {
    return this.supportService.searchBookings(query);
  }

  @Get('bookings/:id')
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

  @Get('drivers/:id/location')
  @Roles(AdminRole.CUSTOMER_SUPPORT, AdminRole.ADMIN, AdminRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Fetch live driver location (logged)' })
  async getDriverLocation(
    @Param('id') id: string,
    @CurrentAdminUser() user: { userId: string; role: AdminRole },
  ) {
    return this.supportService.getDriverLocation(id, user.userId, user.role);
  }

  @Post('notes')
  @Roles(AdminRole.CUSTOMER_SUPPORT, AdminRole.ADMIN, AdminRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create support note for a booking' })
  async createNote(
    @Body() dto: CreateNoteDto,
    @CurrentAdminUser() user: { userId: string; role: AdminRole; firstName: string; lastName: string },
  ) {
    const userName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Support Agent';
    return this.supportService.createNote(dto, user.userId, user.role, userName);
  }

  @Get('notes/:bookingId')
  @Roles(AdminRole.CUSTOMER_SUPPORT, AdminRole.ADMIN, AdminRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get notes for a booking' })
  async getNotes(@Param('bookingId') bookingId: string) {
    return this.supportService.getNotes(bookingId);
  }
}
