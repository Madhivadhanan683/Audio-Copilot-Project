import asyncio
import websockets
import json
import time

async def test_daw_connection():
    uri = "ws://localhost:8000/ws/daw"
    
    print(f"Connecting to {uri}...")
    try:
        async with websockets.connect(uri) as websocket:
            print(" Connected!")

            # 1. Send Heartbeat
            print("Sending HEARTBEAT...")
            await websocket.send(json.dumps({"type": "HEARTBEAT"}))
            response = await websocket.recv()
            print(f"Received: {response}")

            # 2. Simulate initializing a project
            print("Simulating Project Load...")
            time.sleep(1)
            await websocket.send(json.dumps({
                "type": "UPDATE_BPM",
                "payload": {"bpm": 128}
            }))
            await websocket.send(json.dumps({
                "type": "UPDATE_KEY",
                "payload": {"key": "D Minor"}
            }))
            await websocket.send(json.dumps({
                "type": "UPDATE_TRACKS",
                "payload": {"tracks": ["Kick", "Snare", "Bass", "Lead Synth", "Pad"]}
            }))
            
            print("Sending updates... check Frontend!")
            
            # 3. Simulate dynamic BPM change
            for bpm in range(128, 135):
                print(f"BPM -> {bpm}")
                await websocket.send(json.dumps({
                    "type": "UPDATE_BPM",
                    "payload": {"bpm": bpm}
                }))
                time.sleep(0.5)

            # 4. Change Key
            print("Changing Key to A Minor...")
            await websocket.send(json.dumps({
                "type": "UPDATE_KEY",
                "payload": {"key": "A Minor"}
            }))
            time.sleep(1)

            print("Test Completed Successfully!")
            
    except Exception as e:
        print(f"Connection Failed: {e}")

if __name__ == "__main__":
    # Install websockets if needed: pip install websockets
    asyncio.run(test_daw_connection())
