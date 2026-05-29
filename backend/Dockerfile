FROM node:18-alpine

WORKDIR /app

# Install dependencies first for better caching
COPY package*.json ./
RUN npm install --production

# Copy application source code
COPY . .

# Expose backend API port
EXPOSE 3000

# Execute server
CMD ["node", "server.js"]
