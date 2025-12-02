#!/bin/bash

# Start backend in background
cd backend
uvicorn app.main:app --host localhost --port 8000 --reload &
BACKEND_PID=$!

# Start frontend
cd ../frontend
npm run dev

# Cleanup on exit
trap "kill $BACKEND_PID" EXIT
