import librosa
import numpy as np
import os
import uuid

class MixingService:
    """
    Service to analyze audio and provide mixing suggestions using librosa.
    """
    
    def __init__(self, uploads_dir: str = "uploads"):
        self.base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        self.uploads_dir = os.path.join(self.base_dir, uploads_dir)

    async def analyze_audio(self, file_path: str) -> dict:
        """
        Analyze audio file and return metrics and suggestions.
        """
        try:
            print(f"Analyzing audio file: {file_path}")
            
            # Load audio (only first 30 seconds to speed up analysis if track is long)
            y, sr = librosa.load(file_path, duration=30.0)
            
            # 1. Loudness Analysis (RMS)
            rms = librosa.feature.rms(y=y)
            avg_rms = np.mean(rms)
            # Convert to dB roughly: 20 * log10(rms)
            # This is not exact LUFS but a proxy for signal level
            db_level = 20 * np.log10(avg_rms + 1e-6)
            
            # 2. Brightness Analysis (Spectral Centroid)
            centroid = librosa.feature.spectral_centroid(y=y, sr=sr)
            avg_centroid = np.mean(centroid)
            
            # 3. Bass/Low-end Analysis
            # Simple check: Ratio of energy below 100Hz vs total
            spectrogram = np.abs(librosa.stft(y))
            freqs = librosa.fft_frequencies(sr=sr)
            bass_indices = np.where(freqs < 150)[0]
            total_energy = np.sum(spectrogram)
            bass_energy = np.sum(spectrogram[bass_indices, :])
            bass_ratio = bass_energy / (total_energy + 1e-6)

            # Generate Suggestions
            suggestions = []
            
            # Volume Suggestions
            if db_level < -20:
                suggestions.append({
                    "type": "volume",
                    "text": f"Track is very quiet ({db_level:.1f} dB). Consider adding gain or a limiter.",
                    "severity": "high"
                })
            elif db_level > -6:
                 suggestions.append({
                    "type": "volume",
                    "text": f"Track is quite loud ({db_level:.1f} dB). Valid for mastering, but check for clipping.",
                    "severity": "low"
                })
            else:
                 suggestions.append({
                    "type": "volume",
                    "text": f"Volume levels look healthy ({db_level:.1f} dB).",
                    "severity": "info"
                })

            # EQ/Brightness Suggestions
            # Typical centroid for music is 1000-4000Hz depending on genre
            if avg_centroid < 1000:
                suggestions.append({
                    "type": "eq",
                    "text": "Mix sounds muffled or dark. Try boosting high frequencies (shelf above 8kHz).",
                    "severity": "medium"
                })
            elif avg_centroid > 3500:
                suggestions.append({
                    "type": "eq",
                    "text": "Mix sounds very bright or harsh. Check for sibilance or cut some high/high-mids.",
                    "severity": "medium"
                })
            else:
                suggestions.append({
                    "type": "eq",
                    "text": "Spectral balance seems neutral.",
                    "severity": "info"
                })

            # Bass Suggestions
            if bass_ratio > 0.4:
                 suggestions.append({
                    "type": "eq",
                    "text": "Very heavy low-end detected. Ensure bass/kick aren't clashing. Consider a high-pass on non-bass instruments.",
                    "severity": "medium"
                })
            elif bass_ratio < 0.05:
                 suggestions.append({
                    "type": "eq",
                    "text": "Mix lacks low-end energy. Check bass and kick levels.",
                    "severity": "medium"
                })

            return {
                "status": "success",
                "metrics": {
                    "rms_db": float(db_level),
                    "spectral_centroid": float(avg_centroid),
                    "bass_ratio": float(bass_ratio)
                },
                "suggestions": suggestions
            }

        except Exception as e:
            print(f"Error analyzing audio: {e}")
            raise e
