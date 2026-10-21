from .audio_service import RealAudioSynthesizer

class AudioGenerator:
    def __init__(self):
        self.synth = RealAudioSynthesizer()

    def generate(self, prompt: str, audio_type: str = "synth") -> str:
        """
        Generates real synthesized audio based on user prompt and type.
        """
        combined_prompt = f"{audio_type} {prompt}"
        return self.synth.generate_audio(combined_prompt)

