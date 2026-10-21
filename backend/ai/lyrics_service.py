import urllib.request
import json
import random

class LyricsService:
    """
    Service to generate structured lyrics and find rhymes using Datamuse API.
    """
    
    def __init__(self):
        pass

    def find_rhymes(self, word: str) -> list:
        """
        Find perfect rhymes for a word using Datamuse API.
        """
        try:
            url = f"https://api.datamuse.com/words?rel_rhy={word}&max=12"
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=5) as response:
                data = json.loads(response.read().decode())
                rhymes = [item['word'] for item in data]
                return rhymes
        except Exception as e:
            print(f"Error fetching rhymes: {e}")
            return ["glow", "flow", "shadow", "echo", "night", "light", "flight"]

    def generate_lyrics(self, topic: str, mood: str, genre: str) -> dict:
        """
        Generates full-structure song lyrics (Verse 1, Pre-Chorus, Chorus, Verse 2, Bridge, Outro)
        dynamically customized for topic, mood, and genre with rhyming patterns.
        """
        topic_clean = topic.strip().capitalize()
        mood_clean = mood.strip().lower()
        genre_clean = genre.strip().capitalize()

        # Fetch rhyming words for key terms
        topic_rhymes = self.find_rhymes(topic.split()[-1] if topic else "soul")
        mood_rhymes = self.find_rhymes(mood if mood else "high")
        
        r1 = topic_rhymes[0] if len(topic_rhymes) > 0 else "light"
        r2 = topic_rhymes[1] if len(topic_rhymes) > 1 else "night"
        mr1 = mood_rhymes[0] if len(mood_rhymes) > 0 else "free"
        mr2 = mood_rhymes[1] if len(mood_rhymes) > 1 else "see"

        lyrics_structure = f"""[Verse 1]
Tracing shadow lines across the floor,
Thinking 'bout {topic_clean} like never before.
The world outside is spinning {mood_clean} and fast,
Searching for a moment made to last.

[Pre-Chorus]
Can you hear the bass beat in the quiet {r1}?
Everything we feel is coming into {r2}.

[Chorus]
This is our {genre_clean} anthem, hear it echo far!
Chasing {topic_clean} under every single star.
Feeling so {mood_clean}, completely set {mr1},
This is where our spirits were meant to {mr2}!

[Verse 2]
Fading frequencies on the radio screen,
Live inside a feeling that we've never seen.
{topic_clean} keeps pulling like a rising tide,
Nothing left to shadow, nothing left to hide.

[Bridge]
Break down the static, let the melody breathe,
All of these promises we still believe.
From the lowest bass to the highest key,
{topic_clean} is setting everybody free!

[Outro]
Yeah... {topic_clean}...
Feeling {mood_clean}...
Let the {genre_clean} groove fade out into the night..."""

        return {
            "topic": topic,
            "mood": mood,
            "genre": genre,
            "lyrics": lyrics_structure.strip()
        }

