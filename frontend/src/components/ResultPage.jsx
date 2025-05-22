// src/components/ResultPage.jsx
import React, { useState, useEffect, useRef } from 'react';
import * as Tone from 'tone';
import robot from '../assets/robot.png';
import trebleClef from '../assets/treble_clef.png';
import beamedNote from '../assets/beamed_note.png';
import '../styles/result.css';

// Helper function to format time (milliseconds to MM:SS)
const formatTime = (ms) => {
    if (typeof ms !== 'number' || ms < 0) return '0:00';
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
};

const ResultPage = ({ onStartNew, enhancedAudioUrl, originalNotes = [], uploadedFile = null }) => {
    // --- State for Original Playback ---
    const [isPlayingOriginal, setIsPlayingOriginal] = useState(false);
    const [originalPlaybackTime, setOriginalPlaybackTime] = useState(0);
    const [originalDuration, setOriginalDuration] = useState(0);
    const [disableTransition, setDisableTransition] = useState(false);
    
    // MIDI file specific states
    const [isMidiFile, setIsMidiFile] = useState(false);
    const [midiData, setMidiData] = useState(null);
    const [loadingMidi, setLoadingMidi] = useState(false);
    const [midiError, setMidiError] = useState('');

    // Genre breakdown state
    const [genreBreakdown, setGenreBreakdown] = useState([]);
    const [loadingGenres, setLoadingGenres] = useState(false);

    // --- Refs for Original Playback ---
    const originalSynthRef = useRef(null);
    const playbackIntervalRef = useRef(null);
    const scheduledEventsRef = useRef([]);
    const pausedAtTimeRef = useRef(0);
    const startTimeRef = useRef(0);

    // MIDI parsing functions (copied from AudioPlayPage)
    const parseMidiFile = async (file) => {
        try {
            setLoadingMidi(true);
            setMidiError('');
            
            const arrayBuffer = await file.arrayBuffer();
            const midiData = parseMIDI(arrayBuffer);
            
            if (midiData && midiData.tracks && midiData.tracks.length > 0) {
                setMidiData(midiData);
                const totalDuration = calculateMidiDuration(midiData);
                setOriginalDuration(totalDuration);
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

    const parseMIDI = (arrayBuffer) => {
        const view = new DataView(arrayBuffer);
        let offset = 0;
        
        const headerChunk = String.fromCharCode(...new Uint8Array(arrayBuffer, 0, 4));
        if (headerChunk !== 'MThd') {
            throw new Error('Not a valid MIDI file');
        }
        
        offset += 4;
        const headerLength = view.getUint32(offset);
        offset += 4;
        
        const format = view.getUint16(offset);
        offset += 2;
        const trackCount = view.getUint16(offset);
        offset += 2;
        const division = view.getUint16(offset);
        offset += 2;
        
        const tracks = [];
        
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

    const parseTrackEvents = (trackData, division) => {
        const events = [];
        let offset = 0;
        let currentTime = 0;
        let runningStatus = 0;
        let tempo = 500000;
        
        while (offset < trackData.length) {
            let deltaTime = 0;
            let byte;
            do {
                byte = trackData[offset++];
                deltaTime = (deltaTime << 7) | (byte & 0x7F);
            } while (byte & 0x80);
            
            currentTime += deltaTime;
            
            if (offset >= trackData.length) break;
            
            let status = trackData[offset];
            
            if (status < 0x80) {
                status = runningStatus;
            } else {
                offset++;
                runningStatus = status;
            }
            
            const eventType = status & 0xF0;
            const channel = status & 0x0F;
            
            if (eventType === 0x90 || eventType === 0x80) {
                if (offset + 1 >= trackData.length) break;
                
                const note = trackData[offset++];
                const velocity = trackData[offset++];
                
                const noteName = midiNoteToName(note);
                const timeInSeconds = (currentTime / division) * (tempo / 1000000);
                
                events.push({
                    type: (eventType === 0x90 && velocity > 0) ? 'noteOn' : 'noteOff',
                    time: timeInSeconds,
                    ticks: currentTime,
                    note: noteName,
                    velocity: velocity,
                    channel: channel
                });
            } else if (eventType === 0xFF) {
                if (offset >= trackData.length) break;
                const metaType = trackData[offset++];
                
                let metaLength = 0;
                do {
                    byte = trackData[offset++];
                    metaLength = (metaLength << 7) | (byte & 0x7F);
                } while (byte & 0x80);
                
                if (metaType === 0x51 && metaLength === 3) {
                    tempo = (trackData[offset] << 16) | (trackData[offset + 1] << 8) | trackData[offset + 2];
                }
                
                offset += metaLength;
                
                if (metaType === 0x2F) {
                    break;
                }
            } else {
                if (eventType === 0xC0 || eventType === 0xD0) {
                    offset++;
                } else {
                    offset += 2;
                }
            }
        }
        
        return events;
    };

    const midiNoteToName = (midiNote) => {
        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const octave = Math.floor(midiNote / 12) - 1;
        const note = noteNames[midiNote % 12];
        return `${note}${octave}`;
    };

    const calculateMidiDuration = (midiData) => {
        let maxTime = 0;
        let minTime = Infinity;
        
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
        
        if (minTime > 0 && minTime !== Infinity) {
            midiData.tracks.forEach(track => {
                track.events.forEach(event => {
                    event.time = Math.max(0, event.time - minTime);
                });
            });
            maxTime = maxTime - minTime;
        }
        
        return Math.max(maxTime * 1000, 1000);
    };

    // Fetch genre breakdown from model
    const fetchGenreBreakdown = async () => {
        setLoadingGenres(true);
        try {
            // Replace this with your actual API call
            // const response = await fetch('/api/analyze-genre', {
            //     method: 'POST',
            //     body: enhancedAudioData
            // });
            // const genreData = await response.json();
            
            // Mock data for now - replace with actual API call
            await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate API delay
            
            const mockGenreData = [
                { genre: 'Pop', percentage: 45 },
                { genre: 'Rock', percentage: 30 },
                { genre: 'Electronic', percentage: 15 },
                { genre: 'Classical', percentage: 10 }
            ];
            
            setGenreBreakdown(mockGenreData);
        } catch (error) {
            console.error('Error fetching genre breakdown:', error);
            // Set empty array on error
            setGenreBreakdown([]);
        } finally {
            setLoadingGenres(false);
        }
    };

    // --- Initialize and determine input type ---
    useEffect(() => {
        originalSynthRef.current = new Tone.PolySynth(Tone.Synth).toDestination();

        // Determine if we're dealing with uploaded MIDI file or piano recording
        if (uploadedFile) {
            const fileName = uploadedFile.name.toLowerCase();
            const isMidi = fileName.endsWith('.mid') || fileName.endsWith('.midi') || uploadedFile.type === 'audio/midi';
            
            setIsMidiFile(isMidi);
            
            if (isMidi) {
                // Parse uploaded MIDI file
                parseMidiFile(uploadedFile.file);
            } else {
                // Handle other audio files if needed
                setOriginalDuration(0);
            }
        } else if (originalNotes && originalNotes.length > 0) {
            // Handle piano recording notes
            setIsMidiFile(false);
            const maxEndTime = originalNotes.reduce((max, note) => {
                const timestamp = typeof note.timestamp === 'number' ? note.timestamp : 0;
                const duration = typeof note.duration === 'number' ? note.duration : 0;
                const endTime = timestamp + duration;
                return endTime > max ? endTime : max;
            }, 0);
            setOriginalDuration(maxEndTime);
        } else {
            setOriginalDuration(0);
        }

        // Fetch genre breakdown when component mounts
        fetchGenreBreakdown();

        return () => {
            stopOriginalPlayback(true);
            
            if (originalSynthRef.current) {
                originalSynthRef.current.releaseAll();
                originalSynthRef.current.dispose();
                originalSynthRef.current = null;
            }
            
            if (playbackIntervalRef.current) {
                clearInterval(playbackIntervalRef.current);
                playbackIntervalRef.current = null;
            }
            
            scheduledEventsRef.current.forEach(id => Tone.Transport.clear(id));
            scheduledEventsRef.current = [];
            
            Tone.Transport.cancel();
            Tone.Transport.stop();
            Tone.Transport.position = 0;
        };
    }, [originalNotes, uploadedFile]);

    // --- Audio Context Starter ---
    const startAudio = async () => {
        if (Tone.context.state !== 'running') {
            await Tone.start();
            console.log('AudioContext started successfully for ResultPage');
        }
    };

    // --- Play Original Recording Logic (handles both piano and MIDI) ---
    const playOriginalRecording = async () => {
        if (isPlayingOriginal || !originalSynthRef.current) return;

        // Check if we have data to play
        const hasDataToPlay = (isMidiFile && midiData) || (!isMidiFile && originalNotes && originalNotes.length > 0);
        if (!hasDataToPlay) return;

        await startAudio();

        setOriginalPlaybackTime(0);
        let startPosition = 0;

        stopOriginalPlayback(true);
        
        Tone.Transport.cancel();
        Tone.Transport.stop();
        Tone.Transport.position = 0;
        
        if (originalSynthRef.current) {
            originalSynthRef.current.releaseAll();
            originalSynthRef.current.dispose();
            originalSynthRef.current = new Tone.PolySynth(Tone.Synth).toDestination();
        }
        
        Tone.Transport.start();
        
        setIsPlayingOriginal(true);
        scheduledEventsRef.current = [];
        startTimeRef.current = Date.now() - startPosition;

        if (isMidiFile && midiData) {
            // Schedule MIDI events
            midiData.tracks.forEach(track => {
                track.events.forEach(event => {
                    const eventTimeMs = event.time * 1000;
                    
                    if (eventTimeMs >= startPosition) {
                        const adjustedTime = (eventTimeMs - startPosition) / 1000;
                        
                        if (event.type === 'noteOn') {
                            const eventId = Tone.Transport.scheduleOnce((time) => {
                                originalSynthRef.current?.triggerAttack(event.note, time, event.velocity / 127);
                            }, adjustedTime);
                            scheduledEventsRef.current.push(eventId);
                            
                        } else if (event.type === 'noteOff') {
                            const eventId = Tone.Transport.scheduleOnce((time) => {
                                originalSynthRef.current?.triggerRelease(event.note, time);
                            }, adjustedTime);
                            scheduledEventsRef.current.push(eventId);
                        }
                    }
                });
            });
        } else {
            // Schedule piano recording notes
            originalNotes.forEach(note => {
                if (note.duration > 0 && note.timestamp >= 0) {
                    if (note.timestamp >= startPosition) {
                        const adjustedStartTime = (note.timestamp - startPosition) / 1000;
                        const durationSec = note.duration / 1000;

                        const eventId = Tone.Transport.scheduleOnce((time) => {
                            originalSynthRef.current?.triggerAttackRelease(
                                note.note,
                                durationSec,
                                time
                            );
                        }, adjustedStartTime);
                        scheduledEventsRef.current.push(eventId);
                    }
                } else {
                    console.warn("Skipping invalid note in original recording:", note);
                }
            });
        }

        // Update progress bar
        playbackIntervalRef.current = setInterval(() => {
            const elapsed = Date.now() - startTimeRef.current;
            
            if (elapsed >= originalDuration) {
                setOriginalPlaybackTime(originalDuration);
                stopOriginalPlayback(false, true);
            } else {
                setOriginalPlaybackTime(elapsed);
            }
        }, 50);

        // Schedule stop at the end
        const remainingDuration = (originalDuration - startPosition) / 1000;
        const stopEventId = Tone.Transport.scheduleOnce(() => {
            stopOriginalPlayback(false, true); 
        }, remainingDuration);
        scheduledEventsRef.current.push(stopEventId);
    };

    // --- Stop Original Recording Logic ---
    const stopOriginalPlayback = (cancelEvents = true, playbackCompleted = false) => {
        setIsPlayingOriginal(false);
        
        pausedAtTimeRef.current = originalPlaybackTime;
        
        if (playbackIntervalRef.current) {
            clearInterval(playbackIntervalRef.current);
            playbackIntervalRef.current = null;
        }

        if (playbackCompleted) {
            setOriginalPlaybackTime(originalDuration);
        }
        
        if (cancelEvents) {
            scheduledEventsRef.current.forEach(id => Tone.Transport.clear(id));
            scheduledEventsRef.current = [];

            if (originalSynthRef.current) {
                originalSynthRef.current.releaseAll();
            }
            
            Tone.Transport.cancel();
        }
    };

    // --- Button Handler ---
    const handlePlayPauseOriginal = () => {
        if (isPlayingOriginal) {
            stopOriginalPlayback(true, false);
        } else {
            setDisableTransition(true);
            setOriginalPlaybackTime(0);
            
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    setDisableTransition(false);
                    playOriginalRecording();
                });
            });
        }
    };

    // --- Download Handlers ---
    const handleDownload = () => {
        if (enhancedAudioUrl) {
            const link = document.createElement('a');
            link.href = enhancedAudioUrl;
            link.download = 'enhanced-audio.wav';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            console.log("Downloading Enhanced:", enhancedAudioUrl);
        } else {
            alert("No enhanced audio URL available for download.");
        }
    };

    const handleDownloadOriginal = () => {
        alert("Download Original MIDI/Audio - Functionality Placeholder");
    };

    // --- Calculate Progress ---
    const originalProgress = originalDuration > 0 ? (originalPlaybackTime / originalDuration) * 100 : 0;

    // Determine what to show in the original input section
    const getOriginalInputInfo = () => {
        if (loadingMidi) {
            return { title: 'Loading MIDI...', subtitle: 'Parsing uploaded file' };
        }
        if (midiError) {
            return { title: 'Error', subtitle: midiError };
        }
        if (isMidiFile && uploadedFile) {
            return { title: uploadedFile.name, subtitle: 'Uploaded MIDI File' };
        }
        if (originalNotes && originalNotes.length > 0) {
            return { title: 'Your Recording', subtitle: 'Saved as MIDI' };
        }
        return { title: 'No Input', subtitle: 'No audio data available' };
    };

    const inputInfo = getOriginalInputInfo();
    const hasPlayableContent = (isMidiFile && midiData && !midiError) || (!isMidiFile && originalNotes && originalNotes.length > 0);

    return (
        <div className="result-page-container">
            {/* Left Side - Empty Container */}
            <div className="left-container">
                {/* This can be used for additional content later */}
            </div>

            {/* Right Side - Main Content */}
            <div className="right-container">
                <div className="result-content-card">
                    <h2>Your Enhanced Audio</h2>
                    <div className="result-ai-assistant">
                        <img src={robot} alt="AI Assistant" />
                    </div>

                    {/* --- Original Track Section --- */}
                    <h4 className="track-section-title">Original Track</h4>
                    <div className="audio-player-mock original-track">
                        <div className="audio-details">
                            <h3>{inputInfo.title}</h3>
                            <p>Uploaded on {new Date().toLocaleDateString()}</p>
                            
                            {loadingMidi && (
                                <div className="loading-indicator">
                                    <div className="spinner"></div>
                                    <span>Parsing MIDI file...</span>
                                </div>
                            )}
                            
                            {midiError && (
                                <div className="error-message">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M13,13H11V7H13M13,17H11V15H13M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z" />
                                    </svg>
                                    {midiError}
                                </div>
                            )}
                            
                            {!loadingMidi && !midiError && (
                                <div className="player-controls">
                                    <button
                                        className="play-pause-button original-play"
                                        onClick={handlePlayPauseOriginal}
                                        disabled={!hasPlayableContent}
                                    >
                                        {isPlayingOriginal ? (
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"></path>
                                            </svg>
                                        ) : (
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                                <path d="M8 5v14l11-7z"></path>
                                            </svg>
                                        )}
                                    </button>
                                    <span className="time-current">{formatTime(originalPlaybackTime)}</span>
                                    <div className="progress-bar-container">
                                        <div
                                            className="progress-bar"
                                            style={{ 
                                                width: `${Math.min(100, originalProgress)}%`,
                                                transition: disableTransition ? 'none' : 'width 0.3s ease-in-out'
                                            }}
                                        ></div>
                                    </div>
                                    <span className="time-total">{formatTime(originalDuration)}</span>
                                </div>
                            )}
                        </div>
                    </div>
                    {/* --- End Original Track Section --- */}

                    {/* --- Enhanced Track Section --- */}
                    <h4 className="track-section-title">Enhanced Track</h4>
                    <div className="audio-player-mock enhanced-track">
                        <div className="audio-details">
                            <h3>Enhanced Track</h3>
                            <p>Generated on {new Date().toLocaleDateString()}</p>
                            <div className="player-controls">
                                <button className="play-pause-button enhanced-play">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M8 5v14l11-7z"></path>
                                    </svg>
                                </button>
                                <span className="time-current">0:00</span>
                                <div className="progress-bar-container">
                                    <div className="progress-bar" style={{ width: '0%' }}></div>
                                </div>
                                <span className="time-total">3:00</span>
                            </div>
                        </div>
                    </div>
                    {/* --- End Enhanced Track Section --- */}

                    {/* --- Genre Breakdown Section --- */}
                    <h4 className="track-section-title">Genre Breakdown</h4>
                    <div className="genre-breakdown-container">
                        {loadingGenres ? (
                            <div className="genre-loading">
                                <div className="spinner"></div>
                                <span>Analyzing music genres...</span>
                            </div>
                        ) : (
                            <div className="genre-list">
                                {genreBreakdown.map((item, index) => (
                                    <div key={index} className="genre-item">
                                        <div className="genre-info">
                                            <span className="genre-name">{item.genre}</span>
                                            <span className="genre-percentage">{item.percentage}%</span>
                                        </div>
                                        <div className="genre-bar-container">
                                            <div 
                                                className="genre-bar"
                                                style={{ width: `${item.percentage}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    {/* --- End Genre Breakdown Section --- */}

                    <div className="result-actions">
                        <button className="download-button" onClick={handleDownload}>
                            Download Enhanced Audio
                        </button>
                        <button className="start-new-button" onClick={onStartNew}>
                            Start New Enhancement
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ResultPage;