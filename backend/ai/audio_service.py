from abc import ABC, abstractmethod
import time

class AudioService(ABC):
    @abstractmethod
    def generate_audio(self, prompt: str, duration: int = 5) -> str:
        pass

class MockAudioService(AudioService):
    def generate_audio(self, prompt: str, duration: int = 5) -> str:
        print(f"Mock generating audio for: {prompt}")
        # Return a dummy path or URL
        return f"/generated/mock_audio_{int(time.time())}.wav"

class LocalAudioService(AudioService):
    def generate_audio(self, prompt: str, duration: int = 5) -> str:
        # Placeholder for local model inference (e.g., MusicGen)
        print(f"Local model generating audio for: {prompt}")
        return f"/generated/local_audio_{int(time.time())}.wav"
