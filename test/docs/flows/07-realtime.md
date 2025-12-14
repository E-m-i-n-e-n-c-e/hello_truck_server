# 07 – Realtime Updates

## Covered By
- `test/e2e/07-realtime.e2e-spec.ts`

## Purpose
Validates the realtime infrastructure setup for location tracking. Full WebSocket testing requires a running server, so this suite focuses on state validation.

---

## Preconditions
- Customer and Driver authenticated with profiles
- Booking created and assigned to driver
- Driver has accepted the booking (`status: CONFIRMED`)

---

## Setup Flow (in beforeAll)

```
1. Login customer & driver
2. Create profiles, vehicle
3. Set driver VERIFIED + AVAILABLE
4. Create booking
5. Manually assign driver (via Prisma)
6. Accept assignment → booking CONFIRMED
```

---

## Test Cases

### WebSocket Connection (2 tests - SKIPPED)

| Test | Reason Skipped |
|------|----------------|
| Connect driver to WebSocket | Requires running server with `npm run start:dev` |
| Reject connection without token | Requires running server with `npm run start:dev` |

**Note**: Use `npm run test:smoke:realtime` for manual WebSocket testing.

### Realtime Gateway Validation (2 tests)

| Test | Assertion |
|------|-----------|
| Booking confirmed | `booking.status === "CONFIRMED"` |
| Driver assigned | `booking.assignedDriverId === driverId` |

---

## Architecture

```
┌─────────────────┐    Socket.io     ┌─────────────────┐
│  Driver App     │ ───────────────► │  Server         │
│  (Location)     │                  │  (RealtimeGateway) │
└─────────────────┘                  └────────┬────────┘
                                              │
                                     Redis Pub/Sub (Prod)
                                     InMemoryBus (Test)
                                              │
                                     ┌────────▼────────┐
                                     │  Customer App   │
                                     │  (SSE Stream)   │
                                     └─────────────────┘
```

---

## Testing Strategy

| Environment | Realtime Bus | Method |
|-------------|--------------|--------|
| E2E Tests | `InMemoryBus` | State validation only |
| Smoke Tests | Redis | Manual via `test/smoke/realtime.smoke.ts` |
| Dev/Prod | Redis | Full Socket.io + SSE |

---

## Events

### Driver → Server
- **Protocol**: Socket.io
- **Event**: `driver-navigation-update`
- **Payload**: `{ bookingId, latitude, longitude, heading }`

### Server → Customer
- **Protocol**: Server-Sent Events (SSE)
- **Endpoint**: `GET /bookings/customer/driver-navigation/{bookingId}`
- **Payload**: Location updates streamed in real-time

---

## Key Assertions

1. **Booking Ready**: A confirmed booking exists for realtime tracking.
2. **Driver Linked**: `assignedDriverId` is set on the booking.
3. **InMemoryBus**: E2E tests use `InMemoryBus` instead of Redis for CI safety.
