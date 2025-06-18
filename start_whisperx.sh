#!/bin/bash
# Start the Python backend server with WhisperX
python server/main_whisperx.py &
# Start the Next.js frontend
npm run dev 