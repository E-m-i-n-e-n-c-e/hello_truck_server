import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { LibredeskService } from './libredesk.service';
import { LibredeskWebhookPayload } from './libredesk.types';

@Controller('libredesk/webhook')
export class LibredeskWebhookController {
  constructor(private readonly libredeskService: LibredeskService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Headers('x-libredesk-signature') signature: string,
    @Body() payload: LibredeskWebhookPayload,
  ) {
    return await this.libredeskService.handleWebhook(payload, signature);
  }
}
