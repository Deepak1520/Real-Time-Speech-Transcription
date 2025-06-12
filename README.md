# 🎤 Real-Time Speech-to-Text Transcription

This is a simple web app that converts your speech to text in real-time. Speak into your microphone and transcription appears on screen.

## Features

✅ **Real-time transcription** - Live speech-to-text conversion  
✅ **Detachable window** - Separate transcription window for meetings  


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


## Architecture

- **Frontend**: Next.js + React with WebSocket integration and detachable components
- **Backend**: Python server handling audio processing and transcription
- **Communication**: WebSocket for real-time data exchange
- **AI Models**: Whisper/Whisper.cpp for speech recognition
- **UI Components**: React portals for detachable window functionality
