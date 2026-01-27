# Verification Access Control

## Role-Based Access Summary

### SUPER_ADMIN & ADMIN
**Full Access** - Can view and manage all verifications

**Endpoints:**
- `GET /admin-api/verifications/pending-drivers` - View all pending new drivers
- `GET /admin-api/verifications/pending-documents` - View all drivers with pending re-verification
- `GET /admin-api/verifications` - List all verifications with filters
- `GET /admin-api/verifications/:id` - View any verification
- `GET /admin-api/verifications/drivers/:driverId/details` - View any driver
- `POST /admin-api/verifications` - Create verification request
- `PATCH /admin-api/verifications/:id/assign` - Assign to agents
- `POST /admin-api/verifications/:id/approve` - Approve entire verification
- `POST /admin-api/verifications/:id/reject` - Reject entire verification
- `POST /admin-api/verifications/:id/revert-decision` - Handle revert requests

### AGENT
**Assigned Verifications Only** - Can only view and work on verifications assigned to them

**Endpoints:**
- `GET /admin-api/verifications/my-assignments` - View only assigned verifications
- `GET /admin-api/verifications/:id` - View only if assigned to them
- `GET /admin-api/verifications/drivers/:driverId/details` - View only if driver's verification is assigned to them
- `POST /admin-api/verifications/:id/documents/:field/action` - Approve/reject individual documents
- `POST /admin-api/verifications/:id/revert-request` - Request revert during buffer

**Restrictions:**
- ❌ Cannot view all pending drivers
- ❌ Cannot view unassigned verifications
- ❌ Cannot approve entire verifications
- ❌ Cannot assign verifications
- ❌ Cannot handle revert decisions

### FIELD_AGENT
**Assigned Field Verifications Only** - Can only view verifications assigned for field work

**Endpoints:**
- `GET /admin-api/verifications/my-assignments` - View only assigned verifications
- `GET /admin-api/verifications/:id` - View only if assigned to them
- `GET /admin-api/verifications/drivers/:driverId/details` - View only if driver's verification is assigned to them
- `POST /admin-api/field-verification/:verificationId/photos` - Upload field photos
- `DELETE /admin-api/field-verification/photos/:photoId` - Delete own photos

**Restrictions:**
- ❌ Cannot view all pending drivers
- ❌ Cannot approve/reject documents
- ❌ Cannot approve verifications
- ❌ Cannot request reverts

### CUSTOMER_SUPPORT
**No Access** - Customer support has no access to verification features

**Restrictions:**
- ❌ Cannot access any verification endpoints
- ✅ Can access support and refund features only

---

## Auto-Assignment Logic

### New Driver (NEW_DRIVER)
- Auto-assigned to **FIELD_AGENT** with least workload
- Field agent uploads verification photos
- Admin/Agent reviews documents

### Existing Driver Re-verification (EXISTING_DRIVER)
- Auto-assigned to **AGENT** with least workload
- Agent reviews updated documents
- No field verification needed

### Assignment Failure Handling
1. Verification created with status `PENDING` (no assignment)
2. Fire-and-forget async assignment attempt
3. If fails, cron job retries every 5 minutes
4. Admin can manually assign if needed

---

## Access Control Implementation

### Controller Level
```typescript
// Admin only - view all
@Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)

// Agent/Field Agent - view assigned only
@Roles(AdminRole.AGENT, AdminRole.FIELD_AGENT)
```

### Service Level
```typescript
// Check if user can access verification
if (userRole === AdminRole.AGENT || userRole === AdminRole.FIELD_AGENT) {
  if (verification.assignedToId !== userId) {
    throw new ForbiddenException('You can only view verifications assigned to you');
  }
}
```

---

## Security Notes

1. **Agents cannot see unassigned verifications** - Prevents cherry-picking
2. **Field agents cannot approve documents** - Separation of duties
3. **Customer support has no verification access** - Role isolation
4. **All access attempts are audit logged** - Compliance and security
5. **Assignment is automatic** - Reduces manual workload and bias
