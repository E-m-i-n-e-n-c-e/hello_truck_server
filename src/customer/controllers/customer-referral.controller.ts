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
import { AccessTokenGuard } from '../../token/guards/access-token.guard';
import { RolesGuard } from '../../token/guards/roles.guard';
import { Roles } from '../../token/decorators/roles.decorator';
import { User } from '../../token/decorators/user.decorator';
import { UserToken } from '../../common/types/user-session.types';

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
  async getReferralStats(@User() user: UserToken) {
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
