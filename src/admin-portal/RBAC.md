# Admin Portal Role-Based Access Control (RBAC)

This document defines the role hierarchy, permissions, and access control rules for the Hello Truck Admin Portal.

## Role Hierarchy

```
SUPER_ADMIN (Highest Authority)
    ↓
ADMIN (Management)
    ↓
AGENT (Operations)
    ↓
FIELD_AGENT (Field Operations)
    ↓
CUSTOMER_SUPPORT (Support)
```

---

## Role Definitions

### 1. SUPER_ADMIN
**Purpose**: System administration and oversight

**Capabilities**:
- Full system access
- User management (create, update, deactivate admin users)
- View all audit logs
- All ADMIN capabilities

**Restrictions**:
- Cannot be created via API (must be seeded in database)
- At least one SUPER_ADMIN must exist at all times

**Use Cases**:
- System configuration
- Admin user management
- Security audits
- Emergency interventions

---

### 2. ADMIN
**Purpose**: Operational management and final approvals

**Capabilities**:
- **Verifications**:
  - View all verification requests
  - Assign verifications to agents
  - Approve/reject entire verifications
  - Handle revert decisions (approve/reject reverts)
  - Create verification requests manually
- **Refunds**:
  - View all refund requests
  - Approve/reject refunds
  - Handle revert decisions (approve/reject reverts)
- **Support**:
  - View all bookings
  - Add support notes
- **Audit**:
  - View audit logs (all modules)
- **Notifications**:
  - Receive all system notifications

**Restrictions**:
- Cannot manage admin users
- Cannot modify audit logs

**Use Cases**:
- Final approval authority for verifications
- Final approval authority for refunds
- Handling escalations
- Reviewing agent performance

---

### 3. AGENT
**Purpose**: Day-to-day verification and support operations

**Capabilities**:
- **Verifications**:
  - View assigned verification requests
  - Review and approve/reject individual documents
  - Request reverts during buffer window
  - View driver details
- **Refunds**:
  - View refund requests
  - Create refund requests
  - Request reverts during buffer window
- **Support**:
  - View bookings
  - Add support notes
- **Notifications**:
  - Receive notifications for assigned tasks

**Restrictions**:
- Cannot approve entire verifications (only individual documents)
- Cannot approve refunds
- Cannot handle revert decisions
- Cannot assign verifications
- Cannot view audit logs

**Use Cases**:
- Document verification
- Customer support
- Refund request creation
- Quality control (requesting reverts)

---

### 4. FIELD_AGENT
**Purpose**: On-ground verification and photo documentation

**Capabilities**:
- **Field Verification**:
  - Upload field verification photos
  - Delete own uploaded photos
  - View assigned verification requests
- **Verifications**:
  - View driver details for assigned verifications
- **Notifications**:
  - Receive notifications for field verification assignments

**Restrictions**:
- Cannot approve/reject documents
- Cannot create verification requests
- Cannot access refunds
- Cannot access support features
- Cannot view audit logs

**Use Cases**:
- Physical verification of drivers and vehicles
- Photo documentation
- On-site inspections

---

### 5. CUSTOMER_SUPPORT
**Purpose**: Customer assistance and issue resolution

**Capabilities**:
- **Support**:
  - View all bookings
  - Add support notes
  - Search bookings by various criteria
- **Refunds**:
  - View refund requests
  - Create refund requests
- **Notifications**:
  - Receive notifications for support-related events

**Restrictions**:
- Cannot access verification features
- Cannot approve refunds
- Cannot view audit logs
- Cannot upload field photos

**Use Cases**:
- Customer inquiries
- Booking issue resolution
- Refund request creation
- Support ticket management

---

## Permission Matrix

