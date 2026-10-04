from .protocol import validate_viewport

DEFAULT_PRESET = dict(
    id="standard",
    name="Standard",
    width=900,
    height=600,
    fontSize=44,
    lineSpacing=1.5,
    speed=30,
)


def valid_preset(p):
    if not isinstance(p, dict):
        return False
    if not all(
        isinstance(p.get(k), str) and 0 < len(p[k]) <= 100 for k in ("id", "name")
    ):
        return False
    for k, lo, hi in [
        ("width", 240, 3840),
        ("height", 160, 2160),
        ("fontSize", 16, 120),
        ("lineSpacing", 1, 2.5),
        ("speed", 1, 300),
    ]:
        if type(p.get(k)) not in (int, float) or not lo <= p[k] <= hi:
            return False
    return True


class Session:
    def __init__(self):
        self.hasPreferences = False
        self.clients = {}
        self.status = "paused"
        self.owner = None
        self.prompter = None
        self.generation = 0
        self.model = "loading"
        self.detail = "Loading local speech model…"
        self.script = ""
        self.preset = DEFAULT_PRESET.copy()
        self.mode = "voice"
        self.viewport = None
        self.last_sequence = -1

    def snapshot(self):
        return {
            k: getattr(self, k)
            for k in (
                "status",
                "owner",
                "prompter",
                "generation",
                "model",
                "detail",
                "script",
                "preset",
                "mode",
                "hasPreferences",
            )
        }

    def invalidate(self):
        self.generation += 1
        self.viewport = None
        self.last_sequence = -1

    def pause(self):
        if self.status in ("listening", "scrolling"):
            self.status = "paused"
            self.invalidate()

    def join(self, id, role):
        self.clients[id] = role
        if role == "prompter":
            self.pause()
            self.prompter = id
            self.invalidate()
        elif self.owner is None:
            self.owner = id

    def leave(self, id):
        self.clients.pop(id, None)
        if self.owner == id:
            self.pause()
            self.owner = None
        if self.prompter == id:
            self.pause()
            self.prompter = None

    def command(self, id, msg):
        kind = msg.get("type")
        role = self.clients.get(id)
        if role is None:
            return False
        if kind == "claim" and role == "setup" and self.owner is None:
            self.owner = id
            return True
        authorized = id == self.owner or id == self.prompter
        if kind == "preferences":
            if id != self.owner:
                return False
            script = msg.get("script")
            preset = msg.get("preset")
            if (
                not isinstance(script, str)
                or len(script) > 500000
                or not valid_preset(preset)
            ):
                return False
            if script != self.script or preset != self.preset:
                self.pause()
                self.invalidate()
            self.script = script
            self.preset = preset
            self.hasPreferences = True
            return True
        if not authorized:
            return False
        if kind == "start":
            mode = msg.get("mode", self.mode)
            if self.prompter is None or mode not in ("voice", "fixed"):
                return False
            if mode == "voice" and (self.owner is None or self.model != "ready"):
                return False
            if self.status in ("listening", "scrolling"):
                return False
            self.mode = mode
            self.invalidate()
            self.status = "listening" if mode == "voice" else "scrolling"
            return True
        if kind == "pause":
            self.pause()
            return True
        if kind in ("reset", "invalidate"):
            self.invalidate()
            return True
        if kind == "mode":
            if msg.get("mode") not in ("voice", "fixed"):
                return False
            self.pause()
            self.mode = msg["mode"]
            return True
        if kind == "viewport" and id == self.prompter:
            try:
                self.viewport = validate_viewport(msg.get("viewport"), self.generation)
            except ValueError:
                return False
            return True
        return False
