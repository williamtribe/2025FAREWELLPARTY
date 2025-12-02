#!/bin/bash

# Cleanup on exit
cleanup() {
  echo "Shutting down..."
  kill $BACKEND_PID 2>/dev/null
}
trap cleanup EXIT INT TERM

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

# Start frontend
cd ../frontend
npm run dev
