import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { seconds, Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { VerifyOtpDto } from './dtos/verify-otp.dto';
import { SendOtpDto } from './dtos/send-otp.dto';
import { Serialize } from 'src/common/interceptors/serialize.interceptor';
import { SuccessResponseDto } from 'src/common/dtos/success.dto';
import { refreshTokenDto, TokenResponseDto } from './dtos/tokens.dto';

@Controller('auth/customer')
export class CustomerAuthController {
  constructor(private authService: AuthService) {}

  @Throttle({ default: { ttl: seconds(60), limit: 5 } })
  @Post('send-otp')
  @Serialize(SuccessResponseDto)
  @HttpCode(HttpStatus.OK)
  sendCustomerOtp(@Body() body: SendOtpDto): Promise<SuccessResponseDto> {
    return this.authService.sendOtp(body.phoneNumber);
  }

  @Throttle({ default: { ttl: seconds(60), limit: 5 } })
  @Post('verify-otp')
  @Serialize(TokenResponseDto)
  @HttpCode(HttpStatus.OK)
  verifyCustomerOtp(@Body() body: VerifyOtpDto): Promise<TokenResponseDto> {
    return this.authService.verifyCustomerOtp(body);
  }

  @Throttle({ default: { ttl: seconds(60), limit: 20 } })
  @Post('logout')
  @Serialize(SuccessResponseDto)
  @HttpCode(HttpStatus.OK)
  logoutCustomer(@Body() body: refreshTokenDto): Promise<SuccessResponseDto> {
    return this.authService.logoutCustomer(body.refreshToken);
  }

  @Throttle({ default: { ttl: seconds(60), limit: 20 } })
  @Post('refresh-token')
  @Serialize(TokenResponseDto)
  @HttpCode(HttpStatus.OK)
  refreshCustomerToken(
    @Body() body: refreshTokenDto,
  ): Promise<TokenResponseDto> {
    return this.authService.refreshToken(body.refreshToken, 'customer');
  }
}
