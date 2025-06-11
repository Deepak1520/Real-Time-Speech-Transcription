from fastapi import FastAPI, WebSocket
from pywhispercpp.model import Model
import asyncio
import json
import numpy as np
from collections import deque
import time

app = FastAPI()

print("Loading Whisper.cpp model...")
# Use small.en model with optimized settings for better accuracy
model = Model('small.en', print_realtime=False, print_progress=False)
print("Enhanced Whisper.cpp model (small.en) loaded and ready!")

# Optimized settings to reduce blank audio and repetitions (M3 Mac optimized)
SAMPLE_RATE = 16000
CHUNK_DURATION_MS = 500  # Maintain current optimization
CHUNK_SIZE_SAMPLES = int(SAMPLE_RATE * CHUNK_DURATION_MS / 1000)  # 8000 samples
PROCESSING_WINDOW_MS = 2000  # Process every 2 seconds (stable)
PROCESSING_WINDOW_SAMPLES = int(SAMPLE_RATE * PROCESSING_WINDOW_MS / 1000)  # 32000 samples
MIN_PROCESSING_MS = 1500  # Increased minimum for better quality
MIN_PROCESSING_SAMPLES = int(SAMPLE_RATE * MIN_PROCESSING_MS / 1000)  # 24000 samples
OVERLAP_DURATION_MS = 200  # Reduced overlap to minimize repetition
OVERLAP_SIZE = int(SAMPLE_RATE * OVERLAP_DURATION_MS / 1000)
BASE_ENERGY_THRESHOLD = 0.008  # Base threshold for dynamic calculation
SILENCE_CHUNKS_LIMIT = 6  # Reset context after 6 silent 500ms chunks (3 seconds)
VAD_WINDOW_SAMPLES = int(SAMPLE_RATE * 0.1)  # 100ms VAD window

# Enhanced connection state with better speech detection
class ConnectionState:
    def __init__(self):
        self.audio_buffer = np.array([], dtype=np.float32)
        self.previous_text = ""
        self.silent_chunks_count = 0
        self.last_speech_time = time.time()
        self.chunks_received = 0
        self.last_processing_time = time.time()
        self.energy_history = deque(maxlen=10)  # Track energy levels
        self.recent_transcriptions = deque(maxlen=5)  # Track recent outputs

connections = {}

