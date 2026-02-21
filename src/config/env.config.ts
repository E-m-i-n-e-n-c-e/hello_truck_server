/**
 * Environment Configuration with Zod
 *
 * This module provides type-safe access to environment variables with validation.
 * The app will fail fast on startup if required variables are missing.
 */

import { z } from 'zod';

// Define the schema for environment variables
const envSchema = z.object({
  APP_MODE: z.enum(['app', 'admin', 'all']).default('app'),
  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),

  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // Redis
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),

  // JWT
  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
  JWT_EXPIRES_IN: z.string().default('7d'),

  // Admin
  ADMIN_JWT_SECRET: z.string().min(1, 'ADMIN_JWT_SECRET is required'),
  ADMIN_USERNAME: z.string().min(1, 'ADMIN_USERNAME is required'),
  ADMIN_PASSWORD: z.string().min(1, 'ADMIN_PASSWORD is required'),

  // Razorpay
  RAZORPAY_KEY_ID: z.string().min(1, 'RAZORPAY_KEY_ID is required'),
  RAZORPAY_KEY_SECRET: z.string().min(1, 'RAZORPAY_KEY_SECRET is required'),
  RAZORPAY_WEBHOOK_SECRET: z.string().min(1, 'RAZORPAY_WEBHOOK_SECRET is required'),

  // Firebase
  FIREBASE_PROJECT_ID: z.string().min(1, 'FIREBASE_PROJECT_ID is required'),
  FIREBASE_SERVICE_ACCOUNT_PATH: z.string().min(1, 'FIREBASE_SERVICE_ACCOUNT_PATH is required'),
  FIREBASE_STORAGE_BUCKET: z.string().min(1, 'FIREBASE_STORAGE_BUCKET is required'),

  // Client id used for initialization
  GOOGLE_CLIENT_ID: z.string().min(1, 'GOOGLE_CLIENT_ID is required'),

  // Google - Platform-specific client IDs
  GOOGLE_WEB_CLIENT_ID: z.string().min(1, 'GOOGLE_WEB_CLIENT_ID is required'),
  GOOGLE_ANDROID_CLIENT_ID: z.string().min(1, 'GOOGLE_ANDROID_CLIENT_ID is required'),
  GOOGLE_IOS_CLIENT_ID: z.string().min(1, 'GOOGLE_IOS_CLIENT_ID is required'),

  // Storage
  BUCKET_NAME: z.string().min(1, 'BUCKET_NAME is required'),


  // Business Logic
  COMMISSION_RATE: z.coerce.number().min(0).max(1).default(0.07),

  // Cancellation Charge (time-based)
  CANCELLATION_BASE_AMOUNT: z.coerce.number().min(0).default(100), // Fixed amount on which cancellation % is calculated
  PLATFORM_FEE: z.coerce.number().min(0).default(20), // Platform fee added to cancellation charge and non gst bookings
  CANCELLATION_MIN_CHARGE_PERCENT: z.coerce.number().min(0).max(1).default(0.2), // 20% minimum (after calculation)
  CANCELLATION_MAX_CHARGE_PERCENT: z.coerce.number().min(0).max(1).default(1), // 100% maximum
  CANCELLATION_CHARGE_INCREMENT_PER_MIN: z.coerce.number().min(0).max(1).default(0.1), // 10% per minute from booking creation

  // LibreDesk
  LIBREDESK_API_URL: z.string().url().min(1, 'LIBREDESK_API_URL is required'),
  LIBREDESK_API_KEY: z.string().min(1, 'LIBREDESK_API_KEY is required'),
  LIBREDESK_API_SECRET: z.string().min(1, 'LIBREDESK_API_SECRET is required'),
  LIBREDESK_INBOX_ID: z.coerce.number().min(1, 'LIBREDESK_INBOX_ID is required'),
});

// Export the inferred type
export type EnvironmentVariables = z.infer<typeof envSchema>;

/**
 * Validates environment variables using Zod.
 * Throws a detailed error if validation fails.
 */
export function validate(config: Record<string, unknown>): EnvironmentVariables {
  try {
    return envSchema.parse(config);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.issues.map((err) => {
        const path = err.path.join('.');
        return `  - ${path}: ${err.message}`;
      });

      throw new Error(
        `❌ Environment validation failed:\n${errorMessages.join('\n')}\n\n` +
        `Please check your .env file and ensure all required variables are set.`
      );
    }
    throw error;
  }
}
