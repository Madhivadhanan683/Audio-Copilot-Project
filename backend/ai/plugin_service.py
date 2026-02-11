import os
import json

class PluginService:
    """
    Service to recommend VST plugins based on audio analysis or user needs.
    """
    
    def __init__(self):
        # Database of VST Plugins
        # Categories: EQ, Compressor, Reverb, Delay, Saturation, Utility, Limiter
        self.plugin_database = [
            {
                "name": "FabFilter Pro-Q 3",
                "type": "EQ",
                "price": "Paid",
                "tags": ["surgical", "clean", "dynamic", "visual"],
                "solves": ["muddy", "resonance", "masking", "frequency_clash"],
                "description": "The industry standard for clean, surgical EQing with a fantastic visualizer.",
                "url": "https://www.fabfilter.com/products/pro-q-3-equalizer-plug-in"
            },
            {
                "name": "TDR Nova",
                "type": "EQ",
                "price": "Free",
                "tags": ["dynamic", "clean", "free"],
                "solves": ["resonance", "sibilance", "dynamic_control"],
                "description": "A powerful free dynamic equalizer. Great for handling specific problem frequencies that change over time.",
                "url": "https://www.tokyodawn.net/tdr-nova/"
            },
            {
                "name": "ValhallaVintageVerb",
                "type": "Reverb",
                "price": "Paid",
                "tags": ["lush", "colors", "vintage"],
                "solves": ["dry", "flat", "depth"],
                "description": "Versatile, lush reverb that sounds good on almost everything. Perfect for 70s/80s vibes.",
                "url": "https://valhalladsp.com/shop/reverb/valhalla-vintage-verb/"
            },
            {
                "name": "OrilRiver",
                "type": "Reverb",
                "price": "Free",
                "tags": ["algorithmic", "clean", "free"],
                "solves": ["dry", "space"],
                "description": "A fantastic free algorithmic stereo reverb that rivals paid plugins.",
                "url": "https://www.kvraudio.com/product/orilriver-by-denis-tihanov"
            },
            {
                "name": "Xfer OTT",
                "type": "Compressor",
                "price": "Free",
                "tags": ["multiband", "upward", "aggressive", "edm"],
                "solves": ["dull", "quiet", "weak_highs"],
                "description": "The legendary multiband upwards/downwards compressor. Makes things bright and huge.",
                "url": "https://xferrecords.com/freeware"
            },
            {
                "name": "FabFilter Pro-C 2",
                "type": "Compressor",
                "price": "Paid",
                "tags": ["clean", "versatile", "visual", "sidechain"],
                "solves": ["dynamic_range", "inconsistent_levels", "punch"],
                "description": "High-quality compressor with various styles (Vocal, Bus, Punch) and great visual feedback.",
                "url": "https://www.fabfilter.com/products/pro-c-2-compressor-plug-in"
            },
            {
                "name": "Soundtoys Decapitator",
                "type": "Saturation",
                "price": "Paid",
                "tags": ["analog", "warmth", "distortion"],
                "solves": ["thin", "sterile", "digital", "cold"],
                "description": "Analog saturation modeler. Adds warmth, beef, and character to thin sounding tracks.",
                "url": "https://www.soundtoys.com/product/decapitator/"
            },
            {
                "name": "Softube Saturation Knob",
                "type": "Saturation",
                "price": "Free",
                "tags": ["simple", "warmth", "one-knob"],
                "solves": ["thin", "weak"],
                "description": "One knob to rule them all. Simple, effective saturation to thicken up sounds.",
                "url": "https://www.softube.com/saturation-knob"
            },
            {
                "name": "FabFilter Pro-L 2",
                "type": "Limiter",
                "price": "Paid",
                "tags": ["mastering", "transparent", "loudness"],
                "solves": ["quiet", "clipping", "peaks"],
                "description": "True peak limiter. Essential for getting your track to commercial loudness without distortion.",
                "url": "https://www.fabfilter.com/products/pro-l-2-limiter-plug-in"
            },
             {
                "name": "Polyverse Wider",
                "type": "Stereo",
                "price": "Free",
                "tags": ["width", "mono-compatible", "clean"],
                "solves": ["narrow", "mono"],
                "description": "Expands the stereo image of a signal to an insane amount of width depending on needs, without phase issues.",
                "url": "https://polyversemusic.com/products/wider/"
            }
        ]

    def recommend_plugins(self, analysis_data: dict) -> list:
        """
        Analyze metrics from MixingService and recommend plugins.
        """
        metrics = analysis_data.get("metrics", {})
        suggestions = analysis_data.get("suggestions", [])
        
        recommendations = []
        
        # 1. Check for Loudness Issues
        rms_db = metrics.get("rms_db", -20)
        if rms_db < -20:
            # Too quiet -> Compressors, Limiters
            for plugin in self.plugin_database:
                if "quiet" in plugin["solves"]:
                    recommendations.append(plugin)
        
        # 2. Check for Spectral Issues (Brightness)
        centroid = metrics.get("spectral_centroid", 2000)
        if centroid < 1000:
            # Too dark/muddy -> EQ (boost highs), Saturation (add harmonics)
            for plugin in self.plugin_database:
                if "muddy" in plugin["solves"] or "dull" in plugin["solves"]:
                    recommendations.append(plugin)
        elif centroid > 3500:
             # Too bright -> EQ (cut highs), De-esser
             for plugin in self.plugin_database:
                if "harsh" in plugin["solves"]:
                    recommendations.append(plugin)
        
        # 3. Check for Bass Issues
        bass_ratio = metrics.get("bass_ratio", 0.2)
        if bass_ratio < 0.05:
            # Thin -> Saturation
             for plugin in self.plugin_database:
                if "thin" in plugin["solves"]:
                    recommendations.append(plugin)
        elif bass_ratio > 0.4:
            # Boomy -> Multiband compression
             for plugin in self.plugin_database:
                if "frequency_clash" in plugin["solves"]:
                    recommendations.append(plugin)
        
        # 4. General Recommendations (Reverb for Space)
        # Always suggest 1 good reverb if we haven't already
        for plugin in self.plugin_database:
            if "dry" in plugin["solves"]:
                recommendations.append(plugin)

        # Deduplicate
        unique_recs = {p['name']: p for p in recommendations}.values()
        
        return list(unique_recs)
