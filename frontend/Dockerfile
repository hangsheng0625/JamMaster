# Use Node as base image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package.json files from the current directory
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy all frontend code from the current directory
COPY . ./

# Build the app
RUN npm run build

# Expose the port
EXPOSE 5173

# Command to run the frontend
CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0"]