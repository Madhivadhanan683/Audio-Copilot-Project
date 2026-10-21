from fastapi import WebSocket, WebSocketDisconnect
from typing import List, Dict, Optional
import json
import asyncio
import time

class ClientType:
    FRONTEND = "frontend"
    DAW_RELAY = "daw_relay"
    UNKNOWN = "unknown"

class DAWBridge:
    def __init__(self):
        # Maps websocket -> client_type
        self.connections: Dict[WebSocket, str] = {}
        
        # Pending commands queued to send to the DAW relay
        self.pending_daw_commands: List[dict] = []
        
        self.daw_state = {
            "bpm": 120.0,
            "key": "C Major",
            "time_signature": "4/4",
            "is_playing": False,
            "status": "disconnected",
            "tracks": [],
            "project_name": "Untitled",
            "selected_channel": None,
            "song_position": 0,
            "last_updated": None,
        }

    @property
    def active_connections(self) -> List[WebSocket]:
        return list(self.connections.keys())

    @property
    def daw_relay_connections(self) -> List[WebSocket]:
        return [ws for ws, ct in self.connections.items() if ct == ClientType.DAW_RELAY]

    @property
    def frontend_connections(self) -> List[WebSocket]:
        return [ws for ws, ct in self.connections.items() if ct == ClientType.FRONTEND]

    async def connect(self, websocket: WebSocket, client_type: str = ClientType.UNKNOWN):
        await websocket.accept()
        self.connections[websocket] = client_type
        print(f"[DAWBridge] Client connected ({client_type}). Total: {len(self.connections)}")

        if client_type == ClientType.DAW_RELAY:
            self.daw_state["status"] = "connected"
            # Notify all frontends that DAW is live
            await self.broadcast_to_frontends(json.dumps({
                "type": "STATUS_UPDATE",
                "payload": {"connected": True, "status": "connected"}
            }))
        else:
            # Send current DAW state to the newly connected frontend
            await self._safe_send(websocket, json.dumps({
                "type": "STATE_UPDATE",
                "payload": self.daw_state
            }))

    def disconnect(self, websocket: WebSocket):
        client_type = self.connections.pop(websocket, ClientType.UNKNOWN)
        print(f"[DAWBridge] Client disconnected ({client_type}). Total: {len(self.connections)}")

        # If the relay disconnected and no relay remains, mark DAW as offline
        if client_type == ClientType.DAW_RELAY and not self.daw_relay_connections:
            self.daw_state["status"] = "disconnected"
            asyncio.ensure_future(self.broadcast_to_frontends(json.dumps({
                "type": "STATUS_UPDATE",
                "payload": {"connected": False, "status": "disconnected"}
            })))

    async def _safe_send(self, websocket: WebSocket, message: str):
        try:
            await websocket.send_text(message)
        except Exception as e:
            print(f"[DAWBridge] Send error: {e}")

    async def broadcast(self, message: str, exclude: WebSocket = None):
        for ws in list(self.connections.keys()):
            if exclude and ws == exclude:
                continue
            await self._safe_send(ws, message)

    async def broadcast_to_frontends(self, message: str, exclude: WebSocket = None):
        for ws in self.frontend_connections:
            if exclude and ws == exclude:
                continue
            await self._safe_send(ws, message)

    async def send_command_to_daw(self, command: dict) -> bool:
        """
        Send a command from the frontend/backend to the FL Studio relay.
        Commands get forwarded to FL Studio via SysEx MIDI.
        Returns True if a relay is connected, False otherwise.
        """
        relay_conns = self.daw_relay_connections
        if not relay_conns:
            self.pending_daw_commands.append(command)
            print(f"[DAWBridge] No relay connected. Queued command: {command.get('type')}")
            return False

        msg = json.dumps(command)
        for relay_ws in relay_conns:
            await self._safe_send(relay_ws, msg)
        return True

    async def handle_message(self, message: str, sender: WebSocket = None):
        try:
            data = json.loads(message)
        except json.JSONDecodeError:
            print(f"[DAWBridge] Non-JSON message received: {message[:80]}")
            return

        msg_type = data.get("type")
        payload = data.get("payload", {})
        sender_type = self.connections.get(sender, ClientType.UNKNOWN)

        print(f"[DAWBridge] [{sender_type}] → {msg_type}")

        # ── Messages FROM the FL Studio relay (state updates) ──────────────────
        if msg_type in ("STATE_UPDATE", "UPDATE_BPM", "UPDATE_KEY", "UPDATE_TRACKS",
                        "UPDATE_PROJECT", "UPDATE_TIME_SIGNATURE"):
            
            if msg_type == "UPDATE_BPM":
                payload = {"bpm": payload.get("bpm", 120)}
            elif msg_type == "UPDATE_KEY":
                payload = {"key": payload.get("key", "C Major")}
            elif msg_type == "UPDATE_TRACKS":
                payload = {"tracks": payload.get("tracks", [])}
            elif msg_type == "UPDATE_PROJECT":
                payload = {"project_name": payload.get("name", "Untitled")}
            elif msg_type == "UPDATE_TIME_SIGNATURE":
                payload = {"time_signature": payload.get("time_signature", "4/4")}

            self.daw_state.update(payload)
            self.daw_state["last_updated"] = time.time()

            # Forward the live state to all frontends
            await self.broadcast_to_frontends(json.dumps({
                "type": "STATE_UPDATE",
                "payload": self.daw_state
            }), exclude=sender)

        elif msg_type == "HEARTBEAT":
            await self._safe_send(sender, json.dumps({"type": "HEARTBEAT_ACK"}))

        # ── Messages FROM the frontend (commands to DAW) ─────────────────────
        elif msg_type == "CMD_SET_BPM":
            await self.send_command_to_daw({
                "type": "CMD_SET_BPM",
                "payload": {"bpm": payload.get("bpm", 120)}
            })

        elif msg_type == "CMD_TRANSPORT":
            # play / stop / record
            await self.send_command_to_daw({
                "type": "CMD_TRANSPORT",
                "payload": {"action": payload.get("action", "play")}
            })

        elif msg_type == "CMD_OPEN_FILE":
            await self.send_command_to_daw({
                "type": "CMD_OPEN_FILE",
                "payload": {"path": payload.get("path", ""), "target": payload.get("target", "mixer")}
            })

        else:
            print(f"[DAWBridge] Unknown message type: {msg_type}")
