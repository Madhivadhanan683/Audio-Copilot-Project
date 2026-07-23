# Audio Copilot Bridge for Reaper
# =============================================================================
# Save this file to your Scripts directory (e.g., C:\Users\You\AppData\Roaming\REAPER\Scripts)
# Load it in Reaper: Actions > Show Action List > New Action > Load ReaScript...
# =============================================================================

import socket
import json
import threading
import time
import sys

# Configuration
HOST = '127.0.0.1'
PORT = 8000
PATH = '/ws/daw'  # We can't do WS easily with raw socket, so we'll use a hack or just TCP if we change backend.
# Actually, the backend uses WebSocket. 
# Implementing a full WS handshake in a raw socket without libraries is painful.
# BUT, we can just use `urllib` to post to a REST endpoint if available?
# No, our backend updates state via WebSocket.

# Alternative: We can use a simple helper script that runs OUTSIDE Reaper 
# and acts as a relay, or we can try to do a simple WS handshake.

# Let's try a very simple WS handshake for this script to keep it zero-dependency.

def create_ws_frame(data):
    # Create a simple text frame (fin, text)
    frame = bytearray()
    frame.append(0x81) # FIN + Text Opcode
    
    length = len(data)
    if length < 126:
        frame.append(length | 0x80) # Masked
    elif length < 65536:
        frame.append(126 | 0x80)
        frame.extend(length.to_bytes(2, 'big'))
    else:
        frame.append(127 | 0x80)
        frame.extend(length.to_bytes(8, 'big'))
        
    mask = [0x11, 0x22, 0x33, 0x44]
    frame.extend(mask)
    
    masked_data = bytearray()
    for i, b in enumerate(data.encode('utf-8')):
        masked_data.append(b ^ mask[i % 4])
        
    frame.extend(masked_data)
    return frame

class CopilotClient:
    def __init__(self):
        self.sock = None
        self.connected = False
        self.last_state = {}

    def connect(self):
        try:
            self.sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self.sock.settimeout(0.1)
            self.sock.connect((HOST, PORT))
            
            # WebSocket Handshake
            key = "dGhlIHNhbXBsZSBub25jZQ=="
            request = (
                f"GET {PATH} HTTP/1.1\r\n"
                f"Host: {HOST}:{PORT}\r\n"
                "Upgrade: websocket\r\n"
                "Connection: Upgrade\r\n"
                f"Sec-WebSocket-Key: {key}\r\n"
                "Sec-WebSocket-Version: 13\r\n"
                "\r\n"
            )
            self.sock.send(request.encode())
            
            response = self.sock.recv(4096)
            if b"101 Switching Protocols" in response:
                self.connected = True
                RPR_ShowConsoleMsg("Audio Copilot: Connected!\n")
            else:
                RPR_ShowConsoleMsg("Audio Copilot: Handshake failed.\n")
                self.close()

        except Exception as e:
            # Silent fail to avoid spamming console
            self.connected = False

    def send_json(self, data):
        if not self.connected:
            self.connect()
            if not self.connected: return

        try:
            msg = json.dumps(data)
            frame = create_ws_frame(msg)
            self.sock.send(frame)
        except Exception as e:
            self.connected = False
            self.sock.close()

    def close(self):
        if self.sock:
            self.sock.close()
        self.connected = False

client = CopilotClient()

def main_loop():
    # 1. Get Play State (0=stop, 1=play, 2=pause, 5=rec, 6=recpause)
    play_state = RPR_GetPlayState()
    status = "stopped"
    if play_state & 1: status = "playing"
    if play_state & 4: status = "recording"

    # 2. Get BPM
    bpm = RPR_Master_GetTempo()

    # 3. Get Time Selection / Position
    cursor_pos = RPR_GetCursorPosition()
    
    # 4. Get Track Names
    count_tracks = RPR_CountTracks(0)
    tracks = []
    for i in range(count_tracks):
        track = RPR_GetTrack(0, i)
        retval, name, _, _ = RPR_GetSetMediaTrackInfo_String(track, "P_NAME", "", False)
        if retval:
            tracks.append(name if name else f"Track {i+1}")

    # Construct Payload
    # Only send if changed? Ideally yes, but for now periodic is fine (every 1s)
    # Actually, let's just send BPM and Track updates
    
    payload_bpm = {
        "type": "UPDATE_BPM",
        "payload": {"bpm": bpm}
    }
    
    payload_tracks = {
        "type": "UPDATE_TRACKS",
        "payload": {"tracks": tracks}
    }
    
    # We can perform a rudimentary check if state changed to save bandwidth,
    # but localhost socket is fast.
    
    client.send_json(payload_bpm)
    client.send_json(payload_tracks)
    
    # Rerun this function in 1000ms (1 second)
    # Ideally faster, but let's start with 1s to be safe
    RPR_defer("main_loop()") # RPR_defer usually runs as fast as possible. 
    # To run periodically, we have to check time manually.
    
    # BUT! RPR_defer just schedules the script to run essentially on the next UI refresh.
    # To throttle:
    # We need to restructure.
    
# Throttled Loop Wrapper
last_time = 0

def run_loop():
    global last_time
    curr_time = time.time()
    
    if curr_time - last_time > 0.5: # Run every 500ms
        main_loop()
        last_time = curr_time
    
    RPR_defer("run_loop()")

# Start
RPR_ShowConsoleMsg("Audio Copilot Bridge Started...\n")
run_loop()
