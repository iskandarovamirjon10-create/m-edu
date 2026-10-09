FROM node:20-alpine AS alpine
RUN apk add --no-cache libc6-compat ffmpeg openssl

FROM alpine AS builder
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat
WORKDIR /app
RUN npm install -g turbo
COPY . .
RUN turbo prune @medu/api --docker

# Add lockfile and package.json's of isolated subworkspace
FROM alpine AS installer
RUN apk add --no-cache libc6-compat
WORKDIR /app

# First install dependencies (as they change less often)
COPY .gitignore .gitignore
COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/package-lock.json ./package-lock.json
RUN npm ci

# Build the project and its dependencies
COPY --from=builder /app/out/full/ .
COPY turbo.json turbo.json

# Run prisma generate
WORKDIR /app/apps/api
RUN npx prisma generate

WORKDIR /app
RUN npx turbo build --filter=@medu/api...

FROM alpine AS runner
WORKDIR /app

# Don't run production as root
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs
USER nestjs

COPY --from=installer /app/node_modules ./node_modules
COPY --from=installer /app/packages ./packages
COPY --from=installer /app/apps/api/package.json ./apps/api/package.json
COPY --from=installer /app/apps/api/dist ./apps/api/dist
COPY --from=installer /app/apps/api/prisma ./apps/api/prisma
COPY --from=installer /app/apps/api/node_modules ./apps/api/node_modules

WORKDIR /app/apps/api

EXPOSE 3000

ENV PORT=3000
ENV NODE_ENV=production
ENV FACE_DETECTOR_MODEL_PATH=/app/packages/face-engine/models/face_detection_yunet_2023mar.onnx
ENV FACE_EMBEDDER_MODEL_PATH=/app/packages/face-engine/models/face_recognition_sface_2021dec.onnx
ENV FACE_LIVENESS_MODEL_PATH=/app/packages/face-engine/models/minifasnet_v2.onnx

# Health check
HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

CMD ["node", "dist/main"]

