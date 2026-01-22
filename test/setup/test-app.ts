import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from 'src/app.module';
import { REALTIME_BUS } from 'src/redis/interfaces/realtime-bus.interface';
import { InMemoryBus } from 'src/redis/testing/in-memory-bus';
import { RazorpayService } from 'src/razorpay/razorpay.service';
import { FirebaseService } from 'src/firebase/firebase.service';
import { AssignmentService } from 'src/booking/assignment/assignment.service';

/**
 * Create a test NestJS application with mocked dependencies
 */
export async function createTestApp(): Promise<INestApplication> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    // Override RealtimeBus with InMemoryBus for CI-safe testing
    .overrideProvider(REALTIME_BUS)
    .useClass(InMemoryBus)

    // Mock RazorpayService to avoid real API calls
    .overrideProvider(RazorpayService)
    .useValue({
      createPaymentLink: jest.fn().mockImplementation(() => {
        const uniqueId = `plink_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        return Promise.resolve({
          paymentLinkId: uniqueId,
          paymentLinkUrl: `https://rzp.io/${uniqueId}`,
        });
      }),
      cancelPaymentLink: jest.fn().mockResolvedValue(undefined),
      createRefund: jest.fn().mockResolvedValue({
        refundId: 'rfnd_test123',
        paymentId: 'pay_test123',
        amount: 100,
        status: 'processed',
      }),
      fetchRefunds: jest.fn().mockResolvedValue([]),
      verifyWebhookSignature: jest.fn().mockReturnValue(true),
      createContact: jest.fn().mockResolvedValue('contact_test123'),
      createFundAccount: jest.fn().mockResolvedValue('fund_test123'),
    })

    // Mock FirebaseService to avoid real Firebase calls and FCM notifications
    .overrideProvider(FirebaseService)
    .useValue({
      generateSignedUploadUrl: jest.fn().mockResolvedValue({
        signedUrl: 'https://storage.googleapis.com/signed-url',
        publicUrl: 'https://firebasestorage.googleapis.com/test',
        token: 'test-token',
      }),
      verifyGoogleIdToken: jest.fn().mockResolvedValue({
        email: 'test@example.com',
        emailVerified: true,
        name: 'Test User',
      }),
      getEmailFromGoogleIdToken: jest
        .fn()
        .mockResolvedValue('test@example.com'),
      upsertFcmToken: jest.fn().mockResolvedValue(undefined),
      sendNotification: jest
        .fn()
        .mockResolvedValue({ messageId: 'msg_test123' }),
      notifyAllSessions: jest
        .fn()
        .mockResolvedValue({ successCount: 1, failureCount: 0 }),
      subscribeToTopic: jest.fn().mockResolvedValue(undefined),
      unsubscribeFromTopic: jest.fn().mockResolvedValue(undefined),
    })

    // Mock AssignmentService to prevent background worker Redis connection issues
    .overrideProvider(AssignmentService)
    .useValue({
      onBookingCreated: jest.fn(),
      onDriverAccept: jest.fn(),
      onDriverReject: jest.fn(),
      onBookingCancelled: jest.fn(),
      tryToAssignDriver: jest.fn(),
      timeoutDriver: jest.fn(),
    })
    .compile();

  const app = moduleFixture.createNestApplication();

  // Add global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.init();

  return app;
}
