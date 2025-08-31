import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { RolesGuard } from 'src/token/guards/roles.guard';
import { Roles } from 'src/token/decorators/roles.decorator';
import { ProfileService } from './profile/profile.service';
import { Decimal } from '@prisma/client/runtime/library';
import { TokenService } from 'src/token/token.service';

@WebSocketGateway({
  namespace: '/driver',
  cors: {
    origin: '*',
  },
})
@UseGuards(RolesGuard)
@Roles('driver')
export class DriverGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(DriverGateway.name);

  constructor(
    private profileService: ProfileService,
    private tokenService: TokenService,
  ) { }

  afterInit(server: Server) {
    // Add authentication middleware to this specific gateway
    server.use(async (socket: Socket, next: (err?: Error) => void) => {
      try {
        const token = socket.handshake.auth?.token;

        if (!token) {
          return next(new Error('Authentication error: No token provided'));
        }

        // Validate token
        const user = await this.tokenService.validateAccessToken(token);

        // Store user data in socket
        socket.data.user = user;

        next();
      } catch (error) {
        console.log('❌ Auth error:', error.message);
        next(new Error('Authentication error: Invalid token'));
      }
    });
  }

  async handleConnection(client: Socket) {
    try {
      const user = client.data.user;
      const driverId = user.userId;

      this.logger.log(`Driver client connected: ${client.id} - Driver: ${driverId}`);

      // Join driver to their personal room for targeted messages
      client.join(`driver:${driverId}`);

    } catch (err) {
      this.logger.error(`Driver connection failed: ${err.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Driver client disconnected: ${client.id}`);
  }

  @SubscribeMessage('update-location')
  async handleLocationUpdate(client: Socket, payload: {
    latitude: Decimal;
    longitude: Decimal;
  }) {
    const user = client.data.user;
    const driverId = user.userId;
    const { latitude, longitude } = payload;
    try {
      // Validate coordinates
      if (!this.isValidCoordinate(latitude, longitude)) {
        this.logger.warn(`Driver ${driverId} sent invalid coordinates: ${latitude}, ${longitude}`);
        return;
      }

      // Update driver's location using ProfileService
      await this.profileService.updateLocation(driverId, { latitude, longitude });

      this.logger.log(`Driver ${driverId} location updated: ${latitude}, ${longitude}`);

    } catch (error) {
      this.logger.error(`Failed to update location for driver ${driverId}:`, error);
    }
  }

  private isValidCoordinate(lat: Decimal, lng: Decimal): boolean {
    return Number(lat) >= -90 && Number(lat) <= 90 && Number(lng) >= -180 && Number(lng) <= 180;
  }
}
