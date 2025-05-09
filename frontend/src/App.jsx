// src/App.jsx
import React, { useState } from 'react';
import Piano from "./components/Piano";
import ResultPage from "./components/ResultPage";
import LoadingPage from "./components/LoadingPage";

function App() {
    // Possible states: 'piano', 'loading', 'result'
    const [currentPage, setCurrentPage] = useState('piano');
    const [enhancedAudioUrl, setEnhancedAudioUrl] = useState(null);
    const [originalNotes, setOriginalNotes] = useState([]);

    const handleMidiSaved = (notesFromPiano) => {
        console.log("MIDI Saved, transitioning to loading page. Received notes:", notesFromPiano);
        setOriginalNotes(notesFromPiano || []);
        setCurrentPage('loading');
    };

    const handleLoadingComplete = (success) => {
        if (success) {
            console.log("Loading complete, transitioning to result page");
            // In a real app, you'd set the actual enhanced audio URL here
            setEnhancedAudioUrl("path/to/enhanced/audio.wav");
            setCurrentPage('result');
        } else {
            // Handle any potential errors during the enhancement process
            console.error("Enhancement failed");
            // Could either stay on loading with an error message or go back to piano
            setCurrentPage('piano');
        }
    };

    const handleStartNew = () => {
        console.log("Starting New Enhancement, transitioning back to Piano Page");
        setCurrentPage('piano');
        setEnhancedAudioUrl(null);
        setOriginalNotes([]);
    };

    return (
        <>
            {currentPage === 'piano' && (
                <Piano onMidiSaved={handleMidiSaved} />
            )}
            {currentPage === 'loading' && (
                <LoadingPage 
                    onLoadingComplete={handleLoadingComplete} 
                    originalNotes={originalNotes}
                />
            )}
            {currentPage === 'result' && (
                <ResultPage
                    onStartNew={handleStartNew}
                    enhancedAudioUrl={enhancedAudioUrl}
                    originalNotes={originalNotes}
                />
            )}
        </>
    );
}

export default App;