# LibreDesk Integration - Future Implementation

## Overview
LibreDesk is an external ticketing system that will be integrated with the admin portal for tracking verification requests.

## Current State
LibreDesk integration is currently **NOT IMPLEMENTED**. The `ticketId` field in `DriverVerificationRequest` model is reserved for future use.

## Required Changes When Implementing

### 1. Environment Variables
Add to `.env`:
```env
LIBREDESK_API_URL=https://your-libredesk-instance.com/api
LIBREDESK_API_KEY=your-api-key
```

### 2. Create LibreDesk Service
Create `src/admin-portal/libredesk/libredesk.service.ts`:
```typescript
@Injectable()
export class LibreDeskService {
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async createTicket(driverName: string, driverPhone: string, verificationType: string): Promise<string> {
    // API call to create ticket
    // Return ticket ID
  }

  async updateTicketStatus(ticketId: string, status: string): Promise<void> {
    // API call to update ticket
  }

  async assignTicket(ticketId: string, agentEmail: string): Promise<void> {
    // API call to assign ticket
  }
}
```

### 3. Update Verification Service
In `verification.service.ts`, modify `createVerification()`:
```typescript
// After creating verification record
if (this.libreDeskService) {
  try {
    const ticketId = await this.libreDeskService.createTicket(
      `${driver.firstName} ${driver.lastName}`,
      driver.phoneNumber,
      dto.verificationType,
    );

    // Update verification with ticket ID
    await this.prisma.driverVerificationRequest.update({
      where: { id: verification.id },
      data: { ticketId },
    });
  } catch (error) {
    this.logger.error('Failed to create LibreDesk ticket', error);
    // Continue without ticket - manual retry available
  }
}
```

### 4. Retry Mechanism
Add endpoint for manual ticket creation retry:
```typescript
@Post(':id/create-ticket')
async retryTicketCreation(@Param('id') id: string) {
  // Retry creating LibreDesk ticket for verification without ticketId
}
```

### 5. Update Assignment
When assigning verification, also update LibreDesk:
```typescript
async assignVerification(id: string, dto: AssignVerificationDto) {
  // ... existing code ...

  if (verification.ticketId && this.libreDeskService) {
    await this.libreDeskService.assignTicket(
      verification.ticketId,
      assignedAgent.email,
    );
  }
}
```

### 6. Status Sync
Keep LibreDesk ticket status in sync with verification status:
- PENDING → New
- IN_REVIEW → In Progress
- APPROVED → Resolved
- REJECTED → Closed
- REVERT_REQUESTED → Reopened
- FINAL_APPROVED → Closed

### 7. Module Setup
Create `src/admin-portal/libredesk/libredesk.module.ts`:
```typescript
@Module({
  imports: [HttpModule, ConfigModule],
  providers: [LibreDeskService],
  exports: [LibreDeskService],
})
export class LibreDeskModule {}
```

### 8. Error Handling
- Log all LibreDesk API failures
- Store failed requests for retry
- Show UI indicator when verification has no ticket

## Files to Create
1. `src/admin-portal/libredesk/libredesk.module.ts`
2. `src/admin-portal/libredesk/libredesk.service.ts`
3. `src/admin-portal/libredesk/types/libredesk.types.ts`

## Files to Modify
1. `src/admin-portal/verification/verification.module.ts` - Import LibreDeskModule
2. `src/admin-portal/verification/verification.service.ts` - Inject LibreDeskService
3. `src/admin-portal/verification/verification.controller.ts` - Add retry endpoint
4. `src/admin-portal/config/admin-env.config.ts` - Validate LibreDesk env vars

---
*This document should be updated when LibreDesk integration is implemented.*
