import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { TokenService } from '../token.service';

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(private tokenService: TokenService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    let request: any;
    let client: any;

    if (context.getType() === 'ws') {
      client = context.switchToWs().getClient();
      request = client.handshake;
    } else {
      request = context.switchToHttp().getRequest();
    }

    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid token');
    }

    const token = authHeader.split(' ')[1];
    try {
      const user = await this.tokenService.validateAccessToken(token);

      // Store user data in the appropriate place
      if (context.getType() === 'ws') {
        client.data.user = user;  // For WebSocket
      } else {
        request.user = user;      // For HTTP
      }

      return true;
    } catch (error) {
      throw new UnauthorizedException('Invalid access token');
    }
  }
}