from abc import ABC, abstractmethod
import os
import json
from openai import OpenAI
from .midi_generation import MidiService

class LLMService(ABC):
    @abstractmethod
    def generate_response(self, message: str, context: list = None, persona_id: str = None, daw_state: dict = None) -> dict:
        pass

class MockLLMService(LLMService):
    def __init__(self):
        self.midi_service = MidiService()

    def generate_response(self, message: str, context: list = None, persona_id: str = None, daw_state: dict = None) -> dict:
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
        
        # Mock Persona handling
        from .personas import PERSONAS
        persona_prefix = ""
        if persona_id and persona_id in PERSONAS:
            persona = PERSONAS[persona_id]
            
            # Simple mock logic based on persona
            if persona_id == "ar_rahman":
                persona_prefix = "Brother... To find the soul of this track, we must merge the ancient ragas with modern textures. "
            elif persona_id == "harris_jayaraj":
                persona_prefix = "Keep the acoustic guitars crisp. Pan the shakers wide. Throw a ping-pong delay on that vocal chop! "
            elif persona_id == "anirudh":
                persona_prefix = "Bro, this is pure hype! But we need more energy! Let's drop a massive Kuthu beat underneath the 808s! "
                
            return {
                "text": f"{persona_prefix}You said: '{message}'.",
                "files": []
            }
        
        # Default mock response with DAW context awareness
        daw_context = ""
        if daw_state and daw_state.get('connected'):
            daw_context = f" (Project: {daw_state.get('bpm')} BPM, {len(daw_state.get('tracks', []))} tracks)"
            
        return {
            "text": f"I'm your Audio Copilot (Mock Mode). You said: '{message}'{daw_context}. Try asking for a 'sad violin melody' or 'house bass'.",
            "files": []
        }

class OpenAILLMService(LLMService):
    def __init__(self, api_key: str):
        self.client = OpenAI(api_key=api_key)
        self.midi_service = MidiService()

    def generate_response(self, message: str, context: list = None, persona_id: str = None, daw_state: dict = None) -> dict:
        # For Phase 1 MVP, we will stick to text responses or specific function calling for MIDI if implemented.
        # This is a placeholder for the real "Function Calling" logic to trigger MIDI generation.
        try:
            system_content = "You are an expert music producer AI assistant."
            if daw_state and daw_state.get('connected'):
                system_content += f" Current project context: {json.dumps(daw_state)}. Use this metadata to provide better advice."
            
            # Add persona info if available
            from .personas import PERSONAS
            if persona_id and persona_id in PERSONAS:
                persona = PERSONAS[persona_id]
                system_content += f" You are adopting the musical persona of {persona['name']}. Style: {persona['description']}."

            response = self.client.chat.completions.create(
                model="gpt-4o", 
                messages=[
                    {"role": "system", "content": system_content},
                    {"role": "user", "content": message}
                ]
            )
            return {"text": response.choices[0].message.content, "files": []}
        except Exception as e:
            return {"text": f"Error calling OpenAI: {str(e)}", "files": []}

