from fastapi import FastAPI, WebSocket
from faster_whisper import WhisperModel
import asyncio
import json
import numpy as np
from collections import deque
import time

app = FastAPI()

print("Loading Whisper model...")
# small.en works well for English
model = WhisperModel(
    "small.en",
    device="cpu", 
    compute_type="int8",
    cpu_threads=8,
    num_workers=4
)
print("Enhanced Whisper model (small.en) loaded and ready!")

# Audio settings
SAMPLE_RATE = 16000
CHUNK_DURATION_MS = 300
CHUNK_SIZE_SAMPLES = int(SAMPLE_RATE * CHUNK_DURATION_MS / 1000)
PROCESSING_WINDOW_MS = 1200
PROCESSING_WINDOW_SAMPLES = int(SAMPLE_RATE * PROCESSING_WINDOW_MS / 1000)
OVERLAP_DURATION_MS = 150
OVERLAP_SIZE = int(SAMPLE_RATE * OVERLAP_DURATION_MS / 1000)
BASE_ENERGY_THRESHOLD = 0.003
SILENCE_CHUNKS_LIMIT = 8

# Keep track of each connection
class ConnectionState:
    def __init__(self):
        self.audio_buffer = np.array([], dtype=np.float32)
        self.previous_text = ""
        self.silent_chunks_count = 0
        self.last_speech_time = time.time()
        self.chunks_received = 0
        self.last_processing_time = time.time()

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
                # Get audio chunk
                message = await websocket.receive_bytes()
                audio_chunk = np.frombuffer(message, dtype=np.float32)
                
                # Buffer it
                state.audio_buffer = np.concatenate([state.audio_buffer, audio_chunk])
                state.chunks_received += 1
                
                # Should we process yet?
                current_time = time.time()
                has_enough_data = len(state.audio_buffer) >= PROCESSING_WINDOW_SAMPLES
                time_since_last = current_time - state.last_processing_time
                should_process = has_enough_data or (time_since_last > 2.0 and len(state.audio_buffer) > 0)
                
                if should_process:
                    # Get chunk to transcribe
                    processing_size = min(len(state.audio_buffer), PROCESSING_WINDOW_SAMPLES)
                    audio_chunk = state.audio_buffer[:processing_size]
                    
                    # Check if there's actual speech
                    audio_energy = np.sqrt(np.mean(audio_chunk**2))
                    has_speech = audio_energy > calculate_dynamic_threshold(audio_chunk)
                    
                    if has_speech:
                        state.silent_chunks_count = 0
                        state.last_speech_time = time.time()
                        
                        # Run whisper
                        segments, info = model.transcribe(
                            audio_chunk,
                            beam_size=2,
                            best_of=2,
                            temperature=0.0,
                            compression_ratio_threshold=2.2,
                            condition_on_previous_text=False,
                            no_speech_threshold=0.4,
                            word_timestamps=False,
                            language="en",
                            vad_filter=True,
                            vad_parameters={
                                "threshold": 0.3,
                                "min_speech_duration_ms": 200,
                                "max_speech_duration_s": 30,
                                "min_silence_duration_ms": 100,
                                "speech_pad_ms": 30
                            }
                        )
                        
                        # Send back results
                        for segment in segments:
                            text = segment.text.strip()
                            
                            if should_send_text_enhanced(text, info, state.previous_text):
                                await websocket.send_json({
                                    "text": text,
                                    "start": segment.start,
                                    "end": segment.end,
                                    "language": info.language,
                                    "language_probability": info.language_probability,
                                    "chunk_size_ms": CHUNK_DURATION_MS,
                                    "confidence": info.language_probability,
                                    "is_final": True
                                })
                                state.previous_text = text
                    
                    else:
                        state.silent_chunks_count += 1
                        # Reset after too much silence
                        if state.silent_chunks_count >= SILENCE_CHUNKS_LIMIT:
                            state.previous_text = ""
                    
                    # Keep some overlap for next chunk
                    if len(state.audio_buffer) > OVERLAP_SIZE:
                        state.audio_buffer = state.audio_buffer[processing_size - OVERLAP_SIZE:]
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

def calculate_dynamic_threshold(audio_chunk):
    """Figure out speech threshold based on current audio"""
    if len(audio_chunk) == 0:
        return BASE_ENERGY_THRESHOLD
    
    # Use percentile for adaptive threshold
    energy_percentile = np.percentile(np.abs(audio_chunk), 85)
    adaptive_threshold = max(BASE_ENERGY_THRESHOLD, energy_percentile * 0.3)
    
    return min(adaptive_threshold, BASE_ENERGY_THRESHOLD * 3)

def should_send_text_enhanced(text, info, previous_text):
    """Filter out junk transcriptions"""
    if not text or len(text.strip()) < 2:
        return False
    
    text_lower = text.lower().strip()
    
    # Common filler words that whisper picks up
    filler_words = {
        "thank you", "thanks", "you", "yeah", "yes", "no", "oh", "um", "uh", "ah", 
        "hmm", "okay", "ok", "well", "so", "the", "a", "and", "but", "or", 
        "is", "was", "are", "were", "i", "it", "that", "this"
    }
    
    if text_lower in filler_words:
        return False
    
    # Skip really short stuff
    if len(text.split()) == 1 and len(text) < 4:
        return False
    
    # Don't repeat the same thing
    if previous_text and text_lower == previous_text.lower().strip():
        return False
    
    # Check confidence
    if hasattr(info, 'language_probability') and info.language_probability < 0.7:
        return False
    
    return True

# Additional endpoint for configuration
@app.get("/config")
async def get_config():
    return {
        "chunk_duration_ms": CHUNK_DURATION_MS,
        "processing_window_ms": PROCESSING_WINDOW_MS,
        "overlap_duration_ms": OVERLAP_DURATION_MS,
        "sample_rate": SAMPLE_RATE,
        "model": "small.en",
        "energy_threshold": BASE_ENERGY_THRESHOLD,
        "optimization": "250ms_chunks_webrtc"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=61999, log_level="info")