# Driver Verification Flow Documentation

This document describes the complete driver verification workflow in the Hello Truck Admin Portal, including new driver verification, re-verification, buffer windows, and revert mechanisms.

---

## Overview

The driver verification system ensures that all drivers meet safety and regulatory requirements before they can accept rides. It supports both initial verification for new drivers and re-verification for existing drivers who update their documents.

### Key Features
- **Automatic Request Creation**: Verification requests are auto-created when drivers upload documents
- **Document-Level Review**: Individual documents can be approved/rejected
- **Buffer Window**: 1-hour safety window before driver becomes active
- **Revert Mechanism**: Quality control through revert requests
- **Field Verification**: Optional on-ground verification with photo documentation
- **Audit Trail**: Complete history of all verification actions

---

## Verification Types

### 1. NEW_DRIVER
**When**: First-time driver registration

**Trigger**: Driver creates profile and uploads all required documents

**Documents Required**:
- Driving License (with expiry date)
- RC Book (Registration Certificate) (with expiry date)
- FC (Fitness Certificate) (with expiry date)
- Insurance (with expiry date)
- Aadhaar Card (encrypted and hashed)
- PAN Card
- EB Bill (Electricity Bill)
- Selfie Photo (optional)

**Driver Status During Verification**: `PENDING`

**Outcome**: Driver becomes `VERIFIED` and can accept rides

---

### 2. EXISTING_DRIVER
**When**: Verified driver re-uploads documents (e.g., expired license renewal)

**Trigger**: Driver updates any document

**Documents to Review**: Only the updated documents

**Driver Status During Verification**: `VERIFIED` (can still accept rides)

**Outcome**: Updated documents become `VERIFIED`

**Note**: Re-verification reason is required when creating request manually

---

## Verification Request Lifecycle

### Status Flow

```
PENDING
   ↓
[Agent reviews documents]
   ↓
APPROVED (Buffer starts - 1 hour)
   ↓
[Buffer window - revert possible]
   ↓
FINAL_APPROVED (Driver active)
```

**Alternative Paths**:
- `PENDING` → `REJECTED` (Documents rejected)
- `APPROVED` → `REVERT_REQUESTED` → `REVERTED` → `PENDING` (Quality control)
- `APPROVED` → `REVERT_REQUESTED` → `APPROVED` (Revert rejected)

---

## Detailed Workflow

### Phase 1: Request Creation

#### Automatic Creation (Preferred)
Verification requests are automatically created in three scenarios:

1. **Profile Creation** (Fire-and-forget)
   - When: Driver creates profile with documents
   - How: `DocumentsService.createDocuments()` calls `autoCreateVerificationRequest()`
   - Status: `PENDING`
   - Type: `NEW_DRIVER`

2. **Document Update** (Fire-and-forget)
   - When: Driver updates any document
   - How: `DocumentsService.updateDocuments()` calls `autoCreateVerificationRequest()`
   - Status: `PENDING`
   - Type: `EXISTING_DRIVER` (if driver is VERIFIED) or `NEW_DRIVER`

3. **Admin View** (Fallback)
   - When: Admin views driver details
   - How: `VerificationService.getDriverForVerification()` calls `ensureVerificationRequestExists()`
   - Status: `PENDING`
   - Type: Based on driver's current verification status

#### Manual Creation
- **Who**: ADMIN or SUPER_ADMIN
- **When**: Special cases or if auto-creation failed
- **Endpoint**: `POST /admin-api/verifications`
- **Required**: `driverId`, `verificationType`, `reVerificationReason` (for EXISTING_DRIVER)

---

### Phase 2: Assignment

**Who Can Assign**: ADMIN, SUPER_ADMIN

**Process**:
1. Admin views pending verifications list
2. Selects verification request
3. Assigns to an AGENT
4. Status changes to `IN_REVIEW`

**Endpoint**: `PATCH /admin-api/verifications/:id/assign`

**Notification**: Assigned agent receives FCM notification

---

### Phase 3: Document Review

**Who Can Review**: AGENT, ADMIN, SUPER_ADMIN

**Process**:
1. Agent opens verification request
2. Reviews each document individually
3. For each document:
   - **APPROVE**: Document is valid
   - **REJECT**: Document is invalid (requires rejection reason, min 10 characters)

**Documents to Review**:
- `license` → Updates `DriverDocuments.licenseStatus`
- `rcBook` → Updates `DriverDocuments.rcBookStatus`
- `fc` → Updates `DriverDocuments.fcStatus`
- `insurance` → Updates `DriverDocuments.insuranceStatus`
- `aadhar` → No status field (just reviewed)
- `selfie` → No status field (just reviewed)

