
import whisper
import os

class TranscriptionService:
    def __init__(self, model_size="base"):
        print(f"Loading Whisper model: {model_size}...")
        try:
            self.model = whisper.load_model(model_size)
            print("Whisper model loaded successfully.")
            self.WHISPER_AVAILABLE = True
        except Exception as e:
            print(f"Failed to load Whisper model: {e}")
            self.WHISPER_AVAILABLE = False
            self.model = None

    def transcribe(self, audio_path):
        if not self.WHISPER_AVAILABLE:
            raise Exception("Whisper model not available.")
        
        if not os.path.exists(audio_path):
            raise FileNotFoundError(f"Audio file not found: {audio_path}")

        try:
            result = self.model.transcribe(audio_path)
            return result["text"]
        except Exception as e:
            print(f"Transcription error: {e}")
            raise e

class MockTranscriptionService:
    def __init__(self):
        print("Initialized Mock Transcription Service")
        self.WHISPER_AVAILABLE = False # Mock doesn't use real whisper

    def transcribe(self, audio_path):
        return "This is a mock transcription of the audio file. The actual transcription service is not available or failed to load."
