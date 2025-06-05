#!/bin/bash

# Start the Python backend server with Whisper.cpp (faster C++ implementation)
python server/main_whispercpp.py &

# Start the Next.js frontend
npm run dev 