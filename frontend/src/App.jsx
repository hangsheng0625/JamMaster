// src/App.jsx
import React, { useState } from 'react';
import InputMethodPage from './components/InputMethodPage';
import Piano from './components/Piano';
import UploadAudioPage from './components/UploadAudioPage';
import AudioPlayPage from './components/AudioPlayPage';
import LoadingPage from './components/LoadingPage'; // Assuming you have this
import ResultPage from './components/ResultPage';

const App = () => {
  // Page states
  const [currentPage, setCurrentPage] = useState('inputMethod'); // 'inputMethod', 'piano', 'upload', 'audioPlay', 'loading', 'results'
  
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
      // In a real app, you would get the actual enhanced audio URL from your backend
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
      // Here you would call your backend API to process the uploaded file
      // For now, we'll simulate the process
      
      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // In a real app, you would get the actual enhanced audio URL from your backend
      setEnhancedAudioUrl('/path/to/enhanced/audio.wav');
      setCurrentPage('results');
      
    } catch (error) {
      console.error('Error generating music:', error);
      // Handle error - maybe show an error page or go back to audioPlay
      setCurrentPage('audioPlay');
    }
  };

  // Handle starting new enhancement
  const handleStartNew = () => {
    // Reset all states
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