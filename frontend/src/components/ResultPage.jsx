// src/components/ResultPage.jsx
import React, { useState, useEffect, useRef } from 'react';
import * as Tone from 'tone'; // Import Tone.js
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

// Receive originalNotes prop
const ResultPage = ({ onStartNew, enhancedAudioUrl, originalNotes = [] }) => {

    // --- State for Original Playback ---
    const [isPlayingOriginal, setIsPlayingOriginal] = useState(false);
    const [originalPlaybackTime, setOriginalPlaybackTime] = useState(0); // in ms
    const [originalDuration, setOriginalDuration] = useState(0); // in ms
    // Add state to temporarily disable progress bar transition
    const [disableTransition, setDisableTransition] = useState(false);

    // --- Refs for Original Playback ---
    const originalSynthRef = useRef(null);
    const playbackIntervalRef = useRef(null);
    const scheduledEventsRef = useRef([]); // Store Tone event IDs
    const pausedAtTimeRef = useRef(0); // Store time position when paused
    const startTimeRef = useRef(0); // To track when playback started

    // --- Initialize Synth and Calculate Duration ---
    useEffect(() => {
        // Create a dedicated synth instance for original playback
        originalSynthRef.current = new Tone.PolySynth(Tone.Synth).toDestination();

        // Calculate total duration based on originalNotes
        if (originalNotes && originalNotes.length > 0) {
            const maxEndTime = originalNotes.reduce((max, note) => {
                 // Ensure timestamp and duration are valid numbers
                 const timestamp = typeof note.timestamp === 'number' ? note.timestamp : 0;
                 const duration = typeof note.duration === 'number' ? note.duration : 0;
                 const endTime = timestamp + duration;
                return endTime > max ? endTime : max;
            }, 0);
            setOriginalDuration(maxEndTime);
        } else {
            setOriginalDuration(0);
        }

        // Cleanup on unmount
        return () => {
            stopOriginalPlayback(true); // Stop playback and clear events
            
            // Complete cleanup of Tone.js
            if (originalSynthRef.current) {
                originalSynthRef.current.releaseAll();
                originalSynthRef.current.dispose();
                originalSynthRef.current = null;
            }
            
            if (playbackIntervalRef.current) {
                clearInterval(playbackIntervalRef.current);
                playbackIntervalRef.current = null;
            }
            
            // Clear any lingering Tone.Transport events
            scheduledEventsRef.current.forEach(id => Tone.Transport.clear(id));
            scheduledEventsRef.current = [];
            
            // Make sure Transport is completely reset
            Tone.Transport.cancel(); // Cancel all events
            Tone.Transport.stop();
            Tone.Transport.position = 0;
        };
    }, [originalNotes]); // Rerun if originalNotes changes

    // --- Audio Context Starter ---
    const startAudio = async () => {
        if (Tone.context.state !== 'running') {
            await Tone.start();
            console.log('AudioContext started successfully for ResultPage');
        }
    };

    // --- Play Original Recording Logic ---
    const playOriginalRecording = async () => {
        if (isPlayingOriginal || !originalNotes || originalNotes.length === 0 || !originalSynthRef.current) return;

        await startAudio(); // Ensure audio context is running

        // CRITICAL: Always reset the progress bar to 0 when starting playback
        setOriginalPlaybackTime(0);
        let startPosition = 0; // Always start from the beginning

        // IMPORTANT: Stop previous playback and completely reset all Tone.js state
        stopOriginalPlayback(true);
        
        // Completely clean up transport and reset it
        Tone.Transport.cancel(); // Cancel ALL scheduled events
        Tone.Transport.stop();
        Tone.Transport.position = 0;
        
        // Also reset the synth to ensure no lingering notes
        if (originalSynthRef.current) {
            originalSynthRef.current.releaseAll();
            // Recreate the synth to ensure a completely fresh state
            originalSynthRef.current.dispose();
            originalSynthRef.current = new Tone.PolySynth(Tone.Synth).toDestination();
        }
        
        // Now start a completely fresh transport
        Tone.Transport.start();
        
        setIsPlayingOriginal(true);
        
        scheduledEventsRef.current = []; // Clear previous event IDs
        
        // Record the current time for progress tracking
        startTimeRef.current = Date.now() - startPosition;

        // Schedule all notes relative to the Transport timeline
        originalNotes.forEach(note => {
            if (note.duration > 0 && note.timestamp >= 0) {
                // Only schedule notes that should play after our current position
                if (note.timestamp >= startPosition) {
                    const adjustedStartTime = (note.timestamp - startPosition) / 1000; // Convert to seconds
                    const durationSec = note.duration / 1000;

                    // Schedule using Tone.Transport for better timing control
                    const eventId = Tone.Transport.scheduleOnce((time) => {
                        originalSynthRef.current?.triggerAttackRelease(
                            note.note,
                            durationSec,
                            time // Use the exact scheduled time
                        );
                    }, adjustedStartTime);
                    scheduledEventsRef.current.push(eventId); // Store event ID for cancellation
                }
            } else {
                console.warn("Skipping invalid note in original recording:", note);
            }
        });

        // Update progress bar using an interval
        playbackIntervalRef.current = setInterval(() => {
            // Calculate elapsed time since playback started
            const elapsed = Date.now() - startTimeRef.current;
            
            if (elapsed >= originalDuration) {
                // Set playback time to exactly the duration (fill progress bar completely)
                setOriginalPlaybackTime(originalDuration);
                // Then stop playback with completed flag true
                stopOriginalPlayback(false, true); // Auto-stop at the end, keep position at end
            } else {
                setOriginalPlaybackTime(elapsed);
            }
        }, 50); // Update interval (e.g., every 50ms)

        // Schedule stop at the end of playback
        const remainingDuration = (originalDuration - startPosition) / 1000; // seconds
        const stopEventId = Tone.Transport.scheduleOnce(() => {
            // This ensures that when we reach the end naturally, we:
            // 1. Stop playback
            // 2. Set the progress to 100% (done in stopOriginalPlayback with playbackCompleted=true)
            // 3. Don't reset to beginning
            stopOriginalPlayback(false, true); 
        }, remainingDuration);
        scheduledEventsRef.current.push(stopEventId);
    };

    // --- Stop Original Recording Logic ---
    const stopOriginalPlayback = (cancelEvents = true, playbackCompleted = false) => {
        setIsPlayingOriginal(false);
        
        // Store the current playback time when pausing
        pausedAtTimeRef.current = originalPlaybackTime;
        
        if (playbackIntervalRef.current) {
            clearInterval(playbackIntervalRef.current);
            playbackIntervalRef.current = null;
        }

        // If playback completed naturally, set time to the full duration
        if (playbackCompleted) {
            setOriginalPlaybackTime(originalDuration); // Set to full duration when completed
        }
        // Don't reset the time otherwise, so it stays where it stopped
        
        if (cancelEvents) {
            // Cancel scheduled Tone events
            scheduledEventsRef.current.forEach(id => Tone.Transport.clear(id));
            scheduledEventsRef.current = []; // Clear the stored IDs

            // Stop any currently sounding notes from the synth
            if (originalSynthRef.current) {
                originalSynthRef.current.releaseAll();
            }
            
            // Also cancel any lingering events on the Transport
            // This helps prevent echo effects
            Tone.Transport.cancel();
        }
    };

    // --- Button Handler ---
    const handlePlayPauseOriginal = () => {
        if (isPlayingOriginal) {
            stopOriginalPlayback(true, false); // Manually stop, cancel events, don't reset position
        } else {
            // Reset the progress bar without transition
            setDisableTransition(true);
            setOriginalPlaybackTime(0);
            
            // Use requestAnimationFrame to ensure the DOM updates before continuing
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    // Re-enable transition after the DOM has updated
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

    return (
        <div className="result-page-container">
            <div className="result-content-card">
                <h2>Your Enhanced Audio</h2>
                <div className="result-ai-assistant">
                    <img src={robot} alt="AI Assistant" />
                </div>

                {/* --- Original Input Section --- */}
                <h4 className="track-section-title">Original Input</h4>
                <div className="audio-player-mock original-track">
                    <div className="audio-details">
                        <h3>Your Recording</h3>
                        <p>Saved as MIDI</p>
                        <div className="player-controls">
                            <button
                                className="play-pause-button original-play"
                                onClick={handlePlayPauseOriginal}
                                disabled={!originalNotes || originalNotes.length === 0} // Disable if no notes
                            >
                                {isPlayingOriginal ? (
                                    // Pause Icon
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"></path></svg>
                                ) : (
                                    // Play Icon
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"></path></svg>
                                )}
                            </button>
                            {/* Display formatted current time */}
                            <span className="time-current">{formatTime(originalPlaybackTime)}</span>
                            <div className="progress-bar-container">
                                {/* Update progress bar style */}
                                <div
                                    className="progress-bar"
                                    style={{ 
                                        width: `${Math.min(100, originalProgress)}%`,
                                        transition: disableTransition ? 'none' : 'width 0.3s ease-in-out'
                                    }}
                                ></div>
                            </div>
                            {/* Display formatted total duration */}
                            <span className="time-total">{formatTime(originalDuration)}</span>
                            {/* Optional download button */}
                            {/* <button className="download-original-button" onClick={handleDownloadOriginal}>...</button> */}
                        </div>
                    </div>
                </div>
                {/* --- End Original Input Section --- */}

                {/* --- Enhanced Track Section (remains mostly unchanged) --- */}
                <h4 className="track-section-title">Enhanced Track</h4>
                <div className="audio-player-mock enhanced-track">
                    <div className="audio-details">
                        <h3>Enhanced Track</h3>
                        <p>Generated on November 15, 2023</p>
                        <div className="player-controls">
                            {/* Note: Keep this separate logic if enhanced is a real audio file */}
                            <button className="play-pause-button enhanced-play">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"></path></svg>
                            </button>
                            <span className="time-current">0:00</span>
                            <div className="progress-bar-container">
                                <div className="progress-bar" style={{ width: '0%' }}></div> {/* Placeholder */}
                            </div>
                            <span className="time-total">3:00</span>{/* Placeholder */}
                            <button className="volume-button">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"></path></svg>
                            </button>
                        </div>
                    </div>
                </div>
                {/* --- End Enhanced Track Section --- */}

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
    );
};

export default ResultPage;