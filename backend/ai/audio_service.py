from abc import ABC, abstractmethod
import time
import os
import uuid
import numpy as np
import scipy.io.wavfile as wavfile

class AudioService(ABC):
    @abstractmethod
    def generate_audio(self, prompt: str, duration: int = 5) -> str:
        pass

class RealAudioSynthesizer(AudioService):
    """
    Real DSP audio synthesizer engine that generates playable PCM WAV audio
    (risers, sub bass drops, synth pads, kick drums, and ambient textures)
    based on text prompts.
    """
    def __init__(self):
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        self.output_dir = os.path.join(base_dir, "generated")
        os.makedirs(self.output_dir, exist_ok=True)
        self.sample_rate = 44100

    def generate_audio(self, prompt: str, duration: int = 5) -> str:
        prompt_lower = prompt.lower()
        num_samples = int(self.sample_rate * duration)
        t = np.linspace(0, duration, num_samples, endpoint=False)
        
        audio = np.zeros(num_samples)
        
        if "riser" in prompt_lower or "sweep" in prompt_lower or "fx" in prompt_lower:
            # White noise pitch sweep riser
            noise = np.random.uniform(-0.5, 0.5, num_samples)
            sweep_env = np.power(t / duration, 2)
            audio = noise * sweep_env
            # Add rising sine tone
            freq_sweep = 100 + (t / duration) ** 2 * 1200
            sine_rise = 0.4 * np.sin(2 * np.pi * np.cumsum(freq_sweep) / self.sample_rate)
            audio = 0.5 * audio + sine_rise
            
        elif "bass" in prompt_lower or "sub" in prompt_lower or "808" in prompt_lower:
            # 808 style decaying sub-bass drop
            pitch_env = 160 * np.exp(-t * 8) + 45
            sine_bass = np.sin(2 * np.pi * np.cumsum(pitch_env) / self.sample_rate)
            amp_env = np.exp(-t * 1.5)
            # Add mild harmonic saturation
            audio = np.tanh(sine_bass * amp_env * 2.0)
            
        elif "kick" in prompt_lower or "drum" in prompt_lower or "beat" in prompt_lower:
            # Punchy kick drum sequence repeated
            beat_interval = int(self.sample_rate * 0.5) # 120 BPM quarter notes
            for start_idx in range(0, num_samples, beat_interval):
                end_idx = min(start_idx + int(self.sample_rate * 0.3), num_samples)
                kick_t = t[:end_idx - start_idx]
                freq = 150 * np.exp(-kick_t * 30) + 45
                kick_wave = np.sin(2 * np.pi * np.cumsum(freq) / self.sample_rate) * np.exp(-kick_t * 10)
                audio[start_idx:end_idx] += kick_wave
                
        else:
            # Ambient Synth Pad / Chord (C minor 9th: C3, Eb3, G3, Bb3, D4)
            notes_hz = [130.81, 155.56, 196.00, 233.08, 293.66]
            synth = np.zeros(num_samples)
            for freq in notes_hz:
                # Detuned saw/sine oscillators for rich warmth
                osc1 = np.sin(2 * np.pi * freq * t)
                osc2 = np.sin(2 * np.pi * (freq * 1.003) * t)
                synth += (osc1 + osc2) * 0.2
            # Envelope (Fade in and out)
            fade_samples = int(self.sample_rate * 0.5)
            env = np.ones(num_samples)
            env[:fade_samples] = np.linspace(0, 1, fade_samples)
            env[-fade_samples:] = np.linspace(1, 0, fade_samples)
            audio = synth * env

        # Normalize and convert to 16-bit PCM WAV
        max_val = np.max(np.abs(audio))
        if max_val > 0:
            audio = (audio / max_val * 32000).astype(np.int16)
            
        filename = f"synth_{int(time.time())}_{uuid.uuid4().hex[:4]}.wav"
        filepath = os.path.join(self.output_dir, filename)
        wavfile.write(filepath, self.sample_rate, audio)
        
        print(f"Generated real synthesized audio at: {filepath}")
        return f"/generated/{filename}"

class MockAudioService(RealAudioSynthesizer):
    """Legacy class pointing to real DSP synthesizer."""
    pass

class LocalAudioService(RealAudioSynthesizer):
    pass

