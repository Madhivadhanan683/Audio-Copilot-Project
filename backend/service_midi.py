import os
import uuid
from pathlib import Path
import librosa
import numpy as np
import mido

class AudioToMidi:
    """
    Service to convert audio files to MIDI using signal processing (librosa pYIN + mido).
    Accurately tracks fundamental pitch and writes real .mid note events.
    """
    BASIC_PITCH_AVAILABLE = True
    
    def __init__(self, output_dir: str = "generated_midi"):
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        self.output_dir = os.path.join(base_dir, output_dir)
        os.makedirs(self.output_dir, exist_ok=True)
        print(f"AudioToMidiService initialized with output_dir: {self.output_dir}")
        
    async def convert_audio_to_midi(self, input_file: str) -> dict:
        """
        Convert an audio file to a MIDI file using pitch tracking.
        Returns a dictionary with the filename and URL of the generated MIDI.
        """
        import asyncio
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self._process_conversion, input_file)

    def _process_conversion(self, input_file: str) -> dict:
        try:
            job_id = str(uuid.uuid4())[:8]
            output_filename = f"pitch_conversion_{job_id}.mid"
            output_path = os.path.join(self.output_dir, output_filename)

            print(f"Converting {input_file} to MIDI...")
            
            # Load audio file
            y, sr = librosa.load(input_file, sr=22050)
            
            # Extract fundamental frequency using pYIN pitch tracker
            f0, voiced_flag, voiced_probs = librosa.pyin(
                y,
                fmin=librosa.note_to_hz('C2'),
                fmax=librosa.note_to_hz('C7'),
                sr=sr,
                frame_length=2048,
                hop_length=512
            )
            
            mid = mido.MidiFile(ticks_per_beat=480)
            track = mido.MidiTrack()
            mid.tracks.append(track)
            
            hop_length = 512
            frame_time = hop_length / sr
            ticks_per_second = (480 * 120) / 60  # Default 120 BPM
            
            current_note = None
            start_frame = 0
            notes_to_write = []
            
            for i, (f, v) in enumerate(zip(f0, voiced_flag)):
                if v and not np.isnan(f):
                    midi_note = int(round(librosa.hz_to_midi(f)))
                    midi_note = max(0, min(127, midi_note))
                    
                    if current_note is None:
                        current_note = midi_note
                        start_frame = i
                    elif midi_note != current_note:
                        end_frame = i
                        notes_to_write.append((current_note, start_frame * frame_time, end_frame * frame_time))
                        current_note = midi_note
                        start_frame = i
                else:
                    if current_note is not None:
                        end_frame = i
                        notes_to_write.append((current_note, start_frame * frame_time, end_frame * frame_time))
                        current_note = None

            if current_note is not None:
                end_frame = len(f0)
                notes_to_write.append((current_note, start_frame * frame_time, end_frame * frame_time))

            # Write MIDI note events with delta times
            current_tick = 0
            for note, start_sec, end_sec in notes_to_write:
                note_start_tick = int(start_sec * ticks_per_second)
                note_end_tick = int(end_sec * ticks_per_second)
                note_dur_tick = max(24, note_end_tick - note_start_tick)
                
                delta_start = max(0, note_start_tick - current_tick)
                track.append(mido.Message('note_on', note=note, velocity=95, time=delta_start))
                track.append(mido.Message('note_off', note=note, velocity=0, time=note_dur_tick))
                current_tick = note_start_tick + note_dur_tick
                
            mid.save(output_path)
            print(f"Audio-to-MIDI conversion complete: {output_path}")

            return {
                "status": "success",
                "url": f"/generated_midi/{output_filename}",
                "filename": output_filename
            }
        except Exception as e:
            print(f"Error converting audio to MIDI: {e}")
            raise e

class MockAudioToMidiService(AudioToMidi):
    """Fallback legacy class pointing to real AudioToMidi."""
    pass

