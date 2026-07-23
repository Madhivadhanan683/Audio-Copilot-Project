import os
import uuid
import re

class SampleTaggingService:
    def __init__(self):
        self.supported_extensions = ['.wav', '.mp3', '.flac', '.aiff', '.ogg', '.m4a']
        
        # Expanded keywords for heuristic tagging
        self.category_keywords = {
            "Kick": ["kick", "bd", "bassdrum"],
            "Snare": ["snare", "sd"],
            "Clap": ["clap", "cp"],
            "Hihat": ["hihat", "hh", "hat", "ch", "oh", "closedhat", "openhat"],
            "Percussion": ["perc", "bongo", "conga", "shaker", "tamb", "tom"],
            "Cymbal": ["crash", "ride", "cymbal"],
            "Loop": ["loop"],
            "Vocal": ["vox", "vocal", "acapella", "chant"],
            "Bass": ["bass", "808", "sub"],
            "Synth": ["synth", "lead", "pad", "chord", "pluck", "keys"],
            "FX": ["fx", "impact", "riser", "sweep", "drop", "noise"]
        }
        
        # Regex for BPM (e.g., 120bpm, 120 bpm, 120_bpm)
        self.bpm_regex = re.compile(r'(?:^|[^a-zA-Z0-9])(\d{2,3})[_\s]*bpm(?:$|[^a-zA-Z0-9])', re.IGNORECASE)
        
        # Regex for Key (e.g., Cmin, F#maj, Am, D#m)
        self.key_regex = re.compile(r'(?:^|[^a-zA-Z0-9])([A-G][#b]?(?:min|maj|m|M))(?:$|[^a-zA-Z0-9])')

    def scan_directory(self, folder_path: str):
        """Scans a directory for audio files and tags them."""
        results = []
        
        if not os.path.isdir(folder_path):
            return {"error": f"Directory not found or invalid: {folder_path}", "samples": []}
            
        try:
            for root, _, files in os.walk(folder_path):
                for file in files:
                    ext = os.path.splitext(file)[1].lower()
                    if ext in self.supported_extensions:
                        file_path = os.path.join(root, file)
                        sample_info = self._analyze_file(file, file_path)
                        results.append(sample_info)
                        
            return {"samples": results}
        except Exception as e:
            print(f"Error scanning directory {folder_path}: {e}")
            return {"error": str(e), "samples": []}

    def _analyze_file(self, filename: str, filepath: str):
        """Analyzes a single file's name and path to generate tags."""
        name_without_ext = os.path.splitext(filename)[0]
        lower_name = name_without_ext.lower()
        
        # 1. Determine Category
        categories = []
        for cat, keywords in self.category_keywords.items():
            for kw in keywords:
                # Use word boundaries or simple substring depending on keyword
                if re.search(r'\b' + re.escape(kw) + r'\b', lower_name) or (len(kw) > 2 and kw in lower_name):
                    categories.append(cat)
                    break
        
        primary_category = categories[0] if categories else "Other"
        
        # 2. Extract BPM
        bpm = None
        bpm_match = self.bpm_regex.search(lower_name)
        if bpm_match:
            bpm = int(bpm_match.group(1))
            
        # 3. Extract Key
        key = None
        # Often keys might be formatted differently, we look for matches
        # The regex is basic but catches typical naming conventions
        key_match = self.key_regex.search(name_without_ext) # Notice we use original case here as m/M can distinguish minor/major
        if key_match:
            key = key_match.group(1)
            
        # 4. Determine File Size
        try:
            size_bytes = os.path.getsize(filepath)
            size_mb = round(size_bytes / (1024 * 1024), 2)
        except OSError:
            size_mb = 0.0

        return {
            "id": str(uuid.uuid4()),
            "name": name_without_ext,
            "filename": filename,
            "path": filepath,  # Absolute path for the backend to stream
            "category": primary_category,
            "tags": categories, # All matched categories
            "bpm": bpm,
            "key": key,
            "size_mb": size_mb,
            "extension": os.path.splitext(filename)[1].lower()
        }
