from abc import ABC, abstractmethod
import os
import json
from openai import OpenAI
from .midi_generation import MidiService

class LLMService(ABC):
    @abstractmethod
    def generate_response(self, message: str, context: list = None) -> dict:
        pass

class MockLLMService(LLMService):
    def __init__(self):
        self.midi_service = MidiService()

    def generate_response(self, message: str, context: list = None) -> dict:
        msg_lower = message.lower()
        
        # simplified intent detection for MVP
        if "melody" in msg_lower and "violin" in msg_lower:
            midi_path = self.midi_service.generate_melody_from_pattern("sad_violin")
            return {
                "text": "I've generated a sad violin melody for you. Drag it into your DAW!",
                "files": [{"type": "midi", "url": midi_path, "name": "Sad Violin Melody"}]
            }
        elif "bass" in msg_lower and "house" in msg_lower:
            midi_path = self.midi_service.generate_melody_from_pattern("house_bass")
            return {
                "text": "Here is a driving House bassline pattern.",
                "files": [{"type": "midi", "url": midi_path, "name": "House Bassline"}]
            }
        elif "chord" in msg_lower:
             midi_path = self.midi_service.generate_melody_from_pattern("chords")
             return {
                "text": "Here is a standard C Major progression.",
                "files": [{"type": "midi", "url": midi_path, "name": "C Major Chords"}]
            }
        
        return {
            "text": f"I'm your Audio Copilot (Mock Mode). You said: '{message}'. Try asking for a 'sad violin melody' or 'house bass'.",
            "files": []
        }

class OpenAILLMService(LLMService):
    def __init__(self, api_key: str):
        self.client = OpenAI(api_key=api_key)
        self.midi_service = MidiService()

    def generate_response(self, message: str, context: list = None) -> dict:
        # For Phase 1 MVP, we will stick to text responses or specific function calling for MIDI if implemented.
        # This is a placeholder for the real "Function Calling" logic to trigger MIDI generation.
        try:
            response = self.client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": "You are an expert music producer AI assistant."},
                    {"role": "user", "content": message}
                ]
            )
            return {"text": response.choices[0].message.content, "files": []}
        except Exception as e:
            return {"text": f"Error calling OpenAI: {str(e)}", "files": []}

