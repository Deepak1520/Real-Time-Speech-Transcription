# 🎤 Real-Time Speech-to-Text Transcription

This is a simple web app that converts your speech to text in real-time. Speak into your microphone and transcription appears on screen.

## Features

✅ **Real-time transcription** - Live speech-to-text conversion  
✅ **Detachable window** - Separate transcription window for meetings  
✅ **Two AI models** - Choose between Whisper and Whisper.cpp  
✅ **Save options** - Export as TXT, PDF, or copy to clipboard  
✅ **Privacy-focused** - No data storage, everything runs locally  
✅ **Low latency** - Optimized for real-time performance

## 🪟 Detachable Transcription Window

Perfect for **online meetings, lectures, and presentations**! The detachable feature allows you to:

- **Detach** the transcription display to a separate window
- **Position** the window over Zoom, Teams, or any video call
- **Continue recording** from the main window while viewing live transcription
- **Seamless experience** - recording state persists when attaching/detaching

### How to Use Detachable Mode

1. Start the application and allow microphone permissions
2. Click **"Detach to Separate Window"** button
3. A new window opens showing live transcription
4. Position this window over your meeting software
5. Start recording from the main browser window
6. **Live transcription appears in the detached window**
7. Click **"Attach to Main Window"** to return to normal mode

**Perfect for:**
- 📹 Zoom/Teams meeting transcription
- 🎓 Lecture note-taking
- 🎤 Conference call documentation
- 💼 Interview transcription

## Models

### Whisper
OpenAI's Whisper is a robust automatic speech recognition (ASR) model trained on diverse audio data. It provides high accuracy across multiple languages and handles various audio conditions well, making it ideal for general-purpose transcription tasks.

### Whisper.cpp
A high-performance C++ implementation of OpenAI's Whisper model. This version offers significantly faster inference speeds and lower memory usage compared to the original Python implementation, making it perfect for real-time applications where speed is crucial.

## Quick Start

### Prerequisites

Before running this application, make sure you have the following installed:

- **Node.js** (version 16 or higher)
- **npm** (comes with Node.js)
- **Python** (version 3.8 or higher)
- **pip** (Python package installer)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Deepak1520/Real-Time-Speech-Transcription.git
   cd Real-Time-Speech-Transcription
   ```

2. **Install Node.js dependencies**
   ```bash
   npm install
   ```

3. **Install Python dependencies**
   ```bash
   pip install -r requirements.txt
   ```

### Running the Application

Choose one of the two available models:

#### Option 1: Using Whisper (Standard Model)
```bash
./start.sh
```

#### Option 2: Using Whisper.cpp (Faster Model)
```bash
./start_whispercpp.sh
```

**Make the scripts executable if needed:**
```bash
chmod +x start.sh start_whispercpp.sh
```

### Accessing the Application

Once the application is running:

1. The frontend will be available at: `http://localhost:3000`
2. The backend server will start automatically alongside the frontend
3. Open your web browser and navigate to the frontend URL
4. Allow microphone permissions when prompted
5. Start speaking to see real-time transcription

## 💾 Save Options

The application provides multiple ways to save your transcriptions:

- **📄 Save as TXT** - Plain text file download
- **🖨️ Save as PDF** - Formatted PDF via browser print dialog
- **📋 Copy to Clipboard** - Quick copy for pasting elsewhere
- **🧹 Clear** - Reset transcription to start fresh

**Privacy Note:** All save functions work locally in your browser. No data is sent to any server or database.

### Troubleshooting

- **Permission denied**: Make sure the bash scripts are executable (`chmod +x start.sh start_whispercpp.sh`)
- **Port conflicts**: Ensure ports 3000 (frontend) and the backend port are available
- **Microphone access**: Grant microphone permissions in your browser
- **Dependencies**: Make sure all Python and Node.js dependencies are properly installed
- **Detached window issues**: If the detached window doesn't show transcription, try attaching and detaching again

## Architecture

- **Frontend**: Next.js + React with WebSocket integration and detachable components
- **Backend**: Python server handling audio processing and transcription
- **Communication**: WebSocket for real-time data exchange
- **AI Models**: Whisper/Whisper.cpp for speech recognition
- **UI Components**: React portals for detachable window functionality
