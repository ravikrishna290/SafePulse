from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
from model import emergency_model, vision_model
from decision import calculate_decision
import time
import base64
import io
from PIL import Image

app = FastAPI(
    title="Emergency Analysis Service",
    description="Real-time AI-powered emergency analysis using NLP and sensor data.",
    version="1.0.0"
)

# Input data model for validation
class EmergencyInput(BaseModel):
    message: str = Field(..., description="User description of the emergency")
    crowd_density: int = Field(..., ge=0, le=100, description="Crowd density scale 0-100")
    movement: str = Field(..., description="Movement level: 'low', 'medium', or 'high'")
    noise_level: int = Field(..., ge=0, le=100, description="Noise level scale 0-100")
    prev_crowd: Optional[int] = Field(None, ge=0, le=100, description="Previous crowd density scale 0-100")
    zone: str = Field("lobby", description="Location zone of the emergency")

@app.get("/")
def health_check():
    return {"status": "ok", "message": "Emergency Analysis Service is running"}

@app.post("/analyze")
async def analyze_emergency(payload: EmergencyInput):
    start_time = time.time()
    
    try:
        # Step 1: Run NLP Model
        top_label, top_score, scores_dict = emergency_model.analyze_text(payload.message)
        
        # Step 2 & 3: Apply Sensor Logic and Final Decision Engine
        response = calculate_decision(
            nlp_scores=scores_dict,
            crowd_density=payload.crowd_density,
            movement=payload.movement,
            noise_level=payload.noise_level,
            prev_crowd=payload.prev_crowd,
            zone=payload.zone
        )
        
        # Add latency monitoring
        process_time_ms = int((time.time() - start_time) * 1000)
        response["latency_ms"] = process_time_ms
        
        return response
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class VisionInput(BaseModel):
    image_base64: str = Field(..., description="Base64 encoded image string")
    crowd_density: int = Field(50, ge=0, le=100)
    movement: str = Field("medium")
    noise_level: int = Field(50, ge=0, le=100)
    prev_crowd: Optional[int] = Field(None)
    zone: str = Field("lobby")

@app.post("/analyze/vision")
async def analyze_vision(payload: VisionInput):
    start_time = time.time()
    try:
        # Decode base64 image
        image_data = base64.b64decode(payload.image_base64)
        image = Image.open(io.BytesIO(image_data)).convert("RGB")
        
        # 1. Run Vision Model to extract text context
        visual_context = vision_model.analyze_image(image)
        
        # Safe bypass for benign objects to prevent NLP zero-shot hallucinations
        danger_keywords = ["fire", "smoke", "flame", "blood", "gun", "knife", "weapon", "accident", "crash", "fight", "panic"]
        is_dangerous = any(keyword in visual_context.lower() for keyword in danger_keywords)
        
        if not is_dangerous:
            scores_dict = {"normal": 0.99, "fire": 0.0, "panic": 0.0, "medical": 0.0}
        else:
            # 2. Run NLP Model on the visual context
            message = f"Visual scene: {visual_context}"
            top_label, top_score, scores_dict = emergency_model.analyze_text(message)
        
        # 3. Apply Decision Engine
        response = calculate_decision(
            nlp_scores=scores_dict,
            crowd_density=payload.crowd_density,
            movement=payload.movement,
            noise_level=payload.noise_level,
            prev_crowd=payload.prev_crowd,
            zone=payload.zone
        )
        
        response["latency_ms"] = int((time.time() - start_time) * 1000)
        # Add explanation prefix to highlight multimodal
        response["explanation"] = f"[VISION AI DETECTED: {visual_context}] " + response["explanation"]
        
        return response
    except Exception as e:
        print("Vision Error:", e)
        raise HTTPException(status_code=500, detail=str(e))

from model import audio_model
import tempfile
import os

class AudioInput(BaseModel):
    audio_base64: str = Field(..., description="Base64 encoded audio string (.m4a format)")
    crowd_density: int = Field(50, ge=0, le=100)
    movement: str = Field("medium")
    noise_level: int = Field(50, ge=0, le=100)
    prev_crowd: Optional[int] = Field(None)
    zone: str = Field("lobby")

@app.post("/analyze/audio")
async def analyze_audio(payload: AudioInput):
    start_time = time.time()
    temp_file_path = None
    try:
        # Decode base64 audio and save to a temporary file
        audio_data = base64.b64decode(payload.audio_base64)
        
        # Create a temporary file with .m4a extension (Expo AV default format on iOS/Android)
        fd, temp_file_path = tempfile.mkstemp(suffix=".m4a")
        with os.fdopen(fd, 'wb') as f:
            f.write(audio_data)
            
        # 1. Run Gemini Audio Model to transcribe and analyze the audio
        audio_context = audio_model.analyze_audio(temp_file_path)
        
        # Clean up the local temp file immediately
        os.remove(temp_file_path)
        
        # Safe bypass for normal interactions or fallback errors
        if audio_context == "Unable to process audio." or audio_context.lower() == "normal":
            scores_dict = {"normal": 0.99, "fire": 0.0, "panic": 0.0, "medical": 0.0}
        else:
            # 2. Run NLP Model on the audio transcript
            message = f"Audio transcript: {audio_context}"
            top_label, top_score, scores_dict = emergency_model.analyze_text(message)
        
        # 3. Apply Decision Engine
        response = calculate_decision(
            nlp_scores=scores_dict,
            crowd_density=payload.crowd_density,
            movement=payload.movement,
            noise_level=payload.noise_level,
            prev_crowd=payload.prev_crowd,
            zone=payload.zone
        )
        
        response["latency_ms"] = int((time.time() - start_time) * 1000)
        # Add explanation prefix to highlight multimodal
        response["explanation"] = f"[VOICE AI HEARD: {audio_context}] " + response["explanation"]
        
        return response
    except Exception as e:
        print("Audio Error:", e)
        if temp_file_path and os.path.exists(temp_file_path):
            os.remove(temp_file_path)
        raise HTTPException(status_code=500, detail=str(e))

# Run locally using: uvicorn main:app --reload
