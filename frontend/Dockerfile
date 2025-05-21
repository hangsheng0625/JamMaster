# Use Node as base image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package.json
COPY frontend/package*.json ./

# Install dependencies
RUN npm install

# Copy frontend code
COPY frontend/ ./

# Build the app
RUN npm run build

# Expose the port
EXPOSE 5173

# Command to run the frontend
CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0"]