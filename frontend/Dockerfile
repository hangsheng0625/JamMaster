# Use Node as base image - compatible with React 19
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy frontend code
COPY . .

# Build the app
RUN npm run build

# Expose the port
EXPOSE 5173

# Command to run the frontend for production
# If you're using Vite's preview command for production
CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0"]

# Alternatively, if you want to use development mode in the container:
# CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]