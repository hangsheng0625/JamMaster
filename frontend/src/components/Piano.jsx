import React, { useState, useEffect, useRef } from 'react';
import * as Tone from 'tone';
import robot from "../assets/robot.png"
import recording from "../assets/recording_icon.png"
import stopRecording from "../assets/stop-recording.png"
import "../styles/piano.css"

// Function to convert note name to MIDI note number
const noteToMidiNumber = (noteName) => {
  const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  
  // Extract note name and octave
  const matches = noteName.match(/^([A-G]#?)(\d+)$/);
  if (!matches) return 60; // Default to C4 if invalid note
  
  const [, note, octave] = matches;
  
  // Calculate MIDI note number
  const noteIndex = notes.indexOf(note);
  return noteIndex + 12 * (parseInt(octave) + 1);
};

const createSimpleMidiFile = (recordedNotes) => {
  // MIDI file structure
  const midiArray = [
    // MIDI header chunk
    0x4D, 0x54, 0x68, 0x64, // MThd
    0x00, 0x00, 0x00, 0x06, // Header length (6 bytes)
    0x00, 0x00, // Format (0 = single track)
    0x00, 0x01, // Number of tracks (1)
    0x00, 0x60, // Division (96 ticks per quarter note - simpler timing)
    
    // Track chunk
    0x4D, 0x54, 0x72, 0x6B, // MTrk
    0x00, 0x00, 0x00, 0x00, // Track length (placeholder)
  ];
  
  const trackLengthPos = midiArray.length - 4;
  const trackStartPos = midiArray.length;
  
  // Add track events
  
  // Set tempo (120 BPM)
  midiArray.push(
    0x00, // Delta time
    0xFF, 0x51, 0x03, // Meta event: tempo
    0x07, 0xA1, 0x20  // Tempo value (500,000 microseconds per quarter note)
  );
  
  // Program change: set instrument to acoustic grand piano
  midiArray.push(
    0x00, // Delta time
    0xC0, 0x00 // Channel 1, Program 0 (piano)
  );
  
  // Process notes (simplified)
  if (recordedNotes.length > 0) {
    // Sort notes by start time
    const sortedNotes = [...recordedNotes].sort((a, b) => a.timestamp - b.timestamp);
    
    let currentTime = 0;
    
    // Create note on/off events
    sortedNotes.forEach(note => {
      // Convert note name to MIDI note number
      const noteNum = noteToMidiNumber(note.note);
      
      // Delta time for note on (time since last event)
      const deltaOn = Math.max(0, Math.round((note.timestamp - currentTime) / 10));
      
      // Add delta time bytes (simplified for clarity)
      midiArray.push(deltaOn);
      
      // Note on event
      midiArray.push(0x90, noteNum, 0x64); // Note on, note number, velocity 100
      
      // Update current time
      currentTime = note.timestamp;
      
      // Delta time for note off
      const deltaOff = Math.max(1, Math.round(note.duration / 10)); // Ensure non-zero duration
      
      // Add delta time bytes
      midiArray.push(deltaOff);
      
      // Note off event
      midiArray.push(0x80, noteNum, 0x00); // Note off, note number, velocity 0
      
      // Update current time
      currentTime += note.duration;
    });
  }
  
  // End of track
  midiArray.push(0x00, 0xFF, 0x2F, 0x00);
  
  // Calculate and update track length
  const trackLength = midiArray.length - trackStartPos;
  midiArray[trackLengthPos] = (trackLength >> 24) & 0xFF;
  midiArray[trackLengthPos + 1] = (trackLength >> 16) & 0xFF;
  midiArray[trackLengthPos + 2] = (trackLength >> 8) & 0xFF;
  midiArray[trackLengthPos + 3] = trackLength & 0xFF;
  
  return new Uint8Array(midiArray);
};

const Piano = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordedNotes, setRecordedNotes] = useState([]);
  const [startTime, setStartTime] = useState(null);
  const [activeKeys, setActiveKeys] = useState({});
  
  // Track mouse-played notes
  const mouseNotesRef = useRef({});
  
  const synthRef = useRef(null);
  
  // Map of keyboard keys to piano notes
  const keyMap = {
    'q': 'C4', 'w': 'D4', 'e': 'E4', 'r': 'F4', 't': 'G4', 'y': 'A4', 'u': 'B4',
    'i': 'C5', 'o': 'D5', 'p': 'E5', 'z': 'F5', 'x': 'G5', 'c': 'A5', 'v': 'B5',
    '0': 'D#5', '2': 'C#4', '3': 'D#4', '5': 'F#4', '6': 'G#4', '7': 'A#4', '9': 'C#5', 
    's': 'F#5', 'd': 'G#5', 'f': 'A#5'
  };
  
  // Initialize Tone.js
  useEffect(() => {
    // Don't start AudioContext here
    synthRef.current = new Tone.PolySynth(Tone.Synth).toDestination();
    
    // The rest of your cleanup code...
    return () => {
      if (synthRef.current) {
        synthRef.current.dispose();
      }
    };
  }, []);

  // Create a function to start audio on user interaction
  const startAudio = () => {
    if (Tone.context.state !== 'running') {
      Tone.start();
      console.log('AudioContext started successfully');
    }
  };
  
  // Record note start - used by both keyboard and mouse
  const recordNoteStart = (key) => {
    if (!isRecording) return;
    
    const currentTime = Date.now();
    const timestamp = currentTime - startTime;
    
    // Add to recorded notes with zero duration initially
    setRecordedNotes(prev => [
      ...prev, 
      { note: keyMap[key], key, timestamp, duration: 0, id: `${key}-${currentTime}` }
    ]);
    
    // For mouse interactions, keep track of which note was started
    mouseNotesRef.current[key] = currentTime;
  };
  
  // Record note end - used by both keyboard and mouse
  const recordNoteEnd = (key) => {
    if (!isRecording) return;
    
    const releaseTime = Date.now() - startTime;
    
    // Find the most recent note with this key and update its duration
    setRecordedNotes(prev => 
      prev.map(note => {
        if (note.key === key && note.duration === 0) {
          return { ...note, duration: releaseTime - note.timestamp };
        }
        return note;
      })
    );
    
    // Clear from mouse tracking
    delete mouseNotesRef.current[key];
  };
  
  // Handle keyboard events
  useEffect(() => {
    const handleKeyDown = (e) => {
      const key = e.key.toLowerCase();
      
      // Start audio if needed
      startAudio();
      
      // Prevent repeating keys when held down
      if (e.repeat) return;
      
      if (key in keyMap) {
        // Play the note
        playNote(key);
        
        // Record the note if recording is active
        if (isRecording) {
          recordNoteStart(key);
        }
        
        // Set the key as active
        setActiveKeys(prev => ({ ...prev, [key]: true }));
      }
    };
    
    const handleKeyUp = (e) => {
      const key = e.key.toLowerCase();
      
      if (key in keyMap) {
        // Stop the note
        stopNote(key);
        
        // Update the duration if recording
        if (isRecording) {
          recordNoteEnd(key);
        }
        
        // Remove key from active keys
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
  }, [isRecording, startTime, keyMap]);
  
  // Play a note
  const playNote = (key) => {
    startAudio(); // Ensure audio context is running
    
    const note = keyMap[key];
    if (synthRef.current) {
      synthRef.current.triggerAttack(note);
    }
  };
  
  // Stop a note
  const stopNote = (key) => {
    const note = keyMap[key];
    if (synthRef.current) {
      synthRef.current.triggerRelease(note);
    }
  };
  
  // Toggle recording state
  const toggleRecording = () => {
    if (!isRecording) {
      // Start recording
      setRecordedNotes([]);
      setStartTime(Date.now());
      setIsRecording(true);
      mouseNotesRef.current = {}; // Reset mouse notes tracking
    } else {
      // Stop recording
      setIsRecording(false);
      console.log("Recording stopped. Recorded notes:", recordedNotes);
    }
  };
  
  // Play back the recording
  const playRecording = () => {
    startAudio(); // Ensure audio context is running
    
    // Schedule all notes to play at the right time
    const now = Tone.now();
    
    // Create a visual indicator for playback
    setIsPlaying(true);
    
    recordedNotes.forEach(note => {
      if (note.duration > 0) {
        // Schedule note to play at the right time
        synthRef.current.triggerAttackRelease(
          note.note,
          note.duration / 1000,
          now + (note.timestamp / 1000)
        );
        
        // Show visual feedback for the key press
        setTimeout(() => {
          setActiveKeys(prev => ({ ...prev, [note.key]: true }));
        }, note.timestamp);
        
        // Remove visual feedback after duration
        setTimeout(() => {
          setActiveKeys(prev => {
            const newKeys = { ...prev };
            delete newKeys[note.key];
            return newKeys;
          });
        }, note.timestamp + note.duration);
      }
    });
    
    // End playback indicator
    const lastNote = recordedNotes.reduce((latest, note) => {
      const endTime = note.timestamp + note.duration;
      return endTime > latest ? endTime : latest;
    }, 0);
    
    setTimeout(() => {
      setIsPlaying(false);
    }, lastNote + 100);
  };
  
  const saveMidiRecording = () => {
    // Check if we have notes to save
    if (recordedNotes.length === 0) {
      alert("No notes recorded! Play some notes before saving.");
      return;
    }
    
    // Generate simplified MIDI file content
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
  
  // Render piano key
  const renderPianoKey = (keyLabel, note, isBlack = false) => {
    const key = keyLabel.toLowerCase();
    const isActive = activeKeys[key];
    
    return (
      <div 
        className={`piano-key ${isBlack ? 'black-key' : 'white-key'} ${isActive ? 'active' : ''}`}
        data-note={note}
        key={keyLabel}
        onMouseDown={() => {
          // Start audio
          startAudio();
          
          // Play the note
          playNote(key);
          
          // Record the note if recording is active
          if (isRecording) {
            recordNoteStart(key);
          }
          
          // Set the key as active
          setActiveKeys(prev => ({ ...prev, [key]: true }));
        }}
        onMouseUp={() => {
          // Stop the note
          stopNote(key);
          
          // Record note end if recording is active
          if (isRecording && mouseNotesRef.current[key]) {
            recordNoteEnd(key);
          }
          
          // Set the key as inactive
          setActiveKeys(prev => {
            const newActiveKeys = { ...prev };
            delete newActiveKeys[key];
            return newActiveKeys;
          });
        }}
        onMouseLeave={() => {
          if (activeKeys[key]) {
            // Stop the note
            stopNote(key);
            
            // Record note end if recording is active
            if (isRecording && mouseNotesRef.current[key]) {
              recordNoteEnd(key);
            }
            
            // Set the key as inactive
            setActiveKeys(prev => {
              const newActiveKeys = { ...prev };
              delete newActiveKeys[key];
              return newActiveKeys;
            });
          }
        }}
        onTouchStart={() => {
          // For mobile support
          startAudio();
          playNote(key);
          if (isRecording) {
            recordNoteStart(key);
          }
          setActiveKeys(prev => ({ ...prev, [key]: true }));
        }}
        onTouchEnd={() => {
          // For mobile support
          stopNote(key);
          if (isRecording && mouseNotesRef.current[key]) {
            recordNoteEnd(key);
          }
          setActiveKeys(prev => {
            const newActiveKeys = { ...prev };
            delete newActiveKeys[key];
            return newActiveKeys;
          });
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
        onClick={() => {
          startAudio(); // Start audio context first
          toggleRecording(); // Then toggle recording
        }}
      >
        <img src={isRecording ? stopRecording : recording} alt="Recording icon" />
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
      
      {isRecording && (
        <div className="recording-indicator">
          Recording... {Math.floor((Date.now() - startTime) / 1000)}s
        </div>
      )}
      
      {recordedNotes.length > 0 && !isRecording && (
        <div className="recording-controls">
          <h3>Your Recording</h3>
          <p>{recordedNotes.length} notes recorded</p>
          <div className="control-buttons">
            <button 
              className="play-button" 
              onClick={playRecording}
              disabled={isPlaying}
            >
              {isPlaying ? 'Playing...' : 'Play Recording'}
            </button>
            <button className="save-button" onClick={saveMidiRecording}>
              Save as MIDI
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Piano;