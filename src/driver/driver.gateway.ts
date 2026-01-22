import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Inject, Logger, UseGuards } from '@nestjs/common';
import { RolesGuard } from 'src/token/guards/roles.guard';
import { Roles } from 'src/token/decorators/roles.decorator';
import { ProfileService } from './profile/profile.service';
import { Decimal } from '@prisma/client/runtime/library';
import { TokenService } from 'src/token/token.service';
import { seconds, Throttle } from '@nestjs/throttler';
import { REALTIME_BUS, RealtimeBus } from 'src/redis/interfaces/realtime-bus.interface';

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
    @Inject(REALTIME_BUS) private realtimeBus: RealtimeBus,
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
  @Throttle({ default: { ttl: seconds(5), limit: 1 } })
  async handleNavigationUpdate(client: Socket, payload: {
    bookingId: string;
    remainingTime: number;
    remainingDistance: number;
    timeToNextDestinationSeconds: number | null;
    distanceToNextDestinationMeters: number | null;
    timeToFinalDestinationSeconds: number | null;
    distanceToFinalDestinationMeters: number | null;
    latitude: number | null;
    longitude: number | null;
    routePolyline: string | null;
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

      // Check if this is a new booking by looking at cached data
      const cacheKey = `driver_navigation:${driverId}`;
      const cachedDataStr = await this.realtimeBus.get(cacheKey);

      let initialDistanceToPickup: number;
      let kmTravelled: number;

      if (!cachedDataStr) {
        // No cached data - first update ever
        initialDistanceToPickup = distanceToPickup;
        kmTravelled = 0;
        this.logger.log(`Booking ${payload.bookingId}: First navigation update, initial distance: ${Math.floor(initialDistanceToPickup / 1000)}km`);
      } else {
        const cachedData = JSON.parse(cachedDataStr);

        if (cachedData.bookingId !== payload.bookingId) {
          // Different booking - this is a new booking
          initialDistanceToPickup = distanceToPickup;
          kmTravelled = 0;
          this.logger.log(`Booking ${payload.bookingId}: New booking started, initial distance: ${Math.floor(initialDistanceToPickup / 1000)}km`);
        } else {
          // Same booking - calculate distance travelled
          initialDistanceToPickup = cachedData.initialDistanceToPickup || distanceToPickup;
          const distanceTravelled = Math.max(0, initialDistanceToPickup - distanceToPickup);
          kmTravelled = Math.floor(distanceTravelled / 1000);
        }
      }

      // Create the transformed data object
      const transformedData = {
        bookingId: payload.bookingId,
        timeToPickup,
        timeToDrop,
        distanceToPickup,
        distanceToDrop,
        initialDistanceToPickup,
        kmTravelled,
        location: payload.latitude && payload.longitude ? {
            latitude: Number(payload.latitude),
            longitude: Number(payload.longitude)
          } : null,
        routePolyline: payload.routePolyline,
        sentAt: payload.sentAt || new Date().toISOString()
      };

      // Store navigation data with driver ID as key
      await this.realtimeBus.set(cacheKey, JSON.stringify(transformedData));

      // Publish update for SSE listeners scoped to driver
      const sseKey = `driver_navigation_updates:${driverId}`;
      await this.realtimeBus.publish(sseKey, JSON.stringify(transformedData));

      this.logger.log(`Driver ${driverId} | Booking ${payload.bookingId}: ${kmTravelled}km travelled`);

    } catch (error) {
      this.logger.error(`Failed to process navigation update for driver ${driverId}:`, error);
    }
  }

  private isValidCoordinate(lat: Decimal, lng: Decimal): boolean {
    return Number(lat) >= -90 && Number(lat) <= 90 && Number(lng) >= -180 && Number(lng) <= 180;
  }
}
