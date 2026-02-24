# Build stage
FROM node:22-slim AS builder

WORKDIR /app

# Copy package files and install all dependencies
COPY package*.json ./
RUN npm install

# Copy source and config
COPY tsconfig.json ./
COPY src/ ./src/

# Build the project
RUN npm run build

# Production stage
FROM node:22-slim

WORKDIR /app

# Copy only production dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Prepare persistent state directory
RUN mkdir -p /app/state

# Default environment variables
ENV NODE_ENV=production
ENV SUBSCRIBERS_FILE=/app/state/subscribers.json

# Run the bot
CMD ["node", "dist/index.js"]
