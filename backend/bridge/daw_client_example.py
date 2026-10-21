import asyncio
import websockets
import json
import time

async def connect_to_copilot():
    uri = "ws://localhost:8000/ws/daw"
    print(f"Connecting to Audio Copilot at {uri}...")

    try:
        async with websockets.connect(uri) as websocket:
            print("Connected to Audio Copilot!")

            # 1. Send Initial State
            print("Sending Project State...")
            await websocket.send(json.dumps({
                "type": "UPDATE_BPM",
                "payload": {"bpm": 120}
            }))
            await websocket.send(json.dumps({
                "type": "UPDATE_KEY",
                "payload": {"key": "C Major"}
            }))
            await websocket.send(json.dumps({
                "type": "UPDATE_TRACKS",
                "payload": {"tracks": ["Kick", "Snare", "Bass", "Lead Synth", "Vocal"]}
            }))

            print("State sent! Check the left panel in the app.")

            # 3. Create a loop to keep connection alive
            print("Listening for messages (Ctrl+C to stop)...")
            while True:
                try:
                    msg = await websocket.recv()
                    print(f"Received from Copilot: {msg}")
                except websockets.exceptions.ConnectionClosed:
                    print("Connection closed by server.")
                    break

    except Exception as e:
        print(f"Connection failed: {e}")
        print("Make sure the Audio Copilot backend is running on localhost:8000!")

if __name__ == "__main__":
    # Requires: pip install websockets
    try:
        asyncio.run(connect_to_copilot())
    except KeyboardInterrupt:
        print("\nDisconnected.")
