import os
import uuid
import mido

class MidiService:
    def __init__(self):
        self.base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        self.output_dir = os.path.join(self.base_dir, "generated_midi")
        os.makedirs(self.output_dir, exist_ok=True)

    def generate_melody_from_pattern(self, pattern: str) -> str:
        """
        Generates a real MIDI file with actual notes, chords, or rhythm based on pattern request.
        Returns the relative URL to the generated file.
        """
        pattern_lower = pattern.lower()
        filename = f"{pattern_lower}_{uuid.uuid4().hex[:6]}.mid"
        filepath = os.path.join(self.output_dir, filename)
        
        mid = mido.MidiFile(ticks_per_beat=480)
        track = mido.MidiTrack()
        mid.tracks.append(track)
        
        # Set tempo to 120 BPM
        track.append(mido.MetaMessage('set_tempo', tempo=mido.bpm2tempo(120), time=0))
        
        if "violin" in pattern_lower or "sad" in pattern_lower:
            # Sad Violin Melody in A Minor (Violin program = 40)
            track.append(mido.Message('program_change', program=40, time=0))
            # Notes: A4, C5, B4, E5, D5, C5, B4, A4
            melody_notes = [(69, 480), (72, 480), (71, 480), (76, 960), (74, 480), (72, 480), (71, 480), (69, 960)]
            for note, dur in melody_notes:
                track.append(mido.Message('note_on', note=note, velocity=85, time=0))
                track.append(mido.Message('note_off', note=note, velocity=0, time=dur))
                
        elif "bass" in pattern_lower or "house" in pattern_lower:
            # Driving House Bassline (Synth Bass program = 38)
            track.append(mido.Message('program_change', program=38, time=0))
            # 16th note pattern in C minor
            bass_pattern = [36, 36, 39, 36, 41, 36, 43, 41] * 2
            for note in bass_pattern:
                track.append(mido.Message('note_on', note=note, velocity=105, time=0))
                track.append(mido.Message('note_off', note=note, velocity=0, time=240)) # 16th note = 120 ticks, 8th = 240
                
        elif "chord" in pattern_lower or "c_major" in pattern_lower:
            # Polyphonic Chord Progression (Acoustic Piano program = 0)
            track.append(mido.Message('program_change', program=0, time=0))
            # Chords: Cmaj7 (60,64,67,71), Am7 (57,60,64,67), Dm7 (58,62,65,69), G7 (55,59,62,65)
            chords = [
                ([60, 64, 67, 71], 960), # Cmaj7
                ([57, 60, 64, 67], 960), # Am7
                ([58, 62, 65, 69], 960), # Dm7
                ([55, 59, 62, 65], 960), # G7
            ]
            for chord_notes, dur in chords:
                for note in chord_notes:
                    track.append(mido.Message('note_on', note=note, velocity=90, time=0))
                # Release first note after duration and others simultaneously
                for i, note in enumerate(chord_notes):
                    delta = dur if i == 0 else 0
                    track.append(mido.Message('note_off', note=note, velocity=0, time=delta))

        else:
            # Default / Beat Pattern (Percussion channel 10 or lead synth)
            track.append(mido.Message('program_change', program=81, time=0))
            scale_notes = [60, 62, 64, 67, 69, 72, 74, 76]
            for note in scale_notes:
                track.append(mido.Message('note_on', note=note, velocity=90, time=0))
                track.append(mido.Message('note_off', note=note, velocity=0, time=240))
                
        mid.save(filepath)
        print(f"Generated real MIDI file: {filepath}")
        return f"/generated_midi/{filename}"

