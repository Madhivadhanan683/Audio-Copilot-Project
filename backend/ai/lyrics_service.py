import urllib.request
import json
import random

class LyricsService:
    """
    Service to generate lyrics and find rhymes.
    """
    
    def __init__(self):
        pass

    def find_rhymes(self, word: str) -> list:
        """
        Find perfect rhymes for a word using Datamuse API.
        """
        try:
            url = f"https://api.datamuse.com/words?rel_rhy={word}&max=10"
            with urllib.request.urlopen(url) as response:
                data = json.loads(response.read().decode())
                # Extract words
                rhymes = [item['word'] for item in data]
                return rhymes
        except Exception as e:
            print(f"Error fetching rhymes: {e}")
            return []

    def generate_lyrics(self, topic: str, mood: str, genre: str) -> dict:
        """
        Generate lyrics based on topic, mood, and genre.
        Currently uses a template-based approach for the MVP.
        """
        
        # Simple templates for MVP
        templates = [
            f"(Verse 1)\nWalking down the street, thinking 'bout {topic}\nEverything feels {mood}, I can't stop it\nThe city lights are shining bright\nBut I'm just looking for a guiding light\n\n(Chorus)\nOh, {topic}, it's all I know\nIn this {genre} world, I'm ready to go\nCan you feel the rhythm in my soul?\nLet the music take control\n\n(Verse 2)\nAnother day, another fight\nTrying to make everything alright\nBut when the {mood} feeling starts to grow\nI just let the melody flow",
            
            f"(Verse 1)\nI woke up this morning with {topic} on my mind\nA {mood} feeling that's hard to find\nLooking for answers in the sky above\nSearching for a little bit of love\n\n(Chorus)\nThis is my {genre} anthem, singing it loud\nStanding out from the crowd\n{topic}, you're the reason why\nI'm reaching for the sky",
        ]
        
        lyrics = random.choice(templates)
        
        return {
            "topic": topic,
            "mood": mood,
            "genre": genre,
            "lyrics": lyrics
        }
