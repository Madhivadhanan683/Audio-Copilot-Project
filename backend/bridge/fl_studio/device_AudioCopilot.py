# name=Audio Copilot Bridge v2.0
# author=Madhivadhanan (Audio Copilot)
# version=2.0
# Description: Bidirectional FL Studio ↔ Audio Copilot bridge.
#              Reads full DAW state AND handles incoming commands.
# =============================================================================
# SETUP: Place this file in:
#   %USERPROFILE%\Documents\Image-Line\FL Studio\Settings\Hardware\
# Then in FL Studio: Options → MIDI Settings → select "Audio Copilot Bridge v2.0"
# as both Input and Output on the loopMIDI "Audio Copilot Bridge" virtual port.
# =============================================================================

import transport
import mixer
import general
import channels
import ui
import device
import patterns
import time
import json
import binascii

# ─── Helpers ──────────────────────────────────────────────────────────────────

def b64_encode(s):
    """Base64-encode a UTF-8 string for SysEx transport."""
    return binascii.b2a_base64(s.encode('utf-8')).decode('utf-8').strip()

def b64_decode(s):
    """Decode a Base64 string back to UTF-8."""
    import base64
    return base64.b64decode(s).decode('utf-8')

def get_robust_bpm():
    """Safely read project tempo from various FL modules."""
    for mod, fn in [
        (mixer, 'getTempo'),
        (general, 'getTempo'),
        (transport, 'getTempo'),
    ]:
        try:
            if hasattr(mod, fn):
                val = getattr(mod, fn)()
                if val and val > 1000:
                    return round(val / 1000.0, 2)
                if val:
                    return round(val, 2)
        except Exception:
            pass
    return 120.0

def get_time_signature():
    """Return time signature as a string like '4/4'."""
    try:
        num = general.getTimeSignature(0)  # numerator
        den = general.getTimeSignature(1)  # denominator
        return f"{num}/{den}"
    except Exception:
        return "4/4"

def get_robust_project_name():
    """Return current project title."""
    for fn in ['getProjectTitle', 'getProjectName']:
        try:
            val = getattr(general, fn)() if hasattr(general, fn) else None
            if val:
                return val
        except Exception:
            pass
    return "Untitled"

def get_tracks():
    """Return list of non-default FL Studio mixer track names (max 40)."""
    tracks = []
    try:
        for i in range(1, 41):
            name = mixer.getTrackName(i)
            if name and name != f"Insert {i}":
                tracks.append({"index": i, "name": name})
    except Exception:
        pass
    return tracks

def get_selected_channel():
    """Return the name of the currently focused channel rack channel."""
    try:
        idx = channels.selectedChannel()
        name = channels.getChannelName(idx)
        return {"index": idx, "name": name}
    except Exception:
        return None

def get_song_position():
    """Return the current song position in bars (integer)."""
    try:
        return transport.getSongPos()
    except Exception:
        return 0

# ─── Bridge Class ─────────────────────────────────────────────────────────────

