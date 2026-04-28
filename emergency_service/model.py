import os
import torch
from transformers import pipeline, AutoProcessor, AutoModelForCausalLM
from PIL import Image

class EmergencyModel:
    def __init__(self):
        # Using a zero-shot classification model.
        # Zero-shot is extremely flexible for custom labels ("fire", "panic", "medical", "normal")
        # and doesn't require fine-tuning for our specific classes.
        # We use a distilbert-based mnli model as it's lightweight and fits the distilbert-base-uncased requirement.
        model_name = "typeform/distilbert-base-uncased-mnli"
        
        # Determine device (-1 for CPU, 0 for GPU if available)
        # Keeping it default (CPU) for compatibility, but can be updated based on deployment environment
        self.classifier = pipeline(
            "zero-shot-classification",
            model=model_name
        )
        self.candidate_labels = ["fire", "panic", "medical", "normal"]

    def analyze_text(self, text: str):
        """
        Analyzes the text and returns a dict mapping all labels to their probabilities.
        """
        # Run the text through the zero-shot classifier
        result = self.classifier(text, self.candidate_labels)
        
        # result['labels'] and result['scores'] are sorted by score descending
        top_label = result['labels'][0]
        top_score = result['scores'][0]
        
        # Create a dictionary of all scores to pass to the decision engine
        scores_dict = {label: score for label, score in zip(result['labels'], result['scores'])}
        
        return top_label, top_score, scores_dict

# Initialize the model as a singleton so it's loaded once at startup
emergency_model = EmergencyModel()

import requests
import io

class VisionEmergencyModel:
    def __init__(self):
        self.model_id = 'google/mobilenet_v2_1.0_224'
        self.pipeline = None
        self.loaded = False

    def load_model(self):
        if not self.loaded:
            print("Loading 14MB Ultra-Fast Vision AI Model...")
            from transformers import pipeline
            self.pipeline = pipeline("image-classification", model=self.model_id)
            self.loaded = True

    def analyze_image(self, image: Image.Image):
        self.load_model()
        results = self.pipeline(image)
        top_label = results[0]['label']
        
        # If it detects a laptop, it will literally output "A photo showing a laptop"
        # which will be scored safely by the text NLP engine!
        return f"A photo showing a {top_label}"

vision_model = VisionEmergencyModel()

import google.generativeai as genai

class AudioEmergencyModel:
    def __init__(self):
        # Configure Gemini API
        genai.configure(api_key="AIzaSyDVrOlXh1KNpBV3x0HIu0008aVDQjURBvE")
        self.model = genai.GenerativeModel("gemini-1.5-flash")

    def analyze_audio(self, file_path: str) -> str:
        try:
            print(f"Uploading audio file {file_path} to Gemini...")
            audio_file = genai.upload_file(path=file_path)
            
            # Ask Gemini to transcribe and summarize the emergency
            prompt = (
                "Listen to this audio. If it is an emergency report, transcribe exactly what happened. "
                "If someone says 'fire' or 'accident', highlight it. If it is just background noise or normal talk, say 'normal'."
            )
            response = self.model.generate_content([prompt, audio_file])
            text_result = response.text
            
            # Clean up the remote file
            genai.delete_file(audio_file.name)
            
            return text_result.strip()
        except Exception as e:
            print(f"Gemini Audio Error: {e}")
            return "Unable to process audio."

audio_model = AudioEmergencyModel()
