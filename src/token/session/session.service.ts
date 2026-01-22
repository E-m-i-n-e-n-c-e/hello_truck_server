import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import * as crypto from 'crypto';
import {
  UserType,
  Session,
  SessionWithUser,
} from 'src/common/types/user-session.types';
import { Prisma } from '@prisma/client';

@Injectable()
export class SessionService {
  constructor(private prisma: PrismaService) {}

  async createSession(
    userId: string,
    userType: UserType,
    fcmToken?: string,
  ): Promise<Session> {
    const token = crypto.randomBytes(64).toString('hex');
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30); // 30 days

    if (userType === 'customer') {
      const session = await this.prisma.customerSession.create({
        data: {
          customerId: userId,
          token,
          expiresAt,
          fcmToken,
        },
      });
      return session;
    } else {
      const session = await this.prisma.driverSession.create({
        data: {
          driverId: userId,
          token,
          expiresAt,
          fcmToken,
        },
      });
      return session;
    }
  }

  async findSession(
    sessionId: string,
    userType: UserType,
  ): Promise<SessionWithUser | null> {
    if (userType === 'customer') {
      const session = await this.prisma.customerSession.findUnique({
        where: { id: sessionId },
        include: { customer: true },
      });
      if (!session) return null;
      return {
        ...session,
        user: session.customer,
      };
    } else {
      const session = await this.prisma.driverSession.findUnique({
        where: { id: sessionId },
        include: { driver: true },
      });
      if (!session) return null;
      return {
        ...session,
        user: session.driver,
      };
    }
  }

  async findSessionsByUserId(
    userId: string,
    userType: UserType,
  ): Promise<SessionWithUser[]> {
    if (userType === 'customer') {
      const sessions = await this.prisma.customerSession.findMany({
        where: { customerId: userId },
        include: { customer: true },
      });
      return sessions.map((session) => ({
        ...session,
        user: session.customer,
      }));
    } else {
      const sessions = await this.prisma.driverSession.findMany({
        where: { driverId: userId },
        include: { driver: true },
      });
      return sessions.map((session) => ({ ...session, user: session.driver }));
    }
  }

  async updateSession(
    sessionId: string,
    userType: UserType,
    data: Partial<Session>,
  ): Promise<void> {
    if (userType === 'customer') {
      await this.prisma.customerSession.updateMany({
        where: { id: sessionId },
        data,
      });
    } else {
      await this.prisma.driverSession.updateMany({
        where: { id: sessionId },
        data,
      });
    }
  }

  async updateSessionsByUserId(
    userId: string,
    userType: UserType,
    data: Partial<Session>,
  ): Promise<void> {
    if (userType === 'customer') {
      await this.prisma.customerSession.updateMany({
        where: { customerId: userId },
        data,
      });
    } else {
      await this.prisma.driverSession.updateMany({
        where: { driverId: userId },
        data,
      });
    }
  }

  async deleteSession(sessionId: string, userType: UserType): Promise<void> {
    if (userType === 'customer') {
      await this.prisma.customerSession.deleteMany({
        where: { id: sessionId },
      });
    } else {
      await this.prisma.driverSession.deleteMany({
        where: { id: sessionId },
      });
    }
  }

  async deleteAllUserSessions(
    userId: string,
    userType: UserType,
  ): Promise<void> {
    if (userType === 'customer') {
      await this.prisma.customerSession.deleteMany({
        where: { customerId: userId },
      });
    } else {
      await this.prisma.driverSession.deleteMany({
        where: { driverId: userId },
      });
    }
  }
}
