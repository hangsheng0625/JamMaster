// src/components/UploadAudioPage.jsx
import React, { useState, useRef } from 'react';
import robot from '../assets/robot.png';
import '../styles/uploadAudio.css';

const UploadAudioPage = ({ onBack, onFileUploaded }) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef(null);

  // Supported file types
  const supportedTypes = ['audio/midi', 'audio/mid', 'audio/mpeg', 'audio/wav', 'audio/mp3'];
  const maxFileSize = 50 * 1024 * 1024; // 50MB in bytes

  const validateFile = (file) => {
    // Check file size
    if (file.size > maxFileSize) {
      return 'File size exceeds 50MB limit';
    }

    // Check file type
    const fileExtension = file.name.toLowerCase().split('.').pop();
    const validExtensions = ['mid', 'midi', 'mp3', 'wav'];
    
    if (!validExtensions.includes(fileExtension) && !supportedTypes.includes(file.type)) {
      return 'Unsupported file format. Please upload MP3, WAV, or MIDI files.';
    }

    return null;
  };

  const handleFileSelect = async (file) => {
    setUploadError('');
    
    const validationError = validateFile(file);
    if (validationError) {
      setUploadError(validationError);
      return;
    }

    setIsUploading(true);

    try {
      // Create file URL for preview
      const fileURL = URL.createObjectURL(file);
      
      // Simulate upload delay (remove this in production)
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Pass the file data to parent component
      onFileUploaded({
        file: file,
        name: file.name,
        size: file.size,
        type: file.type,
        url: fileURL
      });

    } catch (error) {
      setUploadError('Failed to upload file. Please try again.');
      console.error('Upload error:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleFileInputChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleChooseFile = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="upload-audio-container">
      <button className="back-button" onClick={onBack}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20,11V13H8L13.5,18.5L12.08,19.92L4.16,12L12.08,4.08L13.5,5.5L8,11H20Z" />
        </svg>
        Back
      </button>

      <div className="upload-audio-card">
        <div className="header">
          <h1>Upload Your Audio</h1>
          <p>Select or drag and drop your audio file to begin the enhancement process.</p>
        </div>

        <div className="ai-assistant">
          <img src={robot} alt="AI Assistant" />
        </div>

        <div className="upload-section">
          <div 
            className={`drop-zone ${isDragOver ? 'drag-over' : ''} ${isUploading ? 'uploading' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="drop-zone-content">
              {isUploading ? (
                <>
                  <div className="upload-spinner"></div>
                  <p>Uploading...</p>
                </>
              ) : (
                <>
                  <div className="upload-icon">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
                    </svg>
                  </div>
                  <button 
                    className="choose-file-button"
                    onClick={handleChooseFile}
                    disabled={isUploading}
                  >
                    Choose Audio File
                  </button>
                  <p className="drop-text">or drag and drop your file here</p>
                  <p className="supported-formats">Supported formats: MP3, WAV, MIDI</p>
                </>
              )}
            </div>
          </div>

          {uploadError && (
            <div className="error-message">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M13,13H11V7H13M13,17H11V15H13M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z" />
              </svg>
              {uploadError}
            </div>
          )}

          <div className="file-info">
            <p>Maximum file size: 50MB</p>
          </div>
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".mp3,.wav,.midi,.mid"
          onChange={handleFileInputChange}
          style={{ display: 'none' }}
        />

        {/* Decorative elements */}
        <div className="decorative-note left">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor" opacity="0.3">
            <path d="M12,3V13.55C11.41,13.21 10.73,13 10,13A4,4 0 0,0 6,17A4,4 0 0,0 10,21A4,4 0 0,0 14,17V7H18V3H12Z" />
          </svg>
        </div>

        <div className="decorative-note right">
          <svg width="60" height="60" viewBox="0 0 24 24" fill="currentColor" opacity="0.2">
            <path d="M12,3V13.55C11.41,13.21 10.73,13 10,13A4,4 0 0,0 6,17A4,4 0 0,0 10,21A4,4 0 0,0 14,17V7H18V3H12Z" />
          </svg>
        </div>
      </div>
    </div>
  );
};

export default UploadAudioPage;