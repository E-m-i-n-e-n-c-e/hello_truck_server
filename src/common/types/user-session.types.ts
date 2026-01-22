import { Customer, CustomerSession, Driver, DriverSession } from '@prisma/client';

export type UserType = 'customer' | 'driver';
export type User = Customer | Driver;
export type Session = CustomerSession | DriverSession;
export type SessionWithUser = Session & { user: User };
export type UserToken = { userType: UserType; userId: string; phoneNumber: string; hasCompletedOnboarding: boolean; sessionId: string; isActive: boolean; };