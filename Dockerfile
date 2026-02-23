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

# Create an empty subscribers.json if it doesn't exist (to avoid mount issues)
RUN echo "[]" > subscribers.json

# Default environment variables
ENV NODE_ENV=production

# Run the bot
CMD ["node", "dist/index.js"]
