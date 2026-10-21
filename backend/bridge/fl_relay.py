"""
Audio Copilot FL Studio Relay v2.0 — Bidirectional Bridge
──────────────────────────────────────────────────────────
This script sits between FL Studio (MIDI SysEx) and the Audio Copilot
backend (WebSocket). It:

  FL Studio ──SysEx─→ loopMIDI ──→ This Relay ──WebSocket─→ Backend
  Backend   ──WebSocket──→ This Relay ──SysEx──→ loopMIDI ──→ FL Studio

Requirements:
  pip install mido python-rtmidi websockets

Usage:
  python fl_relay.py

Setup:
  1. Install loopMIDI: https://www.tobias-erichsen.de/software/loopmidi.html
  2. Create a virtual MIDI port named "Audio Copilot Bridge"
  3. In FL Studio MIDI Settings, set the port as both Input & Output for
     the "Audio Copilot Bridge v2.0" device script
  4. Run this relay script
  5. Open the Audio Copilot web app
"""

import mido
import websockets
import json
import asyncio
import sys
import base64
import time

# ─── Configuration ────────────────────────────────────────────────────────────
PORT_NAME  = 'Audio Copilot Bridge'
WS_URI     = 'ws://localhost:8000/ws/daw'
RECONNECT_DELAY = 3  # seconds between reconnect attempts

# ─── Codec ───────────────────────────────────────────────────────────────────

def b64_encode(s: str) -> str:
    return base64.b64encode(s.encode('utf-8')).decode('ascii')

def b64_decode(b: bytes) -> str:
    return base64.b64decode(b).decode('utf-8')

def decode_sysex(sysex_data) -> dict | None:
    """Parse an incoming SysEx byte sequence from FL Studio into a dict."""
    try:
        data_bytes = bytes(sysex_data)
        # Expected: 0x7D <base64 JSON bytes>
        if len(data_bytes) < 2 or data_bytes[0] != 0x7D:
            return None
        b64_payload = data_bytes[1:].decode('ascii')
        json_str    = b64_decode(b64_payload)
        return json.loads(json_str)
    except Exception as e:
        print(f"[Relay] SysEx decode error: {e}")
        return None

def encode_sysex(data: dict) -> bytes:
    """Encode a dict into SysEx bytes to send back to FL Studio."""
    json_str = json.dumps(data)
    b64_str  = b64_encode(json_str)
    msg      = bytearray([0xF0, 0x7D])
    msg.extend(b64_str.encode('ascii'))
    msg.append(0xF7)
    return bytes(msg)

# ─── Port Discovery ───────────────────────────────────────────────────────────

def find_port(port_list, name_fragment):
    """Find the first port whose name contains name_fragment."""
    for p in port_list:
        if name_fragment in p:
            return p
    return None

# ─── Main Relay Loop ─────────────────────────────────────────────────────────

async def relay_loop():
    print("━" * 56)
    print("  Audio Copilot FL Studio Relay v2.0")
    print(f"  MIDI Port : {PORT_NAME}")
    print(f"  Backend WS: {WS_URI}")
    print("━" * 56)

    while True:
        # ── 1. Locate MIDI ports ──────────────────────────────────────────
        input_ports  = mido.get_input_names()
        output_ports = mido.get_output_names()
        in_port_name  = find_port(input_ports,  PORT_NAME)
        out_port_name = find_port(output_ports, PORT_NAME)

        if not in_port_name:
            print(f"[Relay] MIDI input  '{PORT_NAME}' not found. Ports: {input_ports}")
            print("[Relay] Retrying in 5 seconds...")
            await asyncio.sleep(5)
            continue

        if not out_port_name:
            print(f"[Relay] MIDI output '{PORT_NAME}' not found. Ports: {output_ports}")
            print("[Relay] Commands to FL Studio disabled — continuing read-only.")

        print(f"[Relay] MIDI IN  : {in_port_name}")
        print(f"[Relay] MIDI OUT : {out_port_name or 'N/A (output not found)'}")

        # ── 2. Connect to backend WebSocket ───────────────────────────────
        try:
            print(f"[Relay] Connecting to backend: {WS_URI}")
            async with websockets.connect(
                WS_URI,
                ping_interval=20,
                ping_timeout=10,
                extra_headers={"X-Client-Type": "daw_relay"},
            ) as websocket:
                print("[Relay] ✅ Connected to backend!")

                # ── 3. Open MIDI ports ────────────────────────────────────
                out_port = None
                try:
                    if out_port_name:
                        out_port = mido.open_output(out_port_name)
                        print(f"[Relay] MIDI output opened: {out_port_name}")
                except Exception as e:
                    print(f"[Relay] Could not open MIDI output: {e}")

                with mido.open_input(in_port_name) as in_port:
                    print(f"[Relay] Listening on MIDI input: {in_port_name}")
                    print("[Relay] Bridge is LIVE. Press Ctrl+C to stop.\n")

                    # ── 4. Concurrent tasks ───────────────────────────────
                    async def midi_to_ws_task():
                        """Read SysEx from FL Studio → forward to backend WS."""
                        loop = asyncio.get_event_loop()
                        while True:
                            msg = in_port.poll()
                            if msg:
                                if msg.type == 'sysex':
                                    data = decode_sysex(msg.data)
                                    if data:
                                        await websocket.send(json.dumps(data))
                                        msg_type = data.get('type', '?')
                                        print(f"[Relay] FL→Backend : {msg_type}")
                            await asyncio.sleep(0.008)  # ~125 Hz polling

                    async def ws_to_midi_task():
                        """Read commands from backend WS → forward to FL Studio."""
                        async for raw in websocket:
                            try:
                                cmd = json.loads(raw)
                                msg_type = cmd.get('type', '?')
                                print(f"[Relay] Backend→FL : {msg_type}")
                                if out_port and msg_type.startswith("CMD_"):
                                    sysex_bytes = encode_sysex(cmd)
                                    out_port.send(mido.Message.from_bytes(sysex_bytes))
                            except Exception as e:
                                print(f"[Relay] WS→MIDI error: {e}")

                    try:
                        await asyncio.gather(
                            midi_to_ws_task(),
                            ws_to_midi_task(),
                        )
                    except Exception as e:
                        print(f"[Relay] Task error: {e}")
                    finally:
                        if out_port:
                            out_port.close()

        except (websockets.exceptions.WebSocketException, OSError, ConnectionRefusedError) as e:
            print(f"[Relay] Connection failed: {e}")
        except Exception as e:
            print(f"[Relay] Unexpected error: {e}")

        print(f"[Relay] Reconnecting in {RECONNECT_DELAY}s...")
        await asyncio.sleep(RECONNECT_DELAY)


if __name__ == "__main__":
    try:
        asyncio.run(relay_loop())
    except KeyboardInterrupt:
        print("\n[Relay] Stopped by user.")
