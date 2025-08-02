import { Injectable, Logger, OnModuleInit, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import { OAuth2Client } from 'google-auth-library';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);
  private app: admin.app.App;
  private googleClient: OAuth2Client;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    try {
      // Initialize Firebase Admin SDK
      const serviceAccountPath = this.configService.get<string>('FIREBASE_SERVICE_ACCOUNT_PATH');
      const projectId = this.configService.get<string>('FIREBASE_PROJECT_ID');

      if (serviceAccountPath) {
        // Initialize with service account file
        this.app = admin.initializeApp({
          credential: admin.credential.cert(serviceAccountPath),
          storageBucket: this.configService.get<string>('FIREBASE_STORAGE_BUCKET'),
          projectId,
        });
      } else {
        // Initialize with service account key object (for production)
        const serviceAccountKey = {
          type: this.configService.get<string>('FIREBASE_TYPE') || 'service_account',
          project_id: this.configService.get<string>('FIREBASE_PROJECT_ID') || '',
          private_key_id: this.configService.get<string>('FIREBASE_PRIVATE_KEY_ID') || '',
          private_key: this.configService.get<string>('FIREBASE_PRIVATE_KEY')?.replace(/\\n/g, '\n') || '',
          client_email: this.configService.get<string>('FIREBASE_CLIENT_EMAIL') || '',
          client_id: this.configService.get<string>('FIREBASE_CLIENT_ID') || '',
          auth_uri: this.configService.get<string>('FIREBASE_AUTH_URI') || 'https://accounts.google.com/o/oauth2/auth',
          token_uri: this.configService.get<string>('FIREBASE_TOKEN_URI') || 'https://oauth2.googleapis.com/token',
          auth_provider_x509_cert_url: this.configService.get<string>('FIREBASE_AUTH_PROVIDER_X509_CERT_URL') || 'https://www.googleapis.com/oauth2/v1/certs',
          client_x509_cert_url: this.configService.get<string>('FIREBASE_CLIENT_X509_CERT_URL') || '',
        } as admin.ServiceAccount;

        this.app = admin.initializeApp({
          credential: admin.credential.cert(serviceAccountKey),
          storageBucket: this.configService.get<string>('FIREBASE_STORAGE_BUCKET'),
          projectId,
        });
      }

      // Initialize Google Auth Client
      this.googleClient = new OAuth2Client(
        this.configService.get<string>('GOOGLE_CLIENT_ID') || '691159300275-37gn4bpd7jrkld0cmot36vl181s3tsf3.apps.googleusercontent.com'
      );

      this.logger.log('Firebase Admin SDK initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Firebase Admin SDK', error);
      throw error;
    }
  }

  async generateSignedUploadUrl(
    filePath: string,
    contentType: string,
    expiresInSeconds = 300
  ): Promise<{ signedUrl: string; publicUrl: string; token: string }> {
    const token = uuidv4();
    console.log('Token: ', token);

    const bucket = this.app.storage().bucket();
    const file = bucket.file(filePath);

    const [signedUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + expiresInSeconds * 1000,
      contentType,
      extensionHeaders: {
        'x-goog-meta-firebaseStorageDownloadTokens': token,
      },
    });

    const encodedPath = encodeURIComponent(filePath);
    const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodedPath}?alt=media&token=${token}`;

    return {
      signedUrl,
      publicUrl,
      token,
    };
  }

  async verifyGoogleIdToken(idToken: string): Promise<{ email: string; emailVerified: boolean; name?: string }> {
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken,
        audience: this.configService.get<string>('GOOGLE_CLIENT_ID') || '691159300275-37gn4bpd7jrkld0cmot36vl181s3tsf3.apps.googleusercontent.com',
      });

      const payload = ticket.getPayload();
      if (!payload) {
        throw new BadRequestException('Invalid token payload');
      }

      return {
        email: payload.email!,
        emailVerified: payload.email_verified || false,
        name: payload.name,
      };
    } catch (error) {
      this.logger.error('Failed to verify Google ID token', error);
      throw new BadRequestException('Invalid Google ID token');
    }
  }

  async getEmailFromGoogleIdToken(idToken: string): Promise<string> {
    const googleData = await this.verifyGoogleIdToken(idToken);
    if (!googleData.email || !googleData.emailVerified) {
      throw new BadRequestException('Email not verified or not found');
    }
    return googleData.email;
  }
}
