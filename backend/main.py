from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, UploadFile, File
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from ai.llm_service import MockLLMService, OpenAILLMService
from ai.audio_service import MockAudioService
from ai.stem_service import StemService, MockStemService
from service_midi import AudioToMidi, MockAudioToMidiService
from ai.mixing_service import MixingService
from ai.plugin_service import PluginService
from ai.lyrics_service import LyricsService
from ai.transcription_service import TranscriptionService, MockTranscriptionService
from ai.arrangement_service import ArrangementService
from ai.humanize_service import HumanizeService
from ai.sample_tagging_service import SampleTaggingService
from ai.preset_service import PresetService
from ai.export_service import ExportService

from bridge.daw_server import DAWBridge
from bridge.session_manager import SessionManager
import os
import shutil
import uuid

app = FastAPI(title="Audio Copilot Backend")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Services
# Production Real Services
llm_service = MockLLMService()  # MusicProducerLLMService alias
audio_service = MockAudioService()  # RealAudioSynthesizer alias
daw_bridge = DAWBridge()

# Real StemService for Demucs AI separation
stem_service = StemService()

# Audio to MIDI Service (librosa pitch tracking + mido)
audio_to_midi_service = AudioToMidi()

# Mixing Service
mixing_service = MixingService()

# Plugin Service
plugin_service = PluginService()

# Lyrics Service
lyrics_service = LyricsService()

# Transcription Service (Whisper)
try:
    transcription_service = TranscriptionService()
except Exception as e:
    print(f"TranscriptionService lazy initialization ready: {e}")
    transcription_service = MockTranscriptionService()

# Arrangement Service
arrangement_service = ArrangementService()

# Humanize Service
humanize_service = HumanizeService()

# Sample Tagging Service
sample_tagging_service = SampleTaggingService()

# Preset Generator Service
preset_service = PresetService()

# Session Manager for Collab
session_manager = SessionManager()

# Export Service
export_service = ExportService()

# Mount directories for generated files using absolute paths
base_dir = os.path.dirname(os.path.abspath(__file__))
os.makedirs(os.path.join(base_dir, "generated_midi"), exist_ok=True)
os.makedirs(os.path.join(base_dir, "separated_stems"), exist_ok=True)
os.makedirs(os.path.join(base_dir, "generated"), exist_ok=True)
os.makedirs(os.path.join(base_dir, "uploads"), exist_ok=True)

app.mount("/generated_midi", StaticFiles(directory=os.path.join(base_dir, "generated_midi")), name="generated_midi")
app.mount("/separated_stems", StaticFiles(directory=os.path.join(base_dir, "separated_stems")), name="separated_stems")
app.mount("/generated", StaticFiles(directory=os.path.join(base_dir, "generated")), name="generated")

# Store current settings
current_settings = {
    "provider": "production",
    "api_key": None
}


class ChatRequest(BaseModel):
    message: str
    persona_id: str | None = None
    daw_state: dict | None = None
    context: list | None = None

class GenerateRequest(BaseModel):
    prompt: str
    type: str

class SettingsRequest(BaseModel):
    provider: str
    api_key: str | None = None

@app.get("/")
async def read_root():
    return {"status": "online", "message": "Audio Copilot Backend (Phase 2 - Stem Separation)"}

@app.get("/api/daw/status")
async def daw_status():
    """Check if DAW client is connected"""
    return {"connected": len(daw_bridge.active_connections) > 0}

@app.get("/api/settings")
async def get_settings():
    """Get current settings (without exposing API key)"""
    return {"provider": current_settings["provider"]}

