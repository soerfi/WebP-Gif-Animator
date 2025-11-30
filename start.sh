#!/bin/bash
set -e

# Start Uvicorn Backend
echo "Starting Backend..."
cd /app/backend
uvicorn main:app --host 0.0.0.0 --port 8000 &

# Start Nginx
echo "Starting Nginx..."
nginx -g "daemon off;"
