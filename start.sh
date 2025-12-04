#!/bin/bash

cleanup() {
  echo "Shutting down..."
  kill $BACKEND_PID 2>/dev/null
  kill $FRONTEND_PID 2>/dev/null
}
trap cleanup EXIT INT TERM

# Check if we're in production mode (REPLIT_DEPLOYMENT=1)
if [ "$REPLIT_DEPLOYMENT" = "1" ]; then
  echo "=== Production Mode ==="
  
  # Build frontend
  cd frontend
  echo "Building frontend..."
  npm run build
  
  # Run FastAPI on port 5000 (serves both API and static files)
  cd ../backend
  echo "Starting FastAPI server on port 5000..."
  exec uvicorn app.main:app --host 0.0.0.0 --port 5000
  
else
  echo "=== Development Mode ==="
  
  # Start backend in background
  cd backend
  uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
  BACKEND_PID=$!
  
  # Wait for backend to be ready
  echo "Waiting for backend to start..."
  for i in {1..30}; do
    if curl -s http://127.0.0.1:8000/health > /dev/null 2>&1; then
      echo "Backend is ready!"
      break
    fi
    sleep 0.5
  done
  
  # Start frontend (Vite dev server with proxy)
  cd ../frontend
  npm run dev &
  FRONTEND_PID=$!
  
  wait
fi
