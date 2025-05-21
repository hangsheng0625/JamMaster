# Use TensorFlow 1.14 with GPU support as base image
FROM tensorflow/tensorflow:1.14.0-gpu-py3

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    libsndfile1 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Copy everything from the current directory (backend) to /app
COPY . /app

# Install Python dependencies
RUN pip install --no-cache-dir Flask==2.0.3 Flask-API==3.1 Flask-Cors==5.0.0 \
    miditoolkit==1.0.0 numpy==1.19.5 scipy==1.5.4

# Set environment variables
ENV PYTHONPATH=/app

# Expose the port your backend API runs on
EXPOSE 5000

# Command to run the backend
CMD ["python", "app.py"]