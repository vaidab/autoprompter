"""Separate browser-test service so tests never attach to the user's session."""

import uvicorn
from server.app import create_app
from server.worker import SpeechWorker


def main():
    server = None

    def shutdown():
        if server:
            server.should_exit = True

    app = create_app(SpeechWorker(), shutdown, grace=120)

    async def test_origin(scope, receive, send):
        # The production origin policy is tested separately. Translate only the
        # dedicated test origin; all other headers keep their original values.
        if scope["type"] == "websocket":
            scope = dict(scope)
            aliases = {
                (b"host", b"127.0.0.1:8766"): b"127.0.0.1:8765",
                (b"origin", b"http://127.0.0.1:8766"): b"http://127.0.0.1:8765",
            }
            scope["headers"] = [
                (key, aliases.get((key, value), value))
                for key, value in scope["headers"]
            ]
        await app(scope, receive, send)

    server = uvicorn.Server(
        uvicorn.Config(
            test_origin, host="127.0.0.1", port=8766,
            log_level="warning", ws_max_size=640000,
        )
    )
    server.run()


if __name__ == "__main__":
    main()
