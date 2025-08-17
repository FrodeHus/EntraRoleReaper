# Build the React app
FROM node:20-alpine AS build
WORKDIR /app

# Install dependencies
COPY web/package.json web/package-lock.json* ./
RUN apk update && apk upgrade && npm ci || npm install

ARG AZUREAD_TENANT_ID
ARG AZUREAD_CLIENT_ID
ARG VITE_API_SCOPE
ARG VITE_API_URL

# Copy source
COPY web/ ./

# Build
ENV AZUREAD_TENANT_ID=$AZUREAD_TENANT_ID \
	AZUREAD_CLIENT_ID=$AZUREAD_CLIENT_ID \
	VITE_API_SCOPE=$VITE_API_SCOPE \
	VITE_API_URL=$VITE_API_URL
RUN npm run build

# Runtime: nginx, serve static SPA and proxy /api to backend
FROM nginx:alpine AS final

# Create non-root user and group
RUN apk update && apk upgrade && addgroup -S rolereaper-web && adduser -S rolereaper -G rolereaper-web

# Create temp dirs for non-root runtime
RUN mkdir -p /tmp/client_temp /tmp/proxy_temp /tmp/fastcgi_temp /tmp/uwsgi_temp /tmp/scgi_temp

# Copy built assets
COPY --from=build /app/dist /usr/share/nginx/html

# Nginx config (full file) for non-root
COPY web/nginx.conf /etc/nginx/nginx.conf

# Reduce privileges
USER rolereaper
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
