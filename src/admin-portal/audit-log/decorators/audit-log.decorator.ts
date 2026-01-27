/**
 * Audit Log Decorator
 *
 * Marks a route for automatic audit logging.
 *
 * Usage:
 * @AuditLog({
 *   action: 'DOCUMENT_APPROVED',
 *   module: 'VERIFICATION',
 *   description: 'Document approved for driver :id',
 *   entityType: 'DRIVER',
 *   captureRequest: true,
 *   captureResponse: true,
 * })
 */
import { SetMetadata } from '@nestjs/common';

export const AUDIT_LOG_KEY = 'audit_log';

export interface AuditLogMetadata {
  action: string;
  module: string;
  description?: string;
  entityType?: string;
  captureRequest?: boolean;
  captureResponse?: boolean;
}

export const AuditLog = (metadata: AuditLogMetadata) =>
  SetMetadata(AUDIT_LOG_KEY, metadata);