def enhanced_vad(audio_chunk: np.ndarray, energy_threshold: float) -> bool:
    """Enhanced Voice Activity Detection to reduce false positives"""
    # Calculate RMS energy
    rms_energy = np.sqrt(np.mean(audio_chunk**2))
    
    # Calculate zero crossing rate (helps distinguish speech from noise)
    zero_crossings = np.sum(np.diff(np.signbit(audio_chunk)))
    zcr = zero_crossings / len(audio_chunk)
    
    # Calculate spectral centroid (simplified)
    fft = np.fft.fft(audio_chunk)
    magnitude = np.abs(fft[:len(fft)//2])
    freqs = np.fft.fftfreq(len(audio_chunk), 1/SAMPLE_RATE)[:len(fft)//2]
    spectral_centroid = np.sum(freqs * magnitude) / np.sum(magnitude) if np.sum(magnitude) > 0 else 0
    
    # Speech typically has:
    # - Moderate energy (not too low, not too high)
    # - Moderate zero crossing rate (0.01-0.1)
    # - Spectral centroid in speech range (200-4000 Hz)
    
    has_energy = rms_energy > energy_threshold
    has_speech_zcr = 0.01 < zcr < 0.15
    has_speech_spectrum = 200 < spectral_centroid < 4000
    
    return has_energy and has_speech_zcr and has_speech_spectrum

def calculate_dynamic_threshold_cpp(audio_chunk: np.ndarray) -> float:
    """Calculate dynamic energy threshold for Whisper.cpp"""
    if len(audio_chunk) == 0:
        return BASE_ENERGY_THRESHOLD
    
    # Use 80th percentile for adaptive threshold
    abs_audio = np.abs(audio_chunk)
    percentile_80 = np.percentile(abs_audio, 80)
    dynamic_threshold = percentile_80 * 1.5
    
    # Ensure threshold is within reasonable bounds for whisper.cpp
    return max(BASE_ENERGY_THRESHOLD, min(dynamic_threshold, 0.03))

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    connection_id = id(websocket)
    connections[connection_id] = ConnectionState()
    print("INFO:     connection open")
    
    try:
        while True:
            audio_data = await websocket.receive_bytes()
            
            try:
                # Convert to numpy array
                audio = np.frombuffer(audio_data, dtype=np.float32)
                state = connections[connection_id]
                state.chunks_received += 1
                
                # Track energy for adaptive thresholding
                chunk_energy = np.sqrt(np.mean(audio**2))
                state.energy_history.append(chunk_energy)
                
                # Accumulate audio data
                state.audio_buffer = np.concatenate((state.audio_buffer, audio))
                
                # Process less frequently but with better quality
                should_process = (
                    len(state.audio_buffer) >= PROCESSING_WINDOW_SAMPLES or
                    (state.chunks_received % 4 == 0 and len(state.audio_buffer) >= MIN_PROCESSING_SAMPLES)
                )
                
                if should_process:
                    # Determine processing size
                    if len(state.audio_buffer) < MIN_PROCESSING_SAMPLES:
                        continue  # Skip if we don't have enough audio
                    
                    processing_size = min(len(state.audio_buffer), PROCESSING_WINDOW_SAMPLES)
                    audio_chunk = state.audio_buffer[:processing_size]
                    
                    # Enhanced speech activity detection
                    has_speech = enhanced_vad(audio_chunk, calculate_dynamic_threshold_cpp(audio_chunk))
                    
                    # Adaptive threshold based on recent energy levels
                    if len(state.energy_history) > 5:
                        avg_energy = np.mean(list(state.energy_history))
                        adaptive_threshold = max(calculate_dynamic_threshold_cpp(audio_chunk), avg_energy * 0.3)
                        audio_energy = np.sqrt(np.mean(audio_chunk**2))
                        has_sufficient_energy = audio_energy > adaptive_threshold
                    else:
                        has_sufficient_energy = True
                    
                    if has_speech and has_sufficient_energy:
                        state.silent_chunks_count = 0
                        state.last_speech_time = time.time()
                        
                        try:
                            # Use whisper.cpp for transcription
                            segments = model.transcribe(audio_chunk)
                            
                            # Process segments with enhanced filtering
                            for segment in segments:
                                text = segment.text.strip()
                                
                                # Skip common whisper.cpp artifacts
                                if is_valid_transcription_enhanced(text, state):
                                    # Create mock info object for consistency with faster-whisper
                                    mock_info = type('obj', (object,), {'language_probability': 0.95})()  # High confidence for whisper.cpp
                                    
                                    await websocket.send_json({
                                        "text": text,
                                        "start": segment.t0 / 100.0,
                                        "end": segment.t1 / 100.0,
                                        "language": "en",
                                        "language_probability": 0.95,
                                        "chunk_size_ms": len(audio_chunk) * 1000 // SAMPLE_RATE,
                                        "engine": "whisper.cpp",
                                        "confidence": 0.95,
                                        "energy": float(np.sqrt(np.mean(audio_chunk**2))),
                                        "is_final": True
                                    })
                                    state.previous_text = text
                                    state.recent_transcriptions.append(text.lower())
                                    print(f"Enhanced transcription: '{text}' (audio: {len(audio_chunk) * 1000 // SAMPLE_RATE}ms, confidence: 0.95)")
                        
                        except Exception as transcribe_error:
                            print(f"Transcription error: {transcribe_error}")
                    
                    else:
                        state.silent_chunks_count += 1
                        # Reset context after prolonged silence
                        if state.silent_chunks_count >= SILENCE_CHUNKS_LIMIT:
                            state.previous_text = ""
                            state.recent_transcriptions.clear()
                            print("Context reset due to prolonged silence")
                    
                    # Update buffer with minimal overlap
                    if len(state.audio_buffer) > processing_size:
                        # Use smaller overlap to reduce repetitions
                        keep_size = min(OVERLAP_SIZE, len(state.audio_buffer) - processing_size)
                        state.audio_buffer = state.audio_buffer[processing_size - keep_size:]
                    else:
                        state.audio_buffer = np.array([], dtype=np.float32)
                    
                    state.last_processing_time = time.time()
                        
            except Exception as e:
                print(f"Error processing audio chunk: {e}")
                continue
                
    except Exception as e:
        print(f"WebSocket error: {e}")
    finally:
        if connection_id in connections:
            del connections[connection_id]
        try:
            await websocket.close()
        except:
            pass

def is_valid_transcription(text: str, state: ConnectionState) -> bool:
    """Enhanced validation to filter out whisper.cpp artifacts and repetitions"""
    if not text or len(text.strip()) < 2:
        return False
    
    text_lower = text.lower().strip()
    
    # Filter out whisper.cpp specific artifacts
    whisper_artifacts = {
        "[blank_audio]", "(blank_audio)", "[music]", "(music)", 
        "[noise]", "(noise)", "[sound]", "(sound)",
        "thank you", "thank you very much", "thanks", 
        "(keyboard clicking)", "[keyboard clicking]",
        "(mouse clicking)", "[mouse clicking]",
        "(background noise)", "[background noise]",
        "you", "yeah", "yes", "no", "oh", "um", "uh", "ah", 
        "hmm", "okay", "ok", "well", "so", "the", "a", "and", 
        "but", "or", "is", "was", "are", "were", "i", "it", 
        "that", "this", "with", "for", "on", "at", "by", "from"
    }
    
    if text_lower in whisper_artifacts:
        return False
    
    # Filter out very short single words
    if len(text.split()) == 1 and len(text) < 4:
        return False
    
    # Check for exact repetition in recent transcriptions
    if text_lower in state.recent_transcriptions:
        return False
    
    # Check for substring repetition
    for recent in state.recent_transcriptions:
        if text_lower in recent or recent in text_lower:
            return False
    
    # Filter out repetitive patterns like "hello hello hello"
    words = text_lower.split()
    if len(words) > 1:
        # Check if same word repeated
        if len(set(words)) == 1:
            return False
        
        # Check for alternating repetitions
        if len(words) >= 3:
            pattern_detected = True
            for i in range(2, len(words)):
                if words[i] != words[i-2]:
                    pattern_detected = False
                    break
            if pattern_detected:
                return False
    
    # Check similarity with previous text
    if state.previous_text:
        # Calculate word overlap percentage
        prev_words = set(state.previous_text.lower().split())
        curr_words = set(text_lower.split())
        if len(curr_words) > 0:
            overlap = len(prev_words & curr_words) / len(curr_words)
            if overlap > 0.7:  # More than 70% overlap
                return False
    
    return True

def is_valid_transcription_enhanced(text: str, state: ConnectionState) -> bool:
    """Enhanced validation to filter out whisper.cpp artifacts and repetitions"""
    if not text or len(text.strip()) < 2:
        return False
    
    text_lower = text.lower().strip()
    
    # Filter out whisper.cpp specific artifacts
    whisper_artifacts = {
        "[blank_audio]", "(blank_audio)", "[music]", "(music)", 
        "[noise]", "(noise)", "[sound]", "(sound)",
        "thank you", "thank you very much", "thanks", 
        "(keyboard clicking)", "[keyboard clicking]",
        "(mouse clicking)", "[mouse clicking]",
        "(background noise)", "[background noise]",
        "you", "yeah", "yes", "no", "oh", "um", "uh", "ah", 
        "hmm", "okay", "ok", "well", "so", "the", "a", "and", 
        "but", "or", "is", "was", "are", "were", "i", "it", 
        "that", "this", "with", "for", "on", "at", "by", "from"
    }
    
    if text_lower in whisper_artifacts:
        return False
    
    # Filter out very short single words
    if len(text.split()) == 1 and len(text) < 4:
        return False
    
    # Check for exact repetition in recent transcriptions
    if text_lower in state.recent_transcriptions:
        return False
    
    # Check for substring repetition
    for recent in state.recent_transcriptions:
        if text_lower in recent or recent in text_lower:
            return False
    
    # Filter out repetitive patterns like "hello hello hello"
    words = text_lower.split()
    if len(words) > 1:
        # Check if same word repeated
        if len(set(words)) == 1:
            return False
        
        # Check for alternating repetitions
        if len(words) >= 3:
            pattern_detected = True
            for i in range(2, len(words)):
                if words[i] != words[i-2]:
                    pattern_detected = False
                    break
            if pattern_detected:
                return False
    
    # Check similarity with previous text
    if state.previous_text:
        # Calculate word overlap percentage
        prev_words = set(state.previous_text.lower().split())
        curr_words = set(text_lower.split())
        if len(curr_words) > 0:
            overlap = len(prev_words & curr_words) / len(curr_words)
            if overlap > 0.7:  # More than 70% overlap
                return False
    
    return True

# Configuration endpoint
@app.get("/config")
async def get_config():
    return {
        "chunk_duration_ms": CHUNK_DURATION_MS,
        "processing_window_ms": PROCESSING_WINDOW_MS,
        "min_processing_ms": MIN_PROCESSING_MS,
        "overlap_duration_ms": OVERLAP_DURATION_MS,
        "sample_rate": SAMPLE_RATE,
        "model": "small.en",
        "engine": "whisper.cpp",
        "energy_threshold": BASE_ENERGY_THRESHOLD,
        "vad_enabled": True,
        "optimization": "enhanced_vad_with_artifact_filtering"
    }

# Health check
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "model_loaded": True,
        "active_connections": len(connections),
        "engine": "whisper.cpp"
    }

if __name__ == "__main__":
    import uvicorn
    # Backend server on port 61999
    uvicorn.run(app, host="0.0.0.0", port=61999, log_level="info") 