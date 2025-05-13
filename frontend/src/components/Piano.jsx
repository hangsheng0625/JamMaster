// src/components/Piano.jsx
import React, { useState, useEffect, useRef } from 'react';
import * as Tone from 'tone';
import robot from "../assets/robot.png"
import recording from "../assets/recording_icon.png"
import stopRecording from "../assets/stop-recording.png"
import "../styles/piano.css"
import { fetchSanitizeAudio, fetchGenerate } from './api';

// Complete MIDI file generation with all necessary helper functions
/**
 * Convert a note name (e.g., "C4") to its MIDI note number
 * @param {string} noteName - The name of the note (e.g., "C4", "F#5")
 * @return {number} The MIDI note number
 */
const noteToMidiNumber = (noteName) => {
  if (!noteName || typeof noteName !== 'string') {
    throw new Error(`Invalid note name: ${noteName}`);
  }
  
  // Split the note into the note name and octave
  // Handle both "C4" format and "C-4" format
  const match = noteName.match(/^([A-G][#b]?)(-?\d+)$/i);
  if (!match) {
    throw new Error(`Invalid note format: ${noteName}`);
  }
  
  const note = match[1].toUpperCase();
  const octave = parseInt(match[2], 10);
  
  // Base values for MIDI notes
  const noteValues = {
    'C': 0, 'C#': 1, 'DB': 1, 'Db': 1,
    'D': 2, 'D#': 3, 'EB': 3, 'Eb': 3,
    'E': 4, 
    'F': 5, 'F#': 6, 'GB': 6, 'Gb': 6,
    'G': 7, 'G#': 8, 'AB': 8, 'Ab': 8,
    'A': 9, 'A#': 10, 'BB': 10, 'Bb': 10,
    'B': 11
  };
  
  if (!(note in noteValues)) {
    throw new Error(`Unknown note: ${note}`);
  }
  
  // MIDI note number calculation: (octave + 1) * 12 + noteValue
  // Middle C (C4) is MIDI note 60
  const midiNoteNumber = (octave + 1) * 12 + noteValues[note];
  
  // Validate the note is within MIDI range (0-127)
  if (midiNoteNumber < 0 || midiNoteNumber > 127) {
    throw new Error(`Note ${noteName} (${midiNoteNumber}) out of MIDI range (0-127)`);
  }
  
  return midiNoteNumber;
};

/**
 * Convert a number to a Variable Length Quantity (VLQ) for MIDI encoding
 * @param {number} num - The number to convert
 * @return {Array<number>} The VLQ as an array of bytes
 */
const numberToVLQ = (num) => {
  if (num < 0) {
    throw new Error(`Cannot convert negative number ${num} to VLQ`);
  }
  
  if (num === 0) {
    return [0];
  }
  
  const bytes = [];
  let value = num;
  
  // Extract 7 bits at a time, starting from the lowest bits
  while (value > 0) {
    // Take the lowest 7 bits and add them to our bytes
    bytes.unshift(value & 0x7F);
    // Shift right by 7 bits to process the next 7 bits
    value = value >> 7;
  }
  
  // All bytes except the last one need to have the high bit set
  for (let i = 0; i < bytes.length - 1; i++) {
    bytes[i] |= 0x80;
  }
  
  return bytes;
};

/**
 * Convert milliseconds to MIDI ticks with scaling for natural note durations
 * @param {number} ms - The time in milliseconds
 * @param {number} ppq - Pulses per quarter note
 * @param {number} timeFactor - Time factor for conversion (ms per beat)
 * @param {boolean} applyScaling - Whether to apply scaling to long durations
 * @return {number} MIDI ticks
 */
const msToTicks = (ms, ppq, timeFactor, applyScaling = false) => {
  // Apply scaling for note durations to make them more natural
  let scaledMs = ms;
  
  if (applyScaling && ms >= 1000) {
    // Logarithmic scaling for durations > 1 second
    // This creates a more natural feel for held notes
    scaledMs = 1000 + Math.log(ms - 999) * 300;
  }
  
  return Math.round(scaledMs / timeFactor * ppq);
};

/**
 * Create a MIDI file from recorded notes
 * @param {Array<Object>} recordedNotes - Array of note objects with note, timestamp, and duration
 * @return {Uint8Array} MIDI file data as a byte array
 */
const createSimpleMidiFile = (recordedNotes) => {
  console.log(`Creating MIDI file from ${recordedNotes.length} notes`);
  
  // Filter out invalid notes
  const validNotes = recordedNotes.filter(note => 
    note && 
    note.note && 
    typeof note.duration === 'number' && note.duration > 0 && 
    typeof note.timestamp === 'number' && note.timestamp >= 0
  );
  
  console.log(`Found ${validNotes.length} valid notes after filtering`);
  
  // Handle empty recording case
  if (validNotes.length === 0) {
    console.warn("No valid notes to create MIDI file");
    // Return a minimal valid MIDI file with no notes
    return new Uint8Array([
      0x4D, 0x54, 0x68, 0x64, // MThd header
      0x00, 0x00, 0x00, 0x06, // Header length (6 bytes)
      0x00, 0x01,             // Format 1 (multi-track, more compatible than format 0)
      0x00, 0x02,             // Number of tracks (2 - one for tempo, one for notes)
      0x01, 0xE0,             // Division (480 ticks per quarter note - more standard)
      
      // Track 1 - Tempo track
      0x4D, 0x54, 0x72, 0x6B, // MTrk header
      0x00, 0x00, 0x00, 0x14, // Track length (20 bytes)
      
      // Tempo event (120 BPM)
      0x00,                   // Delta time (0)
      0xFF, 0x51, 0x03,       // Meta event: Set Tempo (3 bytes)
      0x07, 0xA1, 0x20,       // Tempo value: 500,000 microseconds/quarter
      
      // Track name
      0x00,                   // Delta time (0)
      0xFF, 0x03, 0x05,       // Meta event: Track Name (5 bytes)
      0x54, 0x65, 0x6D, 0x70, 0x6F, // "Tempo"
      
      // End of track
      0x00,                   // Delta time (0)
      0xFF, 0x2F, 0x00,       // Meta event: End of Track
      
      // Track 2 - Empty note track
      0x4D, 0x54, 0x72, 0x6B, // MTrk header
      0x00, 0x00, 0x00, 0x04, // Track length (4 bytes)
      0x00, 0xFF, 0x2F, 0x00  // End of track event
    ]);
  }
  
  // Set up MIDI header - use format 1 which is more compatible
  const midiData = [
    // MIDI file header (MThd chunk)
    0x4D, 0x54, 0x68, 0x64,   // MThd
    0x00, 0x00, 0x00, 0x06,   // Header length (always 6)
    0x00, 0x01,               // Format 1 (multiple tracks, more standard)
    0x00, 0x02,               // Number of tracks (2 - one for tempo, one for notes)
    0x01, 0xE0,               // Division (480 ticks per quarter note - more standard)
    
    // Track 1 - Tempo and metadata track
    0x4D, 0x54, 0x72, 0x6B,   // MTrk
    0x00, 0x00, 0x00, 0x00    // Track length (placeholder to be filled later)
  ];
  
  // Store position of the first track length bytes for later update
  const track1LengthPos = midiData.length - 4;
  const track1StartPos = midiData.length;
  
  // Add track name
  midiData.push(0x00);                  // Delta time (0)
  midiData.push(0xFF, 0x03, 0x05);      // Meta event: Track Name (5 bytes)
  midiData.push(0x54, 0x65, 0x6D, 0x70, 0x6F); // "Tempo"
  
  // Add initial tempo metadata (120 BPM = 500,000 microseconds per quarter note)
  midiData.push(0x00);                  // Delta time (0)
  midiData.push(0xFF, 0x51, 0x03);      // Meta event: Tempo
  midiData.push(0x07, 0xA1, 0x20);      // Tempo value: 500,000 (0x07A120)
  
  // End of track 1
  midiData.push(0x00);                  // Delta time (0)
  midiData.push(0xFF, 0x2F, 0x00);      // Meta event: End of Track
  
  // Calculate and update track 1 length
  const track1Length = midiData.length - track1StartPos;
  midiData[track1LengthPos] = (track1Length >> 24) & 0xFF;
  midiData[track1LengthPos + 1] = (track1Length >> 16) & 0xFF;
  midiData[track1LengthPos + 2] = (track1Length >> 8) & 0xFF;
  midiData[track1LengthPos + 3] = track1Length & 0xFF;
  
  // Track 2 - Note data
  midiData.push(0x4D, 0x54, 0x72, 0x6B);  // MTrk
  midiData.push(0x00, 0x00, 0x00, 0x00);  // Track length (placeholder to be filled later)
  
  // Store position of the second track length bytes for later update
  const track2LengthPos = midiData.length - 4;
  const track2StartPos = midiData.length;
  
  // Add track name
  midiData.push(0x00);                  // Delta time (0)
  midiData.push(0xFF, 0x03, 0x05);      // Meta event: Track Name (5 bytes)
  midiData.push(0x50, 0x69, 0x61, 0x6E, 0x6F); // "Piano"
  
  // Add program change (instrument = piano)
  midiData.push(0x00);                  // Delta time (0)
  midiData.push(0xC0, 0x00);            // Program Change channel 0, program 0 (piano)
  
  // Prepare note events (both note-on and note-off)
  const events = [];
  
  // MIDI time factor - convert from ms to MIDI ticks
  // We're using 480 PPQ (ticks per quarter) at 120 BPM
  const PPQ = 480; // Pulses per quarter note
  const TIME_FACTOR = 500; // 500ms per beat at 120 BPM
  
  // Normalize timestamps - find the first timestamp to use as the origin
  let firstTimestamp = Number.MAX_SAFE_INTEGER;
  validNotes.forEach(note => {
    if (note.timestamp < firstTimestamp) {
      firstTimestamp = note.timestamp;
    }
  });
  
  // Process each note into note-on and note-off events
  validNotes.forEach(note => {
    try {
      // Convert note name to MIDI note number
      const noteNum = noteToMidiNumber(note.note);
      
      // Normalize the timestamp (subtract the first timestamp)
      const normalizedTimestamp = note.timestamp - firstTimestamp;
      
      // Convert timestamps to MIDI ticks
      const onTimeTicks = msToTicks(normalizedTimestamp, PPQ, TIME_FACTOR);
      
      // Apply scaling for the duration to prevent extremely long notes
      const offTimeTicks = onTimeTicks + msToTicks(note.duration, PPQ, TIME_FACTOR, true);
      
      // Create note-on event
      events.push({
        time: onTimeTicks,
        type: 'note-on',
        noteNum,
        velocity: 0x64  // 100 (medium-loud)
      });
      
      // Create note-off event
      events.push({
        time: offTimeTicks,
        type: 'note-off',
        noteNum,
        velocity: 0x00  // 0 (standard for note-off)
      });
    } catch (error) {
      console.error(`Error processing note:`, note, error);
    }
  });
  
  // Sort events strictly by time
  events.sort((a, b) => {
    // Primary sort by time
    if (a.time !== b.time) return a.time - b.time;
    
    // Secondary sort: note-offs before note-ons at the same timestamp
    // This avoids stuck notes when a note ends exactly when another begins
    if (a.type === 'note-off' && b.type === 'note-on') return -1;
    if (a.type === 'note-on' && b.type === 'note-off') return 1;
    
    // Tertiary sort by note number for consistent ordering
    return a.noteNum - b.noteNum;
  });
  
  // Process events into MIDI data with correct delta times
  let currentTime = 0;
  
  events.forEach(event => {
    // Calculate delta time (difference from the previous event)
    const deltaTime = Math.max(0, event.time - currentTime);
    currentTime = event.time;
    
    // Add delta time as Variable Length Quantity (VLQ)
    const deltaVLQ = numberToVLQ(deltaTime);
    midiData.push(...deltaVLQ);
    
    // Add event data
    if (event.type === 'note-on') {
      // Note-on event (0x90 = note on, channel 0)
      midiData.push(0x90, event.noteNum, event.velocity);
    } else {
      // Note-off event (0x80 = note off, channel 0)
      midiData.push(0x80, event.noteNum, event.velocity);
    }
  });
  
  // Add end-of-track event
  midiData.push(0x00);                 // Delta time (0)
  midiData.push(0xFF, 0x2F, 0x00);     // Meta event: End of Track
  
  // Calculate and update track 2 length
  const track2Length = midiData.length - track2StartPos;
  midiData[track2LengthPos] = (track2Length >> 24) & 0xFF;
  midiData[track2LengthPos + 1] = (track2Length >> 16) & 0xFF;
  midiData[track2LengthPos + 2] = (track2Length >> 8) & 0xFF;
  midiData[track2LengthPos + 3] = track2Length & 0xFF;
  
  console.log(`MIDI file created with ${track1Length + track2Length} bytes of track data`);
  
  return new Uint8Array(midiData);
};

// Piano component
const Piano = ({ onMidiSaved }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordedNotes, setRecordedNotes] = useState([]);
  const [startTime, setStartTime] = useState(null);
  const [activeKeys, setActiveKeys] = useState({});

  // Improved note tracking reference
  const activeNotesRef = useRef({
    // Structure: { keyName: { id: "noteId", startTime: timestamp } }
  });
  
  const synthRef = useRef(null);

  // Key mapping (keyboard key to note)
  const keyMap = {
    'q': 'C4', 'w': 'D4', 'e': 'E4', 'r': 'F4', 't': 'G4', 'y': 'A4', 'u': 'B4',
    'i': 'C5', 'o': 'D5', 'p': 'E5', 'z': 'F5', 'x': 'G5', 'c': 'A5', 'v': 'B5',
    '0': 'D#5', '2': 'C#4', '3': 'D#4', '5': 'F#4', '6': 'G#4', '7': 'A#4', '9': 'C#5',
    's': 'F#5', 'd': 'G#5', 'f': 'A#5'
  };

  // Initialize the synth
  useEffect(() => {
    // Create a new Tone.js polyphonic synth
    synthRef.current = new Tone.PolySynth(Tone.Synth).toDestination();
    
    // Clean up function to dispose of synth when component unmounts
    return () => {
      if (synthRef.current) {
        synthRef.current.dispose();
      }
    };
  }, []);

  // Start the audio context (needed for browser autoplay policies)
  const startAudio = () => {
    if (Tone.context.state !== 'running') {
      Tone.start().then(() => {
        console.log('AudioContext started successfully');
      }).catch(e => {
        console.error("Error starting AudioContext:", e);
      });
    }
  };

  // Improved note recording start function
  const recordNoteStart = (key) => {
    if (!isRecording || !startTime) return;
    
    const currentTime = Date.now();
    const timestamp = currentTime - startTime;
    const noteId = `${key}-${timestamp}-${Math.random().toString(36).substring(2, 7)}`;
    
    // Store new note with initial zero duration
    setRecordedNotes(prev => [
      ...prev,
      { 
        note: keyMap[key],
        key, 
        timestamp, 
        duration: 0, 
        id: noteId 
      }
    ]);
    
    // Store reference data for when the note ends
    activeNotesRef.current[key] = {
      id: noteId,
      startTime: currentTime
    };
  };

  // Improved note recording end function
  const recordNoteEnd = (key) => {
    if (!isRecording || !startTime || !activeNotesRef.current[key]) return;
    
    const { id, startTime: noteStartTime } = activeNotesRef.current[key];
    const releaseTime = Date.now();
    const noteDuration = Math.max(10, releaseTime - noteStartTime); // Min 10ms duration
    
    // Update the recorded note with its final duration
    setRecordedNotes(prev =>
      prev.map(note => {
        if (note.id === id) {
          return { 
            ...note, 
            duration: noteDuration 
          };
        }
        return note;
      })
    );
    
    // Clear from active notes tracking
    delete activeNotesRef.current[key];
  };

  // Keyboard event handling
  useEffect(() => {
    // Handle key down events
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

    // Handle key up events
    const handleKeyUp = (e) => {
      const key = e.key.toLowerCase();
      if (!(key in keyMap)) return;

      if (activeKeys[key]) { // Stop only if it was active
        stopNote(key);
        
        // Update the duration if recording
        if (isRecording && activeNotesRef.current[key]) {
          recordNoteEnd(key);
        }
        
        setActiveKeys(prev => {
          const newActiveKeys = { ...prev };
          delete newActiveKeys[key];
          return newActiveKeys;
        });
      }
    };

    // Add event listeners when component mounts
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // Clean up event listeners when component unmounts
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isRecording, startTime, activeKeys]); // Dependencies

  // Play a note
  const playNote = (key) => {
    startAudio();
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
    startAudio(); // Ensure audio is ready
    
    if (!isRecording) {
      // Start recording
      setRecordedNotes([]);
      setStartTime(Date.now());
      setIsRecording(true);
      activeNotesRef.current = {}; // Reset active notes tracking
      setActiveKeys({}); // Reset active keys visually
    } else {
      // Stop recording
      setIsRecording(false);
      
      // Finalize any held notes
      Object.keys(activeNotesRef.current).forEach(key => {
        recordNoteEnd(key);
      });
      
      // Clear tracking
      activeNotesRef.current = {};
    }
  };

  // Play back the recorded notes
  const playRecording = () => {
    startAudio();
    setIsPlaying(true);
    setActiveKeys({}); // Clear current visual active keys before playback

    const now = Tone.now();
    let maxEndTime = 0;

    // Use a fresh copy of notes for playback scheduling
    const notesToPlay = [...recordedNotes].filter(n => n.duration > 0);

    notesToPlay.forEach(note => {
      // Calculate start and duration in seconds
      const startTimeSec = now + note.timestamp / 1000;
      const durationSec = note.duration / 1000;
      const noteEndTime = note.timestamp + note.duration;
      
      // Track the latest end time for stopping playback
      if (noteEndTime > maxEndTime) {
        maxEndTime = noteEndTime;
      }

      try {
        // Schedule the note in Tone.js
        synthRef.current.triggerAttackRelease(
          note.note,
          durationSec,
          startTimeSec
        );

        // Visual feedback - key down
        setTimeout(() => {
          setActiveKeys(prev => ({ ...prev, [note.key]: true }));
        }, note.timestamp);

        // Visual feedback - key up
        setTimeout(() => {
          setActiveKeys(prev => {
            const newKeys = { ...prev };
            delete newKeys[note.key];
            return newKeys;
          });
        }, noteEndTime);
      } catch (error) {
        console.error(`Error scheduling note ${note.note}:`, error);
      }
    });

    // Set timeout to end playback state
    setTimeout(() => {
      setIsPlaying(false);
      setActiveKeys({}); // Ensure all keys are visually off after playback
    }, maxEndTime + 200); // Add a small buffer
  };

  // Upload MIDI to the backend
  const sendMidiToBackend = async (blob, filename = "recording.mid") => {
    const formData = new FormData();
    formData.append('file', blob, filename);

    try {
      const response = await fetch('http://localhost:5000/upload_midi', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error("MIDI upload failed");
      }

      console.log("MIDI uploaded and saved on backend");
      
      // Trigger other API calls after successful save
      await fetchGenerate(formData.path);
    } catch (err) {
      console.error("Error uploading MIDI:", err);
    }
  };

  // Save the MIDI recording
  const saveMidiRecording = () => {
    // Filter out invalid notes before saving
    const validNotes = recordedNotes.filter(note => note.duration > 0 && note.timestamp >= 0);

    if (validNotes.length === 0) {
      alert("No valid notes recorded! Play some notes before saving.");
      return;
    }

    console.log(`Saving MIDI file with ${validNotes.length} notes`);

    // Trigger page change if callback provided
    if (onMidiSaved) {
      onMidiSaved(validNotes);
    }
    
    // Generate MIDI data
    const midiData = createSimpleMidiFile(validNotes);
    
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
    
    // Upload to backend
    sendMidiToBackend(blob, `recording-${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.mid`);
  };

  // Render a piano key
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
        }
      }
    };

    const handleRelease = () => {
      if (activeKeys[key]) { // Release only if active
        stopNote(key);
        // Update recording if needed
        if (isRecording && activeNotesRef.current[key]) {
          recordNoteEnd(key);
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
        // Touch Events
        onTouchStart={(e) => {
          e.preventDefault(); // Prevent default touch behavior
          handlePress();
        }}
        onTouchEnd={(e) => {
          e.preventDefault();
          handleRelease();
        }}
        onTouchCancel={(e) => {
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
        onClick={toggleRecording}
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
          Recording... {Math.max(0, Math.floor((Date.now() - startTime) / 1000))}s
        </div>
      )}

      {/* Show controls only if not recording AND there are notes */}
      {!isRecording && recordedNotes.length > 0 && (
        <div className="recording-controls">
          <h3>Your Recording</h3>
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