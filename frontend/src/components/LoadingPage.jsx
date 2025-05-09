// src/components/LoadingPage.jsx
import React, { useState, useEffect } from 'react';
import robot from "../assets/robot.png";
import "../styles/loadingPage.css";

const LoadingPage = ({ onLoadingComplete, originalNotes }) => {
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('Starting enhancement...');

  useEffect(() => {
    // Create an array of status messages to show during loading
    const statusMessages = [
      'Starting enhancement...',
      'Analyzing your melody...',
      'Creating harmony patterns...',
      'Generating accompaniment...',
      'Adding musical textures...',
      'Finalizing enhancement...'
    ];

    // Set interval to update progress bar
    const progressInterval = setInterval(() => {
      setProgress(prevProgress => {
        // Calculate new progress
        const newProgress = prevProgress + (100 / 15); // 15 seconds total
        
        // Update status message at certain progress points
        const messageIndex = Math.floor((newProgress / 100) * (statusMessages.length - 1));
        setStatusMessage(statusMessages[Math.min(messageIndex, statusMessages.length - 1)]);
        
        // Complete when we reach 100%
        if (newProgress >= 100) {
          clearInterval(progressInterval);
          setTimeout(() => {
            onLoadingComplete(true); // Signal completion to parent component
          }, 500); // Short delay to ensure progress bar shows 100%
          return 100;
        }
        
        return newProgress;
      });
    }, 1000); // Update every second
    
    // Clear interval on component unmount
    return () => clearInterval(progressInterval);
  }, [onLoadingComplete]);

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
        <div className="progress-bar">
        <div 
            className="progress-fill" 
            style={{ width: `${progress}%` }}
        ></div>
        </div>
        <p className="progress-text">{Math.round(progress)}% Complete</p>
    </div>
    
    <p className="waiting-message">Please wait while we process your audio</p>
    </div>
  );
};

export default LoadingPage;