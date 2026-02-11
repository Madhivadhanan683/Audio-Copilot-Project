import os
import uuid
import asyncio
from pathlib import Path
from typing import Optional
import shutil

class StemService:
    """
    Service to handle audio stem separation using Demucs.
    Separates audio into: vocals, drums, bass, other
    """
    
    def __init__(self, output_dir: str = "separated_stems"):
        # Use absolute path for output_dir
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        self.output_dir = os.path.join(base_dir, output_dir)
        self.jobs = {}  # Store job status
        os.makedirs(self.output_dir, exist_ok=True)
        print(f"StemService initialized with output_dir: {self.output_dir}")
    
    def create_job(self, filename: str) -> str:
        """Create a new separation job and return job ID."""
        job_id = str(uuid.uuid4())[:8]
        self.jobs[job_id] = {
            "status": "pending",
            "filename": filename,
            "progress": 0,
            "stems": None,
            "error": None
        }
        return job_id
    
    def get_job_status(self, job_id: str) -> Optional[dict]:
        """Get the status of a separation job."""
        return self.jobs.get(job_id)
    
    async def separate_stems(self, job_id: str, input_path: str):
        """
        Run Demucs stem separation on the input audio file.
        Updates job status as it progresses.
        """
        try:
            self.jobs[job_id]["status"] = "processing"
            self.jobs[job_id]["progress"] = 10
            
            # Use Path for robust path handling
            input_p = Path(input_path)
            
            # Create job-specific output directory
            job_output_dir = Path(self.output_dir) / job_id
            job_output_dir.mkdir(parents=True, exist_ok=True)
            
            import sys
            
            # Prepare environment with ffmpeg in path
            env = os.environ.copy()
            ffmpeg_bin = r"C:\Users\madhi\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.0.1-full_build\bin"
            if os.path.exists(ffmpeg_bin):
                env["PATH"] = ffmpeg_bin + os.pathsep + env.get("PATH", "")
            
            # Find the audio-separator executable
            audio_sep_exe = Path(sys.executable).parent / "audio-separator.exe"
            if not audio_sep_exe.exists():
                # Try fallback location
                audio_sep_exe = Path(sys.executable).parent / "Scripts" / "audio-separator.exe"
            
            # Construct command with POSIX-style paths for best compatibility
            cmd = [
                str(audio_sep_exe),
                input_p.as_posix(),
                "--model_filename", "htdemucs.yaml",
                "--output_dir", job_output_dir.as_posix(),
                "--log_level", "info"
            ]
            
            print(f"Running command: {' '.join(cmd)}")
            
            self.jobs[job_id]["progress"] = 20
            
            # Run the command asynchronously
            # We use PIPEs but communicate() to avoid deadlocks
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env=env
            )
            
            self.jobs[job_id]["progress"] = 30
            
            # Communicating with the process
            stdout, stderr = await process.communicate()
            
            # Safe decoding
            stdout_str = stdout.decode('utf-8', errors='replace') if stdout else ""
            stderr_str = stderr.decode('utf-8', errors='replace') if stderr else ""
            
            if stdout_str:
                print(f"Audio-separator stdout (chunked): {stdout_str[:500]}...")
            if stderr_str:
                print(f"Audio-separator stderr (chunked): {stderr_str[:500]}...")
            
            if process.returncode != 0:
                self.jobs[job_id]["status"] = "failed"
                self.jobs[job_id]["error"] = stderr_str or "Command failed without stderr output"
                print(f"Audio-separator error (code {process.returncode}): {self.jobs[job_id]['error']}")
                return
            
            self.jobs[job_id]["progress"] = 90
            
            # Find the output stems
            # Audio-separator naming pattern: {input_filename}_({StemName})_htdemucs.flac
            input_stem_name = input_p.stem
            stems = {}
            found_any = False
            
            # Map audio-separator names to our standard names
            name_map = {
                "Vocals": "vocals",
                "Drums": "drums",
                "Bass": "bass",
                "Other": "other"
            }
            
            # Search both in job_output_dir and any subdirectories created by the model
            files_to_check = list(job_output_dir.glob("*.flac")) + list(job_output_dir.glob("htdemucs/*.flac"))
            
            print(f"Checking for output files in {job_output_dir}. Found: {[f.name for f in files_to_check]}")
            
            for sep_name, our_name in name_map.items():
                expected_pattern = f"({sep_name})"
                matched_file = next((f for f in files_to_check if expected_pattern in f.name), None)
                
                if matched_file:
                    new_filename = f"{our_name}.flac"
                    new_path = job_output_dir / new_filename
                    
                    # Move to root of job_output_dir if it's in a subfolder
                    if matched_file != new_path:
                        if new_path.exists():
                            new_path.unlink()
                        shutil.move(str(matched_file), str(new_path))
                    
                    stems[our_name] = f"/separated_stems/{job_id}/{new_filename}"
                    found_any = True
            
            if found_any:
                self.jobs[job_id]["stems"] = stems
                self.jobs[job_id]["status"] = "completed"
                self.jobs[job_id]["progress"] = 100
                print(f"Job {job_id} completed successfully.")
            else:
                self.jobs[job_id]["status"] = "failed"
                self.jobs[job_id]["error"] = f"No output stems found matching expected patterns in {job_output_dir}"
                print(f"Job {job_id} failed: No stems found.")
                
        except Exception as e:
            self.jobs[job_id]["status"] = "failed"
            self.jobs[job_id]["error"] = str(e)
            import traceback
            traceback.print_exc()
            print(f"Stem separation exception for job {job_id}: {e}")


class MockStemService:
    """
    Mock service for testing without Demucs installed.
    Returns fake stem paths after a simulated delay.
    """
    
    def __init__(self, output_dir: str = "separated_stems"):
        self.output_dir = output_dir
        self.jobs = {}
        os.makedirs(output_dir, exist_ok=True)
    
    def create_job(self, filename: str) -> str:
        job_id = str(uuid.uuid4())[:8]
        self.jobs[job_id] = {
            "status": "pending",
            "filename": filename,
            "progress": 0,
            "stems": None,
            "error": None
        }
        return job_id
    
    def get_job_status(self, job_id: str) -> Optional[dict]:
        return self.jobs.get(job_id)
    
    async def separate_stems(self, job_id: str, input_path: str):
        """Simulate stem separation with delays."""
        try:
            self.jobs[job_id]["status"] = "processing"
            
            # Simulate processing steps
            for progress in [20, 40, 60, 80, 100]:
                await asyncio.sleep(1)  # 1 second per step
                self.jobs[job_id]["progress"] = progress
            
            # Create mock output directory
            job_output_dir = os.path.join(self.output_dir, job_id)
            os.makedirs(job_output_dir, exist_ok=True)
            
            # Return mock stem paths (would need real files for actual playback)
            stems = {
                "vocals": f"/separated_stems/{job_id}/vocals.wav",
                "drums": f"/separated_stems/{job_id}/drums.wav", 
                "bass": f"/separated_stems/{job_id}/bass.wav",
                "other": f"/separated_stems/{job_id}/other.wav"
            }
            
            self.jobs[job_id]["stems"] = stems
            self.jobs[job_id]["status"] = "completed"
            
        except Exception as e:
            self.jobs[job_id]["status"] = "failed"
            self.jobs[job_id]["error"] = str(e)
