# Use Node as base image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package.json files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy all frontend code
COPY . ./

# Fix case sensitivity issue
RUN if [ -f "src/styles/loadingpage.css" ] && [ ! -f "src/styles/loadingPage.css" ]; then \
    cp src/styles/loadingpage.css src/styles/loadingPage.css; \
    fi

# Expose the port that Cloud Run expects
EXPOSE 8080

# Use environment variable for port
ENV PORT=8080
ENV HOST=0.0.0.0

# Run in development mode with port configured from environment variable
CMD ["sh", "-c", "npm run dev -- --port ${PORT:-8080} --host ${HOST:-0.0.0.0}"]