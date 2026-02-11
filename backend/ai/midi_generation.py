import os

class MidiService:
    def __init__(self):
        self.base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        self.output_dir = os.path.join(self.base_dir, "generated_midi")
        os.makedirs(self.output_dir, exist_ok=True)

    def generate_melody_from_pattern(self, pattern: str) -> str:
        """
        Mock generation of MIDI from a pattern name.
        Returns the relative URL to the generated file.
        """
        # In a real app, this would use a model to generate MIDI.
        # For now, we'll just return a path to a mock file.
        # We assume the file exists or the frontend handles 404 gracefully.
        # Actually, let's create a dummy file if it doesn't exist.
        
        filename = f"{pattern}.mid"
        filepath = os.path.join(self.output_dir, filename)
        
        if not os.path.exists(filepath):
            # Create a dummy empty file or minimal MIDI header if possible, 
            # but for now just an empty file to avoid 404 on download if checked.
            with open(filepath, "wb") as f:
                f.write(b"MThd\x00\x00\x00\x06\x00\x01\x00\x01\x01\xe0MTrk\x00\x00\x00\x0b\x00\xff\x2f\x00") # Minimal valid MIDI header
        
        return f"/generated_midi/{filename}"
