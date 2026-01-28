/**
 * Admin Notification Types
 *
 * These are for web push notifications sent to admin portal users
 */

// Event types for admin web push notifications
export const AdminNotificationEvent = {
  // Verification events
  NEW_VERIFICATION: 'NEW_VERIFICATION',
  VERIFICATION_ASSIGNED: 'VERIFICATION_ASSIGNED',
  REVERT_REQUESTED: 'REVERT_REQUESTED',
  REVERT_DECISION: 'REVERT_DECISION',
  FIELD_VERIFICATION_SUBMITTED: 'FIELD_VERIFICATION_SUBMITTED',

  // Refund events
  NEW_REFUND_REQUEST: 'NEW_REFUND_REQUEST',
  REFUND_REVERT_REQUESTED: 'REFUND_REVERT_REQUESTED',
  REFUND_REVERT_DECISION: 'REFUND_REVERT_DECISION',

  // System events
  BUFFER_EXPIRING: 'BUFFER_EXPIRING',
  ASSIGNMENT_CHANGED: 'ASSIGNMENT_CHANGED',
} as const;

export type AdminNotificationEventType = typeof AdminNotificationEvent[keyof typeof AdminNotificationEvent];

// Notification priority levels
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

/**
 * FCM payload for admin web push notifications
 * Separate from AppMessagingPayload to keep admin and app types decoupled
 */
export interface AdminMessagingPayload {
  notification?: {
    title: string;
    body: string;
  };
  data?: {
    event?: AdminNotificationEventType;
    entityId?: string;
    entityType?: string;
    driverId?: string; // For verification-related notifications
    actionUrl?: string;
    [key: string]: string | undefined;
  };
}

// Admin notification payload structure (for service layer)
export interface AdminNotificationPayload {
  event: AdminNotificationEventType;
  title: string;
  body: string;
  entityId?: string;
  entityType?: 'VERIFICATION' | 'REFUND' | 'DRIVER' | 'BOOKING';
  driverId?: string; // For verification-related notifications
  priority?: NotificationPriority;
  actionUrl?: string;
  data?: Record<string, string>;
}

// Database notification record (matches Prisma model)
export interface AdminNotificationRecord {
  id: string;
  adminUserId: string;
  event: string;
  title: string;
  body: string;
  entityId?: string;
  entityType?: string;
  driverId?: string; // For verification-related notifications
  priority: string;
  actionUrl?: string;
  isRead: boolean;
  createdAt: Date;
}
