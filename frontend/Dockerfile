# Build stage
FROM node:20-alpine AS build

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

# Build for production
RUN npm run build

# Production stage with nginx
FROM nginx:alpine

# Copy built assets to nginx
COPY --from=build /app/dist /usr/share/nginx/html

# Copy custom nginx config and entrypoint script
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf
COPY nginx/docker-entrypoint.sh /docker-entrypoint.sh

# Make entrypoint script executable
RUN chmod +x /docker-entrypoint.sh

# Set environment variable with a default value
ENV PORT=8080

# Run the entrypoint script
ENTRYPOINT ["/docker-entrypoint.sh"]