from server.launcher import acquire_lock, should_shutdown


def test_only_one_launcher_holds_lock(tmp_path):
    first = acquire_lock(tmp_path / "lock")
    assert first is not None
    assert acquire_lock(tmp_path / "lock") is None
    first.close()
    again = acquire_lock(tmp_path / "lock")
    assert again is not None
    again.close()


def test_shutdown_grace_and_initial_connect():
    assert not should_shutdown(clients=0, had_clients=False, empty_for=16)
    assert not should_shutdown(clients=1, had_clients=True, empty_for=16)
    assert not should_shutdown(clients=0, had_clients=True, empty_for=14.9)
    assert should_shutdown(clients=0, had_clients=True, empty_for=15)
    assert should_shutdown(clients=0, had_clients=False, empty_for=120)
