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

# Expose the port
EXPOSE 5173

# Run in development mode
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]