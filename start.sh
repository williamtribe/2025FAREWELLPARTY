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

# Start frontend
cd ../frontend
npm run dev
