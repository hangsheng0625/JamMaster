// src/App.jsx
import React, { useState } from 'react';
import InputMethodPage from './components/InputMethodPage';
import Piano from './components/Piano';
import UploadAudioPage from './components/UploadAudioPage';
import AudioPlayPage from './components/AudioPlayPage';
import LoadingPage from './components/LoadingPage';
import ResultPage from './components/ResultPage';

const App = () => {
  // Page states
  const [currentPage, setCurrentPage] = useState('inputMethod');
  
  // Data states
  const [recordedNotes, setRecordedNotes] = useState([]);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [enhancedAudioUrl, setEnhancedAudioUrl] = useState(null);
  const [generationParams, setGenerationParams] = useState(null);

  // Handle method selection from input method page
  const handleMethodSelect = (method) => {
    if (method === 'piano') {
      setCurrentPage('piano');
    } else if (method === 'upload') {
      setCurrentPage('upload');
    }
  };

  // Handle piano MIDI generation
  const handlePianoMidiSaved = (notes) => {
    setRecordedNotes(notes);
    setCurrentPage('loading');
    
    // Simulate processing time and then go to results
    setTimeout(() => {
      setEnhancedAudioUrl('/path/to/enhanced/audio.wav');
      setCurrentPage('results');
    }, 3000);
  };

  // Handle file upload
  const handleFileUploaded = (fileData) => {
    setUploadedFile(fileData);
    setCurrentPage('audioPlay');
  };

  // Handle generate from audio play page
  const handleGenerateFromUpload = async (fileData, params) => {
    setGenerationParams(params);
    setCurrentPage('loading');
    
    try {
      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      setEnhancedAudioUrl('/path/to/enhanced/audio.wav');
      setCurrentPage('results');
      
    } catch (error) {
      console.error('Error generating music:', error);
      setCurrentPage('audioPlay');
    }
  };

  // Handle starting new enhancement
  const handleStartNew = () => {
    setRecordedNotes([]);
    setUploadedFile(null);
    setEnhancedAudioUrl(null);
    setGenerationParams(null);
    setCurrentPage('inputMethod');
  };

  // Handle back navigation
  const handleBack = () => {
    switch (currentPage) {
      case 'upload':
        setCurrentPage('inputMethod');
        break;
      case 'audioPlay':
        setCurrentPage('upload');
        break;
      case 'piano':
        setCurrentPage('inputMethod');
        break;
      case 'results':
        setCurrentPage('inputMethod');
        break;
      default:
        setCurrentPage('inputMethod');
    }
  };

  // Render the appropriate page based on current state
  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'inputMethod':
        return (
          <InputMethodPage 
            onMethodSelect={handleMethodSelect}
          />
        );

      case 'piano':
        return (
          <Piano 
            onMidiSaved={handlePianoMidiSaved}
            onBack={handleBack}
          />
        );

      case 'upload':
        return (
          <UploadAudioPage 
            onBack={handleBack}
            onFileUploaded={handleFileUploaded}
          />
        );

      case 'audioPlay':
        return (
          <AudioPlayPage 
            onBack={handleBack}
            uploadedFile={uploadedFile}
            onGenerate={handleGenerateFromUpload}
          />
        );

      case 'loading':
        return (
          <LoadingPage />
        );

      case 'results':
        return (
          <ResultPage 
            onStartNew={handleStartNew}
            enhancedAudioUrl={enhancedAudioUrl}
            originalNotes={recordedNotes} // Pass recorded notes for piano path
            uploadedFile={uploadedFile} // Pass uploaded file for upload path
          />
        );

      default:
        return (
          <InputMethodPage 
            onMethodSelect={handleMethodSelect}
          />
        );
    }
  };

  return (
    <div className="App">
      {renderCurrentPage()}
    </div>
  );
};

export default App;