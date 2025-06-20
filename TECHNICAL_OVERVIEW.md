# Real-Time Speech Transcription - Technical Overview

## Project Architecture

This is a **full-stack real-time speech transcription application** that uses WebSocket communication between a Next.js frontend and a Python FastAPI backend to provide live speech-to-text conversion.

### High-Level Flow
```
User speaks → Browser captures audio → WebSocket → Python backend → AI model processes → Transcription sent back → Displayed in browser
```

---

## Directory Structure

```
transcription_live_two_models/
├── app/                    # Next.js 13+ App Router frontend
├── components/             # React components
├── server/                # Python FastAPI backend
├── public/                # Static assets
├── styles/                # CSS styles
├── start.sh               # Launch script for Whisper
├── start_whispercpp.sh    # Launch script for Whisper.cpp
├── package.json           # Node.js dependencies
└── README.md             # User documentation
```

---

## Frontend Architecture (Next.js + React)

### `app/` Directory (Next.js 13+ App Router)

#### `app/layout.js`
- **Purpose**: Root layout component for the entire application
- **Key Features**:
  - Sets up HTML structure
  - Includes global CSS imports
  - Defines metadata (title, description)
  - Wraps all pages with common layout elements

#### `app/page.js`
- **Purpose**: Main application page (homepage)
- **Key Features**:
  - Renders the main transcription interface
  - Imports and uses the AudioRecorder component
  - Handles the overall page layout and styling

#### `app/globals.css`
- **Purpose**: Global CSS styles for the entire application
- **Key Features**:
  - Tailwind CSS imports and configurations
  - Global styling rules
  - Component-specific styles

### `components/` Directory

#### `components/AudioRecorder.js`
- **Purpose**: The core component that handles all audio recording and transcription
- **Key Responsibilities**:
  - **Audio Capture**: Uses `navigator.mediaDevices.getUserMedia()` to access microphone
  - **WebSocket Connection**: Establishes real-time connection to backend via `ws://localhost:61999/ws`
  - **Audio Processing**: 
    - Captures audio in chunks (16kHz sample rate)
    - Converts audio to Float32Array format
    - Sends audio data to backend every 250-500ms
  - **UI Management**:
    - Start/Stop recording buttons
    - Real-time transcription display
    - Connection status indicators
    - Error handling and user feedback
  - **State Management**: Manages recording state, transcription history, WebSocket connection status

#### `components/PerformanceMonitor.js`
- **Purpose**: Monitors and displays system performance metrics
- **Key Features**:
  - **Latency Tracking**: Measures time between audio capture and transcription result
  - **Throughput Monitoring**: Tracks chunks processed per second
  - **Connection Health**: Monitors WebSocket connection stability
  - **Resource Usage**: Displays processing time and buffer statistics
  - **Real-time Dashboard**: Shows live performance metrics during transcription

#### `components/DetachableWrapper.js`
- **Purpose**: React component for detaching the transcription display
- **Key Features**:
  - Allows users to detach the live transcription display into a separate browser window
  - Users can click a button to open a dedicated, resizable popup window showing the current transcription in real time
  - The detached window is styled for readability and includes a clear indicator that it is in "Detached Mode"
  - The main window continues to control recording; the detached window is for viewing only
  - This feature is useful for meetings, presentations, or multitasking, letting users keep the transcription visible while working in other tabs or apps

---

## Backend Architecture (Python FastAPI)

### `server/` Directory

#### `server/main.py` (Faster-Whisper Implementation)
- **Purpose**: FastAPI server using the `faster-whisper` library
- **Key Components**:

