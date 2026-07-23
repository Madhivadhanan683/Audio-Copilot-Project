import mido
import os
import uuid
import random
import copy


class HumanizeService:
    """
    Service to humanize MIDI files — adds timing jitter, velocity variation,
    and micro-swing so quantized patterns sound like a real performance.
    """

    def __init__(self, output_dir: str = "generated_midi"):
        self.base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        self.output_dir = os.path.join(self.base_dir, output_dir)
        os.makedirs(self.output_dir, exist_ok=True)

    def humanize(
        self,
        input_path: str,
        timing: float = 0.5,
        velocity: float = 0.5,
        swing: float = 0.5,
    ) -> dict:
        """
        Humanize a MIDI file.

        Args:
            input_path: Path to the input MIDI file.
            timing:   0.0–1.0 intensity for random timing jitter.
            velocity: 0.0–1.0 intensity for random velocity variation.
            swing:    0.0–1.0 intensity for micro-swing on alternate notes.

        Returns:
            dict with status, download url, and filename.
        """
        try:
            mid = mido.MidiFile(input_path)
            new_mid = mido.MidiFile(ticks_per_beat=mid.ticks_per_beat)

            max_timing_ticks = int(30 * timing)   # up to ±30 ticks at full intensity
            max_velocity_delta = int(20 * velocity)  # up to ±20 velocity at full
            swing_offset = int(25 * swing)  # up to 25 ticks swing on alternate notes

            for track in mid.tracks:
                new_track = mido.MidiTrack()
                note_index = 0

                for msg in track:
                    new_msg = msg.copy()

                    if msg.type == 'note_on' and msg.velocity > 0:
                        # --- Timing Jitter ---
                        if max_timing_ticks > 0 and new_msg.time > 0:
                            jitter = random.randint(-max_timing_ticks, max_timing_ticks)
                            new_msg.time = max(0, new_msg.time + jitter)

                        # --- Micro-Swing ---
                        if swing_offset > 0 and note_index % 2 == 1:
                            # Push every other note slightly late for groove
                            new_msg.time = new_msg.time + random.randint(0, swing_offset)

                        # --- Velocity Variation ---
                        if max_velocity_delta > 0:
                            delta = random.randint(-max_velocity_delta, max_velocity_delta)
                            new_msg.velocity = max(1, min(127, new_msg.velocity + delta))

                        note_index += 1

                    elif msg.type == 'note_off' or (msg.type == 'note_on' and msg.velocity == 0):
                        # Minor timing variation on note-off too
                        if max_timing_ticks > 0 and new_msg.time > 0:
                            jitter = random.randint(-max_timing_ticks // 2, max_timing_ticks // 2)
                            new_msg.time = max(0, new_msg.time + jitter)

                    new_track.append(new_msg)

                new_mid.tracks.append(new_track)

            # Save output
            job_id = str(uuid.uuid4())[:8]
            output_filename = f"humanized_{job_id}.mid"
            output_path = os.path.join(self.output_dir, output_filename)
            new_mid.save(output_path)

            print(f"Humanized MIDI saved to: {output_path}")

            return {
                "status": "success",
                "url": f"/generated_midi/{output_filename}",
                "filename": output_filename
            }

        except Exception as e:
            print(f"Humanize error: {e}")
            raise e
