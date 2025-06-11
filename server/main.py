from fastapi import FastAPI, WebSocket
from faster_whisper import WhisperModel
import asyncio
import json
import numpy as np
from collections import deque
import time

app = FastAPI()

print("Loading Whisper model...")
# Optimized model for M3 Mac with better accuracy
model = WhisperModel(
    "small.en",  # 25% faster than base.en with better accuracy
    device="cpu", 
    compute_type="int8",
    cpu_threads=8,  # M3 has excellent multi-core performance
    num_workers=4   # Parallel processing for M3
)
print("Enhanced Whisper model (small.en) loaded and ready!")

# Optimized buffer settings for M3 Mac performance
SAMPLE_RATE = 16000
CHUNK_DURATION_MS = 300  # Optimized for Whisper's 30ms frame size
CHUNK_SIZE_SAMPLES = int(SAMPLE_RATE * CHUNK_DURATION_MS / 1000)  # 4800 samples
PROCESSING_WINDOW_MS = 1200  # Matches Whisper's optimal context
PROCESSING_WINDOW_SAMPLES = int(SAMPLE_RATE * PROCESSING_WINDOW_MS / 1000)  # 19200 samples
OVERLAP_DURATION_MS = 150  # Optimized overlap for 300ms chunks
OVERLAP_SIZE = int(SAMPLE_RATE * OVERLAP_DURATION_MS / 1000)
BASE_ENERGY_THRESHOLD = 0.003  # Fallback threshold
SILENCE_CHUNKS_LIMIT = 8  # Reset context after silent chunks

# Per-connection state optimized for smaller chunks
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
    
    try:
        while True:
            audio_data = await websocket.receive_bytes()
            
            try:
                # Convert to numpy array
                audio = np.frombuffer(audio_data, dtype=np.float32)
                state = connections[connection_id]
                state.chunks_received += 1
                
                # Accumulate audio data
                state.audio_buffer = np.concatenate((state.audio_buffer, audio))
                
                # Process when we have enough data (1 second worth) or every 4 chunks (1 second)
                should_process = (
                    len(state.audio_buffer) >= PROCESSING_WINDOW_SAMPLES or
                    (state.chunks_received % 4 == 0 and len(state.audio_buffer) >= CHUNK_SIZE_SAMPLES * 2)  # At least 500ms
                )
                
                if should_process:
                    # Determine processing chunk size
                    processing_size = min(len(state.audio_buffer), PROCESSING_WINDOW_SAMPLES)
                    audio_chunk = state.audio_buffer[:processing_size]
                    
                    # Check for speech activity with adjusted threshold for smaller chunks
                    audio_energy = np.sqrt(np.mean(audio_chunk**2))
                    has_speech = audio_energy > calculate_dynamic_threshold(audio_chunk)
                    
                    if has_speech:
                        state.silent_chunks_count = 0
                        state.last_speech_time = time.time()
                        
                        # Enhanced transcription settings for M3 Mac optimization
                        segments, info = model.transcribe(
                            audio_chunk,
                            beam_size=2,              # Better quality with minimal latency impact
                            best_of=2,                # Improved candidate selection
                            temperature=0.0,          # Deterministic
                            compression_ratio_threshold=2.2,  # Stricter filtering
                            condition_on_previous_text=False,
                            no_speech_threshold=0.4,  # More sensitive speech detection
                            word_timestamps=False,    # Disable for speed
                            language="en",
                            vad_filter=True,          # Enable VAD filtering
                            vad_parameters={
                                "threshold": 0.3,     # More sensitive VAD
                                "min_speech_duration_ms": 200,  # Adjusted for 300ms chunks
                                "max_speech_duration_s": 30,
                                "min_silence_duration_ms": 100,
                                "speech_pad_ms": 30
                            }
                        )
                        
                        # Process segments with enhanced filtering
                        for segment in segments:
                            text = segment.text.strip()
                            
                            # Enhanced filtering with confidence and phoneme detection
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
                        # Reset context after prolonged silence (2 seconds with 250ms chunks)
                        if state.silent_chunks_count >= SILENCE_CHUNKS_LIMIT:
                            state.previous_text = ""
                    
                    # Update buffer with overlap for smaller chunks
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

def should_send_text(text: str, previous_text: str) -> bool:
    """Enhanced filtering to prevent repetition and false positives for 250ms chunks"""
    if not text or len(text.strip()) < 2:
        return False
    
    # Common false positives during silence or noise (expanded for smaller chunks)
    false_positives = {
        "thank you", "thank you very much", "thanks", "you", "yeah", "yes", 
        "no", "oh", "um", "uh", "ah", "hmm", "okay", "ok", "well", "so",
        "the", "a", "and", "but", "or", "is", "was", "are", "were", "i",
        "it", "that", "this", "with", "for", "on", "at", "by", "from"
    }
    
    if text.lower().strip() in false_positives:
        return False
    
    # More aggressive filtering for very short text from 250ms chunks
    if len(text.split()) == 1 and len(text) < 4:
        return False
    
    # Check for repetition (simple similarity check)
    if previous_text and text.lower() in previous_text.lower():
        return False
    
    # Check if it's mostly the same as previous text
    if previous_text:
        common_words = set(text.lower().split()) & set(previous_text.lower().split())
        if len(common_words) >= len(text.split()) * 0.8:  # 80% overlap for smaller chunks
            return False
    
    return True

def should_send_text_enhanced(text: str, info, previous_text: str) -> bool:
    """Enhanced filtering with confidence and phoneme detection"""
    if not text or len(text.strip()) < 2:
        return False
    
    # Confidence threshold - reject low confidence transcriptions
    if info.language_probability < 0.85:
        return False
    
    # Phoneme-based filtering (catches partial words and speech artifacts)
    phoneme_artifacts = ['mm', 'uh', 'ah', 'hmm', 'er', 'em', 'mhmm']
    if any(artifact in text.lower() for artifact in phoneme_artifacts):
        return False
    
    # Common false positives during silence or noise
    false_positives = {
        "thank you", "thank you very much", "thanks", "you", "yeah", "yes", 
        "no", "oh", "um", "uh", "ah", "hmm", "okay", "ok", "well", "so",
        "the", "a", "and", "but", "or", "is", "was", "are", "were", "i",
        "it", "that", "this", "with", "for", "on", "at", "by", "from"
    }
    
    if text.lower().strip() in false_positives:
        return False
    
    # Aggressive filtering for very short text
    if len(text.split()) == 1 and len(text) < 4:
        return False
    
    # Check for repetition with previous text
    if previous_text and text.lower() in previous_text.lower():
        return False
    
    # Check word overlap percentage
    if previous_text:
        current_words = set(text.lower().split())
        previous_words = set(previous_text.lower().split())
        if len(current_words) > 0:
            overlap = len(current_words & previous_words) / len(current_words)
            if overlap > 0.7:  # More than 70% overlap
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

def calculate_dynamic_threshold(audio_chunk: np.ndarray) -> float:
    """Calculate dynamic energy threshold based on audio content"""
    if len(audio_chunk) == 0:
        return BASE_ENERGY_THRESHOLD
    
    # Use 80th percentile for adaptive threshold
    abs_audio = np.abs(audio_chunk)
    percentile_80 = np.percentile(abs_audio, 80)
    dynamic_threshold = percentile_80 * 1.5
    
    # Ensure threshold is within reasonable bounds
    return max(BASE_ENERGY_THRESHOLD, min(dynamic_threshold, 0.02))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3000, log_level="info")