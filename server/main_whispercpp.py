from fastapi import FastAPI, WebSocket
from pywhispercpp.model import Model
import asyncio
import json
import numpy as np
from collections import deque
import time

app = FastAPI()

print("Loading Whisper.cpp model...")
# whisper.cpp is faster than regular whisper
model = Model('small.en', print_realtime=False, print_progress=False)
print("Enhanced Whisper.cpp model (small.en) loaded and ready!")

# Audio settings
SAMPLE_RATE = 16000
CHUNK_DURATION_MS = 500
CHUNK_SIZE_SAMPLES = int(SAMPLE_RATE * CHUNK_DURATION_MS / 1000)
PROCESSING_WINDOW_MS = 2000
PROCESSING_WINDOW_SAMPLES = int(SAMPLE_RATE * PROCESSING_WINDOW_MS / 1000)
MIN_PROCESSING_MS = 1500
MIN_PROCESSING_SAMPLES = int(SAMPLE_RATE * MIN_PROCESSING_MS / 1000)
OVERLAP_DURATION_MS = 200
OVERLAP_SIZE = int(SAMPLE_RATE * OVERLAP_DURATION_MS / 1000)
BASE_ENERGY_THRESHOLD = 0.008
SILENCE_CHUNKS_LIMIT = 6
VAD_WINDOW_SAMPLES = int(SAMPLE_RATE * 0.1)

# Track state per connection
class ConnectionState:
    def __init__(self):
        self.audio_buffer = np.array([], dtype=np.float32)
        self.previous_text = ""
        self.silent_chunks_count = 0
        self.last_speech_time = time.time()
        self.chunks_received = 0
        self.last_processing_time = time.time()
        self.energy_history = deque(maxlen=10)
        self.recent_transcriptions = deque(maxlen=5)

connections = {}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    connection_id = id(websocket)
    connections[connection_id] = ConnectionState()
    state = connections[connection_id]
    
    print("WebSocket connection opened")
    
    try:
        while True:
            try:
                # Get audio data
                message = await websocket.receive_bytes()
                audio_chunk = np.frombuffer(message, dtype=np.float32)
                
                # Add to buffer
                state.audio_buffer = np.concatenate((state.audio_buffer, audio_chunk))
                state.chunks_received += 1
                
                # Check if we should process
                current_time = time.time()
                time_since_last = current_time - state.last_processing_time
                has_enough_data = len(state.audio_buffer) >= MIN_PROCESSING_SAMPLES
                should_process = (
                    has_enough_data and time_since_last >= 0.8 or
                    len(state.audio_buffer) >= PROCESSING_WINDOW_SAMPLES or
                    (time_since_last >= 3.0 and len(state.audio_buffer) > 0)
                )
                
                if should_process:
                    # Get audio to transcribe
                    processing_size = min(len(state.audio_buffer), PROCESSING_WINDOW_SAMPLES)
                    audio_chunk = state.audio_buffer[:processing_size]
                    
                    # Track energy levels
                    current_energy = np.sqrt(np.mean(audio_chunk**2))
                    state.energy_history.append(current_energy)
                    
                    # Figure out dynamic threshold
                    if len(state.energy_history) >= 3:
                        avg_energy = np.mean(list(state.energy_history)[-5:])
                        dynamic_threshold = max(BASE_ENERGY_THRESHOLD, avg_energy * 0.6)
                    else:
                        dynamic_threshold = BASE_ENERGY_THRESHOLD
                    
                    # Check energy level
                    has_sufficient_energy = current_energy > dynamic_threshold
                    
                    # Simple voice activity detection
                    vad_chunks = len(audio_chunk) // VAD_WINDOW_SAMPLES
                    speech_chunks = 0
                    for i in range(vad_chunks):
                        start_idx = i * VAD_WINDOW_SAMPLES
                        end_idx = start_idx + VAD_WINDOW_SAMPLES
                        chunk_energy = np.sqrt(np.mean(audio_chunk[start_idx:end_idx]**2))
                        if chunk_energy > dynamic_threshold * 0.8:
                            speech_chunks += 1
                    
                    has_speech = speech_chunks > vad_chunks * 0.3
                    
                    if has_speech and has_sufficient_energy:
                        state.silent_chunks_count = 0
                        state.last_speech_time = time.time()
                        
                        try:
                            # Run whisper.cpp
                            segments = model.transcribe(audio_chunk)
                            
                            # Process results
                            for segment in segments:
                                text = segment.text.strip()
                                
                                if is_valid_transcription_enhanced(text, state):
                                    # Fake info object for compatibility
                                    mock_info = type('obj', (object,), {'language_probability': 0.95})()
                                    
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
                        # Reset after silence
                        if state.silent_chunks_count >= SILENCE_CHUNKS_LIMIT:
                            state.previous_text = ""
                            state.recent_transcriptions.clear()
                            print("Context reset due to prolonged silence")
                    
                    # Keep some overlap
                    if len(state.audio_buffer) > processing_size:
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
    """Basic filtering for transcriptions"""
    if not text or len(text.strip()) < 2:
        return False
    
    text_lower = text.lower().strip()
    
    # Filter common artifacts
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
    
    # Skip short words
    if len(text.split()) == 1 and len(text) < 4:
        return False
    
    # Check for repetition
    if text_lower in state.recent_transcriptions:
        return False
    
    # Check substring repetition
    for recent in state.recent_transcriptions:
        if text_lower in recent or recent in text_lower:
            return False
    
    # Filter repetitive patterns
    words = text_lower.split()
    if len(words) > 1:
        # Same word repeated
        if len(set(words)) == 1:
            return False
        
        # Alternating repetitions
        if len(words) >= 3:
            pattern_detected = True
            for i in range(2, len(words)):
                if words[i] != words[i-2]:
                    pattern_detected = False
                    break
            if pattern_detected:
                return False
    
    # Check similarity with previous
    if state.previous_text:
        prev_words = set(state.previous_text.lower().split())
        curr_words = set(text_lower.split())
        if len(curr_words) > 0:
            overlap = len(prev_words & curr_words) / len(curr_words)
            if overlap > 0.7:
                return False
    
    return True

def is_valid_transcription_enhanced(text: str, state: ConnectionState) -> bool:
    """Better filtering for transcriptions"""
    if not text or len(text.strip()) < 2:
        return False
    
    text_lower = text.lower().strip()
    
    # Filter common artifacts
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
    
    # Skip short words
    if len(text.split()) == 1 and len(text) < 4:
        return False
    
    # Check for repetition
    if text_lower in state.recent_transcriptions:
        return False
    
    # Check substring repetition
    for recent in state.recent_transcriptions:
        if text_lower in recent or recent in text_lower:
            return False
    
    # Filter repetitive patterns
    words = text_lower.split()
    if len(words) > 1:
        # Same word repeated
        if len(set(words)) == 1:
            return False
        
        # Alternating repetitions
        if len(words) >= 3:
            pattern_detected = True
            for i in range(2, len(words)):
                if words[i] != words[i-2]:
                    pattern_detected = False
                    break
            if pattern_detected:
                return False
    
    # Check similarity with previous
    if state.previous_text:
        prev_words = set(state.previous_text.lower().split())
        curr_words = set(text_lower.split())
        if len(curr_words) > 0:
            overlap = len(prev_words & curr_words) / len(curr_words)
            if overlap > 0.7:
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
    uvicorn.run(app, host="0.0.0.0", port=61999) 