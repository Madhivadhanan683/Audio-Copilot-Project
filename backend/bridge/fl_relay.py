import mido
import websockets
import json
import asyncio
import sys
import base64

# MIDI Port Name (must match loopMIDI)
PORT_NAME = 'Audio Copilot Bridge'
WS_URI = 'ws://localhost:8000/ws/daw'

async def midi_to_ws_relay():
    print(f"--- Audio Copilot FL Studio Relay ---")
    while True:
        try:
            print(f"Connecting to Backend: {WS_URI}")
            async with websockets.connect(WS_URI, ping_interval=None) as websocket:
                print(f"Successfully connected to Backend!")
                
                # Consumer task to swallow incoming packets so the buffer doesn't fill up
                async def consume():
                    try:
                        async for _ in websocket:
                            pass
                    except:
                        pass
                
                consumer_task = asyncio.create_task(consume())
                
                # Find the MIDI port
                input_ports = mido.get_input_names()
                target_port = None
                for p in input_ports:
                    if PORT_NAME in p:
                        target_port = p
                        break
                
                if not target_port:
                    print(f"Error: MIDI port '{PORT_NAME}' not found. Retrying in 5 seconds...")
                    consumer_task.cancel()
                    await asyncio.sleep(5)
                    continue

                print(f"Listening on MIDI port: {target_port}")
                
                try:
                    with mido.open_input(target_port) as inport:
                        while True:
                            msg = inport.poll()
                            if msg:
                                if msg.type == 'sysex':
                                    update_data = None
                                    try:
                                        data_bytes = msg.data
                                        if data_bytes[0] == 0x7D:
                                            b64_payload = bytes(data_bytes[1:]).decode('ascii')
                                            json_str = base64.b64decode(b64_payload).decode('utf-8')
                                            update_data = json.loads(json_str)
                                            print(f"Relaying from FL: {update_data.get('type', 'Unknown')}")
                                    except Exception as e:
                                        print(f"Error decoding SysEx: {e}")
                                    
                                    if update_data:
                                        # Send outside the decode try-catch so network errors trigger reconnects
                                        await websocket.send(json.dumps(update_data))
                                        
                            await asyncio.sleep(0.01) # Low latency
                finally:
                    consumer_task.cancel()

        except (websockets.exceptions.WebSocketException, OSError, Exception) as e:
            print(f"Connection lost or error ({e}). Retrying in 3 seconds...")
            await asyncio.sleep(3)

if __name__ == "__main__":
    try:
        asyncio.run(midi_to_ws_relay())
    except KeyboardInterrupt:
        print("\nRelay stopped.")
