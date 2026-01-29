/**
 * Admin Portal Environment Configuration
 *
 * Validates environment variables required for admin portal operation.
 * Runs on startup - fails fast if required variables are missing.
 */
import { z } from 'zod';

// Admin Portal specific environment schema
const adminEnvSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3001), // Different default port for admin

  // App Mode
  APP_MODE: z.enum(['admin', 'app', 'all']).default('admin'),

  // Database (shared with main app)
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // Redis (shared with main app)
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),

  // Admin JWT (separate from customer/driver JWT)
  ADMIN_JWT_SECRET: z.string().min(1, 'ADMIN_JWT_SECRET is required'),
  ADMIN_JWT_EXPIRES_IN: z.string().default('30m'),
  // LibreDesk Integration (optional in dev)
  LIBREDESK_API_URL: z.string().optional(),
  LIBREDESK_API_KEY: z.string().optional(),

  // Buffer Configuration
  ADMIN_BUFFER_DURATION_MINUTES: z.coerce.number().min(1).default(60), // 1 hour default

  // Audit Log Archival
  AUDIT_LOG_RETENTION_DAYS: z.coerce.number().min(1).default(90), // Archive logs older than 90 days

  // Firebase (for notifications and storage)
  FIREBASE_PROJECT_ID: z.string().min(1, 'FIREBASE_PROJECT_ID is required'),
  FIREBASE_SERVICE_ACCOUNT_PATH: z.string().min(1, 'FIREBASE_SERVICE_ACCOUNT_PATH is required'),
  FIREBASE_STORAGE_BUCKET: z.string().min(1, 'FIREBASE_STORAGE_BUCKET is required'),
});

export type AdminEnvironmentVariables = z.infer<typeof adminEnvSchema>;

/**
 * Validates admin portal environment variables.
 * Called by ConfigModule on startup.
 */
export function validateAdminEnv(config: Record<string, unknown>): AdminEnvironmentVariables {
  try {
    return adminEnvSchema.parse(config);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.issues.map((err) => {
        const path = err.path.join('.');
        return `  - ${path}: ${err.message}`;
      });

      throw new Error(
        `❌ Admin Portal environment validation failed:\n${errorMessages.join('\n')}\n\n` +
        `Please check your .env file and ensure all required admin variables are set.`
      );
    }
    throw error;
  }
}
