import { useState, useEffect, useRef } from 'react';
import useWebSocket from 'react-use-websocket';

const AudioRecorder = ({ onTranscription, onRecordingStateChange, isRecording: externalIsRecording, onToggleRecording, mode = 'transcription', transcriptionLanguage = 'en' }) => {
    const [isRecording, setIsRecording] = useState(externalIsRecording || false);
    const [status, setStatus] = useState('ready');
    const [error, setError] = useState(null);
    const mediaRecorder = useRef(null);
    const audioContext = useRef(null);
    const audioProcessor = useRef(null);
    const audioData = useRef([]);
    const sendIntervalRef = useRef(null);
    
    // 300ms chunks work well with Whisper
    const CHUNK_SIZE_MS = 300;
    const SAMPLE_RATE = 16000;
    const CHUNK_SIZE_SAMPLES = Math.floor((SAMPLE_RATE * CHUNK_SIZE_MS) / 1000);
    
    const startRecordingHandler = async () => {
        try {
            setError(null);
            audioData.current = [];
            
            // Setup audio context
            audioContext.current = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: SAMPLE_RATE,
                latencyHint: 'interactive',
            });
            
            // Get microphone access
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    channelCount: 1,
                    sampleRate: SAMPLE_RATE,
                    latency: 0.01,
                    googEchoCancellation: true,
                    googAutoGainControl: true,
                    googNoiseSuppression: true,
                    googHighpassFilter: true,
                    googTypingNoiseDetection: true,
                    googAudioMirroring: false
                }
            });
            
            mediaRecorder.current = { stream };
            
            const sourceNode = audioContext.current.createMediaStreamSource(stream);
            
            // Small buffer = lower latency
            const bufferSize = 1024;
            audioProcessor.current = audioContext.current.createScriptProcessor(bufferSize, 1, 1);
            
            audioProcessor.current.onaudioprocess = (e) => {
                const inputData = e.inputBuffer.getChannelData(0);
                audioData.current.push(...inputData);
                processAudioData();
            };
            
            sourceNode.connect(audioProcessor.current);
            audioProcessor.current.connect(audioContext.current.destination);
            
            // Fallback timer in case onaudioprocess misses something
            sendIntervalRef.current = setInterval(() => {
                processAudioData();
            }, CHUNK_SIZE_MS / 2);
            
            setIsRecording(true);
            setStatus('recording');
        } catch (error) {
            console.error('Error accessing microphone:', error);
            setError('Could not access microphone');
            setStatus('error');
        }
    };

    const stopRecordingHandler = () => {
        // Stop the timer
        if (sendIntervalRef.current) {
            clearInterval(sendIntervalRef.current);
            sendIntervalRef.current = null;
        }
        
        // Clean up audio stuff
        if (audioProcessor.current) {
            audioProcessor.current.disconnect();
            audioProcessor.current = null;
        }
        if (audioContext.current) {
            if (audioContext.current.state !== 'closed') {
                audioContext.current.close();
            }
            audioContext.current = null;
        }
        // Stop mic
        if (mediaRecorder.current && mediaRecorder.current.stream) {
            mediaRecorder.current.stream.getTracks().forEach(track => {
                track.stop();
            });
        }
        audioData.current = [];
        setIsRecording(false);
        setStatus('ready');
    };

    // Keep in sync with parent component
    useEffect(() => {
        if (externalIsRecording !== undefined && externalIsRecording !== isRecording) {
            if (externalIsRecording) {
                startRecordingHandler();
            } else {
                stopRecordingHandler();
            }
        }
    }, [externalIsRecording, isRecording]);

    // Tell parent when recording state changes
    useEffect(() => {
        if (onRecordingStateChange) {
            onRecordingStateChange(isRecording);
        }
    }, [isRecording, onRecordingStateChange]);
    
    const { sendMessage, lastMessage, readyState } = useWebSocket('/ws', {
        onOpen: () => {
            console.log('WebSocket Connected');
            setStatus('connected');
        },
        onError: (error) => {
            console.log('WebSocket Error:', error);
            setError('Connection failed');
            setStatus('error');
        },
        onMessage: (event) => {
            const data = JSON.parse(event.data);
            if (data.text && data.text.trim()) {
                onTranscription(data.text.trim());
                const modeText = data.mode === 'translation' ? 'Translation' : 'Transcription';
                setStatus(`${modeText}: ${data.language} (${(data.language_probability * 100).toFixed(1)}%)`);
            }
        },
        onClose: () => {
            setStatus('disconnected');
        },
        shouldReconnect: (closeEvent) => true,
        reconnectInterval: 3000,
    });

    // Send mode and language changes to server when they change
    useEffect(() => {
        if (readyState === 1) { // WebSocket is open
            const message = {
                mode: mode,
                transcriptionLanguage: transcriptionLanguage
            };
            sendMessage(JSON.stringify(message));
        }
    }, [mode, transcriptionLanguage, readyState, sendMessage]);

    useEffect(() => {
        return () => {
            if (sendIntervalRef.current) {
                clearInterval(sendIntervalRef.current);
            }
            if (audioProcessor.current) {
                audioProcessor.current.disconnect();
            }
            if (audioContext.current) {
                audioContext.current.close();
            }
        };
    }, []);

    // Send data when we have enough
    const processAudioData = () => {
        if (audioData.current.length >= CHUNK_SIZE_SAMPLES) {
            const audioToSend = new Float32Array(audioData.current.slice(0, CHUNK_SIZE_SAMPLES));
            
            // Send if websocket is ready
            if (readyState === 1) {
                sendMessage(audioToSend.buffer);
            }
            
            // Remove what we just sent
            audioData.current = audioData.current.slice(CHUNK_SIZE_SAMPLES);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', padding: '0.5rem', minHeight: 0 }}>
            <button
                onClick={onToggleRecording || (isRecording ? stopRecordingHandler : startRecordingHandler)}
                style={{
                    padding: '0.5rem 1.2rem',
                    backgroundColor: isRecording ? '#ef4444' : '#ef4444',
                    color: 'white',
                    fontSize: '1rem',
                    fontWeight: '600',
                    border: 'none',
                    borderRadius: '0.5rem',
                    cursor: (status === 'error' || status === 'disconnected') ? 'not-allowed' : 'pointer',
                    transition: 'background-color 0.2s',
                    opacity: (status === 'error' || status === 'disconnected') ? 0.5 : 1,
                    minHeight: 0
                }}
                onMouseOver={(e) => {
                    if (status !== 'error' && status !== 'disconnected') {
                        e.target.style.backgroundColor = '#dc2626';
                    }
                }}
                onMouseOut={(e) => {
                    if (status !== 'error' && status !== 'disconnected') {
                        e.target.style.backgroundColor = '#ef4444';
                    }
                }}
                disabled={status === 'error' || status === 'disconnected'}
            >
                {isRecording ? 'Stop Recording' : 'Start Recording'}
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minHeight: 0 }}>
                <div style={{
                    width: '0.75rem',
                    height: '0.75rem',
                    borderRadius: '50%',
                    backgroundColor: 
                        status === 'recording' ? '#ef4444' :
                        status === 'connected' ? '#10b981' :
                        status === 'error' ? '#ef4444' :
                        status === 'disconnected' ? '#f59e0b' :
                        '#d1d5db',
                    animation: status === 'recording' ? 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' : 'none'
                }} />
                <span style={{
                    fontSize: '0.85rem',
                    color: 
                        status === 'error' ? '#dc2626' :
                        status === 'disconnected' ? '#d97706' :
                        '#6b7280',
                    minHeight: 0
                }}>
                    {status === 'recording' ? `Recording (${mode === 'translation' ? 'Translation' : `Transcription - ${transcriptionLanguage === 'en' ? 'English' : 'German'}`} mode)...` :
                     status === 'connected' ? `Ready - ${mode === 'translation' ? 'Translation' : `Transcription - ${transcriptionLanguage === 'en' ? 'English' : 'German'}`} Mode` :
                     status === 'error' ? error || 'Error' :
                     status === 'disconnected' ? 'Reconnecting...' :
                     'Initializing...'}
                </span>
            </div>
            {error && (
                <div style={{
                    color: '#dc2626',
                    fontSize: '0.85rem',
                    marginTop: '0.25rem',
                    textAlign: 'center',
                    minHeight: 0
                }}>
                    {error}
                </div>
            )}
            <style jsx>{`
                @keyframes pulse {
                    0%, 100% {
                        opacity: 1;
                    }
                    50% {
                        opacity: .5;
                    }
                }
            `}</style>
        </div>
    );
};

export default AudioRecorder; 