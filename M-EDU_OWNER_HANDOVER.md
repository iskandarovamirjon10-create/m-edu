# M-EDU Platform — Owner Handover & Administration Guide

## 1. Architecture Overview

M-EDU is an enterprise-grade education management platform utilizing a monorepo architecture powered by Turborepo.

* **Backend (`apps/api`)**: NestJS, Prisma ORM, PostgreSQL.
* **Frontend (`apps/web`)**: React 18, Vite, Tailwind CSS, TanStack Query.
* **Database**: PostgreSQL (relational data, unstructured JSON, `pg_trgm` extensions).
* **Cache & Realtime**: Redis (WebSocket Pub/Sub, Rate Limiting, distributed locking).
* **AI Engine (`packages/contracts`, `apps/api/src/ai`)**: Gemini API integration with semantic function calling.
* **Camera / Face Recognition (`packages/camera-engine`, `packages/face-engine`)**: Distributed RTSP ingestion with MediaPipe facial processing.

## 2. Deployment Prerequisites & Environment Variables

### Core Dependencies
* Node.js v20.x LTS
* PostgreSQL v15+ (with `pg_trgm` extension installed)
* Redis v7+

### Security & Secrets (.env)
The repository contains a `.env.example`. When deploying to production, ensure the following critical variables are heavily randomized and securely injected via your cloud secrets manager (e.g., AWS Secrets Manager, GitHub Actions Secrets, or Doppler):

```env
NODE_ENV="production"
DATABASE_URL="postgresql://user:pass@host:5432/medu?schema=public"
REDIS_URL="redis://:pass@host:6379"

# Security Secrets (Must be cryptographically strong, >= 32 chars)
JWT_SECRET="YOUR_STRONG_JWT_SECRET"
SESSION_SECRET="YOUR_STRONG_SESSION_SECRET"

# AI Integration
GEMINI_API_KEY="YOUR_GEMINI_API_KEY"
```

> **[WARNING] NEVER commit `.env`, `.env.local`, or `.env.production` files containing real production secrets to the repository.**

## 3. Database Startup & Migrations

The database relies on sequential declarative migrations. 

**Initial Production Setup:**
1. Provision PostgreSQL and ensure it is accessible via `DATABASE_URL`.
2. Connect to the PostgreSQL instance via a client (e.g., `psql`, pgAdmin) and run: `CREATE EXTENSION IF NOT EXISTS pg_trgm;`
3. Deploy the schema:
   ```bash
   npx prisma migrate deploy
   ```
   *Note: Never use `prisma migrate dev` or `prisma migrate reset` against the production database.*

**Automated Backups:**
* Implement automated daily backups using `pg_dump` or a managed cloud database solution (e.g., AWS RDS Automated Backups, Supabase Point-in-Time Recovery).
* Ensure backups are stored in a geographically distinct region.

## 4. Administration & User Roles

The platform enforces strict Tenant Isolation (`organizationId`) at the database row level.
* **PLATFORM_ADMIN**: Can create new Organizations and manage global system health.
* **ORG_ADMIN**: Can configure their specific Organization, invite teachers/students, and manage camera hardware.
* **TEACHER**: Scoped to assigned classes and student attendance.
* **STUDENT / PARENT**: Read-only access to specific educational paths and financials.

To bootstrap the very first `PLATFORM_ADMIN`, use the designated seed script or CLI tooling once the server is live, ensuring you capture the one-time generated credentials.

## 5. Camera & Facial Recognition Administration

### RTSP Configuration
* Cameras are added via the `/cameras` dashboard by providing a valid `rtsp://` URI.
* Ensure the target cameras are network-accessible by the Node.js backend. Use dedicated VPNs or secured IP whitelists if the cameras are remote.

### Hardware Limitations
* Processing multiple 1080p+ H.264 RTSP streams is highly CPU-intensive.
* The system uses a `CameraWorkerManager` which isolates stream decoding to separate OS threads/processes. Monitor CPU usage carefully and implement horizontal scaling or external RTSP decoding servers if frame drops occur.

### Troubleshooting Recognition
* If attendance relies on facial recognition and is falsely rejecting faces, ensure the enrolled face baseline images are well-lit and unobstructed.
* Adjust the distance threshold configurations within the `FaceEngine` settings if false positives/negatives increase.

## 6. Monitoring & Health Checks

Integrate an uptime monitor (e.g., Datadog, UptimeRobot) pointing to the root health routes:
* `/health/liveness`: Returns 200 OK immediately if the HTTP process is responsive.
* `/health/readiness`: Returns 200 OK only if the Database and Redis are actively accepting connections.

## 7. Build & Startup Procedure

To build the entire monorepo for production:
```bash
npm run build
```

To start the backend (typically wrapped in a PM2 or Docker supervisor):
```bash
cd apps/api
npm run start:prod
```

To serve the frontend:
The `apps/web/dist` folder contains static HTML/JS/CSS assets. Serve them using NGINX, Vercel, AWS CloudFront, or any standard static hosting service. Ensure all 404 traffic routes back to `index.html` to support client-side React Router navigation.


## 8. Deployment Security Verification Matrix
As part of the final handover, the following programmatic constraints have been verified against the codebase to ensure your production deployment is secure by default:

* **Production Secret Safety**: **PASS**
* **Frontend Secret Exposure**: **PASS**
* **Docker Secret Exposure**: **PASS**
* **Git Secret Exposure**: **PASS**
* **Production Mock Configuration**: **PASS**
* **Face Engine Production Configuration**: **PASS**
* **AI Production Configuration**: **PASS**

*Note: The platform is engineered to "fail closed". If you fail to provide adequate secrets or configuration, the server will intentionally refuse to start rather than exposing mock behaviors in production.*