**Endpoint**: `POST /admin-api/verifications/:id/documents/:field/action`

**Document Rejection**:
- Document status becomes `REJECTED`
- Verification status becomes `REJECTED`
- Driver receives FCM notification with rejection reason
- Driver must re-upload rejected document

**Important**: Rejecting any document rejects the entire verification

---

### Phase 4: Field Verification (Optional)

**Who**: FIELD_AGENT

**Purpose**: Physical verification of driver and vehicle

**Process**:
1. Field agent visits driver location
2. Takes photos:
   - Driver selfie
   - Vehicle (front, back, side views)
   - Documents (physical verification)
   - Other relevant photos
3. Uploads photos to verification request

**Photo Types**:
- `DRIVER_SELFIE`
- `VEHICLE_FRONT`
- `VEHICLE_BACK`
- `VEHICLE_SIDE`
- `DOCUMENTS`
- `OTHER`

**Endpoint**: `POST /admin-api/field-verification/photos`

**Note**: Field verification is supplementary and doesn't block document approval

---

### Phase 5: Final Approval

**Who Can Approve**: ADMIN, SUPER_ADMIN

**Prerequisites**:
- All required documents reviewed
- No rejected documents
- Optional: Field verification completed

**Process**:
1. Admin reviews all document actions
2. Approves entire verification
3. **Buffer window starts** (1 hour)
4. Status changes to `APPROVED`
5. `bufferExpiresAt` timestamp set

**Endpoint**: `POST /admin-api/verifications/:id/approve`

**Important During Buffer**:
- Driver status remains `PENDING` (NEW_DRIVER) or `VERIFIED` (EXISTING_DRIVER)
- Document statuses remain `PENDING`
- Driver **cannot** accept rides yet (NEW_DRIVER)
- Driver **can still** accept rides (EXISTING_DRIVER)
- Revert requests are possible

**Notification**: Driver receives "Verification Approved" notification

---

### Phase 6: Buffer Window (1 Hour)

**Purpose**: Quality control and error correction window

**Duration**: 60 minutes (configurable via `ADMIN_BUFFER_DURATION_MINUTES`)

**During Buffer**:
- Verification status: `APPROVED`
- Driver status: **Unchanged** (PENDING for new, VERIFIED for existing)
- Document statuses: **Unchanged** (PENDING)
- Revert requests: **Allowed**

**Why Buffer?**:
- Allows time to catch mistakes
- Enables quality control reviews
- Prevents immediate activation of potentially problematic drivers
- Provides window for additional checks

---

### Phase 7: Finalization

**When**: Buffer expires (after 1 hour)

**Process** (Automatic via Bull Queue):
1. Cron job checks for expired buffers
2. Verification status changes to `FINAL_APPROVED`
3. **Driver status changes to `VERIFIED`** (NEW_DRIVER only)
4. **All document statuses change to `VERIFIED`**
5. Driver can now accept rides (NEW_DRIVER)

**Notification**: Driver receives "Verification Complete" notification

**Important**: This is when driver actually becomes active

---

## Revert Mechanism

### Purpose
Quality control mechanism to catch errors after approval but before finalization

### Who Can Request Revert
- AGENT
- ADMIN
- SUPER_ADMIN

### When Revert is Possible
- Only during buffer window (`APPROVED` status)
- Before `bufferExpiresAt` timestamp

### Revert Request Process

1. **Request Revert**
   - Endpoint: `POST /admin-api/verifications/:id/revert-request`
   - Required: `reason` (min 10 characters)
   - Status changes to `REVERT_REQUESTED`
   - Buffer finalization job is **cancelled**

2. **Admin Decision**
   - Who: ADMIN or SUPER_ADMIN only
   - Endpoint: `POST /admin-api/verifications/:id/revert-decision`
   - Options:
     - **Approve Revert**: Verification reverts to `PENDING`, all statuses reset
     - **Reject Revert**: Verification returns to `APPROVED`, buffer resumes

### Revert Approval Effects
- Verification status: `REVERTED` → `PENDING`
- Driver status: Reset to `PENDING`
- All document statuses: Reset to `PENDING`
- Buffer expiry: Cleared
- Approval details: Cleared
- Agent must re-review documents

### Revert Rejection Effects
- Verification status: Returns to `APPROVED`
- Buffer window: Does **not** resume (must re-approve)
- Revert details: Cleared

---

## Rejection Flow

### Document Rejection
**When**: Individual document is invalid

