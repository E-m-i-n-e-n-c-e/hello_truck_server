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
 *   captureSnapshots: true, // Enable before/after snapshot capture from service
 * })
 */
import { SetMetadata } from '@nestjs/common';

export const AUDIT_LOG_KEY = 'audit_log';
export const AUDIT_METADATA_KEY = '__auditMetadata';

export interface AuditLogMetadata {
  action: string;
  module: string;
  description?: string;
  entityType?: string;
  captureRequest?: boolean;
  captureResponse?: boolean;
  captureSnapshots?: boolean; // If true, expects service to return { data, __auditMetadata }
}

export interface AuditSnapshotMetadata {
  beforeSnapshot?: any;
  afterSnapshot?: any;
  entityId?: string;
}

export const AuditLog = (metadata: AuditLogMetadata) =>
  SetMetadata(AUDIT_LOG_KEY, metadata);
