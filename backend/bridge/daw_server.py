from fastapi import WebSocket, WebSocketDisconnect
from typing import List
import json
import asyncio

class DAWBridge:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.daw_state = {
            "bpm": 120,
            "key": "C Major",
            "status": "disconnected",
            "tracks": []
        }

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        self.daw_state["status"] = "connected"
        print(f"DAW Client connected. Total connections: {len(self.active_connections)}")
        
        # Determine client type (DAW vs Frontend) if possible, 
        # or just broadcast "DAW Connected" event to everyone
        await self.broadcast(json.dumps({
            "type": "STATUS_UPDATE",
            "payload": {"connected": True}
        }))

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            print("DAW Client disconnected")
            
        if len(self.active_connections) == 0:
            self.daw_state["status"] = "disconnected"

    async def broadcast(self, message: str):
        # In a refined version, we'd distinguish between frontend clients and DAW clients
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except RuntimeError:
                # Connection might be closed
                pass

    async def handle_message(self, message: str):
        try:
            data = json.loads(message)
            msg_type = data.get("type")
            payload = data.get("payload", {})
            
            print(f"Received from DAW: {msg_type}")

            if msg_type == "HEARTBEAT":
                await self.broadcast(json.dumps({"type": "HEARTBEAT_ACK"}))
            
            elif msg_type == "UPDATE_BPM":
                self.daw_state["bpm"] = payload.get("bpm", 120)
                # Broadcast update to frontend
                await self.broadcast(json.dumps({
                    "type": "STATE_UPDATE",
                    "payload": self.daw_state
                }))
            
            elif msg_type == "UPDATE_KEY":
                self.daw_state["key"] = payload.get("key", "C Major")
                await self.broadcast(json.dumps({
                    "type": "STATE_UPDATE",
                    "payload": self.daw_state
                }))
            
            elif msg_type == "UPDATE_TRACKS":
                self.daw_state["tracks"] = payload.get("tracks", [])
                await self.broadcast(json.dumps({
                    "type": "STATE_UPDATE",
                    "payload": self.daw_state
                }))

        except json.JSONDecodeError:
            print(f"Received non-JSON message: {message}")
