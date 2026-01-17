import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ReferralService } from '../../referral/referral.service';
import { ApplyDriverReferralDto } from '../../referral/dtos/apply-driver-referral.dto';
import { AccessTokenGuard } from '../../token/guards/access-token.guard';
import { RolesGuard } from '../../token/guards/roles.guard';
import { Roles } from '../../token/decorators/roles.decorator';
import { User } from '../../token/decorators/user.decorator';
import { UserToken } from '../../common/types/user-session.types';

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
  async getReferralStats(@User() user: UserToken) {
    return this.referralService.getDriverReferralStats(user.userId);
  }
}
