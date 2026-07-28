# Build stage
FROM node:23-alpine AS builder

WORKDIR /app

# Copy minimal files needed for install
COPY package*.json ./

# Install all dependencies
RUN npm ci

# Copy source files
COPY tsconfig.json ./
COPY prisma ./prisma
COPY src ./src

# Generate Prisma client
RUN npx prisma generate

# Build
RUN npm run build

# Runtime stage
FROM node:23-alpine

WORKDIR /app

# Install dumb-init
RUN apk add --no-cache dumb-init

# Create app user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

# Copy runtime files
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy built files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Copy prisma schema
COPY prisma ./prisma

# Fix permissions
RUN chown -R nodejs:nodejs /app
USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health/live', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

EXPOSE 3000

ENTRYPOINT ["/usr/sbin/dumb-init", "--"]
CMD ["node", "dist/server.js"]
