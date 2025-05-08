// src/App.jsx
import React, { useState } from 'react';
import Piano from "./components/Piano";
import ResultPage from "./components/ResultPage";

function App() {
    const [currentPage, setCurrentPage] = useState('piano');
    const [enhancedAudioUrl, setEnhancedAudioUrl] = useState(null);
    const [originalNotes, setOriginalNotes] = useState([]); // State for original notes

    const handleMidiSaved = (notesFromPiano) => { // Receive notes
        console.log("MIDI Saved, transitioning. Received notes:", notesFromPiano);
        setOriginalNotes(notesFromPiano || []); // Store the notes
        // Example: setEnhancedAudioUrl('path/to/your/enhanced/audio.wav');
        setCurrentPage('result');
    };

    const handleStartNew = () => {
        console.log("Starting New Enhancement, transitioning back to Piano Page");
        setCurrentPage('piano');
        setEnhancedAudioUrl(null);
        setOriginalNotes([]); // Clear notes when starting new
    };

    return (
        <>
            {currentPage === 'piano' && (
                <Piano onMidiSaved={handleMidiSaved} />
            )}
            {currentPage === 'result' && (
                <ResultPage
                    onStartNew={handleStartNew}
                    enhancedAudioUrl={enhancedAudioUrl}
                    originalNotes={originalNotes} // Pass notes down
                />
            )}
        </>
    );
}

export default App;