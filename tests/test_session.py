from server.session import Session


def test_single_owner_and_generation():
    s = Session()
    s.join("a", "setup")
    s.join("b", "setup")
    s.join("p", "prompter")
    s.model = "ready"
    assert s.command("a", {"type": "start", "mode": "voice"})
    assert not s.command("b", {"type": "start", "mode": "voice"})
    old = s.generation
    s.command("a", {"type": "pause"})
    assert s.generation > old and s.status == "paused"
    same = s.generation
    s.command("a", {"type": "pause"})
    assert s.generation == same


def test_surface_close_and_reconnect_pause():
    s = Session()
    s.join("a", "setup")
    s.join("p", "prompter")
    s.model = "ready"
    s.command("a", {"type": "start", "mode": "voice"})
    s.leave("p")
    assert s.status == "paused"
    s.join("p", "prompter")
    s.command("a", {"type": "start", "mode": "voice"})
    s.leave("a")
    assert s.status == "paused" and s.owner is None
