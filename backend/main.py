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

from bridge.daw_server import DAWBridge
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
# Default to Mock
llm_service = MockLLMService()
audio_service = MockAudioService()
daw_bridge = DAWBridge()

# Use real StemService for AI separation
# stem_service = StemService()
stem_service = MockStemService() # Reverted to Mock Service as per user request

# Audio to MIDI Service
# audio_to_midi_service = AudioToMidi()
# Fallback to mock if basic-pitch is not installed
try:
    audio_to_midi_service = AudioToMidi()
    if not audio_to_midi_service.BASIC_PITCH_AVAILABLE:
        print("Basic Pitch not available, using Mock Service")
        audio_to_midi_service = MockAudioToMidiService()
except ImportError:
    print("Could not import AudioToMidi, using Mock")
    audio_to_midi_service = MockAudioToMidiService()

# Mixing Service
mixing_service = MixingService()

# Plugin Service
plugin_service = PluginService()

# Lyrics Service
lyrics_service = LyricsService()

# Mount directories for generated files using absolute paths
base_dir = os.path.dirname(os.path.abspath(__file__))
os.makedirs(os.path.join(base_dir, "generated_midi"), exist_ok=True)
os.makedirs(os.path.join(base_dir, "separated_stems"), exist_ok=True)
os.makedirs(os.path.join(base_dir, "uploads"), exist_ok=True)

app.mount("/generated_midi", StaticFiles(directory=os.path.join(base_dir, "generated_midi")), name="generated_midi")
app.mount("/separated_stems", StaticFiles(directory=os.path.join(base_dir, "separated_stems")), name="separated_stems")

# Store current settings
current_settings = {
    "provider": "mock",
    "api_key": None
}

class ChatRequest(BaseModel):
    message: str

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

@app.post("/api/chat")
async def chat(request: ChatRequest):
    try:
        response = llm_service.generate_response(request.message)
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

# ============== WEBSOCKET ==============

@app.websocket("/ws/daw")
async def websocket_endpoint(websocket: WebSocket):
    await daw_bridge.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            await daw_bridge.handle_message(data)
    except WebSocketDisconnect:
        daw_bridge.disconnect(websocket)
    except Exception as e:
        print(f"WebSocket Error: {e}")
        daw_bridge.disconnect(websocket)
