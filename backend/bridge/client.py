import asyncio
import websockets
import json
import time

async def daw_client():
    uri = "ws://localhost:8000/ws/daw"
    print(f"Connecting to {uri}...")
    try:
        async with websockets.connect(uri) as websocket:
            print("Connected to Audio Copilot!")
            
            # Simulate sending initial state
            initial_state = {
                "type": "STATE_UPDATE",
                "data": {
                    "bpm": 128,
                    "tracks": ["Kick", "Bass", "Lead"]
                }
            }
            await websocket.send(json.dumps(initial_state))
            print("Sent initial state.")

            while True:
                try:
                    message = await websocket.recv()
                    print(f"Received command: {message}")
                    
                    # Simulate handling a command
                    if "GENERATE" in message:
                        print("Simulating audio generation in DAW...")
                        time.sleep(1)
                        await websocket.send(json.dumps({"type": "job_complete", "status": "success"}))
                        
                except websockets.exceptions.ConnectionClosed:
                    print("Connection closed.")
                    break
    except Exception as e:
        print(f"Connection failed: {e}")

if __name__ == "__main__":
    asyncio.run(daw_client())
