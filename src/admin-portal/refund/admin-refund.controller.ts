/**
 * Admin Refund Controller
 *
 * Endpoints:
 * - POST /admin-api/refunds - Create refund (Support)
 * - GET /admin-api/refunds - List refunds with filters
 * - GET /admin-api/refunds/:id - Get refund details
 * - POST /admin-api/refunds/:id/approve - Approve refund (Admin)
 * - POST /admin-api/refunds/:id/revert - Request revert (Support)
 * - POST /admin-api/refunds/:id/revert-decision - Approve/reject revert (Admin)
 *
 * Note: Rejection is handled via revert workflow per requirements
 */
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import { AdminRefundService } from './admin-refund.service';
import { CreateRefundDto } from './dto/create-refund.dto';
import { ListRefundsDto } from './dto/list-refunds.dto';
import { RejectRefundDto } from './dto/reject-refund.dto';
import { RefundRevertRequestDto } from './dto/revert-request.dto';
import { RefundRevertDecisionDto } from './dto/revert-decision.dto';
import { AdminAuthGuard } from '../auth/guards/admin-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentAdminUser } from '../auth/decorators/current-admin-user.decorator';

@ApiTags('Refund Management')
@Controller('admin-api/refunds')
@UseGuards(AdminAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AdminRefundController {
  constructor(private readonly refundService: AdminRefundService) {}

  @Post()
  @Roles(AdminRole.CUSTOMER_SUPPORT, AdminRole.ADMIN, AdminRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a new refund request' })
  @ApiResponse({ status: 201, description: 'Refund request created' })
  async createRefund(
    @Body() dto: CreateRefundDto,
    @CurrentAdminUser() user: { userId: string; role: AdminRole },
  ) {
    return this.refundService.createRefund(dto, user.userId, user.role);
  }

  @Get()
  @Roles(AdminRole.CUSTOMER_SUPPORT, AdminRole.ADMIN, AdminRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'List refund requests with filters' })
  @ApiResponse({ status: 200, description: 'Returns paginated refund list' })
  async listRefunds(@Query() query: ListRefundsDto) {
    return this.refundService.listRefunds(query);
  }

  @Get(':id')
  @Roles(AdminRole.CUSTOMER_SUPPORT, AdminRole.ADMIN, AdminRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get refund request by ID' })
  @ApiResponse({ status: 200, description: 'Returns refund details' })
  async getRefundById(@Param('id') id: string) {
    return this.refundService.getRefundById(id);
  }

  @Post(':id/approve')
  @Roles(AdminRole.ADMIN, AdminRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve refund request (Admin only)' })
  @ApiResponse({ status: 200, description: 'Refund approved' })
  async approveRefund(
    @Param('id') id: string,
    @CurrentAdminUser() user: { userId: string; role: AdminRole },
  ) {
    return this.refundService.approveRefund(id, user.userId, user.role);
  }

  @Post(':id/reject')
  @Roles(AdminRole.ADMIN, AdminRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject refund request (Admin only)' })
  @ApiResponse({ status: 200, description: 'Refund rejected' })
  async rejectRefund(
    @Param('id') id: string,
    @Body() dto: RejectRefundDto,
    @CurrentAdminUser() user: { userId: string; role: AdminRole },
  ) {
    return this.refundService.rejectRefund(id, dto.reason, user.userId, user.role);
  }

  @Post(':id/revert')
  @Roles(AdminRole.CUSTOMER_SUPPORT, AdminRole.ADMIN, AdminRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request revert during buffer window' })
  @ApiResponse({ status: 200, description: 'Revert requested' })
  async requestRevert(
    @Param('id') id: string,
    @Body() dto: RefundRevertRequestDto,
    @CurrentAdminUser() user: { userId: string; role: AdminRole },
  ) {
    return this.refundService.requestRevert(id, dto.reason, user.userId, user.role);
  }

  @Post(':id/revert-decision')
  @Roles(AdminRole.ADMIN, AdminRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve or reject revert request (Admin only)' })
  @ApiResponse({ status: 200, description: 'Revert decision made' })
  async handleRevertDecision(
    @Param('id') id: string,
    @Body() dto: RefundRevertDecisionDto,
    @CurrentAdminUser() user: { userId: string; role: AdminRole },
  ) {
    return this.refundService.handleRevertDecision(id, dto.approve, user.userId, user.role);
  }
}
