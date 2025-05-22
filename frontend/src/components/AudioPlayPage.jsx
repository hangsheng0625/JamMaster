// src/components/AudioPlayPage.jsx
import React, { useState, useRef, useEffect } from 'react';
import * as Tone from 'tone';
import robot from '../assets/robot.png';
import '../styles/audioPlay.css';
import { fetchGenerate } from './api'; // Import the API function

const AudioPlayPage = ({ onBack, uploadedFile, onGenerate }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isMidiFile, setIsMidiFile] = useState(false);
  const [midiData, setMidiData] = useState(null);
  const [loadingMidi, setLoadingMidi] = useState(false);
  const [midiError, setMidiError] = useState('');
  
  const audioRef = useRef(null);
  const synthRef = useRef(null);
  const progressUpdateInterval = useRef(null);
  const scheduledEventsRef = useRef([]);
  const startTimeRef = useRef(0);

  // AI Generation parameters (similar to Piano component)
  const [modelParams, setModelParams] = useState({
    nTargetBar: 8,
    temperature: 0.9,
    topk: 5,
  });

  // Initialize Tone.js synth
  useEffect(() => {
    synthRef.current = new Tone.PolySynth(Tone.Synth).toDestination();
    
    return () => {
      if (synthRef.current) {
        synthRef.current.releaseAll();
        synthRef.current.dispose();
      }
      scheduledEventsRef.current.forEach(id => Tone.Transport.clear(id));
      scheduledEventsRef.current = [];
    };
  }, []);

  // Parse MIDI file using Web MIDI API or a simple parser
  const parseMidiFile = async (file) => {
    try {
      setLoadingMidi(true);
      setMidiError('');
      
      const arrayBuffer = await file.arrayBuffer();
      const midiData = parseMIDI(arrayBuffer);
      
      if (midiData && midiData.tracks && midiData.tracks.length > 0) {
        setMidiData(midiData);
        // Calculate total duration from MIDI events
        const totalDuration = calculateMidiDuration(midiData);
        setDuration(totalDuration);
        return true;
      } else {
        throw new Error('Invalid MIDI file format');
      }
    } catch (error) {
      console.error('Error parsing MIDI file:', error);
      setMidiError('Failed to parse MIDI file. Please ensure it\'s a valid MIDI file.');
      return false;
    } finally {
      setLoadingMidi(false);
    }
  };

  // Simple MIDI parser (basic implementation)
  const parseMIDI = (arrayBuffer) => {
    const view = new DataView(arrayBuffer);
    let offset = 0;
    
    // Check MIDI header
    const headerChunk = String.fromCharCode(...new Uint8Array(arrayBuffer, 0, 4));
    if (headerChunk !== 'MThd') {
      throw new Error('Not a valid MIDI file');
    }
    
    offset += 4; // Skip "MThd"
    const headerLength = view.getUint32(offset); // Should be 6
    offset += 4;
    
    const format = view.getUint16(offset);
    offset += 2;
    const trackCount = view.getUint16(offset);
    offset += 2;
    const division = view.getUint16(offset);
    offset += 2;
    
    const tracks = [];
    
    // Parse tracks
    for (let i = 0; i < trackCount; i++) {
      const trackChunk = String.fromCharCode(...new Uint8Array(arrayBuffer, offset, 4));
      if (trackChunk !== 'MTrk') {
        break;
      }
      offset += 4;
      
      const trackLength = view.getUint32(offset);
      offset += 4;
      
      const trackData = new Uint8Array(arrayBuffer, offset, trackLength);
      const events = parseTrackEvents(trackData, division);
      tracks.push({ events });
      
      offset += trackLength;
    }
    
    return {
      format,
      trackCount,
      division,
      tracks
    };
  };

  // Parse track events (improved timing)
  const parseTrackEvents = (trackData, division) => {
    const events = [];
    let offset = 0;
    let currentTime = 0;
    let runningStatus = 0;
    let tempo = 500000; // Default tempo: 500,000 microseconds per quarter note (120 BPM)
    
    while (offset < trackData.length) {
      // Read variable length delta time
      let deltaTime = 0;
      let byte;
      do {
        byte = trackData[offset++];
        deltaTime = (deltaTime << 7) | (byte & 0x7F);
      } while (byte & 0x80);
      
      currentTime += deltaTime;
      
      if (offset >= trackData.length) break;
      
      let status = trackData[offset];
      
      // Handle running status
      if (status < 0x80) {
        status = runningStatus;
      } else {
        offset++;
        runningStatus = status;
      }
      
      const eventType = status & 0xF0;
      const channel = status & 0x0F;
      
      if (eventType === 0x90 || eventType === 0x80) { // Note on/off
        if (offset + 1 >= trackData.length) break;
        
        const note = trackData[offset++];
        const velocity = trackData[offset++];
        
        // Convert to note name
        const noteName = midiNoteToName(note);
        
        // Better timing calculation
        const timeInSeconds = (currentTime / division) * (tempo / 1000000);
        
        events.push({
          type: (eventType === 0x90 && velocity > 0) ? 'noteOn' : 'noteOff',
          time: timeInSeconds,
          ticks: currentTime,
          note: noteName,
          velocity: velocity,
          channel: channel
        });
      } else if (eventType === 0xFF) { // Meta event
        if (offset >= trackData.length) break;
        const metaType = trackData[offset++];
        
        // Read length
        let metaLength = 0;
        do {
          byte = trackData[offset++];
          metaLength = (metaLength << 7) | (byte & 0x7F);
        } while (byte & 0x80);
        
        // Handle tempo changes
        if (metaType === 0x51 && metaLength === 3) { // Set Tempo
          tempo = (trackData[offset] << 16) | (trackData[offset + 1] << 8) | trackData[offset + 2];
        }
        
        offset += metaLength; // Skip meta data
        
        if (metaType === 0x2F) { // End of track
          break;
        }
      } else {
        // Skip other events
        if (eventType === 0xC0 || eventType === 0xD0) {
          offset++; // 1 data byte
        } else {
          offset += 2; // 2 data bytes
        }
      }
    }
    
    return events;
  };

  // Convert MIDI note number to note name
  const midiNoteToName = (midiNote) => {
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = Math.floor(midiNote / 12) - 1;
    const note = noteNames[midiNote % 12];
    return `${note}${octave}`;
  };

  // Calculate MIDI duration and normalize timing
  const calculateMidiDuration = (midiData) => {
    let maxTime = 0;
    let minTime = Infinity;
    
    // Find the time range
    midiData.tracks.forEach(track => {
      track.events.forEach(event => {
        if (event.time > maxTime) {
          maxTime = event.time;
        }
        if (event.time < minTime) {
          minTime = event.time;
        }
      });
    });
    
    // Normalize events to start from 0
    if (minTime > 0 && minTime !== Infinity) {
      midiData.tracks.forEach(track => {
        track.events.forEach(event => {
          event.time = Math.max(0, event.time - minTime);
        });
      });
      maxTime = maxTime - minTime;
    }
    
    return Math.max(maxTime * 1000, 1000); // Convert to milliseconds, minimum 1 second
  };

  // Check if file is MIDI and set up accordingly
  useEffect(() => {
    if (uploadedFile) {
      const fileName = uploadedFile.name.toLowerCase();
      const isMidi = fileName.endsWith('.mid') || fileName.endsWith('.midi') || uploadedFile.type === 'audio/midi';
      
      setIsMidiFile(isMidi);
      setCurrentTime(0);
      setDuration(0);
      setMidiData(null);
      setMidiError('');
      
      if (isMidi) {
        parseMidiFile(uploadedFile.file);
      } else if (audioRef.current) {
        // Set up regular audio file
        audioRef.current.src = uploadedFile.url;
        
        const audio = audioRef.current;
        
        const handleLoadedMetadata = () => {
          setDuration(audio.duration * 1000);
        };
        
        const handleEnded = () => {
          setIsPlaying(false);
          setCurrentTime(0); // Reset to beginning when audio ends
          if (progressUpdateInterval.current) {
            clearInterval(progressUpdateInterval.current);
          }
        };

        audio.addEventListener('loadedmetadata', handleLoadedMetadata);
        audio.addEventListener('ended', handleEnded);

        return () => {
          audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
          audio.removeEventListener('ended', handleEnded);
        };
      }
    }
  }, [uploadedFile]);

  // Start audio context
  const startAudio = async () => {
    if (Tone.context.state !== 'running') {
      await Tone.start();
    }
  };

  // Handle progress bar click for seeking
  const handleProgressClick = (e) => {
    if (!duration) return;
    
    const progressBar = e.currentTarget;
    const rect = progressBar.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newTime = percentage * duration;
    
    if (isMidiFile) {
      // For MIDI files, restart from the new position
      if (isPlaying) {
        stopPlayback();
        setCurrentTime(newTime);
        setTimeout(() => playMidiFromTime(newTime), 100);
      } else {
        setCurrentTime(newTime);
      }
    } else if (audioRef.current) {
      // For regular audio files
      audioRef.current.currentTime = newTime / 1000;
      setCurrentTime(newTime);
    }
  };

  // Play MIDI from specific time
  const playMidiFromTime = async (startTime = 0) => {
    if (!midiData || !synthRef.current) return;
    
    await startAudio();
    
    setIsPlaying(true);
    startTimeRef.current = Date.now() - startTime;
    
    // Clear previous events
    scheduledEventsRef.current.forEach(id => Tone.Transport.clear(id));
    scheduledEventsRef.current = [];
    
    // Reset transport
    Tone.Transport.cancel();
    Tone.Transport.stop();
    Tone.Transport.position = 0;
    Tone.Transport.start();
    
    // Schedule events that should play after the start time
    midiData.tracks.forEach(track => {
      track.events.forEach(event => {
        const eventTimeMs = event.time * 1000;
        
        // Only schedule events that happen after our start time
        if (eventTimeMs >= startTime) {
          const adjustedTime = (eventTimeMs - startTime) / 1000;
          
          if (event.type === 'noteOn') {
            const eventId = Tone.Transport.scheduleOnce((time) => {
              synthRef.current?.triggerAttack(event.note, time, event.velocity / 127);
            }, adjustedTime);
            scheduledEventsRef.current.push(eventId);
            
          } else if (event.type === 'noteOff') {
            const eventId = Tone.Transport.scheduleOnce((time) => {
              synthRef.current?.triggerRelease(event.note, time);
            }, adjustedTime);
            scheduledEventsRef.current.push(eventId);
          }
        }
      });
    });
    
    // Update progress
    progressUpdateInterval.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      if (elapsed >= duration) {
        // Song finished - stop and reset to beginning
        stopPlayback(true);
      } else {
        setCurrentTime(elapsed);
      }
    }, 50);
    
    // Auto-stop at the end
    const remainingTime = (duration - startTime) / 1000;
    if (remainingTime > 0) {
      const stopEventId = Tone.Transport.scheduleOnce(() => {
        // Song finished naturally - reset to beginning
        stopPlayback(true);
      }, remainingTime);
      scheduledEventsRef.current.push(stopEventId);
    }
  };

  // Stop playback
  const stopPlayback = (resetToBeginning = false) => {
    setIsPlaying(false);
    
    if (progressUpdateInterval.current) {
      clearInterval(progressUpdateInterval.current);
      progressUpdateInterval.current = null;
    }
    
    if (isMidiFile) {
      // Stop MIDI playback
      scheduledEventsRef.current.forEach(id => Tone.Transport.clear(id));
      scheduledEventsRef.current = [];
      Tone.Transport.cancel();
      Tone.Transport.stop();
      
      if (synthRef.current) {
        synthRef.current.releaseAll();
      }
      
      // Reset to beginning if requested or if playback completed naturally
      if (resetToBeginning) {
        setCurrentTime(0);
      }
    } else if (audioRef.current) {
      // Stop regular audio
      audioRef.current.pause();
      if (resetToBeginning) {
        audioRef.current.currentTime = 0;
        setCurrentTime(0);
      }
    }
  };

  const formatTime = (ms) => {
    if (typeof ms !== 'number' || ms < 0) return '0:00';
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handlePlayPause = async () => {
    if (isPlaying) {
      stopPlayback();
    } else {
      if (isMidiFile) {
        // If we're at the end, restart from the beginning
        const playFromTime = currentTime >= duration ? 0 : currentTime;
        if (playFromTime === 0) {
          setCurrentTime(0);
        }
        await playMidiFromTime(playFromTime);
      } else if (audioRef.current) {
        // Regular audio playback
        try {
          // If at the end, restart from beginning
          if (currentTime >= duration) {
            audioRef.current.currentTime = 0;
            setCurrentTime(0);
          }
          
          await audioRef.current.play();
          setIsPlaying(true);
          progressUpdateInterval.current = setInterval(() => {
            if (audioRef.current) {
              const newTime = audioRef.current.currentTime * 1000;
              if (newTime >= duration) {
                // Audio finished - reset to beginning
                stopPlayback(true);
              } else {
                setCurrentTime(newTime);
              }
            }
          }, 50);
        } catch (error) {
          console.error('Error playing audio:', error);
        }
      }
    }
  };

  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    
    if (isMidiFile && synthRef.current) {
      synthRef.current.volume.value = Tone.gainToDb(newVolume);
    } else if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
  };

  const handleParameterChange = (param, value) => {
    setModelParams(prev => ({
      ...prev,
      [param]: value
    }));
  };

  // Upload file to backend and generate music (similar to Piano.jsx)
  const sendFileToBackend = async (file, filename) => {
    const formData = new FormData();
    formData.append('file', file, filename);

    try {
      // 1. Upload the file
      const uploadResponse = await fetch('http://localhost:5000/upload_midi', {
        method: 'POST',
        body: formData
      });

      if (!uploadResponse.ok) {
        throw new Error(`File upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`);
      }

      const uploadData = await uploadResponse.json();
      console.log("File uploaded and saved on backend at:", uploadData.path);
      console.log("Model parameters:", modelParams);

      // 2. Call the generate endpoint
      try {
        const generatedBlob = await fetchGenerate(
          uploadData.path, 
          modelParams.temperature, 
          modelParams.nTargetBar, 
          modelParams.topk
        );
        
        // 3. Create download link and trigger download
        const downloadUrl = window.URL.createObjectURL(generatedBlob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `generated-composition-${Date.now()}.mid`;
        document.body.appendChild(a);
        a.click();
        
        // 4. Cleanup
        window.URL.revokeObjectURL(downloadUrl);
        document.body.removeChild(a);
      } catch (genError) {
        console.error("Error in generation step:", genError);
        alert(`Generation failed: ${genError.message}`);
      }
    } catch (err) {
      console.error("Error in file processing:", err);
      alert(`Error generating composition: ${err.message}`);
    }
  };

  const handleGenerate = async () => {
    if (!uploadedFile || !uploadedFile.file) {
      alert("No file available for generation.");
      return;
    }

    setIsGenerating(true);
    
    try {
      // Create a filename with timestamp
      const timestamp = new Date().toISOString().slice(0,19).replace(/:/g,'-');
      const fileExtension = uploadedFile.name.split('.').pop();
      const filename = `uploaded-${timestamp}.${fileExtension}`;
      
      // Send the uploaded file to backend for processing
      await sendFileToBackend(uploadedFile.file, filename);
      
      // Optionally call the parent callback if you still want to navigate to results page
      // Comment out the line below if you don't want to navigate away after generation
      await onGenerate(uploadedFile, modelParams);
      
    } catch (error) {
      console.error('Error generating music:', error);
      alert('Failed to generate music. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="audio-play-container">
      <button className="back-button" onClick={onBack}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20,11V13H8L13.5,18.5L12.08,19.92L4.16,12L12.08,4.08L13.5,5.5L8,11H20Z" />
        </svg>
        Back
      </button>

      <div className="audio-play-card">
        <div className="header">
          <h1>Your Audio</h1>
          <p>Preview your uploaded file and customize AI generation settings.</p>
        </div>

        <div className="ai-assistant">
          <img src={robot} alt="AI Assistant" />
        </div>

        <div className="audio-preview-section">
          <div className="file-info">
            <div className="file-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
              </svg>
            </div>
            <div className="file-details">
              <h3>{uploadedFile?.name || 'Unknown file'}</h3>
              <p>{formatFileSize(uploadedFile?.size || 0)} • {isMidiFile ? 'MIDI File' : 'Audio File'}</p>
            </div>
          </div>

          {loadingMidi && (
            <div className="loading-midi">
              <div className="midi-spinner"></div>
              <p>Parsing MIDI file...</p>
            </div>
          )}

          {midiError && (
            <div className="midi-error">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M13,13H11V7H13M13,17H11V15H13M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z" />
              </svg>
              {midiError}
            </div>
          )}

          {(!loadingMidi && !midiError) && (
            <>
              <div className="audio-controls">
                <div className="time-display">
                  {formatTime(currentTime)}
                </div>
                
                <div className="playback-controls">
                  
                  <button 
                    className="play-pause-btn" 
                    onClick={handlePlayPause}
                    disabled={!duration || loadingMidi}
                  >
                    {isPlaying ? (
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M14,19H18V5H14M6,19H10V5H6V19Z" />
                      </svg>
                    ) : (
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8,5.14V19.14L19,12.14L8,5.14Z" />
                      </svg>
                    )}
                  </button>
                </div>

                <div className="volume-control">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M14,3.23V5.29C16.89,6.15 19,8.83 19,12C19,15.17 16.89,17.85 14,18.71V20.77C18.01,19.86 21,16.28 21,12C21,7.72 18.01,4.14 14,3.23M16.5,12C16.5,10.23 15.5,8.71 14,7.97V16C15.5,15.29 16.5,13.76 16.5,12M3,9V15H7L12,20V4L7,9H3Z" />
                  </svg>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={volume}
                    onChange={handleVolumeChange}
                    className="volume-slider"
                  />
                </div>
              </div>

              <div className="progress-container">
                <div className="progress-bar-wrapper">
                  <span className="time-current">{formatTime(currentTime)}</span>
                  <div 
                    className="progress-bar-clickable" 
                    onClick={handleProgressClick}
                    style={{ cursor: duration ? 'pointer' : 'default' }}
                  >
                    <div 
                      className="progress-fill" 
                      style={{ 
                        width: `${Math.min(100, progress)}%`,
                        transition: isPlaying ? 'none' : 'width 0.3s ease-in-out'
                      }}
                    ></div>
                  </div>
                  <span className="time-total">{formatTime(duration)}</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* AI Generation Settings */}
        <div className="generation-settings">
          <h3>AI Generation Settings</h3>
          <div className="settings-grid">
            <div className="setting-item">
              <label>Bars to Generate: {modelParams.nTargetBar}</label>
              <input
                type="range"
                min="1"
                max="16"
                step="1"
                value={modelParams.nTargetBar}
                onChange={(e) => handleParameterChange('nTargetBar', parseInt(e.target.value))}
              />
            </div>
            
            <div className="setting-item">
              <label>Temperature: {modelParams.temperature}</label>
              <input
                type="range"
                min="0.1"
                max="1.5"
                step="0.1"
                value={modelParams.temperature}
                onChange={(e) => handleParameterChange('temperature', parseFloat(e.target.value))}
              />
            </div>
            
            <div className="setting-item">
              <label>Top-K: {modelParams.topk}</label>
              <input
                type="range"
                min="1"
                max="50"
                step="1"
                value={modelParams.topk}
                onChange={(e) => handleParameterChange('topk', parseInt(e.target.value))}
              />
            </div>
          </div>
        </div>

        <button 
          className={`generate-button ${isGenerating ? 'generating' : ''}`}
          onClick={handleGenerate}
          disabled={isGenerating || loadingMidi || !!midiError || !uploadedFile}
        >
          {isGenerating ? (
            <>
              <div className="generate-spinner"></div>
              Generating AI Music...
            </>
          ) : (
            <>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12,3V13.55C11.41,13.21 10.73,13 10,13A4,4 0 0,0 6,17A4,4 0 0,0 10,21A4,4 0 0,0 14,17V7H18V3H12Z" />
              </svg>
              Generate AI Music
            </>
          )}
        </button>

        {/* Hidden audio element for non-MIDI files */}
        {!isMidiFile && <audio ref={audioRef} preload="metadata" />}

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

export default AudioPlayPage;