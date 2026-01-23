import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ReferralService } from '../../referral/referral.service';
import { ApplyCustomerReferralDto } from '../../referral/dtos/apply-customer-referral.dto';
import { CustomerReferralStatsDto } from '../../referral/dtos/referral-stats.dto';
import { AccessTokenGuard } from '../../token/guards/access-token.guard';
import { RolesGuard } from '../../token/guards/roles.guard';
import { Roles } from '../../token/decorators/roles.decorator';
import { User } from '../../token/decorators/user.decorator';
import { UserToken } from '../../common/types/user-session.types';
import { Serialize } from 'src/common/interceptors/serialize.interceptor';

@Controller('customer/referral')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('customer')
export class CustomerReferralController {
  constructor(private readonly referralService: ReferralService) {}

  @Post('apply')
  @HttpCode(HttpStatus.OK)
  async applyReferralCode(
    @User() user: UserToken,
    @Body() dto: ApplyCustomerReferralDto,
  ) {
    await this.referralService.applyCustomerReferralCode(
      dto.referralCode,
      user.userId,
    );
    return {
      message: 'Referral code applied successfully',
    };
  }

  @Get('stats')
  @Serialize(CustomerReferralStatsDto)
  async getReferralStats(@User() user: UserToken): Promise<CustomerReferralStatsDto> {
    return this.referralService.getCustomerReferralStats(user.userId);
  }

  @Get('validate')
  async validateReferralCode(
    @User() user: UserToken,
    @Query('code') code: string,
  ) {
    return this.referralService.validateCustomerReferralCode(code, user.userId);
  }
}
