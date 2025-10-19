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
import { seconds, Throttle } from '@nestjs/throttler';
import { RedisService } from 'src/redis/redis.service';
import { BookingDriverService } from 'src/booking/services/booking-driver.service';

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
    private redisService: RedisService,
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
  @Throttle({ default: { ttl: seconds(2), limit: 1 } })
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

  @SubscribeMessage('driver-navigation-update')
  @Throttle({ default: { ttl: seconds(2), limit: 1 } })
  async handleNavigationUpdate(client: Socket, payload: {
    remainingTime: number;
    remainingDistance: number;
    timeToNextDestinationSeconds: number;
    distanceToNextDestinationMeters: number;
    timeToFinalDestinationSeconds: number;
    distanceToFinalDestinationMeters: number;
    latitude: number;
    longitude: number;
    routePolyline: string;
    sentAt: string;
  }) {
    const user = client.data.user;
    const driverId = user.userId;

    try {

      // Calculate transformed values
      const timeToPickup = Math.max(payload.remainingTime || 0, payload.timeToNextDestinationSeconds || 0);
      const distanceToPickup = Math.max(payload.remainingDistance || 0, payload.distanceToNextDestinationMeters || 0);
      const timeToDrop = Math.max(timeToPickup, payload.timeToFinalDestinationSeconds || 0);
      const distanceToDrop = Math.max(distanceToPickup, payload.distanceToFinalDestinationMeters || 0);

      // Create the transformed data object
      const transformedData = {
        timeToPickup,
        timeToDrop,
        distanceToPickup,
        distanceToDrop,
        location: {
          latitude: Number(payload.latitude),
          longitude: Number(payload.longitude)
        },
        route: payload.routePolyline,
        sentAt: payload.sentAt || new Date().toISOString()
      };

      // Store in Redis with driver ID as key
      const redisKey = `driver_navigation:${driverId}`;
      await this.redisService.set(redisKey, JSON.stringify(transformedData), 'EX', 300);

      // Publish update for SSE listeners scoped to driver
      const sseKey = `driver_navigation_updates:${driverId}`;
      await this.redisService.publish(sseKey, JSON.stringify(transformedData));

      this.logger.log(`Driver ${driverId} navigation data stored and published`);

    } catch (error) {
      this.logger.error(`Failed to process navigation update for driver ${driverId}:`, error);
    }
  }

  private isValidCoordinate(lat: Decimal, lng: Decimal): boolean {
    return Number(lat) >= -90 && Number(lat) <= 90 && Number(lng) >= -180 && Number(lng) <= 180;
  }
}
