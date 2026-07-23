import sys
import os

# Add backend directory to path
# Script is at project root, backend is in ./backend
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.join(current_dir, 'backend')
sys.path.append(backend_dir)

from ai.lyrics_service import LyricsService

def test_lyrics_service():
    service = LyricsService()
    
    print("Testing generate_lyrics...")
    lyrics = service.generate_lyrics("Space", "Epic", "Orchestral")
    print(f"Generated Lyrics:\n{lyrics['lyrics'][:100]}...")
    assert lyrics['topic'] == "Space"
    
    print("\nTesting find_rhymes...")
    rhymes = service.find_rhymes("cat")
    print(f"Rhymes for 'cat': {rhymes}")
    assert len(rhymes) > 0

if __name__ == "__main__":
    test_lyrics_service()


