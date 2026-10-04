import asyncio
import contextlib
import json
import time
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request
from fastapi.responses import FileResponse, JSONResponse
from .session import Session
from .launcher import should_shutdown
from .protocol import allowed_origin, validate_audio

ROOT = Path(__file__).resolve().parents[1]


def create_app(worker=None, shutdown=lambda: None, grace=15):
    session = Session()
    sockets = {}
    last_empty = time.monotonic()
    had_clients = False

    async def broadcast(message):
        for ws in list(sockets.values()):
            try:
                await ws.send_json(message)
            except Exception:
                pass

    async def publish():
        await broadcast({"type": "state", "state": session.snapshot()})

    async def events():
        nonlocal last_empty
        while True:
            if worker:
                for event in worker.poll():
                    if event["type"] == "model":
                        session.model = event["status"]
                        session.detail = event.get("detail", "")
                        if session.model == "error":
                            session.pause()
                        await publish()
                    elif (
                        event["type"] == "transcript"
                        and session.status == "listening"
                        and event["generation"] == session.generation
                    ):
                        await broadcast(event)
            if should_shutdown(
                clients=len(sockets),
                had_clients=had_clients,
                empty_for=time.monotonic() - last_empty,
                grace=grace,
            ):
                shutdown()
                return
            await asyncio.sleep(0.05)

    @asynccontextmanager
    async def lifespan(app):
        if worker:
            worker.load()
        task = asyncio.create_task(events())
        yield
        task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await task
        if worker:
            worker.stop()

    app = FastAPI(lifespan=lifespan)
    app.state.session = session

    @app.get("/api/health")
    async def health():
        return {"app": "autoprompter", "version": "0.1.0", "model": session.model}

    @app.websocket("/ws")
    async def websocket(ws: WebSocket):
        nonlocal last_empty, had_clients
        if not allowed_origin(ws.headers.get("origin"), ws.headers.get("host", "")):
            await ws.close(code=1008)
            return
        await ws.accept()
        id = str(uuid.uuid4())
        header = None
        try:
            hello = await asyncio.wait_for(ws.receive_json(), 5)
            if hello.get("role") not in ("setup", "prompter"):
                await ws.close(code=1008)
                return
            session.join(id, hello["role"])
            sockets[id] = ws
            had_clients = True
            await ws.send_json({"type": "welcome", "id": id})
            await publish()
            while True:
                raw = await ws.receive()
                if raw["type"] == "websocket.disconnect":
                    break
                if raw.get("bytes") is not None:
                    if header is None:
                        raise ValueError("PCM header missing")
                    h, header = header, None
                    if id != session.owner or session.status != "listening":
                        continue
                    # Navigation can race a buffered PCM frame. Ignore stale generations.
                    if h.get("generation") != session.generation:
                        continue
                    frame = validate_audio(h, raw["bytes"], session.generation)
                    if frame["sequence"] <= session.last_sequence:
                        continue
                    session.last_sequence = frame["sequence"]
                    if worker:
                        worker.submit(frame)
                    continue
                text = raw.get("text", "")
                if len(text) > 600000:
                    raise ValueError("Message too large")
                msg = json.loads(text)
                if not isinstance(msg, dict):
                    raise ValueError("Invalid message")
                if msg.get("type") == "audio":
                    if header is not None:
                        raise ValueError("PCM frame missing")
                    header = msg
                    continue
                if msg.get("type") == "quit" and id in (
                    session.owner,
                    session.prompter,
                ):
                    session.pause()
                    await broadcast({"type": "stopped"})
                    shutdown()
                    return
                if msg.get("type") == "retry" and id == session.owner:
                    if worker:
                        worker.load()
                    continue
                before = session.generation
                if session.command(id, msg):
                    if before != session.generation and worker:
                        worker.reset()
                    if msg["type"] == "viewport":
                        await broadcast(msg)
                    else:
                        await publish()
                        if msg["type"] == "reset":
                            await broadcast({"type": "reset"})
        except (WebSocketDisconnect, ValueError, asyncio.TimeoutError, RuntimeError):
            pass
        finally:
            before = session.generation
            sockets.pop(id, None)
            session.leave(id)
            if worker and before != session.generation:
                worker.reset()
            if not sockets:
                last_empty = time.monotonic()
            await publish()

    @app.get("/{path:path}")
    async def assets(path: str):
        dist = ROOT / "web" / "dist"
        target = (dist / path).resolve()
        if not target.is_relative_to(dist.resolve()):
            return JSONResponse({"error": "Not found"}, status_code=404)
        if target.is_file():
            return FileResponse(target)
        if path in ("", "prompter") and (dist / "index.html").exists():
            return FileResponse(dist / "index.html")
        return JSONResponse(
            {"error": "Build the browser app first: npm run build --prefix web"},
            status_code=404,
        )

    return app
