# Base image
FROM oven/bun:1

# Working directory
WORKDIR /app

# Install dependencies
# Copy package files first for caching
COPY package.json bun.lock ./
# If you have patches or other install config, copy them here
RUN bun install --frozen-lockfile

# Copy source code
COPY src ./src
COPY tsconfig.json ./
# Copy any other necessary config files (e.g. .env is usually mounted, but we need the structure)

# Environment variables should be passed at runtime, but we can set defaults
ENV NODE_ENV=production
ENV CDP_NETWORK_ID=base-mainnet

# Expose The Voice API port
EXPOSE 3001

# Start the agent
# Note: The CLI uses 'Ink' which renders to stdout. 
# In a non-interactive cloud env, this log output is preserved.
CMD ["bun", "run", "src/index.tsx"]
