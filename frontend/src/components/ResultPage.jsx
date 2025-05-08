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

    // --- Refs for Original Playback ---
    const originalSynthRef = useRef(null);
    const playbackIntervalRef = useRef(null);
    const scheduledEventsRef = useRef([]); // Store Tone event IDs

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
            if (originalSynthRef.current) {
                originalSynthRef.current.dispose();
            }
            if (playbackIntervalRef.current) {
                clearInterval(playbackIntervalRef.current);
            }
            // Clear any lingering Tone.Transport events if necessary
             scheduledEventsRef.current.forEach(id => Tone.Transport.clear(id));
             scheduledEventsRef.current = [];
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

        // Ensure Tone.Transport is started
        if (Tone.Transport.state !== 'started') {
            await Tone.Transport.start();
        }


        stopOriginalPlayback(true); // Clear previous state/events before starting new playback
        setIsPlayingOriginal(true);
        setOriginalPlaybackTime(0);
        scheduledEventsRef.current = []; // Clear previous event IDs

        const now = Tone.now(); // Use Tone's context time

        originalNotes.forEach(note => {
            if (note.duration > 0 && note.timestamp >= 0) {
                 const startTimeSec = note.timestamp / 1000; // Relative to Transport start
                 const durationSec = note.duration / 1000;

                // Schedule using Tone.Transport for better timing control
                 const eventId = Tone.Transport.scheduleOnce((time) => {
                    originalSynthRef.current?.triggerAttackRelease(
                        note.note,
                        durationSec,
                        time // Use the exact scheduled time
                    );
                 }, startTimeSec);
                 scheduledEventsRef.current.push(eventId); // Store event ID for cancellation

            } else {
                 console.warn("Skipping invalid note in original recording:", note);
            }
        });

        // Update progress bar using an interval based on Transport position
        const startTimeMs = Date.now();
        playbackIntervalRef.current = setInterval(() => {
            // Use elapsed time since start, clamped by duration
            const elapsed = Date.now() - startTimeMs;
             if (elapsed >= originalDuration) {
                 stopOriginalPlayback(false); // Auto-stop at the end
             } else {
                setOriginalPlaybackTime(elapsed);
             }
        }, 50); // Update interval (e.g., every 50ms)

        // Schedule stop using Tone.Transport
         const stopEventId = Tone.Transport.scheduleOnce(() => {
             stopOriginalPlayback(false); // Stop naturally without cancelling events
         }, originalDuration / 1000); // Schedule stop at the calculated end time
         scheduledEventsRef.current.push(stopEventId);


    };

    // --- Stop Original Recording Logic ---
    const stopOriginalPlayback = (cancelEvents = true) => {
        setIsPlayingOriginal(false);
        if (playbackIntervalRef.current) {
            clearInterval(playbackIntervalRef.current);
            playbackIntervalRef.current = null;
        }

        // Reset time only if stopping manually or at the very end
        if (cancelEvents || originalPlaybackTime >= originalDuration) {
             setOriginalPlaybackTime(0); // Reset time when manually stopped or finished
        }


        if (cancelEvents) {
             // Cancel scheduled Tone events
            scheduledEventsRef.current.forEach(id => Tone.Transport.clear(id));
            scheduledEventsRef.current = []; // Clear the stored IDs

             // Stop any currently sounding notes from the synth
             originalSynthRef.current?.releaseAll();

             // Ensure transport stops if nothing else is scheduled
              if (Tone.Transport.state === 'started') {
                // Check if any other events might be scheduled? For safety, maybe don't stop transport globally here
                // Or only stop if it was started specifically by this component?
                 // Let's be cautious and avoid stopping transport globally unless sure.
                 // Tone.Transport.stop(); // Maybe risky if other components use Transport
              }

        }
         // Note: Do not clear scheduledEventsRef if cancelEvents is false,
         // as the events (like the final stop event) should complete naturally.
         // However, we should clear it after the natural stop occurs.
          if (!cancelEvents) {
             // If stopping naturally, clear the ref after a short delay
             setTimeout(() => { scheduledEventsRef.current = []; }, 10);
          }
    };

    // --- Button Handler ---
    const handlePlayPauseOriginal = () => {
        if (isPlayingOriginal) {
            stopOriginalPlayback(true); // Manually stop, cancel events
        } else {
            playOriginalRecording();
        }
    };


    // --- Download Handlers ---
    const handleDownload = () => {
        // ... (existing enhanced download logic) ...
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
                                    style={{ width: `${Math.min(100, originalProgress)}%` }} // Ensure width doesn't exceed 100%
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