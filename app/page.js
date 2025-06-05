'use client';

import { useState } from 'react';
import AudioRecorder from '../components/AudioRecorder';
import PerformanceMonitor from '../components/PerformanceMonitor';

export default function Home() {
  const [transcription, setTranscription] = useState('');
  const [error, setError] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [performanceMetrics, setPerformanceMetrics] = useState(null);

  const handleTranscription = (text) => {
    setTranscription(prev => prev + ' ' + text);
  };

  const handleRecordingStateChange = (recording) => {
    setIsRecording(recording);
  };

  const handleMetricsUpdate = (metrics) => {
    setPerformanceMetrics(metrics);
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
    const filename = `transcription_${timestamp}.${format}`;
    
    if (format === 'txt') {
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
      const pdfContent = `
        <html>
          <head>
            <title>Transcription</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
              h1 { color: #333; border-bottom: 2px solid #333; padding-bottom: 10px; }
              .content { margin-top: 20px; white-space: pre-wrap; }
              .timestamp { color: #666; font-size: 12px; margin-top: 20px; }
            </style>
          </head>
          <body>
            <h1>RealTime Transcription</h1>
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
        maxWidth: '600px', 
        textAlign: 'center' 
      }}>
        <h1 style={{ 
          fontSize: '2rem', 
          fontWeight: 'bold', 
          color: '#111827', 
          marginBottom: '1rem' 
        }}>
          RealTime Transcription
        </h1>
        
        {/* Audio Recorder Component */}
        <div style={{ marginBottom: '1rem' }}>
          <AudioRecorder 
            onTranscription={handleTranscription} 
            onRecordingStateChange={handleRecordingStateChange}
          />
        </div>

        {/* Performance Monitor */}
        <PerformanceMonitor 
          isRecording={isRecording} 
          onMetricsUpdate={handleMetricsUpdate}
        />

        {/* Error Display */}
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

        {/* Transcription Box */}
        <div style={{
          backgroundColor: 'white',
          border: '1px solid #d1d5db',
          borderRadius: '0.5rem',
          padding: '1.5rem',
          marginBottom: '1.5rem',
          marginTop: '1.5rem',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
          width: '100%'
        }}>
          <div style={{
            minHeight: '200px',
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
            justifyContent: 'flex-start'
          }}>
            <div style={{ width: '100%' }}>
              {transcription || (
                <span style={{ color: '#6b7280', fontStyle: 'italic' }}>
                  Your transcription will appear here...
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
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
      </div>
    </div>
  );
} 