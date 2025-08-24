// Typed FCM event kinds used by clients to route behaviors
export enum FcmEventType {
  DriverAssignmentOffered = 'DRIVER_ASSIGNMENT_OFFERED',
  DriverAssignmentTimeout = 'DRIVER_ASSIGNMENT_TIMEOUT',
  AssignmentEscalated = 'ASSIGNMENT_ESCALATED',
  NoDriverAvailable = 'NO_DRIVER_AVAILABLE',
}

// App-level typed payload for FCM
export interface AppMessagingPayload {
  notification?: {
    title?: string;
    body?: string;
  };
  data?: {
    event: FcmEventType;
    [key: string]: string;
  };
}
