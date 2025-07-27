import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import * as crypto from 'crypto';
import { UserType, Session, SessionWithUser } from 'src/common/types/user-session.types';

@Injectable()
export class SessionService {
  constructor(private prisma: PrismaService) {}

  async createSession(userId: string, userType: UserType): Promise<Session> {
    const token = crypto.randomBytes(64).toString('hex');
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30); // 30 days

    if (userType === 'customer') {
      const session = await this.prisma.customerSession.create({
        data: {
          customerId: userId,
          token,
          expiresAt,
        },
      });
      return session;
    } else {
      const session = await this.prisma.driverSession.create({
        data: {
          driverId: userId,
          token,
          expiresAt,
        },
      });
      return session;
    }
  }

  async findSession(sessionId: string, userType: UserType): Promise<SessionWithUser | null> {
    if (userType === 'customer') {
      const session = await this.prisma.customerSession.findUnique({ where: { id: sessionId }, include: { customer: true } });
      if (!session) return null;
      return {
        ...session,
        user: session.customer,
      };
    } else {
      const session = await this.prisma.driverSession.findUnique({ where: { id: sessionId }, include: { driver: true } });
      if (!session) return null;
      return {
        ...session,
        user: session.driver,
      };
    }
  }

  async updateSession(sessionId: string, userType: UserType, data: Partial<Session>): Promise<void> {
    if (userType === 'customer') {
      await this.prisma.customerSession.updateMany({ where: { id: sessionId }, data });
    } else {
      await this.prisma.driverSession.updateMany({ where: { id: sessionId }, data });
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

  async deleteAllUserSessions(userId: string, userType: UserType): Promise<void> {
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