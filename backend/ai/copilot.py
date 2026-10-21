from .llm_service import MusicProducerLLMService

class AudioCopilot:
    def __init__(self):
        self.engine = MusicProducerLLMService()

    def process_message(self, message: str, daw_state: dict = None) -> dict:
        """
        Process a user message and return structured response with text and files.
        """
        return self.engine.generate_response(message, daw_state=daw_state)

