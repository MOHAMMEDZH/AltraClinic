# Real-Time Architecture (WebSockets)

**Version**: 2026-06-15.v1  
**Status**: Implemented  
**Stack**: NestJS WebSockets · Socket.IO · Redis event buffer · Domain Event Bus

---

## Overview

Real-time updates are delivered over Socket.IO on namespace `/realtime`. Domain events flow through the existing outbox → `DomainEventBus` → `RealtimeDomainEventListener` → WebSocket rooms.

```
Domain Handler → OutboxEventPublisher → DomainEventBus
                                              ├── NotificationListener
                                              ├── AnalyticsListener
                                              └── RealtimeDomainEventListener
                                                        ├── Redis buffer (replay)
                                                        └── Socket.IO emit (live)
```

---

## Supported Channels

| Channel | Events | RBAC Resource |
|---|---|---|
| `queue` | `queue.enqueued` | `api.queue:view` |
| `dashboard` | `dashboard.snapshot`, `dashboard.metrics_updated` | `api.analytics:view` |
| `notifications` | `notification.created` | `api.notifications:view` |
| `appointments` | `appointment.scheduled` | `api.scheduling:view` |
| `patients` | `patient.registered` | `api.patients:view` |

---

## Connection Flow

```
1. Client connects to ws://host/realtime
2. Pass JWT: handshake.auth.token OR ?token=
3. Server validates JWT + JTI blacklist
4. Server joins user room: tenant:{tenantId}:user:{userId}
5. Server emits `connected` with lastSequence + heartbeatMs
6. Client emits `subscribe` { channels: [...] }
7. Server checks RBAC per channel → joins tenant rooms
8. Client emits `ping` every 25s → server responds `pong`
9. On disconnect: lastSequence saved to Redis
10. On reconnect: client emits `resume` { lastSequence } → `replay` batch
```

---

## Room Model (Tenant Isolation)

| Room Pattern | Purpose |
|---|---|
| `tenant:{tenantId}:channel:{channel}` | Tenant-wide channel broadcast |
| `tenant:{tenantId}:branch:{branchId}:channel:{channel}` | Branch-scoped broadcast |
| `tenant:{tenantId}:user:{userId}` | User-private (notifications) |

**Security**: Room names always include `tenantId` from the authenticated JWT. Clients cannot join rooms for other tenants because subscription uses the token's `tenantId`, not client-supplied values.

---

## Wire Protocol

### Client → Server

| Event | Payload | Description |
|---|---|---|
| `subscribe` | `{ channels: RealtimeChannel[] }` | Subscribe to channels (RBAC checked) |
| `unsubscribe` | `{ channels: RealtimeChannel[] }` | Leave channel rooms |
| `resume` | `{ lastSequence, channels? }` | Replay missed events |
| `ping` | `{}` | Heartbeat |

### Server → Client

| Event | Description |
|---|---|
| `connected` | Auth success + session metadata |
| `subscribed` | `{ channels, denied }` |
| `realtime.event` | Live event envelope |
| `replay` | `{ events, count, fromSequence, toSequence }` |
| `pong` | Heartbeat response |
| `error` | Auth or validation failure |

### Event Envelope

```json
{
  "sequence": 42,
  "eventId": "uuid",
  "channel": "appointments",
  "type": "appointment.scheduled",
  "tenantId": "...",
  "branchId": "...",
  "timestamp": "2026-06-15T10:00:00.000Z",
  "payload": { }
}
```

---

## Reconnection Handling

1. **Sequence numbers** — monotonic per tenant (`INCR` in Redis)
2. **Event buffer** — last 200 events per tenant+channel (2h TTL)
3. **Connection state** — `lastSequence` persisted per user+session on disconnect
4. **Resume** — client sends `lastSequence`; server replays buffered events with `sequence > lastSequence`

**COMPETING ARCHITECT**:
- Challenger: "Use Socket.IO built-in reconnect only — skip server replay."
- Counter: Built-in reconnect restores the socket but not missed events during downtime. Buffer + resume gives at-most-once delivery of recent events without requiring clients to poll REST.
- Verdict: Hybrid — Socket.IO auto-reconnect + server-side replay.

---

## Architecture Decisions (Challenged)

### Decision 1: Socket.IO over native WebSockets

Socket.IO provides rooms, fallback transports, and NestJS first-class support. Native WS would require rebuilding room management.

### Decision 2: Same JWT as REST (not separate WS token)

Reuses existing auth infrastructure and permission matrix. Access token is short-lived (15 min). Production must use WSS.

### Decision 3: In-process DomainEventBus fan-out (not Redis Pub/Sub)

Outbox already guarantees post-commit delivery. Realtime listener runs in-process alongside notification/analytics listeners. Phase 2: `@socket.io/redis-adapter` for multi-node emit.

### Decision 4: Channel-level RBAC (not event-level)

Subscribing to `patients` grants all patient events. Finer granularity (per-patient rooms) adds complexity; branch scoping covers most clinic use cases.

### Decision 5: Capped Redis list buffer (not Streams)

200 events × 5 channels × N tenants is manageable with LPUSH+LTRIM. Streams add consumer group complexity without benefit at current scale.

---

## Module Structure

```
src/modules/realtime/
├── api/realtime.gateway.ts
├── domain/
│   ├── realtime.types.ts
│   ├── realtime-channel.config.ts
│   └── realtime-room.builder.ts
├── application/
│   ├── services/ (auth, broadcast, buffer, dashboard, authorization)
│   └── listeners/realtime-domain-event.listener.ts
└── realtime.module.ts
```

---

## Bypass Vulnerability Audit

| Risk | Status | Mitigation |
|---|---|---|
| Cross-tenant room join | ✅ | Rooms built from JWT tenantId only |
| Unauthenticated WS | ✅ | Disconnect on auth failure |
| Revoked token access | ✅ | JTI blacklist check on connect |
| Subscribe without permission | ✅ | RBAC per channel before join |
| Token in query string logged | ⚠️ | Prefer `handshake.auth.token`; query supported for legacy clients |
| Missed events during outage | ⚠️ | 200-event buffer; older events require REST poll |
| Multi-node broadcast gap | ⚠️ | Single-node OK; Phase 2 Redis adapter |
| CORS origin: * | ⚠️ | Restrict to tenant domains in production |

---

## Phase 2 Roadmap

| Priority | Enhancement |
|---|---|
| High | `@socket.io/redis-adapter` for horizontal scaling |
| High | `patient.status_changed` event from patient update handler |
| High | Restrict CORS to configured tenant domains |
| Medium | Dedicated short-lived WS tokens |
| Medium | Per-patient rooms for portal users |
| Low | Redis Streams buffer for larger replay window |

---

## Client Example (JavaScript)

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000/realtime', {
  auth: { token: accessToken },
  transports: ['websocket'],
});

socket.on('connected', ({ lastSequence, heartbeatMs }) => {
  socket.emit('subscribe', { channels: ['appointments', 'queue', 'notifications'] });
  if (lastSequence > 0) {
    socket.emit('resume', { lastSequence });
  }
  setInterval(() => socket.emit('ping', {}), heartbeatMs);
});

socket.on('realtime.event', (envelope) => {
  console.log(envelope.type, envelope.payload);
});

socket.on('replay', ({ events }) => {
  events.forEach((e) => console.log('replay', e.type));
});
```
