FROM node:20-alpine AS alpine

FROM alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app
RUN npm install -g turbo
COPY . .
RUN turbo prune @medu/web --docker

FROM alpine AS installer
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY .gitignore .gitignore
COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/package-lock.json ./package-lock.json
RUN npm ci

COPY --from=builder /app/out/full/ .
COPY turbo.json turbo.json

# Inject safe build-time env vars if necessary
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}

RUN npx turbo build --filter=@medu/web...

FROM nginx:alpine AS runner
RUN apk add --no-cache libcap && \
    setcap 'cap_net_bind_service=+ep' /usr/sbin/nginx

# Copy custom nginx config
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

WORKDIR /usr/share/nginx/html
# Remove default nginx static assets
RUN rm -rf ./*
# Copy static build from installer
COPY --from=installer /app/apps/web/dist .

# Configure Nginx directories and pid for non-root execution (M-EDU-OPS-004)
RUN sed -i 's|/var/run/nginx.pid|/tmp/nginx.pid|g' /etc/nginx/nginx.conf 2>/dev/null || true && \
    mkdir -p /var/cache/nginx /var/log/nginx /var/run && \
    touch /tmp/nginx.pid && \
    chown -R nginx:nginx /usr/share/nginx/html /var/cache/nginx /var/log/nginx /var/run /tmp/nginx.pid /etc/nginx/conf.d

USER nginx

EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

ENTRYPOINT ["nginx", "-g", "daemon off;"]
