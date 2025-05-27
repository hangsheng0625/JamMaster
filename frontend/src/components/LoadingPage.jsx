// src/components/LoadingPage.jsx
import React, { useState, useEffect } from 'react';
import robot from "../assets/robot.png";
import "../styles/loadingPage.css";

const LoadingPage = ({ onLoadingComplete, originalNotes }) => {
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('Starting enhancement...');

  // Remove the existing useEffect and add this
  useEffect(() => {
    if (isIndeterminate) return; // Don't start timer
    
    // Original interval setup...
  }, [isIndeterminate, onLoadingComplete]);

  return (
    <div className="loading-card">
    <h1>Enhancing Your Audio</h1>
    
    <div className="robot-container">
        <img src={robot} alt="AI Assistant" className="robot-image" />
        <div className="music-notes">
        <span className="music-note">♪</span>
        <span className="music-note">♫</span>
        <span className="music-note">♩</span>
        <span className="music-note">♬</span>
        </div>
    </div>
    
    <p className="status-message">{statusMessage}</p>
    
    <div className="progress-container">
      {isIndeterminate ? (
      <div className="indeterminate-loader"></div>
        ) : (
        <div>
          <div className="progress-bar">
          <div 
              className="progress-fill" 
              style={{ width: `${progress}%` }}
          ></div>
          </div>
          <p className="progress-text">{Math.round(progress)}% Complete</p>
        </div>)}
    </div>
    
    <p className="waiting-message">Please wait while we process your audio</p>
    </div>
  );
};

export default LoadingPage;