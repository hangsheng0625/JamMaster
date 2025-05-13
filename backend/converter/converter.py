from collections import defaultdict
import mido
from mido import MidiFile, MidiTrack, Message
import numpy as np


# Note Representation

def midi_to_note_name(midi_num, use_flats=False):
    sharp_notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
    flat_notes =  ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']
    
    octave = midi_num // 12 - 1
    note_index = midi_num % 12
    
    return (flat_notes[note_index] if use_flats else sharp_notes[note_index]) + str(octave)

def note_name_to_midi(note_name):
    # Handle both sharps and flats
    if 'b' in note_name:
        note, octave = note_name.split('b')
        note += 'b'
    elif '#' in note_name:
        note, octave = note_name.split('#')
        note += '#'
    else:
        note = note_name[:-1]
        octave = note_name[-1]
    
    sharp_notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
    flat_notes =  ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']
    
    try:
        # Try sharp first, then flat
        note_index = sharp_notes.index(note) if note in sharp_notes else flat_notes.index(note)
        return (int(octave) + 1) * 12 + note_index
    except ValueError:
        return None

## Key and Scale Definitions ##

major_intervals = [0, 2, 4, 5, 7, 9, 11]  # Major scale semitone intervals
minor_intervals = [0, 2, 3, 5, 7, 8, 10]   # Natural minor scale intervals

# Proper key definitions with preferred accidentals
keys = {
    # Sharp keys
    'C': 0,
    'G': 7, 'D': 2, 'A': 9, 'E': 4, 'B': 11, 'F#': 6, 'C#': 1,
    # Flat keys
    'F': 5, 'Bb': 10, 'Eb': 3, 'Ab': 8, 'Db': 1, 'Gb': 6, 'Cb': 11,
    # Enharmonic equivalents
    'D#': 3, 'G#': 8, 'A#': 10
}

# Generate all scales with proper naming
scales = {}
for key_name, semitone in keys.items():
    # Major scales
    scales[f"{key_name} major"] = [(i + semitone) % 12 for i in major_intervals]
    
    # Minor scales (natural minor)
    scales[f"{key_name} minor"] = [(i + semitone) % 12 for i in minor_intervals]

## Key Detection ##

def detect_key(midi_notes):
    # Convert MIDI notes to pitch classes (0-11)
    pitch_classes = [n % 12 for n in midi_notes]
    unique_pitches = list(set(pitch_classes))
    
    best_match = {'key': None, 'score': -1}
    
    for scale_name, scale_pitches in scales.items():
        # Count how many input notes are in this scale
        score = sum(1 for pitch in unique_pitches if pitch in scale_pitches)
        
        # Normalize by number of unique pitches
        normalized_score = score / len(unique_pitches)
        
        if normalized_score > best_match['score']:
            best_match = {'key': scale_name, 'score': normalized_score}
    
    return best_match['key']

## Note Correction ##

def correct_to_nearest_in_key(midi_note, key):
    if key not in scales:
        return midi_note  # Unknown key, return original
    
    scale_pitches = scales[key]
    pitch_class = midi_note % 12
    octave = midi_note // 12
    
    # If already in key, return as-is
    if pitch_class in scale_pitches:
        return midi_note
    
    # Find nearest pitch in key
    distances = []
    for scale_pitch in scale_pitches:
        # Calculate minimal distance considering octave wrapping
        distance = min(
            abs(scale_pitch - pitch_class),
            abs(scale_pitch + 12 - pitch_class),
            abs(scale_pitch - pitch_class - 12)
        )
        distances.append(distance)
    
    # Get the pitch with minimal distance
    nearest_pitch = scale_pitches[np.argmin(distances)]
    
    # Reconstruct MIDI note with corrected pitch
    return nearest_pitch + octave * 12

## Helper Functions ##

def get_preferred_accidental(key):
    """Determine whether to use sharps or flats for a given key"""
    sharp_keys = ['G', 'D', 'A', 'E', 'B', 'F#', 'C#', 'G#', 'D#', 'A#']
    flat_keys = ['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb']
    
    base_key = key.split(' ')[0]
    return 'flat' if base_key in flat_keys else 'sharp'

def extract_notes(midi_path):
    mid = MidiFile(midi_path)
    notes = []
    
    for track in mid.tracks:
        absolute_time = 0
        for msg in track:
            absolute_time += msg.time
            if msg.type == 'note_on' and msg.velocity > 0:
                notes.append({
                    'pitch': msg.note,
                    'start': absolute_time,
                    'end': None,
                    'velocity': msg.velocity,
                    'track': track
                })
            elif msg.type == 'note_off' or (msg.type == 'note_on' and msg.velocity == 0):
                # Find the matching note_on
                for note in reversed(notes):
                    if note['pitch'] == msg.note and note['end'] is None:
                        note['end'] = absolute_time
                        break
    return notes

def create_corrected_midi(original_midi_path, corrected_pitches, output_path):
    """Create new MIDI file that preserves all original timing and messages,
       only changing note pitches"""
    
    mid = MidiFile(original_midi_path)
    note_index = 0  # Tracks which note we're correcting
    
    for track in mid.tracks:
        for msg in track:
            if msg.type == 'note_on' and msg.velocity > 0:
                if note_index < len(corrected_pitches):
                    msg.note = corrected_pitches[note_index]
                    note_index += 1
            elif msg.type == 'note_off' or (msg.type == 'note_on' and msg.velocity == 0):
                if note_index > 0 and note_index <= len(corrected_pitches):
                    msg.note = corrected_pitches[note_index-1]
    
    mid.save(output_path)
    return mid

def process_midi_file(input_path, output_path):
    """Full processing pipeline that preserves original timing"""
    print("processing midi file")
    # 1. Load original MIDI file
    mid = MidiFile(input_path)
    
    # 2. Extract all notes in order they appear
    original_notes = []
    for track in mid.tracks:
        for msg in track:
            if msg.type == 'note_on' and msg.velocity > 0:
                original_notes.append(msg.note)
    
    # 3. Detect key
    detected_key = detect_key(original_notes)
    print(f"Detected key: {detected_key}")
    
    # 4. Correct notes
    corrected_pitches = [correct_to_nearest_in_key(p, detected_key) for p in original_notes]
    
    # 5. Create new MIDI with corrected pitches but original structure
    create_corrected_midi(input_path, corrected_pitches, output_path)
    print(f"Saved corrected MIDI to {output_path}")
    
    # 6. Print diagnostics
    use_flats = get_preferred_accidental(detected_key) == 'flat'
    print("\nSample corrections:")
    for i in range(min(5, len(original_notes))):
        orig_name = midi_to_note_name(original_notes[i], use_flats)
        corrected_name = midi_to_note_name(corrected_pitches[i], use_flats)
        print(f"{orig_name} → {corrected_name}")



if __name__ == "__main__":
    input_midi = "test.mid"  # Change to your input file
    output_midi = "corrected_output.mid"
    
    process_midi_file(input_midi, output_midi)

   