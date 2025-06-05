import { useState, useEffect, useRef } from 'react';
import useWebSocket from 'react-use-websocket';

const AudioRecorder = ({ onTranscription, onRecordingStateChange }) => {
    const [isRecording, setIsRecording] = useState(false);
    const [status, setStatus] = useState('ready');
    const [error, setError] = useState(null);
    const mediaRecorder = useRef(null);
    const audioContext = useRef(null);
    const audioProcessor = useRef(null);
    const audioData = useRef([]);
    const sendIntervalRef = useRef(null);
    
    // Optimized settings to match enhanced backend (300ms chunks)
    const CHUNK_SIZE_MS = 300; // Updated to match backend optimization
    const SAMPLE_RATE = 16000;
    const CHUNK_SIZE_SAMPLES = Math.floor((SAMPLE_RATE * CHUNK_SIZE_MS) / 1000); // 4800 samples
    
    // Notify parent component of recording state changes
    useEffect(() => {
        if (onRecordingStateChange) {
            onRecordingStateChange(isRecording);
        }
    }, [isRecording, onRecordingStateChange]);
    
    const { sendMessage, lastMessage, readyState } = useWebSocket('ws://localhost:8000/ws', {
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
                setStatus(`Detected: ${data.language} (${(data.language_probability * 100).toFixed(1)}%)`);
            }
        },
        onClose: () => {
            setStatus('disconnected');
        },
        shouldReconnect: (closeEvent) => true,
        reconnectInterval: 3000,
    });

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

    // Optimized audio processing with smaller, more frequent chunks
    const processAudioData = () => {
        if (audioData.current.length >= CHUNK_SIZE_SAMPLES) {
            const audioToSend = new Float32Array(audioData.current.slice(0, CHUNK_SIZE_SAMPLES));
            
            // Send immediately for lower latency
            if (readyState === 1) { // WebSocket.OPEN
                sendMessage(audioToSend.buffer);
            }
            
            // Remove processed samples
            audioData.current = audioData.current.slice(CHUNK_SIZE_SAMPLES);
        }
    };

    const startRecording = async () => {
        try {
            setError(null);
            audioData.current = [];
            
            // WebRTC-optimized audio context settings
            audioContext.current = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: SAMPLE_RATE,
                latencyHint: 'interactive', // WebRTC optimization for low latency
            });
            
            // WebRTC-style audio constraints for optimal real-time performance
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    channelCount: 1,
                    sampleRate: SAMPLE_RATE,
                    // WebRTC optimizations
                    latency: 0.01, // 10ms latency target
                    googEchoCancellation: true,
                    googAutoGainControl: true,
                    googNoiseSuppression: true,
                    googHighpassFilter: true,
                    googTypingNoiseDetection: true,
                    googAudioMirroring: false
                }
            });
            
            // Store stream reference for cleanup
            mediaRecorder.current = { stream };
            
            const sourceNode = audioContext.current.createMediaStreamSource(stream);
            
            // Use smaller buffer size for lower latency (WebRTC style)
            const bufferSize = 1024; // Smaller buffer for lower latency
            audioProcessor.current = audioContext.current.createScriptProcessor(bufferSize, 1, 1);
            
            audioProcessor.current.onaudioprocess = (e) => {
                const inputData = e.inputBuffer.getChannelData(0);
                audioData.current.push(...inputData);
                
                // Process immediately when we have enough data
                processAudioData();
            };
            
            // Connect the nodes
            sourceNode.connect(audioProcessor.current);
            audioProcessor.current.connect(audioContext.current.destination);
            
            // Set up interval to ensure regular processing even with variable input
            sendIntervalRef.current = setInterval(() => {
                processAudioData();
            }, CHUNK_SIZE_MS / 2); // Check twice per chunk duration for responsiveness
            
            setIsRecording(true);
            setStatus('recording');
        } catch (error) {
            console.error('Error accessing microphone:', error);
            setError('Could not access microphone');
            setStatus('error');
        }
    };

    const stopRecording = () => {
        // Clear the send interval
        if (sendIntervalRef.current) {
            clearInterval(sendIntervalRef.current);
            sendIntervalRef.current = null;
        }
        
        if (audioProcessor.current) {
            audioProcessor.current.disconnect();
            audioProcessor.current = null;
        }
        if (audioContext.current) {
            // Get all tracks from the audio context source
            if (audioContext.current.state !== 'closed') {
                audioContext.current.close();
            }
            audioContext.current = null;
        }
        // Stop all media tracks
        if (mediaRecorder.current && mediaRecorder.current.stream) {
            mediaRecorder.current.stream.getTracks().forEach(track => {
                track.stop();
            });
        }
        audioData.current = [];
        setIsRecording(false);
        setStatus('ready');
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '1rem' }}>
            <button
                onClick={isRecording ? stopRecording : startRecording}
                style={{
                    padding: '1rem 2rem',
                    backgroundColor: isRecording ? '#ef4444' : '#ef4444',
                    color: 'white',
                    fontSize: '1.125rem',
                    fontWeight: '600',
                    border: 'none',
                    borderRadius: '0.5rem',
                    cursor: (status === 'error' || status === 'disconnected') ? 'not-allowed' : 'pointer',
                    transition: 'background-color 0.2s',
                    opacity: (status === 'error' || status === 'disconnected') ? 0.5 : 1
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
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                    width: '1rem',
                    height: '1rem',
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
                    fontSize: '0.875rem',
                    color: 
                        status === 'error' ? '#dc2626' :
                        status === 'disconnected' ? '#d97706' :
                        '#6b7280'
                }}>
                    {status === 'recording' ? 'Recording (300ms chunks)...' :
                     status === 'connected' ? 'Ready - WebRTC Optimized' :
                     status === 'error' ? error || 'Error' :
                     status === 'disconnected' ? 'Reconnecting...' :
                     'Initializing...'}
                </span>
            </div>
            
            {error && (
                <div style={{
                    color: '#dc2626',
                    fontSize: '0.875rem',
                    marginTop: '0.5rem',
                    textAlign: 'center'
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