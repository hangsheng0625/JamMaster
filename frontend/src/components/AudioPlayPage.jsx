// First install: npm install midi-player-js

// src/components/AudioPlayPage.jsx
import React, { useState, useRef, useEffect } from 'react';
import * as Tone from 'tone';
import MidiPlayer from 'midi-player-js';
import robot from '../assets/robot.png';
import '../styles/audioPlay.css';

const AudioPlayPage = ({ onBack, uploadedFile, onGenerate }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isMidiFile, setIsMidiFile] = useState(false);
  const [loadingMidi, setLoadingMidi] = useState(false);
  const [midiError, setMidiError] = useState('');
  
  const audioRef = useRef(null);
  const synthRef = useRef(null);
  const midiPlayerRef = useRef(null);
  const progressUpdateInterval = useRef(null);

  // AI Generation parameters
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
      if (midiPlayerRef.current) {
        midiPlayerRef.current.stop();
      }
      if (progressUpdateInterval.current) {
        clearInterval(progressUpdateInterval.current);
      }
    };
  }, []);

  // Setup MIDI player with accurate duration calculation
  const setupMidiPlayer = async (file) => {
    try {
      setLoadingMidi(true);
      setMidiError('');
      
      // Create new MIDI player instance
      const player = new MidiPlayer.Player();
      midiPlayerRef.current = player;
      
      // Read file as array buffer
      const arrayBuffer = await file.arrayBuffer();
      
      // Load MIDI data
      player.loadArrayBuffer(arrayBuffer);
      
      // Get both reported and calculated durations
      const reportedDuration = player.getSongTime();
      const accurateDuration = calculateAccurateDuration(player);
      
      console.log(`Duration comparison:`);
      console.log(`- Library getSongTime(): ${reportedDuration.toFixed(2)}s (${Math.floor(reportedDuration/60)}:${Math.floor(reportedDuration%60).toString().padStart(2,'0')})`);
      console.log(`- Event-based calculation: ${accurateDuration.toFixed(2)}s (${Math.floor(accurateDuration/60)}:${Math.floor(accurateDuration%60).toString().padStart(2,'0')})`);
      
      // Use the more accurate duration (usually the shorter one)
      const finalDuration = Math.min(reportedDuration, accurateDuration);
      setDuration(finalDuration * 1000);
      
      // Ensure player starts at beginning
      player.skipToSeconds(0);
      setCurrentTime(0);
      
      const minutes = Math.floor(finalDuration / 60);
      const seconds = Math.floor(finalDuration % 60);
      console.log(`Using final duration: ${minutes}:${seconds.toString().padStart(2,'0')} (${finalDuration.toFixed(2)}s)`);
      
      // Setup event listeners
      player.on('midiEvent', handleMidiEvent);
      player.on('endOfFile', handleEndOfFile);
      
      return true;
    } catch (error) {
      console.error('Error loading MIDI file:', error);
      setMidiError('Failed to load MIDI file. Please ensure it\'s a valid MIDI file.');
      return false;
    } finally {
      setLoadingMidi(false);
    }
  };

  // Handle end of MIDI file
  const handleEndOfFile = () => {
    console.log('MIDI playback finished at:', (currentTime / 1000).toFixed(2), 'seconds');
    
    setIsPlaying(false);
    setCurrentTime(0);
    
    if (progressUpdateInterval.current) {
      clearInterval(progressUpdateInterval.current);
      progressUpdateInterval.current = null;
    }
    
    // Release all notes
    if (synthRef.current) {
      synthRef.current.releaseAll();
    }
  };

  // Handle MIDI events and convert to Tone.js
  const handleMidiEvent = async (event) => {
    if (!synthRef.current) return;
    
    // Ensure audio context is started
    if (Tone.context.state !== 'running') {
      await Tone.start();
    }
    
    if (event.name === 'Note on' && event.velocity > 0) {
      // Convert MIDI note number to note name
      const noteName = midiNoteToName(event.noteNumber);
      const velocity = event.velocity / 127; // Normalize velocity
      
      try {
        synthRef.current.triggerAttack(noteName, undefined, velocity);
      } catch (error) {
        console.warn('Error triggering note:', noteName, error);
      }
    } else if (event.name === 'Note off' || (event.name === 'Note on' && event.velocity === 0)) {
      // Note off event
      const noteName = midiNoteToName(event.noteNumber);
      
      try {
        synthRef.current.triggerRelease(noteName);
      } catch (error) {
        console.warn('Error releasing note:', noteName, error);
      }
    }
  };

  // Calculate accurate duration by analyzing actual MIDI events
  const calculateAccurateDuration = (player) => {
    try {
      // Method 1: Find the last meaningful event (note-on/note-off)
      let lastEventTick = 0;
      let hasNoteEvents = false;
      
      // Get all events from the player
      const events = player.getEvents();
      
      events.forEach(event => {
        // Look for note events and other meaningful events
        if (event.name === 'Note on' || event.name === 'Note off') {
          lastEventTick = Math.max(lastEventTick, event.tick || 0);
          hasNoteEvents = true;
        } else if (event.name === 'Controller Change' || event.name === 'Program Change') {
          // Include other musical events but with lower priority
          if (hasNoteEvents) {
            lastEventTick = Math.max(lastEventTick, event.tick || 0);
          }
        }
      });
      
      if (lastEventTick > 0) {
        // Convert ticks to seconds using the player's method
        const accurateDuration = player.ticksToSeconds ? 
          player.ticksToSeconds(lastEventTick) : 
          (lastEventTick / (player.division || 480)) * (60 / (player.tempo || 120));
        
        console.log(`Event-based duration calculation:`);
        console.log(`- Last event tick: ${lastEventTick}`);
        console.log(`- Converted to seconds: ${accurateDuration.toFixed(2)}s`);
        
        return accurateDuration;
      }
      
      // Fallback to library method if no events found
      return player.getSongTime();
      
    } catch (error) {
      console.warn('Error calculating accurate duration:', error);
      return player.getSongTime();
    }
  };

  // Setup progress tracking using tick-based approach (more reliable)
  const setupProgressTracking = () => {
    if (progressUpdateInterval.current) {
      clearInterval(progressUpdateInterval.current);
    }
    
    // Manual time tracking for more accuracy
    const startTime = Date.now();
    const initialCurrentTime = currentTime;
    
    progressUpdateInterval.current = setInterval(() => {
      if (midiPlayerRef.current && midiPlayerRef.current.isPlaying()) {
        try {
          // Use manual time calculation instead of getSongTimeRemaining()
          const elapsed = Date.now() - startTime;
          const newCurrentTime = initialCurrentTime + elapsed;
          
          // Alternative: Try tick-based calculation as backup
          const currentTick = midiPlayerRef.current.getCurrentTick();
          const totalTicks = midiPlayerRef.current.getTotalTicks();
          
          if (totalTicks > 0) {
            const tickProgress = currentTick / totalTicks;
            const tickBasedTime = tickProgress * duration;
            
            // Use manual time but validate against tick-based time
            let finalTime = newCurrentTime;
            
            // If there's a big discrepancy, prefer tick-based time
            if (Math.abs(newCurrentTime - tickBasedTime) > 1000) {
              finalTime = tickBasedTime;
            }
            
            console.log(`Manual: ${(newCurrentTime/1000).toFixed(2)}s, Tick-based: ${(tickBasedTime/1000).toFixed(2)}s, Using: ${(finalTime/1000).toFixed(2)}s`);
            
            if (finalTime >= duration) {
              handleEndOfFile();
            } else {
              setCurrentTime(Math.max(0, finalTime));
            }
          } else {
            // Fallback to manual tracking
            if (newCurrentTime >= duration) {
              handleEndOfFile();
            } else {
              setCurrentTime(Math.max(0, newCurrentTime));
            }
          }
        } catch (error) {
          console.warn('Error in progress tracking:', error);
          // Fallback to manual time tracking
          const elapsed = Date.now() - startTime;
          const newCurrentTime = initialCurrentTime + elapsed;
          
          if (newCurrentTime >= duration) {
            handleEndOfFile();
          } else {
            setCurrentTime(Math.max(0, newCurrentTime));
          }
        }
      }
    }, 100);
  };

  // Convert MIDI note number to note name
  const midiNoteToName = (midiNote) => {
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = Math.floor(midiNote / 12) - 1;
    const note = noteNames[midiNote % 12];
    return `${note}${octave}`;
  };

  // Check if file is MIDI and set up accordingly
  useEffect(() => {
    if (uploadedFile) {
      const fileName = uploadedFile.name.toLowerCase();
      const isMidi = fileName.endsWith('.mid') || fileName.endsWith('.midi') || uploadedFile.type === 'audio/midi';
      
      setIsMidiFile(isMidi);
      setCurrentTime(0);
      setDuration(0);
      setMidiError('');
      
      // Stop any existing playback
      if (midiPlayerRef.current) {
        midiPlayerRef.current.stop();
      }
      if (synthRef.current) {
        synthRef.current.releaseAll();
      }
      
      if (isMidi) {
        setupMidiPlayer(uploadedFile.file);
      } else if (audioRef.current) {
        // Set up regular audio file
        audioRef.current.src = uploadedFile.url;
        
        const audio = audioRef.current;
        
        const handleLoadedMetadata = () => {
          setDuration(audio.duration * 1000);
        };
        
        const handleEnded = () => {
          setIsPlaying(false);
          setCurrentTime(0);
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

  // Handle progress bar click for seeking
  const handleProgressClick = (e) => {
    if (!duration) return;
    
    const progressBar = e.currentTarget;
    const rect = progressBar.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width));
    const newTime = percentage * duration;
    
    if (isMidiFile && midiPlayerRef.current) {
      // Stop current playback
      const wasPlaying = isPlaying;
      if (wasPlaying) {
        midiPlayerRef.current.stop();
        setIsPlaying(false);
        if (progressUpdateInterval.current) {
          clearInterval(progressUpdateInterval.current);
          progressUpdateInterval.current = null;
        }
      }
      
      // Release all notes
      if (synthRef.current) {
        synthRef.current.releaseAll();
      }
      
      // Use skipToSeconds for more accurate seeking
      const newTimeSeconds = newTime / 1000;
      midiPlayerRef.current.skipToSeconds(newTimeSeconds);
      setCurrentTime(newTime);
      
      // Resume if was playing
      if (wasPlaying) {
        setTimeout(() => {
          midiPlayerRef.current.play();
          setIsPlaying(true);
          setupProgressTracking();
        }, 100);
      }
    } else if (audioRef.current) {
      // For regular audio files
      audioRef.current.currentTime = newTime / 1000;
      setCurrentTime(newTime);
    }
  };

  const handlePlayPause = async () => {
    if (isPlaying) {
      // Pause
      if (isMidiFile && midiPlayerRef.current) {
        midiPlayerRef.current.pause();
        
        // Release all notes
        if (synthRef.current) {
          synthRef.current.releaseAll();
        }
        
        if (progressUpdateInterval.current) {
          clearInterval(progressUpdateInterval.current);
          progressUpdateInterval.current = null;
        }
      } else if (audioRef.current) {
        audioRef.current.pause();
        
        if (progressUpdateInterval.current) {
          clearInterval(progressUpdateInterval.current);
          progressUpdateInterval.current = null;
        }
      }
      
      setIsPlaying(false);
    } else {
      // Play
      if (isMidiFile && midiPlayerRef.current) {
        // Ensure audio context is started
        if (Tone.context.state !== 'running') {
          await Tone.start();
        }
        
        // Always ensure we start from the correct position
        if (currentTime <= 0) {
          // Starting from beginning
          midiPlayerRef.current.skipToSeconds(0);
          setCurrentTime(0);
        } else if (currentTime >= duration) {
          // At the end, restart from beginning
          midiPlayerRef.current.skipToSeconds(0);
          setCurrentTime(0);
        } else {
          // Resume from current position
          const currentTimeSeconds = currentTime / 1000;
          midiPlayerRef.current.skipToSeconds(currentTimeSeconds);
        }
        
        midiPlayerRef.current.play();
        setIsPlaying(true);
        setupProgressTracking();
      } else if (audioRef.current) {
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
                setIsPlaying(false);
                setCurrentTime(0);
                if (progressUpdateInterval.current) {
                  clearInterval(progressUpdateInterval.current);
                  progressUpdateInterval.current = null;
                }
              } else {
                setCurrentTime(newTime);
              }
            }
          }, 16);
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

  const handleGenerate = async () => {
    setIsGenerating(true);
    
    try {
      await onGenerate(uploadedFile, modelParams);
    } catch (error) {
      console.error('Error generating music:', error);
      alert('Failed to generate music. Please try again.');
    } finally {
      setIsGenerating(false);
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
              <p>Loading MIDI file...</p>
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
                  <button className="control-btn" disabled={!duration}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M6,18V6H18V18H6M6,6V18L18,12L6,6Z" />
                    </svg>
                  </button>
                  
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
                  
                  <button className="control-btn" disabled={!duration}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18,18V6H6V18H18M18,6V18L6,12L18,6Z" />
                    </svg>
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
          disabled={isGenerating || loadingMidi || !!midiError}
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