import asyncio
import json
from typing import Dict, List
from fastapi import WebSocket

class SessionManager:
    def __init__(self):
        # Maps session_id -> list of WebSockets
        self.active_connections: Dict[str, List[WebSocket]] = {}
        # Maps session_id -> current state (bpm, key, etc.)
        self.session_states: Dict[str, dict] = {}

    async def connect(self, websocket: WebSocket, session_id: str):
        await websocket.accept()
        if session_id not in self.active_connections:
            self.active_connections[session_id] = []
            self.session_states[session_id] = {
                "bpm": 120,
                "key": "C Major",
                "scale": "Major",
                "status": "active"
            }
        self.active_connections[session_id].append(websocket)
        
        # Send current state to newly connected client
        await self.send_personal_message(
            {"type": "STATE_SYNC", "payload": self.session_states[session_id]},
            websocket
        )
        
        # Notify others
        await self.broadcast(
            {"type": "USER_JOINED", "payload": {"message": "A user joined the session."}},
            session_id
        )

    def disconnect(self, websocket: WebSocket, session_id: str):
        if session_id in self.active_connections:
            if websocket in self.active_connections[session_id]:
                self.active_connections[session_id].remove(websocket)
                
            if len(self.active_connections[session_id]) == 0:
                # Optionally clean up empty rooms, but maybe we want to keep state for a bit
                # del self.active_connections[session_id]
                # del self.session_states[session_id]
                pass
            else:
                 # It's an async call so we'd have to create a task to broadcast disconnect cleanly
                 # Alternatively, handled by the background event loop in production.
                 pass

    async def send_personal_message(self, message: dict, websocket: WebSocket):
        try:
             await websocket.send_text(json.dumps(message))
        except Exception as e:
             print(f"Error sending personal message: {e}")

    async def broadcast(self, message: dict, session_id: str):
        if session_id in self.active_connections:
            dead_sockets = []
            for connection in self.active_connections[session_id]:
                try:
                    await connection.send_text(json.dumps(message))
                except Exception as e:
                    print(f"Error broadcasting: {e}")
                    dead_sockets.append(connection)
            
            # Cleanup dead sockets
            for dead in dead_sockets:
                self.disconnect(dead, session_id)

    async def handle_message(self, data_str: str, websocket: WebSocket, session_id: str):
        try:
            data = json.loads(data_str)
            msg_type = data.get("type")
            payload = data.get("payload", {})

            if msg_type == "STATE_UPDATE":
                # Update shared state
                if session_id in self.session_states:
                    self.session_states[session_id].update(payload)
                
                # Broadcast the new state to EVERYONE (including sender, or rely on optimistic UI)
                await self.broadcast(
                    {"type": "STATE_SYNC", "payload": self.session_states[session_id]},
                    session_id
                )

            elif msg_type == "CHAT_MESSAGE":
                # Broadcast chat message to EVERYONE
                await self.broadcast(
                    {"type": "CHAT_MESSAGE", "payload": payload},
                    session_id
                )
                
            else:
                print(f"Unknown message type: {msg_type}")

        except json.JSONDecodeError:
            print("Invalid JSON received in session manager.")
        except Exception as e:
            print(f"Error handling session message: {e}")
