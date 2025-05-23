# Use TensorFlow 1.14 with CPU support as base image (GPU not supported on Cloud Run)
FROM tensorflow/tensorflow:1.14.0-py3

# Set working directory
WORKDIR /app

# Install Google Cloud SDK and other dependencies
RUN apt-get update && apt-get install -y \
    libsndfile1 \
    ffmpeg \
    curl \
    gnupg \
    && echo "deb [signed-by=/usr/share/keyrings/cloud.google.gpg] https://packages.cloud.google.com/apt cloud-sdk main" | tee -a /etc/apt/sources.list.d/google-cloud-sdk.list \
    && curl https://packages.cloud.google.com/apt/doc/apt-key.gpg | apt-key --keyring /usr/share/keyrings/cloud.google.gpg add - \
    && apt-get update && apt-get install -y google-cloud-cli \
    && rm -rf /var/lib/apt/lists/*

# Copy everything from the current directory (backend) to /app
COPY . /app

# Install Python dependencies
RUN pip install --no-cache-dir Flask==2.0.3 Flask-API==3.1 Flask-Cors==5.0.0 \
    miditoolkit==1.0.0 numpy==1.19.5 scipy==1.5.4

# Create model directory
RUN mkdir -p /app/remi

# Set environment variables
ENV PYTHONPATH=/app
ENV MODEL_BUCKET_NAME=jammaster-models-160279

# Expose the port
EXPOSE 8080

# Command to run the backend
CMD ["python", "app.py"]