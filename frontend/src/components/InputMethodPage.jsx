// src/components/InputMethodPage.jsx
import React from 'react';
import robot from '../assets/robot.png';
import '../styles/inputMethod.css';

const InputMethodPage = ({ onMethodSelect }) => {
  return (
    <div className="input-method-container">
      <div className="input-method-card">
        <div className="header">
          <h1>Choose Input Method</h1>
          <p>Select how you'd like to create music with JamMaster.</p>
        </div>

        <div className="ai-assistant">
          <img src={robot} alt="AI Assistant" />
        </div>

        <div className="method-options">
          <div 
            className="method-option"
            onClick={() => onMethodSelect('upload')}
          >
            <div className="method-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
                <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
              </svg>
            </div>
            <h3>Upload Audio File</h3>
            <p>Import existing audio files in MIDI format for AI analysis and enhancement.</p>
          </div>

          <div 
            className="method-option"
            onClick={() => onMethodSelect('piano')}
          >
            <div className="method-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
                <path d="M4,2H20A2,2 0 0,1 22,4V20A2,2 0 0,1 20,22H4A2,2 0 0,1 2,20V4A2,2 0 0,1 4,2M4,4V12H6V8H8V12H10V8H12V12H14V8H16V12H18V8H20V4H4M4,14V20H6V16H8V20H10V16H12V20H14V16H16V20H18V16H20V20H20V14H4Z" />
              </svg>
            </div>
            <h3>Virtual Piano</h3>
            <p>Play and record music in real-time using our interactive virtual piano interface.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InputMethodPage;