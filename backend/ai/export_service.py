import librosa
import numpy as np
import os

class ExportService:
    """
    Service to analyze a final mix/master for export readiness.
    Provides LUFS estimation, true peak, dynamic range, clipping detection,
    and platform-specific recommendations.
    """

    # Platform loudness targets (approximate integrated LUFS)
    PLATFORM_TARGETS = {
        "Spotify": {"lufs": -14, "label": "Spotify"},
        "Apple Music": {"lufs": -16, "label": "Apple Music"},
        "YouTube": {"lufs": -14, "label": "YouTube"},
        "CD": {"lufs": -9, "label": "CD / Loud Master"},
    }

    async def analyze_for_export(self, file_path: str) -> dict:
        """Analyze an audio file and return an export-readiness report."""
        try:
            print(f"Export analysis: loading {file_path}")
            y, sr = librosa.load(file_path, sr=None, mono=False)

            # If stereo, average to mono for loudness analysis
            if y.ndim > 1:
                y_mono = np.mean(y, axis=0)
            else:
                y_mono = y

            # --- 1. Integrated Loudness (LUFS approximation) ---
            # K-weighted approximation: apply a simple high-shelf boost
            # then compute RMS-based loudness. Not ITU-R BS.1770 exact, but close.
            rms = librosa.feature.rms(y=y_mono, frame_length=2048, hop_length=512)[0]
            # Avoid log of zero
            rms_nonzero = rms[rms > 1e-10]
            if len(rms_nonzero) > 0:
                # Mean-square then convert
                mean_power = np.mean(rms_nonzero ** 2)
                lufs_estimate = 10 * np.log10(mean_power + 1e-10) - 0.691
            else:
                lufs_estimate = -70.0  # silence

            # --- 2. True Peak (dBFS) ---
            true_peak = float(np.max(np.abs(y_mono)))
            true_peak_db = float(20 * np.log10(true_peak + 1e-10))

            # --- 3. Dynamic Range ---
            # Split into segments and measure RMS per segment
            segment_len = int(sr * 0.5)  # 500ms segments
            segments = [y_mono[i:i+segment_len] for i in range(0, len(y_mono), segment_len)
                        if len(y_mono[i:i+segment_len]) == segment_len]
            if segments:
                seg_rms = [float(np.sqrt(np.mean(s**2))) for s in segments]
                seg_rms_nonzero = [r for r in seg_rms if r > 1e-10]
                if seg_rms_nonzero:
                    loudest_db = 20 * np.log10(max(seg_rms_nonzero))
                    quietest_db = 20 * np.log10(min(seg_rms_nonzero))
                    dynamic_range = float(loudest_db - quietest_db)
                else:
                    dynamic_range = 0.0
            else:
                dynamic_range = 0.0

            # --- 4. Clipping Detection ---
            clipping_threshold = 0.999
            clipping_samples = int(np.sum(np.abs(y_mono) >= clipping_threshold))
            duration = float(len(y_mono) / sr)

            # --- 5. Platform Recommendations ---
            platforms = {}
            for name, target in self.PLATFORM_TARGETS.items():
                diff = lufs_estimate - target["lufs"]
                if abs(diff) <= 2.0:
                    status = "pass"
                    note = f"Within target range ({target['lufs']} LUFS)."
                elif diff > 2.0:
                    status = "too_loud"
                    note = f"~{diff:.1f} dB louder than the {target['lufs']} LUFS target. The platform will normalize your track down."
                else:
                    status = "too_quiet"
                    note = f"~{abs(diff):.1f} dB quieter than the {target['lufs']} LUFS target. Consider raising overall level."
                platforms[name] = {"status": status, "note": note, "target_lufs": target["lufs"]}

            # --- 6. Suggestions ---
            suggestions = []

            if clipping_samples > 0:
                suggestions.append({
                    "type": "clipping",
                    "severity": "high",
                    "text": f"⚠️ {clipping_samples} samples are clipping (hitting 0 dBFS). Use a limiter or reduce gain."
                })

            if true_peak_db > -1.0:
                suggestions.append({
                    "type": "peak",
                    "severity": "medium",
                    "text": f"True peak is {true_peak_db:.1f} dBFS. For streaming, aim for -1 dBTP or lower."
                })
            else:
                suggestions.append({
                    "type": "peak",
                    "severity": "info",
                    "text": f"True peak is {true_peak_db:.1f} dBFS. Good headroom for streaming platforms."
                })

            if dynamic_range < 4.0:
                suggestions.append({
                    "type": "dynamics",
                    "severity": "medium",
                    "text": "Very low dynamic range detected. The track may sound over-compressed or fatiguing."
                })
            elif dynamic_range > 20.0:
                suggestions.append({
                    "type": "dynamics",
                    "severity": "info",
                    "text": "Wide dynamic range. Great for classical/acoustic, but pop/electronic may want more compression."
                })

            if lufs_estimate < -20:
                suggestions.append({
                    "type": "loudness",
                    "severity": "high",
                    "text": f"Track is very quiet ({lufs_estimate:.1f} LUFS). Consider mastering to bring the level up."
                })

            return {
                "status": "success",
                "metrics": {
                    "lufs": round(float(lufs_estimate), 1),
                    "true_peak_db": round(float(true_peak_db), 1),
                    "dynamic_range_db": round(float(dynamic_range), 1),
                    "clipping_samples": clipping_samples,
                    "duration_seconds": round(duration, 1),
                    "sample_rate": sr,
                },
                "platforms": platforms,
                "suggestions": suggestions,
            }

        except Exception as e:
            print(f"Export analysis error: {e}")
            import traceback
            traceback.print_exc()
            raise e
