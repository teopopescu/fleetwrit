"""Server CLI helpers: free-port probing and dashboard discovery."""

from __future__ import annotations

import socket

from fleetwrit_server.cli import _find_dashboard, _free_port


def test_free_port_skips_a_bound_port() -> None:
    # Hold a port open, then ask _free_port to start from it: it must move past.
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as held:
        held.bind(("127.0.0.1", 0))
        held.listen()
        taken = held.getsockname()[1]

        chosen = _free_port(taken)
        assert chosen != taken
        assert chosen >= taken


def test_free_port_returns_a_free_port_unchanged() -> None:
    # Find a definitely-free port, release it, then confirm _free_port returns it.
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
        probe.bind(("127.0.0.1", 0))
        free = probe.getsockname()[1]

    assert _free_port(free) == free


def test_find_dashboard_locates_sibling(tmp_path) -> None:
    dash = tmp_path / "dashboard"
    dash.mkdir()
    (dash / "package.json").write_text("{}")

    found = _find_dashboard(str(tmp_path))
    assert found is not None
    assert found.resolve() == dash.resolve()


def test_find_dashboard_returns_none_when_absent(tmp_path) -> None:
    assert _find_dashboard(str(tmp_path)) is None