class CopilotBridge:
    def __init__(self):
        self.last_sync_time = 0
        self.sync_interval = 0.5  # seconds between state broadcasts

    def send_sysex(self, data: dict) -> bool:
        """Serialize data to JSON, Base64-encode, wrap in SysEx, and send."""
        try:
            json_str = json.dumps(data)
            b64_str = b64_encode(json_str)
            msg = bytearray([0xF0, 0x7D])      # 0x7D = non-commercial SysEx ID
            msg.extend(b64_str.encode('ascii'))
            msg.append(0xF7)                   # End of SysEx
            device.midiOutSysex(bytes(msg))
            return True
        except Exception as e:
            print(f"[AudioCopilot] SysEx send error: {e}")
            return False

    def handle_command(self, cmd: dict):
        """Execute a command received from the backend via SysEx."""
        cmd_type = cmd.get("type")
        payload  = cmd.get("payload", {})
        print(f"[AudioCopilot] CMD: {cmd_type} → {payload}")

        if cmd_type == "CMD_SET_BPM":
            bpm = float(payload.get("bpm", 120))
            try:
                # FL Studio uses mixer.setTempo for scripted tempo changes
                mixer.setTempo(bpm)
                ui.setHintMsg(f"Audio Copilot: BPM set to {bpm}")
            except Exception as e:
                print(f"[AudioCopilot] Set BPM error: {e}")

        elif cmd_type == "CMD_TRANSPORT":
            action = payload.get("action", "play")
            try:
                if action == "play":
                    transport.start()
                elif action == "stop":
                    transport.stop()
                elif action == "record":
                    transport.record()
                ui.setHintMsg(f"Audio Copilot: Transport → {action}")
            except Exception as e:
                print(f"[AudioCopilot] Transport error: {e}")

        elif cmd_type == "CMD_OPEN_FILE":
            path = payload.get("path", "")
            if path:
                try:
                    # Open file in the current channel / sampler
                    channels.setChannelName(channels.selectedChannel(), "AC Import")
                    ui.setHintMsg(f"Audio Copilot: Ready to receive → {path}")
                    # Note: FL's scripting API does not expose a direct file-open call.
                    # We set the hint so the user knows what file to drag in.
                    # A full implementation would use FL's drag-out file protocol.
                except Exception as e:
                    print(f"[AudioCopilot] Open file error: {e}")

        else:
            print(f"[AudioCopilot] Unknown command: {cmd_type}")

bridge = CopilotBridge()

# ─── FL Studio Event Hooks ────────────────────────────────────────────────────

def OnInit():
    print("━" * 50)
    print("  Audio Copilot Bridge v2.0")
    print(f"  Device: {device.getName()}")
    print("━" * 50)
    ui.setHintMsg("🎵 Audio Copilot Bridge v2.0 — Active")

def OnDeInit():
    print("[AudioCopilot] Bridge deinitialized.")

def OnIdle():
    """Called periodically by FL Studio — used for timed state sync."""
    global bridge
    now = time.time()
    if now - bridge.last_sync_time >= bridge.sync_interval:
        bridge.last_sync_time = now
        _sync_state()

def OnUpdateBeatIndicator(value):
    pass  # Called on every beat — leave empty to avoid spam

def OnMidiIn(event):
    """Handle raw MIDI input (primarily to catch SysEx commands from backend)."""
    event.handled = True  # Mark all events as handled to avoid FL processing them

def OnSysEx(event):
    """
    Called when FL Studio receives a SysEx message on the MIDI input port.
    The backend/relay sends commands back to FL Studio via SysEx.
    """
    data = event.sysex
    try:
        # Expected format: F0 7D <base64 JSON> F7
        if len(data) > 3 and data[0] == 0xF0 and data[1] == 0x7D:
            b64_payload = bytes(data[2:-1]).decode('ascii')
            json_str    = b64_decode(b64_payload)
            cmd         = json.loads(json_str)
            bridge.handle_command(cmd)
    except Exception as e:
        print(f"[AudioCopilot] SysEx receive error: {e}")
    event.handled = True

# ─── State Sync ───────────────────────────────────────────────────────────────

def _sync_state():
    """Gather full FL Studio state and send it to the backend."""
    bpm              = get_robust_bpm()
    time_sig         = get_time_signature()
    tracks           = get_tracks()
    project_name     = get_robust_project_name()
    is_playing       = transport.isPlaying()
    selected_channel = get_selected_channel()
    song_position    = get_song_position()

    bridge.send_sysex({
        "type": "STATE_UPDATE",
        "payload": {
            "bpm":              bpm,
            "time_signature":   time_sig,
            "tracks":           tracks,
            "project_name":     project_name,
            "is_playing":       is_playing,
            "selected_channel": selected_channel,
            "song_position":    song_position,
            "status":           "connected"
        }
    })
