
import sys
import os
import unittest
from unittest.mock import MagicMock, patch

# Add backend directory to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from ai.transcription_service import TranscriptionService

class TestTranscriptionService(unittest.TestCase):
    @patch('ai.transcription_service.whisper')
    def test_transcription_initialization(self, mock_whisper):
        """Test that TranscriptionService initializes the model correctly."""
        # Setup mock
        mock_model = MagicMock()
        mock_whisper.load_model.return_value = mock_model
        
        # Test initialization
        service = TranscriptionService(model_size="base")
        
        # Assertions
        mock_whisper.load_model.assert_called_with("base")
        self.assertTrue(service.WHISPER_AVAILABLE)
        self.assertIsNotNone(service.model)

    @patch('ai.transcription_service.whisper')
    @patch('os.path.exists')
    def test_transcribe(self, mock_exists, mock_whisper):
        """Test that transcribe method calls model.transcribe correctly."""
        # Setup mocks
        mock_model = MagicMock()
        mock_model.transcribe.return_value = {"text": "Hello world"}
        mock_whisper.load_model.return_value = mock_model
        mock_exists.return_value = True
        
        # Initialize service
        service = TranscriptionService()
        
        # Test transcribe
        result = service.transcribe("test_audio.mp3")
        
        # Assertions
        mock_model.transcribe.assert_called_with("test_audio.mp3")
        self.assertEqual(result, "Hello world")

if __name__ == '__main__':
    unittest.main()