| Feature | SUPER_ADMIN | ADMIN | AGENT | FIELD_AGENT | CUSTOMER_SUPPORT |
|---------|-------------|-------|-------|-------------|------------------|
| **User Management** |
| Create admin users | ✅ | ❌ | ❌ | ❌ | ❌ |
| Update admin users | ✅ | ❌ | ❌ | ❌ | ❌ |
| Deactivate admin users | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Verifications** |
| View pending drivers | ✅ | ✅ | ✅ | ✅ | ❌ |
| View driver details | ✅ | ✅ | ✅ | ✅ | ❌ |
| Create verification request | ✅ | ✅ | ❌ | ❌ | ❌ |
| Assign verification | ✅ | ✅ | ❌ | ❌ | ❌ |
| Approve/reject document | ✅ | ✅ | ✅ | ❌ | ❌ |
| Approve entire verification | ✅ | ✅ | ❌ | ❌ | ❌ |
| Reject entire verification | ✅ | ✅ | ❌ | ❌ | ❌ |
| Request revert | ✅ | ✅ | ✅ | ❌ | ❌ |
| Handle revert decision | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Field Verification** |
| Upload field photos | ✅ | ✅ | ✅ | ✅ | ❌ |
| View field photos | ✅ | ✅ | ✅ | ✅ | ❌ |
| Delete field photos | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Refunds** |
| View refunds | ✅ | ✅ | ✅ | ❌ | ✅ |
| Create refund | ✅ | ✅ | ✅ | ❌ | ✅ |
| Approve refund | ✅ | ✅ | ❌ | ❌ | ❌ |
| Reject refund | ✅ | ✅ | ❌ | ❌ | ❌ |
| Request revert | ✅ | ✅ | ✅ | ❌ | ❌ |
| Handle revert decision | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Support** |
| View bookings | ✅ | ✅ | ✅ | ❌ | ✅ |
| Add support notes | ✅ | ✅ | ✅ | ❌ | ✅ |
| **Audit** |
| View audit logs | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Notifications** |
| Receive notifications | ✅ | ✅ | ✅ | ✅ | ✅ |
| Manage notifications | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## Access Control Rules

### 1. Authentication
- All admin portal routes require valid JWT access token
- Access tokens expire after 15 minutes
- Refresh tokens expire after 7-30 days (configurable)
- Failed login attempts are logged for security monitoring

### 2. Authorization
- Role-based guards check user role before allowing access
- Insufficient permissions return 403 Forbidden
- All authorization checks are logged in audit trail

### 3. Data Access
- **Verifications**:
  - AGENT can only view assigned verifications
  - ADMIN and SUPER_ADMIN can view all verifications
  - FIELD_AGENT can only view verifications assigned for field work
- **Refunds**:
  - All roles with refund access can view all refunds
  - Creation and approval follow role hierarchy
- **Audit Logs**:
  - Only SUPER_ADMIN and ADMIN can access
  - Cannot be modified or deleted

### 4. Action Restrictions
- **Two-Level Approval**:
  - Refunds require ADMIN approval (AGENT can only create)
  - Verifications require ADMIN approval (AGENT can only review documents)
- **Revert Mechanism**:
  - Any authorized role can request revert during buffer
  - Only ADMIN can approve/reject revert requests
- **Buffer Window**:
  - 1-hour window after approval before finalization
  - Allows quality control and error correction

---

## Security Best Practices

### 1. Password Requirements
- Minimum 8 characters
- Must contain uppercase, lowercase, number, and special character
- Passwords are hashed using bcrypt
- Password reset requires SUPER_ADMIN intervention

### 2. Session Management
- One active session per user (new login invalidates old session)
- Sessions tracked by IP address and user agent
- Automatic logout after token expiry
- Manual logout invalidates refresh token

### 3. Audit Trail
- All critical actions logged with:
  - User ID and role
  - Action type and module
  - Before/after snapshots
  - IP address and user agent
  - Timestamp
- Logs are immutable and permanent
- Regular audit reviews recommended

### 4. IP Whitelisting (Optional)
- Can be configured to restrict access by IP
- Recommended for production environments
- SUPER_ADMIN can manage whitelist

---

## Role Assignment Guidelines

### When to assign SUPER_ADMIN
- System administrators only
- Limit to 1-2 users
- Requires background check and security clearance

### When to assign ADMIN
- Operations managers
- Senior team leads
- Users who need final approval authority
- Limit to 3-5 users per region

### When to assign AGENT
- Verification specialists
- Customer support leads
- Day-to-day operations staff
- Most common role

### When to assign FIELD_AGENT
- On-ground verification staff
- Mobile field workers
- Users who only need photo upload capability

### When to assign CUSTOMER_SUPPORT
- Support desk staff
- Call center agents
- Users who only handle customer inquiries

---

## Emergency Procedures

### Account Lockout
- After 5 failed login attempts, account is locked for 30 minutes
- SUPER_ADMIN can manually unlock accounts
- Lockout events are logged

### Compromised Account
1. SUPER_ADMIN immediately deactivates account
2. All active sessions are invalidated
3. Audit logs reviewed for suspicious activity
4. Password reset required before reactivation

### Role Escalation
- Temporary role escalation requires SUPER_ADMIN approval
- Time-limited (max 24 hours)
- All actions during escalation are flagged in audit logs

---

## Compliance and Monitoring

### Regular Reviews
- Quarterly review of user roles and permissions
- Monthly audit log analysis
- Annual security assessment

### Metrics to Monitor
- Failed login attempts per user
- Unusual access patterns
- Revert request frequency
- Approval/rejection ratios

### Alerts
- Multiple failed logins
- Access from new IP addresses
- High-value actions (bulk approvals, etc.)
- Revert requests outside normal hours
