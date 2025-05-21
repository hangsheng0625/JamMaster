# Build stage
FROM node:20-alpine as build

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

# Configure nginx for Cloud Run
RUN sed -i.bak 's/listen\(.*\)80;/listen $PORT;/' /etc/nginx/conf.d/default.conf && \
    sed -i.bak 's/^user *nginx;/user nobody;/' /etc/nginx/nginx.conf

# Set environment variable with a default value
ENV PORT=8080

# Start nginx
CMD ["nginx", "-g", "daemon off;"]