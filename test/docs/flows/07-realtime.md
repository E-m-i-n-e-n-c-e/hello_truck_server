# 07 – Realtime Updates (Socket & SSE)

## Covered By
- `test/e2e/07-realtime.e2e-spec.ts`

## Purpose
Verifies the realtime communication layer: Driver Location Updates (via Socket.io) -> Server -> Customer Navigation Updates (via SSE).

---

## Architecture
- **In-Memory Bus**: Used for E2E tests to simulate Redis Pub/Sub without external dependencies.
- **Production**: Uses Redis Pub/Sub.

---

## Flows

### 1. Driver Location Update
- **Protocol**: Socket.io
- **Event**: `driver-navigation-update`
- **Payload**: `{ bookingId, latitude, longitude, heading }`
- **Auth**: Bearer Token in Socket Handshake.

### 2. Customer Subscription
- **Protocol**: Server-Sent Events (SSE)
- **Endpoint**: `/bookings/customer/driver-navigation/:bookingId`
- **Auth**: Standard Cookie/Header.

---

## Side Effects
- No database writes (ephemeral data).
- Events broadcast to specific Redis channels.

---

## Testing Strategy
- Tests utilize `socket.io-client` to simulate driver.
- Tests utilize `EventSource` simulation to capture SSE stream.
- Verifies that `Event A` from Driver results in `Event B` to Customer.
