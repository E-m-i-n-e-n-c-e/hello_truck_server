import { AdminRefundStatus } from '@prisma/client';

export const ACTIVE_REFUND_REQUEST_STATUSES: AdminRefundStatus[] = [
  AdminRefundStatus.PENDING,
  AdminRefundStatus.APPROVED,
  AdminRefundStatus.REVERT_REQUESTED,
  AdminRefundStatus.REVERTED,
];

export const EDITABLE_REFUND_REQUEST_STATUSES: AdminRefundStatus[] = [
  AdminRefundStatus.PENDING,
  AdminRefundStatus.REVERTED,
];
