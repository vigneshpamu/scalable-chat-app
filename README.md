# Scalable Chat App

A real-time, horizontally scalable chat application built with a microservices-inspired architecture. The system uses **Redis Pub/Sub** for cross-instance message broadcasting and **Apache Kafka** for durable message persistence — decoupling real-time delivery from database writes to ensure high throughput and fault tolerance.

Built as a **Turborepo monorepo** with TypeScript across the entire stack.

---

## System Design

![Scalable Chat App - System Design](system_design.png)

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Tech Stack](#tech-stack)
- [Monorepo Structure](#monorepo-structure)
- [Data Flow](#data-flow)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Environment Variables](#environment-variables)
  - [Installation](#installation)
  - [Running the Project](#running-the-project)
- [Project Walkthrough](#project-walkthrough)
  - [Frontend (`apps/web`)](#frontend-appsweb)
  - [Backend (`apps/server`)](#backend-appsserver)
  - [Database Schema](#database-schema)
- [Scalability Design](#scalability-design)
- [System Design Diagram](#system-design-diagram)
- [API Reference](#api-reference)
- [Known Limitations](#known-limitations)
- [License](#license)

---

## Architecture Overview

```
┌──────────────┐    WebSocket     ┌───────────────────────┐
│  Next.js Web │ ◄──────────────► │   Socket.IO Server    │
│  (Frontend)  │   Socket.IO v4   │   (Node.js, ×N)       │
└──────────────┘                  └──────┬────────────────┘
                                         │
                               ┌─────────┴──────────┐
                               ▼                     ▼
                        ┌─────────────┐       ┌─────────────┐
                        │ Redis PubSub│       │ Kafka Topic │
                        │ (ioredis)   │       │ (kafkajs)   │
                        └──────┬──────┘       └──────┬──────┘
                               │                      │
                     broadcast to all          ┌──────▼──────┐
                     server instances          │ Kafka       │
                     → io.emit()               │ Consumer    │
                               │               └──────┬──────┘
                               ▼                      ▼
                        ┌──────────────┐      ┌──────────────┐
                        │ All Clients  │      │  PostgreSQL  │
                        │ receive msg  │      │  (Prisma)    │
                        └──────────────┘      └──────────────┘
```

The architecture is split into **four tiers**:

| Tier | Components | Purpose |
|---|---|---|
| **Client Tier** | Next.js Frontend (React 18) | Chat UI with Socket.IO client |
| **Server Tier** | Node.js HTTP Server + Socket.IO | WebSocket connection handling, Redis pub/sub |
| **Messaging Tier** | Redis Pub/Sub + Apache Kafka | Real-time broadcasting and durable message queuing |
| **Data Tier** | PostgreSQL via Prisma ORM | Persistent message storage |

---

## Tech Stack

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| **Frontend Framework** | Next.js | 14.2.6 | React-based chat UI |
| **UI Library** | React | 18.3.1 | Component-based rendering |
| **WebSocket Client** | socket.io-client | 4.7.5 | Browser-side real-time connection |
| **Backend Runtime** | Node.js | ≥ 18 | HTTP + WebSocket server |
| **WebSocket Server** | Socket.IO | 4.7.2 | Bi-directional real-time communication |
| **Pub/Sub** | Redis (ioredis) | 5.4.1 | Cross-instance message broadcasting |
| **Message Queue** | Apache Kafka (kafkajs) | 2.2.4 | Durable, ordered message buffer |
| **Database** | PostgreSQL | — | Persistent message storage |
| **ORM** | Prisma | 5.19.1 | Type-safe database access |
| **Language** | TypeScript | 5.x | Static typing across the entire stack |
| **Build System** | Turborepo | 2.1.1 | Monorepo task orchestration |

---

## Monorepo Structure

```
scalable-chat-app/
├── apps/
│   ├── web/                          # Next.js frontend application
│   │   ├── app/
│   │   │   ├── layout.tsx            # Root layout (wraps SocketProvider)
│   │   │   ├── page.tsx              # Main chat page
│   │   │   ├── [id]/page.tsx         # Dynamic route chat page
│   │   │   ├── globals.css           # Global styles
│   │   │   └── page.module.css       # Chat input & button styles
│   │   ├── context/
│   │   │   └── SocketProvider.tsx     # Socket.IO context & connection manager
│   │   └── package.json
│   │
│   ├── server/                       # Node.js backend server
│   │   ├── src/
│   │   │   ├── index.ts              # Entry point (HTTP server + Kafka consumer)
│   │   │   └── services/
│   │   │       ├── socket.ts         # SocketService class (WebSocket + Redis)
│   │   │       ├── kafka.ts          # Kafka producer & consumer
│   │   │       └── prisma.ts         # Prisma client singleton
│   │   ├── prisma/
│   │   │   ├── schema.prisma         # Database schema
│   │   │   └── migrations/           # SQL migration files
│   │   └── package.json
│   │
│   └── docs/                         # Documentation site (Next.js)
│       └── app/
│           ├── layout.tsx
│           └── page.tsx
│
├── packages/
│   ├── ui/                           # Shared React component library (@repo/ui)
│   │   └── src/
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       └── code.tsx
│   ├── eslint-config/                # Shared ESLint configurations
│   └── typescript-config/            # Shared TypeScript configurations
│
├── turbo.json                        # Turborepo pipeline configuration
├── package.json                      # Root workspace configuration
└── scalable-chat-app-hld.excalidraw  # System design diagram
```

---

## Data Flow

The message lifecycle follows this path through the system:

```
 ① User types message & clicks "Send"
    │
    ▼
 ② SocketProvider emits "event:message" via Socket.IO client
    │   (SocketProvider.tsx → socket.emit)
    │
    ▼
 ③ Socket.IO Server receives the event
    │   (socket.ts → io.on('connect') → socket.on('event:message'))
    │
    ▼
 ④ Server publishes message to Redis channel
    │   (socket.ts → pub.publish(KAFKA_TOPIC, message))
    │
    ▼
 ⑤ Redis broadcasts to ALL subscribed server instances
    │   (socket.ts → sub.on('message'))
    │
    ├──▶ Each instance calls io.emit('message', message)
    │    All connected WebSocket clients receive the message in real-time
    │
    └──▶ Server produces message to Kafka topic
         (socket.ts → produceMessage(message))
              │
              ▼
         ⑥ Kafka Consumer picks up the message
              (kafka.ts → consumer.run → eachMessage)
              │
              ▼
         ⑦ Consumer writes to PostgreSQL via Prisma
              (kafka.ts → prismaClient.message.create())
              │
              ▼
         Message persisted in "messages" table
```

**Key design decisions:**
- Real-time delivery (steps ④→⑤) and persistence (steps ⑤→⑥→⑦) happen **in parallel**
- If PostgreSQL is down, real-time chat still works — messages buffer in Kafka
- Kafka consumer has built-in error recovery: on DB failure it pauses for 60 seconds then resumes

---

## Getting Started

### Prerequisites

- **Node.js** ≥ 18
- **npm** ≥ 9.6.0
- **PostgreSQL** (running instance)
- **Redis** (running instance)
- **Apache Kafka** (running instance or managed service like Confluent Cloud)

### Environment Variables

Create a `.env` file in the `apps/server/` directory:

```env
# Server
PORT=8000

# PostgreSQL
DATABASE_URL="postgresql://user:password@localhost:5432/chatdb"

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_USERNAME=default
REDIS_PASSWORD=your_redis_password

# Kafka
KAFKA_BROKER="your-kafka-broker:9092"
KAFKA_TOPIC=chat-messages
KAFKA_GROUP_ID=chat-consumer-group
KAFKA_USERNAME=your_kafka_username
KAFKA_PASSWORD=your_kafka_password
KAFKA_CA_PATH=./ca-cert.pem
```

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd scalable-chat-app

# Install all dependencies (root workspace installs everything)
npm install

# Generate Prisma client
cd apps/server
npx prisma generate

# Run database migrations
npx prisma migrate dev

# Return to root
cd ../..
```

### Running the Project

```bash
# Start all apps in development mode (from project root)
npm run dev
```

This uses Turborepo to run both `apps/web` (Next.js on port 3000) and `apps/server` (Node.js on port 8000) concurrently.

**Individual commands:**

```bash
# Frontend only
npm run dev --workspace=web

# Backend only (with auto-reload via tsc-watch)
npm run dev --workspace=server

# Build all
npm run build

# Lint all
npm run lint
```

---

## Project Walkthrough

### Frontend (`apps/web`)

**`context/SocketProvider.tsx`** — The core of the frontend. Creates a React Context that:

1. Establishes a Socket.IO connection to `ws://localhost:8000` on mount
2. Listens for `message` events and appends them to the `messages` state array
3. Exposes `sendMessage(msg)` which emits `event:message` to the server
4. Cleans up the socket connection on unmount

**`app/layout.tsx`** — Wraps the entire application in `<SocketProvider>`, making the socket context available to all pages.

**`app/page.tsx`** — Main chat page with a text input, send button, and message list rendered from the `messages` array.

**`app/[id]/page.tsx`** — Dynamic route variant that also clears the input field after sending.

### Backend (`apps/server`)

**`src/index.ts`** — Entry point that:
1. Starts the Kafka message consumer (runs in background)
2. Creates an HTTP server
3. Attaches Socket.IO to the HTTP server
4. Starts listening on the configured port
5. Initializes Socket.IO event listeners

**`src/services/socket.ts`** — `SocketService` class that:
- Creates two Redis clients: `pub` (publisher) and `sub` (subscriber)
- Subscribes to the Redis channel on construction
- On `event:message` from a client → publishes to Redis
- On Redis message → broadcasts to all connected clients via `io.emit()` AND produces to Kafka
- CORS is configured to allow all origins (`*`)

**`src/services/kafka.ts`** — Kafka integration with two key functions:
- `produceMessage(message)` — Sends a message to the Kafka topic using a singleton producer
- `startMessageConsumer()` — Subscribes to the Kafka topic and writes each message to PostgreSQL via Prisma
  - Error handling: on DB failure, pauses the consumer for 60 seconds, then resumes — preventing message loss

**`src/services/prisma.ts`** — Exports a singleton Prisma client with query logging enabled.

### Database Schema

The application uses a single `messages` table:

```sql
CREATE TABLE "messages" (
    "id"         TEXT NOT NULL,          -- UUID, auto-generated
    "text"       TEXT NOT NULL,          -- Message content
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);
```

**Prisma schema** (`prisma/schema.prisma`):

```prisma
model Message {
  id        String   @id @default(uuid())
  text      String
  createdAt DateTime @default(now()) @map("created_at")

  @@map("messages")
}
```

---

## Scalability Design

### Horizontal Scaling

The key to horizontal scaling is the **Redis Pub/Sub** layer:

```
                    ┌─────────────────┐
                    │   Load Balancer  │
                    └──┬──────┬───────┘
                       │      │
              ┌────────▼┐  ┌──▼───────┐
              │ Server 1 │  │ Server 2 │  ← Each runs SocketService
              └──┬────┬──┘  └──┬────┬──┘
                 │    │        │    │
        pub ────┘    │   pub ──┘    │
        sub ─────────┘   sub ───────┘
                 │             │
                 ▼             ▼
            ┌─────────────────────┐
            │    Redis Pub/Sub    │  ← Broadcasts to ALL instances
            └─────────────────────┘
```

When any server instance receives a message from a client:
1. It publishes to Redis
2. Redis delivers the message to **all** subscribed instances
3. Each instance calls `io.emit()` — reaching all connected clients

This means clients connected to Server 1 will receive messages sent by clients connected to Server 2.

### Fault Tolerance

| Failure Scenario | System Behavior |
|---|---|
| **PostgreSQL goes down** | Real-time chat continues. Messages buffer in Kafka. Consumer retries after 60s pause. |
| **One server instance crashes** | Clients reconnect to another instance via load balancer. No message loss. |
| **Kafka goes down** | Real-time delivery still works via Redis. Messages that were published to Redis but not yet produced to Kafka are lost (no Kafka acknowledgment). |
| **Redis goes down** | Real-time broadcasting stops. Only clients on the same server as the sender receive messages. |

### Kafka Consumer Error Recovery

The consumer in `kafka.ts` implements a pause-and-resume strategy:

```typescript
eachMessage: async ({ message, pause }) => {
  try {
    await prismaClient.message.create({ ... })
  } catch (err) {
    pause()                                    // Stop consuming new messages
    setTimeout(() => {
      consumer.resume([{ topic: KAFKA_TOPIC }]) // Resume after 60 seconds
    }, 60 * 1000)
  }
}
```

This prevents the consumer from racing ahead when the database is temporarily unavailable, while automatically recovering without data loss.

---

## System Design Diagram

A detailed **High Level Design (HLD)** diagram is included as an Excalidraw file:

```
scalable-chat-app-hld.excalidraw
```

Open it at [excalidraw.com](https://excalidraw.com) or in VS Code with the Excalidraw extension. It shows all 8 components, 4 architectural tiers, data flow arrows with function call labels, and a tech stack reference.

---

## API Reference

### WebSocket Events

| Event | Direction | Payload | Description |
|---|---|---|---|
| `event:message` | Client → Server | `{ message: string }` | Sent when a user sends a chat message |
| `message` | Server → Client | `string` (JSON) | Broadcast to all clients when a new message arrives |

### Event Lifecycle

```
Client emits "event:message"  →  Server publishes to Redis
                                    │
                                    ├── Redis subscriber → io.emit("message") → All clients
                                    │
                                    └── produceMessage() → Kafka → Consumer → PostgreSQL
```

---

## Known Limitations

- **No authentication** — There is no user identity system, so messages are anonymous
- **No chat rooms** — All messages are broadcast globally to every connected client
- **No message history** — The frontend only displays messages received during the current session; historical messages in PostgreSQL are never loaded back
- **No read receipts or delivery status** — No acknowledgment beyond Kafka/Redis delivery
- **Redis channel naming** — The Redis channel name reuses the `KAFKA_TOPIC` env variable, which is semantically confusing (they are separate concerns sharing the same name)
- **The `[id]` dynamic route** exists but does not use the `id` parameter for room-based chat

---

## License

Private project. All rights reserved.
