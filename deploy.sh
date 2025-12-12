#!/bin/bash

# Stop on error
set -e

echo "🚀 Starting deployment..."

# 1. Pull latest changes
echo "📥 Pulling latest code..."
git pull

# 2. Build Docker Image
echo "🏗️ Building Docker image..."
docker build -t my-app-menu .

# 3. Stop and remove existing container (if running)
echo "🛑 Stopping existing container..."
docker stop my-app-menu || true
docker rm my-app-menu || true

# 4. Run new container
# Note: We use --restart unless-stopped so it auto-starts on reboot
echo "▶️ Starting new container..."
docker run -d \
  --name my-app-menu \
  --restart unless-stopped \
  -v $(pwd)/data:/app/data \
  -p 80:80 \
  my-app-menu

echo "✅ Deployment complete! App is running on port 80."
