/**
 * Audit Log Interceptor
 *
 * Automatically logs actions from ALL admin portal users after successful responses.
 * This includes: Super Admin, Admin, Agent, Field Agent, and Customer Support.
 * Uses metadata to determine what to log.
 *
 * Usage:
 * @AuditLog({ action: 'DOCUMENT_APPROVED', module: 'VERIFICATION' })
 */
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import { AuditLogService } from './audit-log.service';
import { AUDIT_LOG_KEY, AuditLogMetadata } from './decorators/audit-log.decorator';
import { AdminJwtPayload } from '../auth/admin-auth.service';

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(
    private readonly auditLogService: AuditLogService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const auditMetadata = this.reflector.get<AuditLogMetadata>(
      AUDIT_LOG_KEY,
      context.getHandler(),
    );

    // If no @AuditLog decorator, skip logging
    if (!auditMetadata) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const user: AdminJwtPayload | undefined = request.user;

    // Capture before state if needed
    const beforeSnapshot = auditMetadata.captureRequest
      ? { params: request.params, body: request.body }
      : undefined;

    return next.handle().pipe(
      tap((response) => {
        // Only log if user is authenticated
        if (!user) return;

        // Build description
        let description = auditMetadata.description || `${auditMetadata.action} action performed`;

        // Replace placeholders in description
        if (request.params.id) {
          description = description.replace(':id', request.params.id);
        }
        if (request.params.field) {
          description = description.replace(':field', request.params.field);
        }

        // Extract entity info
        const entityId = request.params.id || request.params.driverId || request.params.bookingId;
        const entityType = auditMetadata.entityType;

        // Capture after state if configured
        const afterSnapshot = auditMetadata.captureResponse ? response : undefined;

        // Determine actual action type (for dynamic actions like document approval/rejection)
        let actionType = auditMetadata.action;

        // Special handling for document actions - check request body for actual action
        if (request.body?.action === 'APPROVED') {
          actionType = 'DOCUMENT_APPROVED';
        } else if (request.body?.action === 'REJECTED') {
          actionType = 'DOCUMENT_REJECTED';
        }

        // Log asynchronously (don't await)
        this.auditLogService.log({
          userId: user.sub,
          role: user.role,
          actionType,
          module: auditMetadata.module,
          description,
          ipAddress: request.ip || request.headers['x-forwarded-for'],
          userAgent: request.headers['user-agent'],
          beforeSnapshot,
          afterSnapshot,
          entityId,
          entityType,
        }).catch((err) => {
          console.error('Failed to create audit log:', err);
        });
      }),
    );
  }
}
