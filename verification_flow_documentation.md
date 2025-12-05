# Hello Truck - Driver Verification Flow Documentation

## Overview
This document describes the driver verification lifecycle, including initial onboarding, re-verification of documents, and automated expiration handling. It details how the system decouples individual document statuses from the driver's overall ability to work, ensuring a smooth operational flow while maintaining compliance.

## Verification Lifecycle

### Status Progression
```
PENDING (Onboarding) → VERIFIED (Active) → PENDING (Re-upload/Expiry) → VERIFIED (Re-verified)
```

### Key Concepts
- **Overall Driver Status**: The master switch for a driver's ability to take rides (`VERIFIED` or `PENDING`).
- **Individual Document Status**: The status of specific documents like License, FC, Insurance (`VERIFIED`, `PENDING`, `REJECTED`).
- **Expiry Date**: The definitive date used to determine if a document is valid or expired.

## Detailed Scenarios

### 1. Initial Onboarding
**Description**: A new driver signs up and uploads their documents.

**System State**:
- **Driver Status**: `PENDING`
- **Document Statuses**: `PENDING` (for all uploaded docs)

**Admin Action**:
- Admin reviews documents in the **"Pending Verification"** tab.
- Admin sets **Expiry Dates** for License, FC, and Insurance.
- **Action**: Clicking "Approve All & Verify Driver" sets the driver and all documents to `VERIFIED`.

**Outcome**:
- Driver becomes `VERIFIED` and can start taking rides.

---

### 2. Document Re-upload (Hot Update)
**Description**: A verified driver uploads a new version of a document (e.g., renewed License) *before* the old one expires.

**System State**:
- **Driver Status**: Remains `VERIFIED` (Non-blocking).
- **Specific Document Status**: Resets to `PENDING`.
- **Other Documents**: Remain `VERIFIED`.

**Admin Action**:
- These cases appear in the **"Pending Documents"** tab.
- Admin reviews the new document.
- Admin updates the **Expiry Date** for that specific document.

**Outcome**:
- Driver continues to work without interruption.
- Document status becomes `VERIFIED` once approved.

---

### 3. Document Expiration (Blocking)
**Description**: A driver fails to renew a document, and the current date passes the recorded `expiryDate`.

**System State**:
- **Cron Job**: Detects `expiryDate < now`.
- **Specific Document Status**: Sets to `PENDING`.
- **Driver Status**: Demoted to `PENDING` (Blocking).

**Admin Action**:
- These cases appear in the **"Pending Verification"** tab (since the driver is now unverified).
- Admin waits for driver to upload new documents.
- Once uploaded, Admin reviews and sets new **Expiry Dates**.

**Outcome**:
- Driver is blocked from taking rides until compliance is met.

---

## Admin Dashboard Workflow

### Tab 1: Pending Verification
**Target Audience**: New drivers OR drivers with expired documents.
**Logic**: Drivers where `verificationStatus` is `PENDING`.
**Action Needed**: Full review and setting of expiry dates to enable the driver.

### Tab 2: Pending Documents
**Target Audience**: Active drivers with updated documents.
**Logic**: Drivers where `verificationStatus` is `VERIFIED` **BUT** at least one document is `PENDING`.
**Action Needed**: Review specific documents and update expiry dates. **Urgency is lower** as operations are not blocked.

## Technical Implementation Details

### Database Schema
- **Driver**: Has `verificationStatus` (`PENDING`, `VERIFIED`, `REJECTED`).
- **DriverDocuments**: Has individual fields:
  - `licenseStatus`, `licenseExpiry`, `licenseUrl`
  - `fcStatus`, `fcExpiry`, `fcUrl`
  - `insuranceStatus`, `insuranceExpiry`, `insuranceUrl`

### Cron Job Logic (`cron.service.ts`)
Runs daily at midnight to enforce compliance:
1.  **Mark Documents Pending**: Updates `licenseStatus` to `PENDING` where `licenseExpiry < now`.
2.  **Demote Driver**: Updates Driver `verificationStatus` to `PENDING` **ONLY IF** actual expiry dates are passed (`licenseExpiry < now`).
    *   *Crucial*: It does NOT demote drivers solely based on `licenseStatus` being `PENDING` (which happens during re-uploads).

### Re-upload Logic (`documents.service.ts`)
When a driver uploads a file:
1.  The specific document status (e.g., `licenseStatus`) is reset to `PENDING`.
2.  The Driver's overall `verificationStatus` is NOT automatically demoted.
3.  This creates the "Verified Driver with Pending Documents" state.
