import os
import uuid
from pathlib import Path
from typing import Optional

# try:
#     from basic_pitch.inference import predict_and_save
#     BASIC_PITCH_AVAILABLE = True
# except ImportError:
#     BASIC_PITCH_AVAILABLE = False
#     print("Warning: basic-pitch not installed. Audio-to-MIDI will not work.")

BASIC_PITCH_AVAILABLE = False
print("DEBUG: midi_service.py execution started")

class AudioToMidi:
    """
    Service to convert audio files to MIDI using basic-pitch.
    """
    BASIC_PITCH_AVAILABLE = BASIC_PITCH_AVAILABLE
    
    def __init__(self, output_dir: str = "generated_midi"):
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        self.output_dir = os.path.join(base_dir, output_dir)
        os.makedirs(self.output_dir, exist_ok=True)
        print(f"AudioToMidiService initialized with output_dir: {self.output_dir}")
        
    async def convert_audio_to_midi(self, input_file: str) -> dict:
        """
        Convert an audio file to a MIDI file.
        Returns a dictionary with the filename and URL of the generated MIDI.
        """
        if not BASIC_PITCH_AVAILABLE:
            raise ImportError("basic-pitch library is not installed on the server.")
            
        try:
            # Generate a unique filename for the output
            job_id = str(uuid.uuid4())[:8]
            output_filename = f"midi_convention_{job_id}.mid"
            output_path = os.path.join(self.output_dir, output_filename)
            
            # Predict and save
            # basic-pitch saves multiple files if save_midi=True, save_notes=True, etc.
            # predict_and_save returns [midi_path, note_events_path, ...]
            # We only want the MIDI file.
            
            print(f"Converting {input_file} to MIDI...")
            
            # Basic Pitch API: predict_and_save(audio_path_list, output_directory, save_midi, save_model_outputs, save_notes)
            # It processes a list of files.
            
            # Note: predict_and_save is a synchronous function, so we might want to run it in an executor if it blocks too long.
            # But for a prototype, calling it directly is fine for now, or we can use run_in_executor.
            
            import asyncio
            loop = asyncio.get_event_loop()
            
            # Running in executor to avoid blocking the main thread
            await loop.run_in_executor(
                None, 
                lambda: predict_and_save(
                    [input_file], 
                    self.output_dir, 
                    save_midi=True, 
                    sonify_midi=False, 
                    save_model_outputs=False, 
                    save_notes=False
                )
            )
            
            # basic-pitch derives the output filename from the input filename.
            # e.g., input.mp3 -> input_basic_pitch.mid
            # We need to find the generated file and rename it to our UUID based name.
            
            input_stem = Path(input_file).stem
            expected_output = os.path.join(self.output_dir, f"{input_stem}_basic_pitch.mid")
            
            if os.path.exists(expected_output):
                # Rename to our ID-based name
                os.rename(expected_output, output_path)
                return {
                    "status": "success",
                    "url": f"/generated_midi/{output_filename}",
                    "filename": output_filename
                }
            else:
                # Fallback: maybe it didn't append _basic_pitch? or input file had spaces?
                # Let's list the directory and see if we can find a new .mid file created recently.
                raise FileNotFoundError(f"Could not find generated MIDI file at expected location: {expected_output}")

        except Exception as e:
            print(f"Error converting audio to MIDI: {e}")
            raise e

class MockAudioToMidiService:
    """Mock service."""
    def __init__(self, output_dir: str = "generated_midi"):
        pass

    async def convert_audio_to_midi(self, input_file: str) -> dict:
        import asyncio
        await asyncio.sleep(2) # Simulate processing
        return {
            "status": "success",
            "url": "/generated_midi/mock_melody.mid",
            "filename": "mock_melody.mid"
        }
