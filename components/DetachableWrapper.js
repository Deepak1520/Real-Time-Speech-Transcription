import React, { useState, useEffect, useRef } from 'react';
import { Rnd } from 'react-rnd';
import ReactDOM from 'react-dom';

const DetachableWrapper = ({ children, onDetachChange, transcription }) => {
  const [detached, setDetached] = useState(false);
  const [externalWindow, setExternalWindow] = useState(null);
  const [containerElement, setContainerElement] = useState(null);
  const [windowDimensions, setWindowDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setWindowDimensions({ width: window.innerWidth, height: window.innerHeight });
    }
  }, []);

  useEffect(() => {
    if (detached && !externalWindow) {
      // Pop up a new window
      const newWindow = window.open('', '', 'width=450,height=500,resizable=yes,scrollbars=yes,left=100,top=100');
      
      if (newWindow) {
        newWindow.document.title = 'RealTime Transcription - Detached';
        newWindow.document.head.innerHTML = `
          <style>
            body { 
              margin: 0; 
              font-family: system-ui, -apple-system, sans-serif; 
              background: #f9fafb;
              padding: 0;
            }
            * { box-sizing: border-box; }
            .detached-container {
              background: white;
              border-radius: 0.75rem;
              box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
              margin: 1rem;
              padding: 1.5rem;
            }
          </style>
        `;
        
        const container = newWindow.document.createElement('div');
        container.className = 'detached-container';
        newWindow.document.body.appendChild(container);
        
        setExternalWindow(newWindow);
        setContainerElement(container);

        // Close handler
        newWindow.addEventListener('beforeunload', () => {
          setDetached(false);
          setExternalWindow(null);
          setContainerElement(null);
        });
      }
    }

    // Cleanup
    return () => {
      if (!detached && externalWindow) {
        externalWindow.close();
      }
    };
  }, [detached, externalWindow]);

  useEffect(() => {
    // Update parent component
    if (onDetachChange) {
      onDetachChange(detached);
    }
  }, [detached, onDetachChange]);

  const handleDetachToggle = () => {
    if (detached && externalWindow) {
      externalWindow.close();
      setExternalWindow(null);
      setContainerElement(null);
    }
    setDetached(!detached);
  };

  // The detach button
  const DetachButton = () => (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      marginBottom: '1rem' 
    }}>
      <button
        onClick={handleDetachToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.5rem 1rem',
          backgroundColor: detached ? '#ef4444' : '#3b82f6',
          color: 'white',
          fontSize: '0.875rem',
          fontWeight: '500',
          border: 'none',
          borderRadius: '0.375rem',
          cursor: 'pointer',
          transition: 'all 0.2s',
          boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
        }}
        onMouseOver={(e) => {
          e.target.style.backgroundColor = detached ? '#dc2626' : '#2563eb';
          e.target.style.transform = 'translateY(-1px)';
        }}
        onMouseOut={(e) => {
          e.target.style.backgroundColor = detached ? '#ef4444' : '#3b82f6';
          e.target.style.transform = 'translateY(0)';
        }}
      >
        <span>{detached ? '📎' : '🔗'}</span>
        <span>{detached ? 'Attach to Main Window' : 'Detach to Separate Window'}</span>
      </button>
    </div>
  );

  // What goes in the detached window (just transcription stuff)
  const detachedContent = (
    <div>
      <DetachButton />
      
      <div style={{
        padding: '1rem',
        backgroundColor: '#f8fafc',
        border: '2px solid #e2e8f0',
        borderRadius: '0.5rem',
        minHeight: '300px',
        maxHeight: '400px',
        overflowY: 'auto',
      }}>
        <div style={{ 
          fontWeight: '600', 
          marginBottom: '0.75rem', 
          color: '#1e293b',
          fontSize: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          📝 Live Transcription
          <span style={{
            fontSize: '0.75rem',
            backgroundColor: '#10b981',
            color: 'white',
            padding: '0.25rem 0.5rem',
            borderRadius: '9999px'
          }}>
            Detached Mode
          </span>
        </div>
        <div style={{ 
          whiteSpace: 'pre-wrap', 
          lineHeight: '1.6',
          color: '#334155',
          fontSize: '0.9rem',
          minHeight: '200px'
        }}>
          {transcription ? transcription : (
            <span style={{ color: '#64748b', fontStyle: 'italic' }}>
              Transcription will appear here when you start recording in the main window...
            </span>
          )}
        </div>
      </div>
      
      <div style={{
        marginTop: '1rem',
        padding: '0.75rem',
        backgroundColor: '#fef3c7',
        border: '1px solid #f59e0b',
        borderRadius: '0.5rem',
        fontSize: '0.875rem',
        color: '#92400e'
      }}>
        💡 <strong>Note:</strong> Control recording from the main browser window. This detached window shows live transcription only.
      </div>
    </div>
  );

  // AudioRecorder stays in main window, transcription goes to popup when detached
  return (
    <div>
      <DetachButton />
      {children}
      
      {/* Portal transcription to popup window */}
      {detached && externalWindow && containerElement && 
        ReactDOM.createPortal(detachedContent, containerElement)
      }
    </div>
  );
};

export default DetachableWrapper; 