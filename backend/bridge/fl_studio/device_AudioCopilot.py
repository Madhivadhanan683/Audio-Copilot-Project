# name=Audio Copilot Bridge v1.2.2
# author=Madhivadhanan (Audio Copilot)
# version=1.2.2
# Description: Connects FL Studio to the Audio Copilot Backend (Ultra-Robust Version)
# =============================================================================
# If you see errors, make sure you selected 'Bridge v1.2.2' in MIDI settings.
# =============================================================================

import transport
import mixer
import general
import ui
import device
import time
import json
import binascii

def b64_encode(s):
    return binascii.b2a_base64(s.encode('utf-8')).decode('utf-8').strip()

def get_robust_bpm():
    """Safely attempts to get tempo from various FL modules."""
    try:
        if hasattr(mixer, 'getTempo'):
            return round(mixer.getTempo(), 2)
    except: pass
    
    try:
        if hasattr(general, 'getTempo'):
            return round(general.getTempo(), 2)
    except: pass
    
    try:
        if hasattr(transport, 'getTempo'):
            val = transport.getTempo()
            if val > 1000: return round(val / 1000.0, 2)
            return round(val, 2)
    except: pass
    
    return 120.0 # Fallback

def get_robust_project_name():
    """Safely attempts to get project name from general module."""
    # 1. Try getProjectTitle (Standard in MIDI scripting)
    try:
        if hasattr(general, 'getProjectTitle'):
            name = general.getProjectTitle()
            if name: return name
    except: pass

    # 2. Try getProjectName
    try:
        if hasattr(general, 'getProjectName'):
            name = general.getProjectName()
            if name: return name
    except: pass

    return "Untitled"

class CopilotBridge:
    def __init__(self):
        self.last_sync_time = 0
        self.sync_interval = 0.5

    def send_update(self, data):
        try:
            json_str = json.dumps(data)
            b64_str = b64_encode(json_str)
            msg = bytearray([0xF0, 0x7D])
            msg.extend(b64_str.encode('ascii'))
            msg.append(0xF7)
            device.midiOutSysex(msg)
            return True
        except Exception as e:
            return False

bridge = CopilotBridge()

def OnInit():
    print("--------------------------------------------------")
    print("Audio Copilot FL Studio Bridge v1.2.2 (ULTRA-ROBUST)")
    print("Device: " + device.getName())
    print("--------------------------------------------------")
    ui.setHintMsg("Audio Copilot Bridge: Active (v1.2.2)")

def OnDeInit():
    print("Audio Copilot Bridge: Deinitialized")

def OnIdle():
    global bridge
    curr_time = time.time()
    if curr_time - bridge.last_sync_time < bridge.sync_interval:
        return
    bridge.last_sync_time = curr_time
    sync_state()

def sync_state():
    # 1. Transport State
    is_playing = transport.isPlaying()
    bpm = get_robust_bpm()
    
    # 2. Tracks State
    track_list = []
    for i in range(1, 41):
        name = mixer.getTrackName(i)
        if name and name != "Insert " + str(i):
            track_list.append(name)

    # 3. Project Name
    proj_name = get_robust_project_name()

    bridge.send_update({
        "type": "STATE_UPDATE",
        "payload": {
            "bpm": bpm,
            "tracks": track_list,
            "project_name": proj_name,
            "is_playing": is_playing,
            "status": "connected"
        }
    })

def OnUpdateBeatIndicator(value):
    pass
