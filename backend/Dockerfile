# Use TensorFlow 1.14 with CPU support as base image
FROM tensorflow/tensorflow:1.14.0-py3

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    libsndfile1 \
    libsndfile1-dev \
    ffmpeg \
    curl \
    gnupg \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install Google Cloud SDK
RUN echo "deb [signed-by=/usr/share/keyrings/cloud.google.gpg] https://packages.cloud.google.com/apt cloud-sdk main" | tee -a /etc/apt/sources.list.d/google-cloud-sdk.list \
    && curl https://packages.cloud.google.com/apt/doc/apt-key.gpg | apt-key --keyring /usr/share/keyrings/cloud.google.gpg add - \
    && apt-get update && apt-get install -y google-cloud-cli \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements.txt first (for better Docker layer caching)
COPY Requirements.txt /app/

# Upgrade pip and install Python dependencies from requirements.txt
RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt --verbose

# Copy everything else from the current directory (backend) to /app
COPY . /app

# Create model directory
RUN mkdir -p /app/remi

# Set environment variables
ENV PYTHONPATH=/app
ENV MODEL_BUCKET_NAME=jammaster-models-160279

# Expose the port
EXPOSE 8080

# Command to run the backend
CMD ["python", "app.py"]