@app.post("/api/settings")
async def update_settings(settings: SettingsRequest):
    """Update AI provider settings"""
    global llm_service, current_settings
    
    try:
        if settings.provider == "mock":
            llm_service = MockLLMService()
            current_settings = {"provider": "mock", "api_key": None}
        elif settings.provider == "openai":
            if not settings.api_key:
                raise HTTPException(status_code=400, detail="API key required for OpenAI")
            
            try:
                new_service = OpenAILLMService(api_key=settings.api_key)
                llm_service = new_service
                current_settings = {"provider": "openai", "api_key": settings.api_key}
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"Invalid Configuration: {str(e)}")
        else:
            raise HTTPException(status_code=400, detail="Unsupported provider")
        
        return {"status": "success", "provider": settings.provider}
    except HTTPException:
        raise 
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/personas")
async def get_personas():
    """Get available AI Co-Producers"""
    try:
        from ai.personas import PERSONAS
        # Return as a list of dicts without the heavy system prompts
        return {
            "personas": [
                {
                    "id": p["id"],
                    "name": p["name"],
                    "avatar": p["avatar"],
                    "description": p["description"],
                    "genre": p["genre"]
                } for p in PERSONAS.values()
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/chat")
async def chat(request: ChatRequest):
    try:
        response = llm_service.generate_response(
            request.message, 
            context=request.context,
            persona_id=request.persona_id,
            daw_state=request.daw_state
        )
        return response 
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/generate")
async def generate_audio(request: GenerateRequest):
    try:
        file_url = audio_service.generate_audio(request.prompt)
        return {"status": "success", "file_url": file_url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============== STEM SEPARATION ENDPOINTS ==============

@app.post("/api/stems/upload")
async def upload_for_stem_separation(
    file: UploadFile = File(...)
):
    """Upload an audio file for stem separation."""
    import asyncio
    
    try:
        print(f"Received file: {file.filename}")
        
        # Validate file type
        allowed_extensions = [".mp3", ".wav", ".flac", ".ogg", ".m4a"]
        file_ext = os.path.splitext(file.filename)[1].lower()
        
        if file_ext not in allowed_extensions:
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid file type. Allowed: {', '.join(allowed_extensions)}"
            )
        
        # Create job
        job_id = stem_service.create_job(file.filename)
        print(f"Created job: {job_id}")
        
        # Save uploaded file using absolute path
        base_dir = os.path.dirname(os.path.abspath(__file__))
        uploads_dir = os.path.join(base_dir, "uploads")
        os.makedirs(uploads_dir, exist_ok=True)
        
        upload_path = os.path.join(uploads_dir, f"{job_id}{file_ext}")
        with open(upload_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        print(f"Saved file to: {upload_path}")
        
        # Start separation in background using asyncio.create_task
        asyncio.create_task(stem_service.separate_stems(job_id, upload_path))
        print(f"Started background task for job: {job_id}")
        
        return {
            "job_id": job_id,
            "filename": file.filename,
            "status": "processing"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Upload error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/stems/status/{job_id}")
async def get_stem_status(job_id: str):
    """Get the status of a stem separation job."""
    job = stem_service.get_job_status(job_id)
    
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    return job

@app.get("/api/stems/download/{job_id}/{stem}")
async def download_stem(job_id: str, stem: str):
    """Download a specific stem from a job."""
    job = stem_service.get_job_status(job_id)
    if not job or not job["stems"] or stem not in job["stems"]:
        raise HTTPException(status_code=404, detail="Stem not found")
    
    # Path is stored in stems dict
    # format: /separated_stems/{job_id}/{stem_name}.flac
    relative_path = job["stems"][stem].lstrip("/")
    
    # Use absolute path to find the file
    base_dir = os.path.dirname(os.path.abspath(__file__))
    file_path = os.path.join(base_dir, relative_path)
    
    if os.path.exists(file_path):
        ext = os.path.splitext(file_path)[1]
        return FileResponse(
            file_path, 
            filename=f"{job['filename']}_{stem}{ext}"
        )
    else:
        raise HTTPException(status_code=404, detail=f"File not found: {file_path}")

# ============== AUDIO TO MIDI ENDPOINTS ==============

@app.post("/api/midi/audio-to-midi")
async def audio_to_midi(
    file: UploadFile = File(...)
):
    """Convert an uploaded audio file to MIDI."""
    import asyncio
    
    try:
        print(f"Received file for MIDI conversion: {file.filename}")
        
        # Validate file type
        allowed_extensions = [".mp3", ".wav", ".flac", ".ogg", ".m4a"]
        file_ext = os.path.splitext(file.filename)[1].lower()
        
        if file_ext not in allowed_extensions:
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid file type. Allowed: {', '.join(allowed_extensions)}"
            )
        
        # Save uploaded file
        base_dir = os.path.dirname(os.path.abspath(__file__))
        uploads_dir = os.path.join(base_dir, "uploads")
        os.makedirs(uploads_dir, exist_ok=True)
        
        upload_path = os.path.join(uploads_dir, f"midi_input_{uuid.uuid4()}{file_ext}")
        with open(upload_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        print(f"Saved file to: {upload_path}")
        
        # Process audio to MIDI
        result = await audio_to_midi_service.convert_audio_to_midi(upload_path)
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Audio-to-MIDI error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

# ============== MIXING ANALYSIS ENDPOINTS ==============

@app.post("/api/mixing/analyze")
async def analyze_mixing(
    file: UploadFile = File(...)
):
    """Analyze audio for mixing suggestions."""
    try:
        print(f"Received file for mixing analysis: {file.filename}")
        
        # Validate file type
        allowed_extensions = [".mp3", ".wav", ".flac", ".ogg", ".m4a"]
        file_ext = os.path.splitext(file.filename)[1].lower()
        
        if file_ext not in allowed_extensions:
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid file type. Allowed: {', '.join(allowed_extensions)}"
            )
        
        # Save uploaded file
        base_dir = os.path.dirname(os.path.abspath(__file__))
        uploads_dir = os.path.join(base_dir, "uploads")
        os.makedirs(uploads_dir, exist_ok=True)
        
        upload_path = os.path.join(uploads_dir, f"mixing_input_{uuid.uuid4()}{file_ext}")
        with open(upload_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        print(f"Saved file to: {upload_path}")
        
        # Process analysis
        result = await mixing_service.analyze_audio(upload_path)
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Mixing analysis error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

# ============== PLUGIN RECOMMENDATION ENDPOINTS ==============

@app.post("/api/plugins/recommend")
async def recommend_plugins(
    file: UploadFile = File(...)
):
    """Analyze audio and recommend VST plugins."""
    try:
        print(f"Received file for plugin recommendation: {file.filename}")
        
        # 1. Reuse Mixing Service to get metrics
        # Save file first (code duplicated from mixing service for now to keep endpoints independent)
        base_dir = os.path.dirname(os.path.abspath(__file__))
        uploads_dir = os.path.join(base_dir, "uploads")
        os.makedirs(uploads_dir, exist_ok=True)
        
        file_ext = os.path.splitext(file.filename)[1].lower()
        upload_path = os.path.join(uploads_dir, f"plugin_input_{uuid.uuid4()}{file_ext}")
        
        with open(upload_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # Analyze
        analysis_result = await mixing_service.analyze_audio(upload_path)
        
        # 2. Get Recommendations based on analysis
        recommendations = plugin_service.recommend_plugins(analysis_result)
        
        return {
            "status": "success",
            "analysis": analysis_result,
            "recommendations": recommendations
        }
        
    except Exception as e:
        print(f"Plugin recommendation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ============== LYRICS ASSISTANT ENDPOINTS ==============

class LyricsRequest(BaseModel):
    topic: str
    mood: str
    genre: str

@app.post("/api/lyrics/generate")
async def generate_lyrics(request: LyricsRequest):
    try:
        result = lyrics_service.generate_lyrics(request.topic, request.mood, request.genre)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/lyrics/rhyme/{word}")
async def get_rhymes(word: str):
    try:
        rhymes = lyrics_service.find_rhymes(word)
        return {"word": word, "rhymes": rhymes}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============== TRANSCRIPTION ENDPOINTS ==============

@app.post("/api/transcription/transcribe")
async def transcribe_audio(
    file: UploadFile = File(...)
):
    """Transcribe an uploaded audio file."""
    try:
        print(f"Received file for transcription: {file.filename}")
        
        # Validate file type
        allowed_extensions = [".mp3", ".wav", ".flac", ".ogg", ".m4a", ".webm"]
        file_ext = os.path.splitext(file.filename)[1].lower()
        
        if file_ext not in allowed_extensions:
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid file type. Allowed: {', '.join(allowed_extensions)}"
            )
        
        # Save uploaded file
        base_dir = os.path.dirname(os.path.abspath(__file__))
        uploads_dir = os.path.join(base_dir, "uploads")
        os.makedirs(uploads_dir, exist_ok=True)
        
        upload_path = os.path.join(uploads_dir, f"transcription_input_{uuid.uuid4()}{file_ext}")
        with open(upload_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        print(f"Saved file to: {upload_path}")
        
        # Process transcription
        text = transcription_service.transcribe(upload_path)
        
        return {"text": text}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Transcription error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/transcription/save")
async def save_transcription(
    request: dict
):
    """Save transcription to Notes.txt"""
    try:
        text = request.get("text")
        if not text:
            raise HTTPException(status_code=400, detail="Text is required")
            
        base_dir = os.path.dirname(os.path.abspath(__file__))
        # Assuming Notes.txt is in the project root, which is one level up from backend
        project_root = os.path.dirname(base_dir)
        notes_path = os.path.join(project_root, "Notes.txt")
        
        with open(notes_path, "a") as f:
            f.write(f"\n\n--- Voice Memo ({uuid.uuid4()}) ---\n")
            f.write(text)
            
        return {"status": "success", "message": "Note saved"}
    except Exception as e:
        print(f"Save note error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ============== ARRANGEMENT ANALYSIS ENDPOINTS ==============

@app.post("/api/arrangement/analyze")
async def analyze_arrangement(
    file: UploadFile = File(...)
):
    """Analyze audio structure and provide arrangement suggestions."""
    try:
        print(f"Received file for arrangement analysis: {file.filename}")
        
        # Validate file type
        allowed_extensions = [".mp3", ".wav", ".flac", ".ogg", ".m4a"]
        file_ext = os.path.splitext(file.filename)[1].lower()
        
        if file_ext not in allowed_extensions:
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid file type. Allowed: {', '.join(allowed_extensions)}"
            )
        
        # Save uploaded file
        base_dir_local = os.path.dirname(os.path.abspath(__file__))
        uploads_dir = os.path.join(base_dir_local, "uploads")
        os.makedirs(uploads_dir, exist_ok=True)
        
        upload_path = os.path.join(uploads_dir, f"arrangement_input_{uuid.uuid4()}{file_ext}")
        with open(upload_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        print(f"Saved file to: {upload_path}")
        
        # Process arrangement analysis
        result = await arrangement_service.analyze_arrangement(upload_path)
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Arrangement analysis error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

# ============== HUMANIZE MIDI ENDPOINTS ==============

class HumanizeRequest(BaseModel):
    timing: float = 0.5
    velocity: float = 0.5
    swing: float = 0.5

@app.post("/api/humanize/process")
async def humanize_midi(
    file: UploadFile = File(...),
    timing: float = 0.5,
    velocity: float = 0.5,
    swing: float = 0.5,
):
    """Humanize an uploaded MIDI file."""
    try:
        print(f"Received file for humanization: {file.filename}")
        
        # Validate file type
        file_ext = os.path.splitext(file.filename)[1].lower()
        if file_ext not in [".mid", ".midi"]:
            raise HTTPException(
                status_code=400, 
                detail="Invalid file type. Please upload a MIDI file (.mid or .midi)."
            )
        
        # Clamp values
        timing = max(0.0, min(1.0, timing))
        velocity = max(0.0, min(1.0, velocity))
        swing = max(0.0, min(1.0, swing))
        
        # Save uploaded file
        base_dir_local = os.path.dirname(os.path.abspath(__file__))
        uploads_dir = os.path.join(base_dir_local, "uploads")
        os.makedirs(uploads_dir, exist_ok=True)
        
        upload_path = os.path.join(uploads_dir, f"humanize_input_{uuid.uuid4()}{file_ext}")
        with open(upload_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        print(f"Saved file to: {upload_path}")
        
        # Process humanization
        result = humanize_service.humanize(
            upload_path,
            timing=timing,
            velocity=velocity,
            swing=swing,
        )
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Humanize error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

# ============== SAMPLE LIBRARY TAGGING ENDPOINTS ==============

class ScanRequest(BaseModel):
    folder_path: str

@app.post("/api/samples/scan")
async def scan_samples(request: ScanRequest):
    """Scan a local directory for audio samples and tag them."""
    try:
        if not request.folder_path:
            raise HTTPException(status_code=400, detail="Folder path is required")
        
        result = sample_tagging_service.scan_directory(request.folder_path)
        if "error" in result:
             raise HTTPException(status_code=400, detail=result["error"])
             
        return result
    except HTTPException:
        raise
    except Exception as e:
        print(f"Sample scan error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/samples/audio")
async def get_sample_audio(path: str):
    """Stream a local audio file by its absolute path for previewing."""
    try:
        if not os.path.exists(path):
            raise HTTPException(status_code=404, detail="File not found")
            
        allowed_extensions = [".wav", ".mp3", ".flac", ".aiff", ".ogg", ".m4a"]
        file_ext = os.path.splitext(path)[1].lower()
        if file_ext not in allowed_extensions:
            raise HTTPException(status_code=400, detail="Not a supported audio file")
            
        filename = os.path.basename(path)
        return FileResponse(path, filename=filename)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============== SYNTH PRESET ENDPOINTS ==============

class PresetRequest(BaseModel):
    synth: str
    style: str

@app.post("/api/presets/generate")
async def generate_preset(request: PresetRequest):
    """Generate a synth preset file."""
    try:
        if request.synth.lower() != "vital":
            raise HTTPException(status_code=400, detail="Only 'vital' is supported currently.")
            
        preset_data = preset_service.generate_vital_preset(request.style)
        return preset_data
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Preset generation error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

# ============== EXPORT/RENDERING ASSISTANT ENDPOINTS ==============

@app.post("/api/export/analyze")
async def analyze_for_export(
    file: UploadFile = File(...)
):
    """Analyze an audio file for export readiness."""
    try:
        print(f"Received file for export analysis: {file.filename}")
        
        # Validate file type
        allowed_extensions = [".mp3", ".wav", ".flac", ".ogg", ".m4a"]
        file_ext = os.path.splitext(file.filename)[1].lower()
        
        if file_ext not in allowed_extensions:
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid file type. Allowed: {', '.join(allowed_extensions)}"
            )
        
        # Save uploaded file
        base_dir_local = os.path.dirname(os.path.abspath(__file__))
        uploads_dir = os.path.join(base_dir_local, "uploads")
        os.makedirs(uploads_dir, exist_ok=True)
        
        upload_path = os.path.join(uploads_dir, f"export_input_{uuid.uuid4()}{file_ext}")
        with open(upload_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        print(f"Saved file to: {upload_path}")
        
        # Process export analysis
        result = await export_service.analyze_for_export(upload_path)
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Export analysis error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

# ============== WEBSOCKET ==============

from bridge.daw_server import ClientType

@app.websocket("/ws/daw")
async def websocket_endpoint(websocket: WebSocket):
    # The relay sends X-Client-Type: daw_relay; browsers send frontend
    client_type = websocket.headers.get("x-client-type", ClientType.FRONTEND)
    await daw_bridge.connect(websocket, client_type=client_type)
    try:
        while True:
            data = await websocket.receive_text()
            await daw_bridge.handle_message(data, sender=websocket)
    except WebSocketDisconnect:
        daw_bridge.disconnect(websocket)
    except Exception as e:
        print(f"WebSocket Error: {e}")
        daw_bridge.disconnect(websocket)

@app.websocket("/ws/session/{session_id}")
async def session_websocket(websocket: WebSocket, session_id: str):
    await session_manager.connect(websocket, session_id)
    try:
        while True:
            data_str = await websocket.receive_text()
            await session_manager.handle_message(data_str, websocket, session_id)
    except WebSocketDisconnect:
        session_manager.disconnect(websocket, session_id)
        await session_manager.broadcast(
            {"type": "USER_LEFT", "payload": {"message": "A user left the session."}},
            session_id
        )
    except Exception as e:
        print(f"Session WebSocket Error: {e}")
        session_manager.disconnect(websocket, session_id)

# ============== PLUGIN API ==============

class TransportRequest(BaseModel):
    action: str  # "play" | "stop" | "record"

class SetBpmRequest(BaseModel):
    bpm: float

class SendFileRequest(BaseModel):
    path: str
    target: str = "mixer"  # "mixer" | "piano_roll" | "playlist"

@app.get("/api/plugin/daw-state")
async def get_daw_state():
    """Return the current cached DAW state."""
    relay_connected = len(daw_bridge.daw_relay_connections) > 0
    return {
        **daw_bridge.daw_state,
        "relay_connected": relay_connected,
        "frontend_count": len(daw_bridge.frontend_connections),
    }

@app.post("/api/plugin/transport")
async def plugin_transport(req: TransportRequest):
    """Send a transport command (play/stop/record) to FL Studio."""
    ok = await daw_bridge.send_command_to_daw({
        "type": "CMD_TRANSPORT",
        "payload": {"action": req.action}
    })
    return {"sent": ok, "action": req.action}

@app.post("/api/plugin/set-bpm")
async def plugin_set_bpm(req: SetBpmRequest):
    """Push a new BPM value to FL Studio."""
    ok = await daw_bridge.send_command_to_daw({
        "type": "CMD_SET_BPM",
        "payload": {"bpm": req.bpm}
    })
    return {"sent": ok, "bpm": req.bpm}

@app.post("/api/plugin/send-file")
async def plugin_send_file(req: SendFileRequest):
    """
    Instruct FL Studio to open/import a file (MIDI, WAV stem, etc.).
    The relay forwards this as a CMD_OPEN_FILE SysEx to FL Studio.
    """
    if not os.path.exists(req.path):
        raise HTTPException(status_code=404, detail=f"File not found: {req.path}")
    ok = await daw_bridge.send_command_to_daw({
        "type": "CMD_OPEN_FILE",
        "payload": {"path": req.path, "target": req.target}
    })
    return {"sent": ok, "path": req.path, "target": req.target}

@app.get("/api/plugin/relay-status")
async def relay_status():
    """Check if the FL Studio relay (fl_relay.py) is connected."""
    return {
        "relay_connected": len(daw_bridge.daw_relay_connections) > 0,
        "frontend_count": len(daw_bridge.frontend_connections),
        "daw_state": daw_bridge.daw_state,
    }
