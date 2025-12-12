import { Injectable, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';
import { VerificationStatus } from '@prisma/client';
import { UpdateDriverVerificationDto } from './dtos/admin.dto';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async login(username: string, pass: string): Promise<{ accessToken: string }> {
    const adminUsername = this.configService.get<string>('ADMIN_USERNAME')!;
    const adminPassword = this.configService.get<string>('ADMIN_PASSWORD')!;

    if (username !== adminUsername || pass !== adminPassword) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { username: adminUsername, role: 'admin' };
    return {
      accessToken: await this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('ADMIN_JWT_SECRET')!,
        expiresIn: '1d',
      }),
    };
  }

  /**
   * Get all drivers with PENDING verification status
   */
  async getPendingVerificationDrivers(
    page: number = 1,
    limit: number = 10,
    search?: string,
  ) {
    const skip = (page - 1) * limit;
    const where: any = {
      verificationStatus: VerificationStatus.PENDING,
    };

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { phoneNumber: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [drivers, total] = await Promise.all([
      this.prisma.driver.findMany({
        where,
        skip,
        take: Number(limit),
        include: {
          documents: true,
          vehicle: {
            include: {
              owner: true,
            },
          },
          address: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.driver.count({ where }),
    ]);

    return {
      data: drivers,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get drivers who are VERIFIED but have PENDING documents (re-uploaded or expired)
   */
  async getDriversWithPendingDocuments(
    page: number = 1,
    limit: number = 10,
    search?: string,
  ) {
    const skip = (page - 1) * limit;
    const where: any = {
      verificationStatus: VerificationStatus.VERIFIED,
      documents: {
        OR: [
          { licenseStatus: VerificationStatus.PENDING },
          { fcStatus: VerificationStatus.PENDING },
          { insuranceStatus: VerificationStatus.PENDING },
        ],
      },
    };

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { phoneNumber: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [drivers, total] = await Promise.all([
      this.prisma.driver.findMany({
        where,
        skip,
        take: Number(limit),
        include: {
          documents: true,
          vehicle: {
            include: {
              owner: true,
            },
          },
          address: true,
        },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.driver.count({ where }),
    ]);

    return {
      data: drivers,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get a specific driver's details
   */
  async getDriverDetails(id: string) {
    const driver = await this.prisma.driver.findUnique({
      where: { id },
      include: {
        documents: true,
        vehicle: {
          include: {
            owner: true,
          },
        },
        address: true,
      },
    });

    if (!driver) {
      throw new NotFoundException('Driver not found');
    }

    return driver;
  }

  /**
   * Verify or reject a driver and optionally set document expiry dates
   */
  async updateDriverVerification(
    id: string,
    dto: UpdateDriverVerificationDto,
  ) {
    // Check if driver exists
    const driver = await this.prisma.driver.findUnique({
      where: { id },
      include: { documents: true },
    });

    if (!driver) {
      throw new NotFoundException('Driver not found');
    }

    // Convert string dates to Date objects
    const expiryDates = {
      licenseExpiry: dto.licenseExpiry ? new Date(dto.licenseExpiry) : undefined,
      fcExpiry: dto.fcExpiry ? new Date(dto.fcExpiry) : undefined,
      insuranceExpiry: dto.insuranceExpiry ? new Date(dto.insuranceExpiry) : undefined,
    };

    // Update driver verification status and document expiry dates in a transaction
    return this.prisma.$transaction(async (tx) => {
      // Update driver verification status
      const updatedDriver = await tx.driver.update({
        where: { id },
        data: { verificationStatus: dto.status },
      });

      // If verifying and expiry dates are provided, update them
      if (dto.status === VerificationStatus.VERIFIED && driver.documents) {
        await tx.driverDocuments.update({
          where: { driverId: id },
          data: {
            licenseExpiry: expiryDates.licenseExpiry,
            fcExpiry: expiryDates.fcExpiry,
            insuranceExpiry: expiryDates.insuranceExpiry,
            fcStatus: VerificationStatus.VERIFIED,
            licenseStatus: VerificationStatus.VERIFIED,
            insuranceStatus: VerificationStatus.VERIFIED,
          },
        });
      }

      return updatedDriver;
    });
  }
}