**Model Setup (Flexible Model Selection)**:
```python
from faster_whisper import WhisperModel
model = WhisperModel("small.en", device="cpu", compute_type="int8")
```
- Uses `small.en` model for English transcription
- Optimized for CPU with int8 quantization
- Multi-threaded processing (8 CPU threads, 4 workers)
- The backend supports selecting different Whisper model sizes (`small`, `medium`, `large-v1`, `large-v2`, `large-v3`) depending on your hardware capacity and accuracy needs.
- For local or low-resource environments, use `small` for fast, lightweight transcription.
- For cloud or high-resource environments (with GPU/large RAM), you can uncomment and use larger models for better accuracy and translation quality.
- Model selection and compute settings (CPU/GPU, quantization, threads) can be configured in `server/main.py` and `server/main_whispercpp.py`.
- Trade-off: Larger models provide higher accuracy and better translation, but require more memory, compute power, and longer load times.

**Audio Processing Pipeline**:
- **Chunk Size**: 300ms chunks (4,800 samples at 16kHz)
- **Processing Window**: 1.2 seconds (19,200 samples)
- **Overlap**: 150ms overlap between chunks to prevent word cutting
- **Buffer Management**: Accumulates audio until processing threshold reached

**WebSocket Handler** (`/ws`):
- Accepts real-time audio data as bytes
- Converts bytes to numpy Float32 arrays
- Implements voice activity detection (VAD)
- Processes audio when sufficient data accumulated
- Sends JSON responses with transcription results

**Advanced Features**:
- **Dynamic Thresholding**: Adapts to ambient noise levels
- **Speech Detection**: RMS energy calculation with adaptive thresholds
- **Text Filtering**: Removes common false positives and repetitions
- **Context Management**: Resets context after silence periods

#### `server/main_whispercpp.py` (Whisper.cpp Implementation)
- **Purpose**: FastAPI server using the `pywhispercpp` library (direct C++ bindings)
- **Key Differences from main.py**:

**Model Setup (Flexible Model Selection)**:
```python
from pywhispercpp.model import Model
model = Model('small', print_realtime=False)
# For higher accuracy or translation, you can use 'medium', 'large-v1', 'large-v2', or 'large-v3' depending on your hardware.
```
- The backend supports selecting different Whisper.cpp model sizes (`small`, `medium`, `large-v1`, `large-v2`, `large-v3`) based on your available CPU/RAM.
- Use `small` for fast, lightweight transcription on local or low-resource machines.
- Use larger models for better accuracy and translation support on more powerful hardware.
- Model selection is controlled in `server/main_whispercpp.py`.
- Trade-off: Larger models require more memory and CPU, but provide better results, especially for translation and multilingual tasks.

**Enhanced Processing**:
- **Larger Chunks**: 500ms chunks (8,000 samples)
- **Longer Processing Window**: 2 seconds (32,000 samples)
- **Enhanced VAD**: More sophisticated voice activity detection
- **Spectral Analysis**: Includes zero-crossing rate and spectral centroid analysis

**Advanced Speech Detection**:
```python
def enhanced_vad(audio_chunk):
    # RMS energy calculation
    # Zero crossing rate analysis  
    # Spectral centroid analysis
    # Multi-factor speech detection
```

**Performance Optimizations**:
- Adaptive energy thresholding based on recent audio history
- Enhanced filtering to reduce false positives
- Better context management and memory usage

---

## Launch Scripts

### `start.sh`
```bash
#!/bin/bash
# Start the Python backend server
python server/main.py &
# Start the Next.js frontend
npm run dev 
```
- **Purpose**: Launches the faster-whisper version
- **Process**: Starts backend in background, then starts frontend
- **Backend Port**: 61999 (FastAPI custom port)
- **Frontend Port**: 3000 (Next.js default)

### `start_whispercpp.sh`
```bash
#!/bin/bash
# Start the Python backend server with Whisper.cpp
python server/main_whispercpp.py &
# Start the Next.js frontend
npm run dev 
```
- **Purpose**: Launches the whisper.cpp version
- **Same process**: Background backend + foreground frontend
- **Backend Port**: 61999 (FastAPI custom port)
- **Frontend Port**: 3000 (Next.js default)

---

## Real-Time Communication Flow

