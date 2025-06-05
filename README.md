# Real-Time Speech-to-Text Transcription

This is a simple web app that converts your speech to text in real-time. Speak into your microphone and transcription appears on screen.

## AI Models

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
   git clone <repository-url>
   cd transcription_live_two_models
   ```

2. **Install Node.js dependencies**
   ```bash
   npm install
   ```

3. **Install Python dependencies** (you may need to install additional Python packages for the backend)
   ```bash
   pip install -r requirements.txt
   ```
   *Note: If requirements.txt doesn't exist, you'll need to install the necessary Python packages for speech recognition and WebSocket handling.*

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

### Troubleshooting

- **Permission denied**: Make sure the bash scripts are executable (`chmod +x start.sh start_whispercpp.sh`)
- **Port conflicts**: Ensure ports 3000 (frontend) and the backend port are available
- **Microphone access**: Grant microphone permissions in your browser
- **Dependencies**: Make sure all Python and Node.js dependencies are properly installed

## Architecture

- **Frontend**: Next.js + React with WebSocket integration
- **Backend**: Python server handling audio processing and transcription
- **Communication**: WebSocket for real-time data exchange
- **AI Models**: Whisper/Whisper.cpp for speech recognition
