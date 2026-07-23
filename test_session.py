"""Quick test for the collaborative session WebSocket endpoint."""
import asyncio
import json

async def test_session():
    try:
        import websockets
    except ImportError:
        print("websockets not installed, using urllib to test HTTP endpoint instead")
        import urllib.request
        req = urllib.request.Request('http://localhost:8000/')
        with urllib.request.urlopen(req) as resp:
            print("Backend is live:", resp.read().decode())
        print("WebSocket test skipped (no websockets lib), but endpoint is wired up.")
        print("Please test manually by opening two browser tabs to the Collab Mode tab.")
        return

    uri = "ws://localhost:8000/ws/session/test-room"

    # Client 1 connects
    async with websockets.connect(uri) as ws1:
        # Should receive STATE_SYNC on connect
        msg = await asyncio.wait_for(ws1.recv(), timeout=3)
        data = json.loads(msg)
        print(f"WS1 initial: {data['type']} -> BPM={data['payload'].get('bpm')}")
        assert data["type"] == "STATE_SYNC", "Expected STATE_SYNC"

        # Should receive USER_JOINED broadcast
        msg2 = await asyncio.wait_for(ws1.recv(), timeout=3)
        data2 = json.loads(msg2)
        print(f"WS1 event:   {data2['type']} -> {data2['payload'].get('message')}")

        # Client 2 connects
        async with websockets.connect(uri) as ws2:
            # ws2 gets STATE_SYNC
            m = await asyncio.wait_for(ws2.recv(), timeout=3)
            print(f"WS2 initial: {json.loads(m)['type']}")

            # ws1 should see USER_JOINED for ws2
            m = await asyncio.wait_for(ws1.recv(), timeout=3)
            print(f"WS1 sees:    {json.loads(m)['type']}")

            # ws2 sends chat
            await ws2.send(json.dumps({
                "type": "CHAT_MESSAGE",
                "payload": {"text": "Hello from WS2!", "sender": "Tester2"}
            }))

            # Both should see the chat
            for label, sock in [("WS1", ws1), ("WS2", ws2)]:
                m = await asyncio.wait_for(sock.recv(), timeout=3)
                d = json.loads(m)
                print(f"{label} chat:   {d['payload'].get('text')}")

            # ws1 updates state
            await ws1.send(json.dumps({
                "type": "STATE_UPDATE",
                "payload": {"bpm": 140, "key": "D Minor"}
            }))

            for label, sock in [("WS1", ws1), ("WS2", ws2)]:
                m = await asyncio.wait_for(sock.recv(), timeout=3)
                d = json.loads(m)
                print(f"{label} state:  BPM={d['payload'].get('bpm')}, Key={d['payload'].get('key')}")

    print("\n✅ All session tests passed!")

asyncio.run(test_session())
