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
import { ApplyDriverReferralDto } from '../../referral/dtos/apply-driver-referral.dto';
import { DriverReferralStatsDto } from '../../referral/dtos/referral-stats.dto';
import { AccessTokenGuard } from '../../token/guards/access-token.guard';
import { RolesGuard } from '../../token/guards/roles.guard';
import { Roles } from '../../token/decorators/roles.decorator';
import { User } from '../../token/decorators/user.decorator';
import { UserToken } from '../../common/types/user-session.types';
import { Serialize } from 'src/common/interceptors/serialize.interceptor';

@Controller('driver/referral')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('driver')
export class DriverReferralController {
  constructor(private readonly referralService: ReferralService) {}

  @Post('apply')
  @HttpCode(HttpStatus.OK)
  async applyReferralCode(
    @User() user: UserToken,
    @Body() dto: ApplyDriverReferralDto,
  ) {
    await this.referralService.applyDriverReferralCode(
      dto.referralCode,
      user.userId,
    );
    return {
      message: 'Referral code applied successfully',
    };
  }

  @Get('stats')
  @Serialize(DriverReferralStatsDto)
  async getReferralStats(@User() user: UserToken): Promise<DriverReferralStatsDto> {
    return this.referralService.getDriverReferralStats(user.userId);
  }

  @Get('validate')
  async validateReferralCode(
    @User() user: UserToken,
    @Query('code') code: string,
  ) {
    return this.referralService.validateDriverReferralCode(code, user.userId);
  }
}
