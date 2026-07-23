import librosa
import numpy as np
import os


class ArrangementService:
    """
    Service to analyze audio structure and provide arrangement suggestions.
    Uses librosa to detect segments, compute energy curves, and generate
    rule-based advice on song arrangement.
    """

    def __init__(self):
        self.base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

    async def analyze_arrangement(self, file_path: str) -> dict:
        """
        Analyze the full audio file and return structural sections + suggestions.
        """
        try:
            print(f"Analyzing arrangement for: {file_path}")

            # Load full audio
            y, sr = librosa.load(file_path, sr=22050)
            duration = librosa.get_duration(y=y, sr=sr)

            # --- Tempo & Beat Detection ---
            tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr)
            # Handle tempo being an ndarray
            if hasattr(tempo, '__len__'):
                tempo = float(tempo[0])
            else:
                tempo = float(tempo)
            beat_times = librosa.frames_to_time(beat_frames, sr=sr)

            # --- Structural Segmentation ---
            # Compute features for segmentation
            mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
            # Use recurrence matrix for structural analysis
            rec = librosa.segment.recurrence_matrix(mfcc, mode='affinity', sym=True)

            # Agglomerative clustering to find segment boundaries
            # Target ~6-10 segments for a typical track
            n_segments = max(4, min(10, int(duration / 20)))
            bound_frames = librosa.segment.agglomerative(mfcc, n_segments)
            bound_times = librosa.frames_to_time(bound_frames, sr=sr)

            # Add start and end
            bound_times = np.concatenate([[0.0], bound_times, [duration]])
            bound_times = np.unique(np.sort(bound_times))

            # --- Per-Segment Analysis ---
            sections = []
            rms_full = librosa.feature.rms(y=y)[0]
            centroid_full = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
            frame_times = librosa.frames_to_time(np.arange(len(rms_full)), sr=sr)

            for i in range(len(bound_times) - 1):
                start = float(bound_times[i])
                end = float(bound_times[i + 1])
                seg_duration = end - start

                # Get frames within this segment
                mask = (frame_times >= start) & (frame_times < end)
                if not np.any(mask):
                    continue

                seg_rms = np.mean(rms_full[mask])
                seg_centroid = np.mean(centroid_full[mask])
                seg_energy_db = float(20 * np.log10(seg_rms + 1e-6))

                sections.append({
                    "index": i,
                    "start": round(start, 2),
                    "end": round(end, 2),
                    "duration": round(seg_duration, 2),
                    "energy_db": round(seg_energy_db, 1),
                    "brightness": round(float(seg_centroid), 0),
                    "label": "",  # will be assigned below
                    "energy_level": ""  # will be assigned below
                })

            # --- Label Sections ---
            if sections:
                energies = [s["energy_db"] for s in sections]
                max_energy = max(energies)
                min_energy = min(energies)
                energy_range = max_energy - min_energy if max_energy != min_energy else 1.0

                for idx, sec in enumerate(sections):
                    # Normalize energy 0-1
                    norm_energy = (sec["energy_db"] - min_energy) / energy_range

                    # Assign energy level
                    if norm_energy > 0.7:
                        sec["energy_level"] = "high"
                    elif norm_energy > 0.35:
                        sec["energy_level"] = "medium"
                    else:
                        sec["energy_level"] = "low"

                    # Heuristic label based on position and energy
                    position_ratio = idx / len(sections)

                    if idx == 0:
                        sec["label"] = "Intro"
                    elif idx == len(sections) - 1:
                        sec["label"] = "Outro"
                    elif norm_energy > 0.7:
                        sec["label"] = "Drop / Chorus"
                    elif norm_energy < 0.3:
                        sec["label"] = "Breakdown"
                    elif 0.3 <= position_ratio <= 0.6 and norm_energy > 0.5:
                        sec["label"] = "Build-up"
                    else:
                        sec["label"] = "Verse / Bridge"

            # --- Generate Arrangement Suggestions ---
            suggestions = self._generate_suggestions(sections, duration, tempo)

            return {
                "status": "success",
                "overview": {
                    "duration": round(duration, 2),
                    "tempo": round(tempo, 1),
                    "total_sections": len(sections),
                    "total_beats": len(beat_times)
                },
                "sections": sections,
                "suggestions": suggestions
            }

        except Exception as e:
            print(f"Arrangement analysis error: {e}")
            import traceback
            traceback.print_exc()
            raise e

    def _generate_suggestions(self, sections: list, duration: float, tempo: float) -> list:
        """Rule-based engine to generate arrangement advice."""
        suggestions = []

        if not sections:
            return [{"text": "Could not detect any sections.", "severity": "info", "type": "structure"}]

        # Calculate bars per section (assuming 4/4 time)
        beats_per_bar = 4
        bars_per_second = (tempo / 60.0) / beats_per_bar

        # 1. Intro length check
        intro = sections[0]
        intro_ratio = intro["duration"] / duration
        intro_bars = intro["duration"] * bars_per_second

        if intro_ratio > 0.20:
            suggestions.append({
                "type": "intro",
                "text": f"Your intro is {intro['duration']:.0f}s (~{intro_bars:.0f} bars) — that's {intro_ratio*100:.0f}% of the track. Consider shortening it to hook listeners sooner.",
                "severity": "medium"
            })
        elif intro_bars < 4:
            suggestions.append({
                "type": "intro",
                "text": f"Your intro is very short (~{intro_bars:.0f} bars). Consider extending it to set the mood before the first section.",
                "severity": "low"
            })
        else:
            suggestions.append({
                "type": "intro",
                "text": f"Intro length looks good ({intro['duration']:.0f}s, ~{intro_bars:.0f} bars).",
                "severity": "info"
            })

        # 2. Drop / Chorus length check
        drops = [s for s in sections if s["energy_level"] == "high"]
        if drops:
            for drop in drops:
                drop_bars = drop["duration"] * bars_per_second
                if drop_bars < 16:
                    suggestions.append({
                        "type": "drop",
                        "text": f"High-energy section at {self._format_time(drop['start'])} is only ~{drop_bars:.0f} bars. Consider making the drop/chorus longer (16-32 bars is typical).",
                        "severity": "high"
                    })
                elif drop_bars > 64:
                    suggestions.append({
                        "type": "drop",
                        "text": f"High-energy section at {self._format_time(drop['start'])} is ~{drop_bars:.0f} bars — it may lose impact. Consider splitting it with a breakdown.",
                        "severity": "medium"
                    })
        else:
            suggestions.append({
                "type": "drop",
                "text": "No high-energy section (drop/chorus) detected. Consider adding a climactic peak to your arrangement.",
                "severity": "high"
            })

        # 3. Breakdown / contrast check
        breakdowns = [s for s in sections if s["energy_level"] == "low" and s["label"] not in ("Intro", "Outro")]
        if not breakdowns and len(sections) > 3:
            suggestions.append({
                "type": "dynamics",
                "text": "No breakdown or low-energy section found between Intro and Outro. Adding contrast (a quiet bridge or breakdown) makes the drops hit harder.",
                "severity": "medium"
            })

        # 4. Outro check
        outro = sections[-1]
        outro_bars = outro["duration"] * bars_per_second
        if outro_bars < 4:
            suggestions.append({
                "type": "outro",
                "text": f"Your outro is very short (~{outro_bars:.0f} bars). Consider extending it for a smoother ending, especially for DJ-friendly tracks.",
                "severity": "low"
            })
        elif outro["energy_level"] == "high":
            suggestions.append({
                "type": "outro",
                "text": "Your track ends on a high-energy section. Consider adding a wind-down for a more natural ending.",
                "severity": "low"
            })

        # 5. Dynamic range / variety check
        energy_levels = [s["energy_level"] for s in sections]
        unique_levels = set(energy_levels)
        if len(unique_levels) == 1:
            suggestions.append({
                "type": "dynamics",
                "text": f"All sections have {energy_levels[0]} energy. Add more dynamic variation — contrast between quiet and loud sections creates emotional impact.",
                "severity": "high"
            })

        # 6. Overall structure assessment
        if len(sections) <= 3 and duration > 120:
            suggestions.append({
                "type": "structure",
                "text": f"Only {len(sections)} sections detected in a {duration/60:.1f}-minute track. Consider adding more distinct sections for variety.",
                "severity": "medium"
            })

        return suggestions

    @staticmethod
    def _format_time(seconds: float) -> str:
        """Format seconds to mm:ss."""
        m = int(seconds // 60)
        s = int(seconds % 60)
        return f"{m}:{s:02d}"
