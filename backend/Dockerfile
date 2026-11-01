FROM node:22-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY . .

# Create data directory for SQLite database
RUN mkdir -p /app/data

EXPOSE 5000

CMD ["node", "src/index.js"]
