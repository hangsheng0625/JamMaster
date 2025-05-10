 // src/components/Piano.jsx
 import React, { useState, useEffect, useRef } from 'react';
 import * as Tone from 'tone';
 import robot from "../assets/robot.png"
 import recording from "../assets/recording_icon.png"
 import stopRecording from "../assets/stop-recording.png"
 import "../styles/piano.css"

 // ... (keep noteToMidiNumber and createSimpleMidiFile functions as they are) ...
 const noteToMidiNumber = (noteName) => {
     // ... (implementation)
     const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
     const matches = noteName.match(/^([A-G]#?)(\d+)$/);
     if (!matches) return 60;
     const [, note, octave] = matches;
     const noteIndex = notes.indexOf(note);
     return noteIndex + 12 * (parseInt(octave) + 1);
 };

 const createSimpleMidiFile = (recordedNotes) => {
     // ... (implementation - no changes needed here)
     const midiArray = [0x4D, 0x54, 0x68, 0x64, 0x00, 0x00, 0x00, 0x06, 0x00, 0x00, 0x00, 0x01, 0x00, 0x60, 0x4D, 0x54, 0x72, 0x6B, 0x00, 0x00, 0x00, 0x00];
     const trackLengthPos = midiArray.length - 4;
     const trackStartPos = midiArray.length;
     midiArray.push(0x00, 0xFF, 0x51, 0x03, 0x07, 0xA1, 0x20);
     midiArray.push(0x00, 0xC0, 0x00);
     if (recordedNotes.length > 0) {
         const sortedNotes = [...recordedNotes].sort((a, b) => a.timestamp - b.timestamp);
         let currentTime = 0;
         sortedNotes.forEach(note => {
             const noteNum = noteToMidiNumber(note.note);
             const deltaOn = Math.max(0, Math.round((note.timestamp - currentTime) / 10));
             midiArray.push(deltaOn);
             midiArray.push(0x90, noteNum, 0x64);
             currentTime = note.timestamp;
             const deltaOff = Math.max(1, Math.round(note.duration / 10));
             midiArray.push(deltaOff);
             midiArray.push(0x80, noteNum, 0x00);
             currentTime += note.duration;
         });
     }
     midiArray.push(0x00, 0xFF, 0x2F, 0x00);
     const trackLength = midiArray.length - trackStartPos;
     midiArray[trackLengthPos] = (trackLength >> 24) & 0xFF;
     midiArray[trackLengthPos + 1] = (trackLength >> 16) & 0xFF;
     midiArray[trackLengthPos + 2] = (trackLength >> 8) & 0xFF;
     midiArray[trackLengthPos + 3] = trackLength & 0xFF;
     return new Uint8Array(midiArray);
 };


 // Add onMidiSaved to the props
 const Piano = ({ onMidiSaved }) => {
   const [isRecording, setIsRecording] = useState(false);
   const [isPlaying, setIsPlaying] = useState(false);
   const [recordedNotes, setRecordedNotes] = useState([]);
   const [startTime, setStartTime] = useState(null);
   const [activeKeys, setActiveKeys] = useState({});

   const mouseNotesRef = useRef({});
   const synthRef = useRef(null);

   const keyMap = {
     'q': 'C4', 'w': 'D4', 'e': 'E4', 'r': 'F4', 't': 'G4', 'y': 'A4', 'u': 'B4',
     'i': 'C5', 'o': 'D5', 'p': 'E5', 'z': 'F5', 'x': 'G5', 'c': 'A5', 'v': 'B5',
     '0': 'D#5', '2': 'C#4', '3': 'D#4', '5': 'F#4', '6': 'G#4', '7': 'A#4', '9': 'C#5',
     's': 'F#5', 'd': 'G#5', 'f': 'A#5'
   };

   useEffect(() => {
     synthRef.current = new Tone.PolySynth(Tone.Synth).toDestination();
     return () => {
       if (synthRef.current) {
         synthRef.current.dispose();
       }
     };
   }, []);

   const startAudio = () => {
     if (Tone.context.state !== 'running') {
       Tone.start().then(() => {
         console.log('AudioContext started successfully');
       }).catch(e => {
         console.error("Error starting AudioContext:", e);
       });
     }
   };

   // ... (keep recordNoteStart, recordNoteEnd, handleKeyDown, handleKeyUp, playNote, stopNote functions as they are) ...
     const recordNoteStart = (key) => {
         if (!isRecording || !startTime) return;
         const currentTime = Date.now();
         const timestamp = currentTime - startTime;
         setRecordedNotes(prev => [
             ...prev,
             { note: keyMap[key], key, timestamp, duration: 0, id: `${key}-${currentTime}` }
         ]);
         mouseNotesRef.current[key] = currentTime;
     };

     const recordNoteEnd = (key) => {
         if (!isRecording || !startTime) return;
         const releaseTime = Date.now() - startTime;
         setRecordedNotes(prev =>
             prev.map(note => {
                 // Find the most recent note for this key that hasn't ended yet
                 if (note.key === key && note.duration === 0 && prev.filter(n => n.key === key && n.duration === 0).length === 1) {
                      // Calculate duration, ensure it's non-negative
                      const duration = Math.max(0, releaseTime - note.timestamp);
                      return { ...note, duration: duration };
                 }
                 return note;
             }).filter(note => note.id) // Ensure notes have IDs, removes potential duplicates if logic had issues
         );
          // Clear from mouse tracking *after* updating state
          // Check if the key exists before deleting
         if (mouseNotesRef.current.hasOwnProperty(key)) {
             delete mouseNotesRef.current[key];
         }
     };

     useEffect(() => {
         const handleKeyDown = (e) => {
             const key = e.key.toLowerCase();
             if (e.repeat || !(key in keyMap)) return; // Ignore repeats and non-mapped keys

             startAudio();
             if (!activeKeys[key]) { // Play only if not already active
                 playNote(key);
                 setActiveKeys(prev => ({ ...prev, [key]: true }));
                 if (isRecording) {
                     recordNoteStart(key);
                 }
             }
         };

         const handleKeyUp = (e) => {
             const key = e.key.toLowerCase();
             if (!(key in keyMap)) return;

             if (activeKeys[key]) { // Stop only if it was active
                 stopNote(key);
                  // Update the duration if recording
                 if (isRecording) {
                     // Ensure the note started while recording
                     const noteStartedDuringRecording = recordedNotes.some(n => n.key === key && n.timestamp >= 0 && n.duration === 0);
                     if (noteStartedDuringRecording) {
                          recordNoteEnd(key);
                     }
                 }
                 setActiveKeys(prev => {
                     const newActiveKeys = { ...prev };
                     delete newActiveKeys[key];
                     return newActiveKeys;
                 });
             }
         };

         window.addEventListener('keydown', handleKeyDown);
         window.addEventListener('keyup', handleKeyUp);

         return () => {
             window.removeEventListener('keydown', handleKeyDown);
             window.removeEventListener('keyup', handleKeyUp);
         };
          // Include activeKeys in dependency array to correctly handle state inside handlers
         }, [isRecording, startTime, keyMap, activeKeys, recordedNotes]);

      const playNote = (key) => {
         startAudio();
         const note = keyMap[key];
         if (synthRef.current) {
             synthRef.current.triggerAttack(note);
         }
     };

     const stopNote = (key) => {
         const note = keyMap[key];
         if (synthRef.current) {
             // Check if the note is actually playing before releasing
             // Note: Tone.js PolySynth doesn't directly expose active voices easily.
             // We rely on our activeKeys state for visual, but triggerRelease is generally safe.
             synthRef.current.triggerRelease(note);
         }
     };


   const toggleRecording = () => {
     startAudio(); // Ensure audio is ready
     if (!isRecording) {
       setRecordedNotes([]);
       setStartTime(Date.now());
       setIsRecording(true);
       mouseNotesRef.current = {}; // Reset mouse notes tracking
       setActiveKeys({}); // Reset active keys visually when starting recording
     } else {
       setIsRecording(false);
        // Ensure any held keys at the moment recording stops are finalized
        Object.keys(activeKeys).forEach(key => {
            if (keyMap[key]) { // Check if it's a piano key
                recordNoteEnd(key); // Finalize duration for keys held when stopping
            }
        });
       console.log("Recording stopped. Final notes:", recordedNotes); // Log might show state before final updates
     }
   };

   const playRecording = () => {
     startAudio();
     setIsPlaying(true);
     setActiveKeys({}); // Clear current visual active keys before playback

     const now = Tone.now();
     let maxEndTime = 0;

     // Use a fresh copy of notes for playback scheduling
     const notesToPlay = [...recordedNotes];

     notesToPlay.forEach(note => {
        // Only play notes with a positive duration
         if (note.duration > 0 && note.timestamp >= 0) {
             const startTimeSec = now + note.timestamp / 1000;
             const durationSec = note.duration / 1000;
             const noteEndTime = note.timestamp + note.duration;
             if (noteEndTime > maxEndTime) {
                 maxEndTime = noteEndTime;
             }

             try {
                 synthRef.current.triggerAttackRelease(
                     note.note,
                     durationSec,
                     startTimeSec
                 );

                 // Visual feedback scheduling
                 setTimeout(() => {
                     setActiveKeys(prev => ({ ...prev, [note.key]: true }));
                 }, note.timestamp);

                 setTimeout(() => {
                     setActiveKeys(prev => {
                         const newKeys = { ...prev };
                         delete newKeys[note.key];
                         return newKeys;
                     });
                 }, noteEndTime); // Use calculated end time
              } catch (error) {
                  console.error(`Error scheduling note ${note.note}:`, error);
              }
         } else {
             console.warn("Skipping note with invalid duration or timestamp:", note);
         }
     });

     // Set timeout to end playback state slightly after the last note finishes
     setTimeout(() => {
         setIsPlaying(false);
         setActiveKeys({}); // Ensure all keys are visually off after playback
     }, maxEndTime + 200); // Add a small buffer
   };

  const saveMidiRecording = () => {
    // Filter out notes with zero or negative duration before saving
    const validNotes = recordedNotes.filter(note => note.duration > 0 && note.timestamp >= 0);

    if (validNotes.length === 0) {
        alert("No valid notes recorded! Play some notes before saving.");
        return;
    }

    // ... (MIDI generation and download logic) ...
      console.log(`MIDI file generated with ${validNotes.length} notes`);

    // --- !!! TRIGGER PAGE CHANGE HERE !!! ---
    if (onMidiSaved) {
      // Pass the valid notes to the App component
      onMidiSaved(validNotes); // MODIFIED LINE
    }
    // --- !!! END TRIGGER !!! ---
    const midiData = createSimpleMidiFile(recordedNotes);
    
    // Create a Blob and download link
    const blob = new Blob([midiData], { type: 'audio/midi' });
    const url = URL.createObjectURL(blob);
    
    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = `piano-recording-${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.mid`;
    
    // Trigger download
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    
    // Clean up blob URL
    setTimeout(() => URL.revokeObjectURL(url), 100);
    
    console.log(`MIDI file saved with ${recordedNotes.length} notes`);
  };

   // --- Render Piano Key Function ---
   // Add onMouseDown/Up/Leave handlers directly here for clarity
    const renderPianoKey = (keyLabel, note, isBlack = false) => {
     const key = keyLabel.toLowerCase();
     const isActive = activeKeys[key];

     const handlePress = () => {
         startAudio();
         if (!activeKeys[key]) { // Prevent re-triggering if already active
             playNote(key);
             setActiveKeys(prev => ({ ...prev, [key]: true }));
             if (isRecording) {
                 recordNoteStart(key);
                 mouseNotesRef.current[key] = Date.now(); // Track mouse/touch start time
             }
         }
     };

     const handleRelease = () => {
         if (activeKeys[key]) { // Release only if active
             stopNote(key);
             // Use the tracked mouse/touch time for recording end
             if (isRecording && mouseNotesRef.current[key]) {
                  recordNoteEnd(key); // recordNoteEnd uses Date.now() internally
                  delete mouseNotesRef.current[key]; // Clean up tracked key
             }
             setActiveKeys(prev => {
                 const newActiveKeys = { ...prev };
                 delete newActiveKeys[key];
                 return newActiveKeys;
             });
         }
     };

     return (
         <div
             className={`piano-key ${isBlack ? 'black-key' : 'white-key'} ${isActive ? 'active' : ''}`}
             data-note={note}
             key={keyLabel}
             // Mouse Events
             onMouseDown={handlePress}
             onMouseUp={handleRelease}
             onMouseLeave={handleRelease} // Release if mouse leaves while pressed
             // Touch Events (basic support)
             onTouchStart={(e) => {
                 e.preventDefault(); // Prevent default touch behavior like scrolling
                 handlePress();
             }}
             onTouchEnd={(e) => {
                 e.preventDefault();
                 handleRelease();
             }}
              onTouchCancel={(e) => { // Handle interruption
                 e.preventDefault();
                 handleRelease();
              }}
         >
             <span className="key-label">{keyLabel}</span>
             <span className="note-label">{note}</span>
         </div>
     );
 };


   return (
     <div className="virtual-piano-container">
       <div className="header">
         <h1>Virtual Piano Studio</h1>
         <p>Play, record, and let AI enhance your music</p>
       </div>

       <div className="ai-assistant">
         <img src={robot} alt="AI Assistant" />
       </div>

       <button
         className={`recording-button ${isRecording ? 'recording' : ''}`}
         onClick={toggleRecording} // Simplified onClick
       >
         <img src={isRecording ? stopRecording : recording} alt={isRecording ? "Stop icon" : "Record icon"} />
         {isRecording ? 'Stop Recording' : 'Start Recording'}
       </button>

       <div className="piano-container">
         {/* White keys */}
         <div className="white-keys">
           {renderPianoKey('Q', 'C4')}
           {renderPianoKey('W', 'D4')}
           {renderPianoKey('E', 'E4')}
           {renderPianoKey('R', 'F4')}
           {renderPianoKey('T', 'G4')}
           {renderPianoKey('Y', 'A4')}
           {renderPianoKey('U', 'B4')}
           {renderPianoKey('I', 'C5')}
           {renderPianoKey('O', 'D5')}
           {renderPianoKey('P', 'E5')}
           {renderPianoKey('Z', 'F5')}
           {renderPianoKey('X', 'G5')}
           {renderPianoKey('C', 'A5')}
           {renderPianoKey('V', 'B5')}
         </div>

         {/* Black keys */}
         <div className="black-keys">
           {renderPianoKey('2', 'C#4', true)}
           {renderPianoKey('3', 'D#4', true)}
           {renderPianoKey('5', 'F#4', true)}
           {renderPianoKey('6', 'G#4', true)}
           {renderPianoKey('7', 'A#4', true)}
           {renderPianoKey('9', 'C#5', true)}
           {renderPianoKey('0', 'D#5', true)}
           {renderPianoKey('S', 'F#5', true)}
           {renderPianoKey('D', 'G#5', true)}
           {renderPianoKey('F', 'A#5', true)}
         </div>
       </div>

       {isRecording && startTime && (
         <div className="recording-indicator">
           {/* Calculate elapsed time safely */}
           Recording... {Math.max(0, Math.floor((Date.now() - startTime) / 1000))}s
         </div>
       )}

      {/* Show controls only if not recording AND there are notes */}
       {!isRecording && recordedNotes.length > 0 && (
         <div className="recording-controls">
           <h3>Your Recording</h3>
            {/* Filter for valid notes before displaying count */}
            <p>{recordedNotes.filter(n => n.duration > 0).length} notes recorded</p>
           <div className="control-buttons">
             <button
               className="play-button"
               onClick={playRecording}
               disabled={isPlaying}
             >
               {isPlaying ? 'Playing...' : 'Play Recording'}
             </button>
             <button className="save-button" onClick={saveMidiRecording}>
               Generate
             </button>
           </div>
         </div>
       )}
     </div>
   );
 };

 export default Piano;