**Process**:
1. Agent rejects specific document with reason
2. Document status becomes `REJECTED`
3. Verification status becomes `REJECTED`
4. Driver receives notification with rejection reason
5. Driver must re-upload rejected document
6. New verification request auto-created on re-upload

**Endpoint**: `POST /admin-api/verifications/:id/documents/:field/action`

### Entire Verification Rejection
**When**: Driver is not suitable (e.g., fake documents, criminal record)

**Process**:
1. Admin rejects entire verification with reason
2. Verification status becomes `REJECTED`
3. Driver status becomes `REJECTED`
4. Driver receives notification
5. Driver **cannot** re-apply (permanent rejection)

**Endpoint**: `POST /admin-api/verifications/:id/reject`

**Note**: This is a permanent action and should be used carefully

---

## Listing and Filtering

### Pending Drivers List
**Endpoint**: `GET /admin-api/verifications/pending-drivers`

**Shows**: Drivers with `verificationStatus = PENDING`

**Use Case**: New drivers awaiting first verification

**Includes**:
- Driver details
- Documents
- Vehicle information
- Most recent verification request (if exists)

### Pending Documents List
**Endpoint**: `GET /admin-api/verifications/pending-documents`

**Shows**: Drivers with `verificationStatus = VERIFIED` but have documents with `status = PENDING`

**Use Case**: Existing drivers who re-uploaded documents

**Includes**:
- Driver details
- Documents (with status per document)
- Vehicle information
- Most recent verification request (if exists)

### Verification Requests List
**Endpoint**: `GET /admin-api/verifications`

**Filters**:
- `status`: Filter by verification status
- `verificationType`: NEW_DRIVER or EXISTING_DRIVER
- `assignedToId`: Filter by assigned agent
- `startDate` / `endDate`: Date range
- `search`: Search by driver name, phone, ticket ID

**Use Case**: Comprehensive verification management

---

## Integration Points

### 1. Driver Module
- **Documents Service**: Auto-creates verification requests
- **Profile Service**: Provides driver details
- **Vehicle Service**: Provides vehicle information

### 2. Firebase (FCM)
- Sends notifications to drivers
- Notification types:
  - Document rejected
  - Verification approved
  - Verification complete
  - Verification rejected

### 3. LibreDesk (Future)
- Creates support tickets for verifications
- Links verification requests to tickets
- Syncs status updates

### 4. Bull Queue
- Schedules buffer finalization jobs
- Processes expired buffers
- Handles job cancellation for reverts

---

## Best Practices

### For Agents
1. Review all documents thoroughly
2. Check expiry dates carefully
3. Verify document authenticity
4. Provide clear rejection reasons
5. Request field verification if suspicious

### For Admins
1. Review agent decisions before final approval
2. Use buffer window for quality checks
3. Approve reverts only when necessary
4. Monitor agent performance metrics
5. Investigate patterns of rejections

### For Field Agents
1. Take clear, well-lit photos
2. Verify physical documents match uploaded ones
3. Check vehicle condition
4. Document any discrepancies
5. Upload photos promptly

---

## Troubleshooting

### Verification Request Not Created
**Symptoms**: Driver uploaded documents but no verification request exists

**Solutions**:
1. Check if auto-creation failed (check logs)
2. Admin can manually create request
3. Admin can view driver details (triggers fallback creation)

### Buffer Not Expiring
**Symptoms**: Verification stuck in APPROVED status past buffer time

**Solutions**:
1. Check Bull queue status
2. Check cron job logs
3. Manually trigger finalization (SUPER_ADMIN only)

### Revert Request Stuck
**Symptoms**: Revert request not processed

**Solutions**:
1. Admin must approve/reject revert decision
2. Check if admin has proper role (ADMIN or SUPER_ADMIN)
3. Check audit logs for decision history

### Driver Can't Accept Rides After Approval
**Symptoms**: Driver approved but still can't accept rides

**Solutions**:
1. Check if buffer has expired
2. Check driver status (should be VERIFIED)
3. Check document statuses (should be VERIFIED)
4. Check if verification is FINAL_APPROVED

---

## Metrics and Monitoring

### Key Metrics
- Average verification time (request to final approval)
- Document rejection rate per document type
- Agent approval/rejection ratio
- Revert request frequency
- Buffer utilization (reverts vs. finalizations)

### Alerts
- Verification requests pending > 24 hours
- High rejection rate for specific agent
- Multiple revert requests for same verification
- Buffer expiry failures

### Reports
- Daily verification summary
- Agent performance report
- Document rejection analysis
- Revert request trends
