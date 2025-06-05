#!/bin/bash

# Start the Python backend server
python server/main.py &

# Start the Next.js frontend
npm run dev 