from fastapi import FastAPI, WebSocket
import whisperx
import asyncio
import json
import numpy as np
import time

app = FastAPI()

print("Loading WhisperX model...")
device = "cpu"
model = whisperx.load_model("small", device, compute_type="int8")
print("WhisperX model loaded and ready!")

SAMPLE_RATE = 16000
CHUNK_DURATION_MS = 300
CHUNK_SIZE_SAMPLES = int(SAMPLE_RATE * CHUNK_DURATION_MS / 1000)
PROCESSING_WINDOW_MS = 1200
PROCESSING_WINDOW_SAMPLES = int(SAMPLE_RATE * PROCESSING_WINDOW_MS / 1000)
OVERLAP_DURATION_MS = 150
OVERLAP_SIZE = int(SAMPLE_RATE * OVERLAP_DURATION_MS / 1000)
SILENCE_CHUNKS_LIMIT = 8

class ConnectionState:
    def __init__(self):
        self.audio_buffer = np.array([], dtype=np.float32)
        self.previous_text = ""
        self.silent_chunks_count = 0
        self.last_speech_time = time.time()
        self.chunks_received = 0
        self.last_processing_time = time.time()
        self.mode = "transcription"
        self.transcription_language = "en"

connections = {}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    connection_id = id(websocket)
    connections[connection_id] = ConnectionState()
    state = connections[connection_id]
    print("WebSocket connection opened (WhisperX)")

    try:
        while True:
            try:
                message = await websocket.receive()
                if "text" in message:
                    try:
                        data = json.loads(message["text"])
                        if "mode" in data:
                            state.mode = data["mode"]
                            print(f"Mode set to: {state.mode}")
                        if "transcriptionLanguage" in data:
                            state.transcription_language = data["transcriptionLanguage"]
                            print(f"Transcription language set to: {state.transcription_language}")
                        await websocket.send_json({
                            "type": "mode_set",
                            "mode": state.mode,
                            "transcriptionLanguage": state.transcription_language
                        })
                    except Exception as e:
                        print(f"Error parsing mode message: {e}")
                    continue
                elif "bytes" in message:
                    audio_bytes = message["bytes"]
                    audio_chunk = np.frombuffer(audio_bytes, dtype=np.float32)
                    state.audio_buffer = np.concatenate([state.audio_buffer, audio_chunk])
                    state.chunks_received += 1

                    current_time = time.time()
                    has_enough_data = len(state.audio_buffer) >= PROCESSING_WINDOW_SAMPLES
                    time_since_last = current_time - state.last_processing_time
                    should_process = has_enough_data or (time_since_last > 2.0 and len(state.audio_buffer) > 0)

                    if should_process:
                        processing_size = min(len(state.audio_buffer), PROCESSING_WINDOW_SAMPLES)
                        audio_to_process = state.audio_buffer[:processing_size]
                        # WhisperX expects numpy float32 array at 16kHz
                        try:
                            if state.mode == "translation":
                                result = model.transcribe(audio_to_process, batch_size=8, task="translate")
                                detected_language = "en"
                            else:
                                result = model.transcribe(audio_to_process, batch_size=8, language=state.transcription_language)
                                detected_language = state.transcription_language
                            segments = result["segments"] if "segments" in result else []
                            for segment in segments:
                                text = segment["text"].strip()
                                if text and text != state.previous_text:
                                    await websocket.send_json({
                                        "text": text,
                                        "start": segment["start"],
                                        "end": segment["end"],
                                        "language": detected_language,
                                        "chunk_size_ms": CHUNK_DURATION_MS,
                                        "mode": state.mode,
                                        "is_final": True
                                    })
                                    state.previous_text = text
                        except Exception as e:
                            print(f"WhisperX transcription error: {e}")
                        if len(state.audio_buffer) > OVERLAP_SIZE:
                            state.audio_buffer = state.audio_buffer[processing_size - OVERLAP_SIZE:]
                        else:
                            state.audio_buffer = np.array([], dtype=np.float32)
                        state.last_processing_time = time.time()
                else:
                    print(f"Received unknown message type: {message}")
            except Exception as e:
                print(f"Error processing message: {e}")
                if isinstance(e, Exception) and ("disconnect" in str(e).lower() or "connection" in str(e).lower()):
                    break
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