# Use TensorFlow 1.14 with GPU support as base image
FROM tensorflow/tensorflow:1.14.0-gpu-py3

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    libsndfile1 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements file
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy REMI model and your backend code
COPY ./remi /app/remi
COPY ./backend /app/backend

# Set environment variables
ENV PYTHONPATH=/app

# Expose the port your backend API runs on
EXPOSE 5000

# Command to run the backend
CMD ["python", "backend/app.py"]