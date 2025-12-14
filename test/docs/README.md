# Hello Truck Documentation 🚛

Welcome to the living documentation for the Hello Truck Backend. This documentation is structured to map 1-to-1 with our automated test suite.

## 📂 Structure

### [QA Strategy](QA/QA_STRATEGY.md)
High-level strategy, testing pyramid, and release checklists.

### [QA Coverage](QA/QA_COVERAGE.md)
Detailed consolidated matrix of all business rules and test scenarios.

### [Testing Guide](testing/TESTING_GUIDE.md)
How to run, write, and debug tests.

### 🌊 Flows (Behavioral Contracts)
These documents explain the business logic for each major feature flow.

- [01 - Authentication](flows/01-auth.md)
- [02 - Customer Profile](flows/02-customer.md)
- [03 - Driver Profile](flows/03-driver.md)
- [04 - Booking Lifecycle](flows/04-booking.md)
- [05 - Financial Logs](flows/05-logs.md)
- [06 - Cancellation](flows/06-cancellation.md)
- [07 - Realtime Updates](flows/07-realtime.md)

### 🔄 State Machines
Reference for complex state transitions.

- [Booking States](states/booking-states.md)
- [Driver States](states/driver-states.md)
- [Payment States](states/payment-states.md)

---

## 🧪 Traceability
Every E2E test file in `test/e2e/` links back to one of these flow documents via the `@doc` tag.
