# Build stage
FROM node:23-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy config and source
COPY tsconfig.json ./
COPY prisma ./prisma
COPY src ./src

# Generate Prisma Client
RUN npm exec prisma generate -- --schema prisma/schema.prisma

# Verify prisma exists by listing
RUN ls -la src/generated/prisma/index.ts || exit 1

# Build 
RUN npm run build

# Runtime stage
FROM node:23-alpine

WORKDIR /app

RUN apk add --no-cache dumb-init
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

# Copy runtime files
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy built code
COPY --from=builder /app/dist ./dist

# Copy prisma runtime files
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/src/generated ./src/generated
COPY prisma ./prisma

RUN chown -R nodejs:nodejs /app
USER nodejs

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health/live', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

EXPOSE 3000
ENTRYPOINT ["/usr/sbin/dumb-init", "--"]
CMD ["node", "dist/server.js"]
