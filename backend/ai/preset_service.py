import json
import random
import uuid

class PresetService:
    def __init__(self):
        # Base template for a Matt Tytel Vital synth preset (.vital)
        # Note: A real Vital preset has hundreds of parameters. This is a minimal valid 
        # structure providing basic oscillator routing and macro setup to produce sound.
        pass

    def generate_vital_preset(self, style: str) -> dict:
        """Generates a Vital synth preset JSON dictionary based on the requested style."""
        style = style.lower()
        
        # Base Template
        preset = {
            "author": "Audio Copilot",
            "comments": f"AI Generated {style.capitalize()} Preset",
            "macro1": "Macro 1",
            "macro2": "Macro 2",
            "macro3": "Macro 3",
            "macro4": "Macro 4",
            "plugin_version": "1.5.5",
            "sample_rate": 44100,
            "synth_version": "1.5.5",
            "settings": {
                "osc_1_on": True,
                "osc_2_on": False,
                "osc_3_on": False,
                "filter_1_on": True,
                "env_1_attack": 0.001,
                "env_1_decay": 1.0,
                "env_1_sustain": 1.0,
                "env_1_release": 0.1,
                "filter_1_cutoff": 60.0,
                "filter_1_drive": 0.0,
                "osc_1_unison_voices": 1,
                "osc_1_unison_detune": 0.0,
                "chorus_on": False,
                "reverb_on": False,
                "delay_on": False
            }
        }

        settings = preset["settings"]

        if style == "bass":
            # Fast attack, low pass, maybe some drive
            settings["env_1_attack"] = random.uniform(0.001, 0.01)
            settings["env_1_decay"] = random.uniform(0.3, 0.8)
            settings["env_1_sustain"] = random.uniform(0.2, 0.6)
            settings["env_1_release"] = random.uniform(0.05, 0.2)
            settings["filter_1_cutoff"] = random.uniform(30.0, 50.0)
            settings["filter_1_drive"] = random.uniform(2.0, 8.0)
            settings["osc_1_unison_voices"] = random.choice([1, 2, 4])
            settings["osc_1_unison_detune"] = random.uniform(0.0, 0.1)
            
        elif style == "pad":
            # Slow attack, long release, detuned oscillators, effects
            settings["env_1_attack"] = random.uniform(0.5, 2.0)
            settings["env_1_decay"] = random.uniform(1.0, 3.0)
            settings["env_1_sustain"] = random.uniform(0.8, 1.0)
            settings["env_1_release"] = random.uniform(1.0, 4.0)
            settings["filter_1_cutoff"] = random.uniform(50.0, 80.0)
            settings["osc_1_unison_voices"] = random.choice([7, 9, 11])
            settings["osc_1_unison_detune"] = random.uniform(0.15, 0.3)
            settings["chorus_on"] = True
            settings["reverb_on"] = True
            
        elif style == "lead":
            # Medium attack, high cutoff, maybe delay
            settings["env_1_attack"] = random.uniform(0.01, 0.05)
            settings["env_1_decay"] = random.uniform(0.5, 1.5)
            settings["env_1_sustain"] = random.uniform(0.6, 1.0)
            settings["env_1_release"] = random.uniform(0.2, 0.6)
            settings["filter_1_cutoff"] = random.uniform(70.0, 110.0)
            settings["osc_1_unison_voices"] = random.choice([1, 3, 5])
            settings["osc_1_unison_detune"] = random.uniform(0.05, 0.15)
            settings["delay_on"] = random.choice([True, False])
            settings["reverb_on"] = True
            
        elif style == "pluck":
            # Instant attack, fast decay, zero sustain
            settings["env_1_attack"] = random.uniform(0.0001, 0.001)
            settings["env_1_decay"] = random.uniform(0.1, 0.4)
            settings["env_1_sustain"] = 0.0
            settings["env_1_release"] = random.uniform(0.1, 0.4)
            settings["filter_1_cutoff"] = random.uniform(40.0, 80.0)
            settings["osc_1_unison_voices"] = random.choice([1, 3])
            settings["osc_1_unison_detune"] = random.uniform(0.0, 0.1)
            settings["reverb_on"] = random.choice([True, False])
            
        else:
            # Default fallback
            preset["comments"] = "AI Generated Default Preset"
            
        return preset
