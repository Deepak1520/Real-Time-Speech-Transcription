'use client';

import { useState, useEffect } from 'react';
import AudioRecorder from '../components/AudioRecorder';
import PerformanceMonitor from '../components/PerformanceMonitor';
import DetachableWrapper from '../components/DetachableWrapper';

export default function Home() {
  const [transcription, setTranscription] = useState('');
  const [error, setError] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [performanceMetrics, setPerformanceMetrics] = useState(null);
  const [detached, setDetached] = useState(false);
  const [globalRecordingState, setGlobalRecordingState] = useState(false);
  const [mode, setMode] = useState('transcription');
  const [transcriptionLanguage, setTranscriptionLanguage] = useState('en');

  const handleTranscription = (text) => {
    setTranscription(prev => prev + ' ' + text);
  };

  // Auto-scroll to bottom when transcription updates
  useEffect(() => {
    if (transcription) {
      const transcriptionBox = document.getElementById('transcription-box');
      if (transcriptionBox) {
        transcriptionBox.scrollTop = transcriptionBox.scrollHeight;
      }
    }
  }, [transcription]);

  const handleRecordingStateChange = (recording) => {
    setIsRecording(recording);
  };

  const handleMetricsUpdate = (metrics) => {
    setPerformanceMetrics(metrics);
  };

  const handleDetachChange = (isDetached) => {
    setDetached(isDetached);
  };

  const handleToggleRecording = () => {
    setGlobalRecordingState(prev => !prev);
  };

  const clearTranscription = () => {
    setTranscription('');
    setError(null);
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(transcription);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const saveAsFile = (format) => {
    if (!transcription) return;
    
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const filename = `${mode}_${timestamp}.${format}`;
    
    if (format === 'txt') {
      // Download as text file
      const blob = new Blob([transcription], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else if (format === 'pdf') {
      // Print to PDF
      const pdfContent = `
        <html>
          <head>
            <title>${mode === 'translation' ? 'Translation' : 'Transcription'}</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
              h1 { color: #333; border-bottom: 2px solid #333; padding-bottom: 10px; }
              .content { margin-top: 20px; white-space: pre-wrap; }
              .timestamp { color: #666; font-size: 12px; margin-top: 20px; }
              .mode { color: #666; font-size: 12px; margin-top: 5px; }
            </style>
          </head>
          <body>
            <h1>RealTime ${mode === 'translation' ? 'Translation' : 'Transcription'}</h1>
            <div class="mode">Mode: ${mode === 'translation' ? 'Translation (Any Language → English)' : `Transcription (${transcriptionLanguage === 'en' ? 'English' : 'German'})`}</div>
            <div class="content">${transcription}</div>
            <div class="timestamp">Generated on: ${new Date().toLocaleString()}</div>
          </body>
        </html>
      `;
      
      const printWindow = window.open('', '_blank');
      printWindow.document.write(pdfContent);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 250);
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#f9fafb', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      padding: '2rem'
    }}>
      <div style={{ 
        width: '100%', 
        maxWidth: '1200px', 
        textAlign: 'center',
        marginLeft: 'auto',
        marginRight: 'auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <h1 style={{ 
          fontSize: '2rem', 
          fontWeight: 'bold', 
          color: '#111827', 
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem'
        }}>
          RealTime {mode === 'translation' ? 'Translation' : 'Transcription'}
          {detached && (
            <span style={{
              fontSize: '0.875rem',
              backgroundColor: '#fbbf24',
              color: '#92400e',
              padding: '0.25rem 0.75rem',
              borderRadius: '9999px',
              fontWeight: '500'
            }}>
              🔗 Detached
            </span>
          )}
          {globalRecordingState && (
            <span style={{
              fontSize: '0.875rem',
              backgroundColor: '#ef4444',
              color: 'white',
              padding: '0.25rem 0.75rem',
              borderRadius: '9999px',
              fontWeight: '500',
              animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
            }}>
              🎤 Recording
            </span>
          )}
        </h1>
        
        {/* Mode Selector */}
        <div style={{
          marginBottom: '1.5rem',
          display: 'flex',
          justifyContent: 'center',
          gap: '0.5rem'
        }}>
          <button
            onClick={() => setMode('transcription')}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: mode === 'transcription' ? '#3b82f6' : '#e5e7eb',
              color: mode === 'transcription' ? 'white' : '#374151',
              fontSize: '0.875rem',
              fontWeight: '500',
              border: 'none',
              borderRadius: '0.375rem',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            📝 Transcription
          </button>
          <button
            onClick={() => setMode('translation')}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: mode === 'translation' ? '#10b981' : '#e5e7eb',
              color: mode === 'translation' ? 'white' : '#374151',
              fontSize: '0.875rem',
              fontWeight: '500',
              border: 'none',
              borderRadius: '0.375rem',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            🌍 Translation
          </button>
        </div>
        
        {/* Language Selector for Transcription Mode */}
        {mode === 'transcription' && (
          <div style={{
            marginBottom: '1.5rem',
            display: 'flex',
            justifyContent: 'center',
            gap: '0.5rem'
          }}>
            <button
              onClick={() => setTranscriptionLanguage('en')}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: transcriptionLanguage === 'en' ? '#3b82f6' : '#e5e7eb',
                color: transcriptionLanguage === 'en' ? 'white' : '#374151',
                fontSize: '0.875rem',
                fontWeight: '500',
                border: 'none',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              🇺🇸 English
            </button>
            <button
              onClick={() => setTranscriptionLanguage('de')}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: transcriptionLanguage === 'de' ? '#3b82f6' : '#e5e7eb',
                color: transcriptionLanguage === 'de' ? 'white' : '#374151',
                fontSize: '0.875rem',
                fontWeight: '500',
                border: 'none',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              🇩🇪 German
            </button>
          </div>
        )}
        
        {/* Mode Description */}
        <div style={{
          marginBottom: '1.5rem',
          padding: '0.75rem',
          backgroundColor: mode === 'translation' ? '#ecfdf5' : '#eff6ff',
          border: `1px solid ${mode === 'translation' ? '#a7f3d0' : '#bfdbfe'}`,
          borderRadius: '0.5rem',
          fontSize: '0.875rem',
          color: mode === 'translation' ? '#065f46' : '#1e40af'
        }}>
          {mode === 'translation' 
            ? '🌍 Translation Mode: Detects any language and outputs in English'
            : `📝 Transcription Mode: Transcribes in ${transcriptionLanguage === 'en' ? 'English' : 'German'}`
          }
        </div>
        
        {/* Main recorder */}
        <div style={{ 
          marginBottom: '2rem',
          padding: '1.5rem',
          backgroundColor: 'white',
          borderRadius: '0.75rem',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          border: '1px solid #e2e8f0'
        }}>
          <DetachableWrapper onDetachChange={handleDetachChange} transcription={transcription}>
            <AudioRecorder 
              onTranscription={handleTranscription} 
              onRecordingStateChange={handleRecordingStateChange}
              isRecording={globalRecordingState}
              onToggleRecording={handleToggleRecording}
              mode={mode}
              transcriptionLanguage={transcriptionLanguage}
            />
          </DetachableWrapper>
        </div>

        {/* Performance monitor - hidden when detached */}
        {/* {!detached && (
          <PerformanceMonitor 
            isRecording={isRecording} 
            onMetricsUpdate={handleMetricsUpdate}
          />
        )} */}

        {/* Errors */}
        {error && (
          <div style={{
            marginBottom: '1.5rem',
            padding: '1rem',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '0.5rem',
            color: '#b91c1c'
          }}>
            {error}
          </div>
        )}

        {/* Transcription box - hidden when detached */}
        {!detached && (
          <div style={{
            backgroundColor: 'white',
            border: '1px solid #d1d5db',
            borderRadius: '0.5rem',
            padding: '1.5rem',
            marginBottom: '1.5rem',
            marginTop: '1.5rem',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
            width: '100%',
            maxWidth: '1800px',
            marginLeft: '0.5rem',
            marginRight: 'auto',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <div 
              id="transcription-box"
              style={{
                minHeight: '180px',
                maxHeight: '400px',
                width: '100%',
                padding: '1rem',
                backgroundColor: '#f9fafb',
                border: '1px solid #e5e7eb',
                borderRadius: '0.25rem',
                color: '#111827',
                textAlign: 'left',
                boxSizing: 'border-box',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'flex-start',
                fontSize: '1.25rem',
                lineHeight: 1.7,
                overflowY: 'auto',
                overflowX: 'hidden'
              }}
            >
              <div style={{ width: '100%' }}>
                {transcription || (
                  <span style={{ color: '#6b7280', fontStyle: 'italic' }}>
                    Your {mode === 'translation' ? 'translation' : 'transcription'} will appear here...
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Save buttons - hidden when detached */}
        {!detached && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap', marginTop: '2rem' }}>
          <button
            onClick={() => saveAsFile('txt')}
            disabled={!transcription}
            style={{
              padding: '0.5rem 1.5rem',
              backgroundColor: transcription ? '#3b82f6' : '#d1d5db',
              color: 'white',
              fontSize: '0.875rem',
              fontWeight: '500',
              border: 'none',
              borderRadius: '0.25rem',
              cursor: transcription ? 'pointer' : 'not-allowed',
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => {
              if (transcription) e.target.style.backgroundColor = '#2563eb';
            }}
            onMouseOut={(e) => {
              if (transcription) e.target.style.backgroundColor = '#3b82f6';
            }}
          >
            Save as TXT
          </button>
          <button
            onClick={() => saveAsFile('pdf')}
            disabled={!transcription}
            style={{
              padding: '0.5rem 1.5rem',
              backgroundColor: transcription ? '#8b5cf6' : '#d1d5db',
              color: 'white',
              fontSize: '0.875rem',
              fontWeight: '500',
              border: 'none',
              borderRadius: '0.25rem',
              cursor: transcription ? 'pointer' : 'not-allowed',
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => {
              if (transcription) e.target.style.backgroundColor = '#7c3aed';
            }}
            onMouseOut={(e) => {
              if (transcription) e.target.style.backgroundColor = '#8b5cf6';
            }}
          >
            Save as PDF
          </button>
          <button
            onClick={copyToClipboard}
            disabled={!transcription}
            style={{
              padding: '0.5rem 1.5rem',
              backgroundColor: transcription ? '#10b981' : '#d1d5db',
              color: 'white',
              fontSize: '0.875rem',
              fontWeight: '500',
              border: 'none',
              borderRadius: '0.25rem',
              cursor: transcription ? 'pointer' : 'not-allowed',
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => {
              if (transcription) e.target.style.backgroundColor = '#059669';
            }}
            onMouseOut={(e) => {
              if (transcription) e.target.style.backgroundColor = '#10b981';
            }}
          >
            Copy
          </button>
          <button
            onClick={clearTranscription}
            disabled={!transcription}
            style={{
              padding: '0.5rem 1.5rem',
              backgroundColor: transcription ? '#6b7280' : '#d1d5db',
              color: 'white',
              fontSize: '0.875rem',
              fontWeight: '500',
              border: 'none',
              borderRadius: '0.25rem',
              cursor: transcription ? 'pointer' : 'not-allowed',
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => {
              if (transcription) e.target.style.backgroundColor = '#4b5563';
            }}
            onMouseOut={(e) => {
              if (transcription) e.target.style.backgroundColor = '#6b7280';
            }}
          >
            Clear
          </button>
        </div>
        )}
      </div>
    </div>
  );
} 