### 1. Connection Establishment
```
Browser → WebSocket connection → ws://localhost:61999/ws → FastAPI WebSocket handler
```

### 2. Audio Capture & Transmission
```
Microphone → MediaRecorder API → Audio chunks → WebSocket.send(bytes) → Python backend
```

### 3. Audio Processing
```
Bytes → numpy.frombuffer() → Float32Array → Audio buffer → VAD check → Whisper model → Text
```

### 4. Response Transmission
```
Text result → JSON format → WebSocket.send() → Frontend → Display update
```

---

## Key Technical Specifications

### Audio Configuration
- **Sample Rate**: 16,000 Hz (standard for speech recognition)
- **Format**: 32-bit Float (Float32Array)


### Processing Parameters
- **Faster-Whisper**: 300ms chunks, 1.2s processing window
- **Whisper.cpp**: 500ms chunks, 2s processing window
- **Overlap**: Prevents word boundary cutting
- **VAD Threshold**: Dynamic based on ambient noise

### Model Specifications
- **Model Size**: `small ` (39MB, ~39M parameters)
- **Language**: English, German
- **Quantization**: int8 for faster inference
- **Memory Usage**: ~200MB RAM per instance

---

## Performance Characteristics

### Faster-Whisper Implementation
- **Latency**: ~300-500ms from speech to text
- **CPU Usage**: Moderate (optimized C++ backend)
- **Memory**: ~200MB base + processing buffers
- **Throughput**: Processes 300ms chunks every 1.2s

### Whisper.cpp Implementation  
- **Latency**: ~400-600ms (more processing but better accuracy)
- **CPU Usage**: Lower (more optimized C++ implementation)
- **Memory**: ~180MB base + processing buffers
- **Throughput**: Processes 500ms chunks every 2s

---

## Dependencies & Libraries

### Frontend Dependencies
- **Next.js 15.3.2**: React framework with App Router
- **React 19.0.0**: UI library
- **react-use-websocket**: WebSocket hook for React
- **socket.io-client**: Real-time communication
- **Tailwind CSS**: Utility-first CSS framework

### Backend Dependencies
- **FastAPI**: Modern Python web framework
- **faster-whisper**: Optimized Whisper implementation
- **pywhispercpp**: Direct whisper.cpp bindings
- **numpy**: Numerical computing
- **websockets**: WebSocket support

---

## Error Handling & Reliability

### Frontend Error Handling
- **Microphone Access**: Graceful fallback if permission denied
- **WebSocket Disconnection**: Automatic reconnection attempts
- **Audio Processing**: Error recovery for corrupted audio chunks
- **UI Feedback**: Clear error messages and status indicators

### Backend Error Handling
- **Connection Management**: Per-connection state isolation
- **Audio Processing**: Graceful handling of malformed data
- **Model Errors**: Fallback processing for transcription failures
- **Memory Management**: Buffer cleanup and connection cleanup
---

### Translation Mode
- Users can switch to Translation Mode from the frontend.
- In Translation Mode, the backend will attempt to translate any spoken language to English using the Whisper model's translation capabilities.
- Translation is triggered by sending `mode: "translation"` from the frontend to the backend via WebSocket.
- The backend uses the `task="translate"` parameter for the model when in this mode.

### Language Selection for Transcription
- In Transcription Mode, users can select the language they are speaking.
- The selected language is sent to the backend as `transcriptionLanguage`.
- The backend uses this language for more accurate transcription.


### Detachable Transcription Window (DetachableWrapper)
- The `DetachableWrapper` React component allows users to detach the live transcription display into a separate browser window.
- Users can click a button to open a dedicated, resizable popup window showing the current transcription in real time.
- The detached window is styled for readability and includes a clear indicator that it is in "Detached Mode".
- The main window continues to control recording; the detached window is for viewing only.
- This feature is useful for meetings, presentations, or multitasking, letting users keep the transcription visible while working in other tabs or apps. 