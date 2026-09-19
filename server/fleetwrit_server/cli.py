"""`fleetwrit-server` console entrypoint.

Bare command runs the API with uvicorn (back-compat). `fleetwrit-server dev`
also launches the dashboard, so the whole local stack comes up in one command.
"""

from __future__ import annotations

import argparse
import os
import shutil
import socket
import subprocess
import sys
import time
from pathlib import Path


def _free_port(preferred: int, host: str = "127.0.0.1", tries: int = 20) -> int:
    """Return the first bindable port at or after ``preferred`` (up to ``tries``)."""
    for port in range(preferred, preferred + tries):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
            try:
                probe.bind((host, port))
                return port
            except OSError:
                continue
    raise RuntimeError(f"no free port in {preferred}..{preferred + tries - 1}")


def _run_server_only(port: int) -> None:
    import uvicorn

    uvicorn.run("fleetwrit_server.app:app", host="127.0.0.1", port=port, reload=False)


def _find_dashboard(start: str | None) -> Path | None:
    """Look for a sibling ``dashboard/`` (with a package.json) from here upward."""
    here = Path(start or os.getcwd()).resolve()
    for base in (here, *here.parents):
        candidate = base / "dashboard"
        if (candidate / "package.json").is_file():
            return candidate
    return None


def run_dev(
    port: int = 4100,
    dashboard_port: int = 5174,
    dashboard: bool = True,
    seed: bool = False,
    path: str | None = None,
) -> int:
    """Start the server, and (if found) the dashboard, then wait for Ctrl-C."""
    env = {**os.environ, "FLEETWRIT_SEED": "1" if seed else "0"}
    procs: list[subprocess.Popen] = []

    resolved = _free_port(port)
    if resolved != port:
        print(f"· port {port} is busy — using {resolved} instead", flush=True)
        port = resolved

    server = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "fleetwrit_server.app:app",
         "--host", "127.0.0.1", "--port", str(port)],
        env=env,
    )
    procs.append(server)
    print(f"→ server   http://localhost:{port}  (API, seeded demo data)", flush=True)

    # Prefer the dashboard bundled into the server: it is served by the API on
    # the same port, so a pip-installed user needs no repo checkout and no Node.
    bundled = (Path(__file__).with_name("static") / "index.html").is_file()
    if dashboard and bundled:
        print(f"→ dashboard http://localhost:{port}  (bundled, served by the API)", flush=True)
    elif dashboard:
        dash_dir = _find_dashboard(path)
        npm = shutil.which("npm")
        if dash_dir is None:
            print("! no bundled dashboard and no sibling dashboard/ — running the server only.", flush=True)
        elif npm is None:
            print("! npm not found on PATH — running the server without the dashboard.", flush=True)
        else:
            if not (dash_dir / "node_modules").is_dir():
                print("· installing dashboard deps (first run)…", flush=True)
                subprocess.run([npm, "install"], cwd=dash_dir, check=False)
            dashboard_port = _free_port(dashboard_port)
            dash_env = {**env, "VITE_FLEETWRIT_URL": f"http://localhost:{port}"}
            procs.append(subprocess.Popen(
                [npm, "run", "dev", "--", "--port", str(dashboard_port), "--strictPort"],
                cwd=dash_dir, env=dash_env,
            ))
            print(f"→ dashboard http://localhost:{dashboard_port}  (live against the server)", flush=True)

    print("Press Ctrl-C to stop.", flush=True)
    try:
        while True:
            for p in procs:
                if p.poll() is not None:
                    raise KeyboardInterrupt
            time.sleep(0.5)
    except KeyboardInterrupt:
        pass
    finally:
        for p in procs:
            if p.poll() is None:
                p.terminate()
        for p in procs:
            try:
                p.wait(timeout=5)
            except subprocess.TimeoutExpired:
                p.kill()
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="fleetwrit-server", description="Fleetwrit dev server")
    sub = parser.add_subparsers(dest="command")

    dev = sub.add_parser("dev", help="Run the server and the dashboard together")
    dev.add_argument("--port", type=int, default=int(os.getenv("PORT", "4100")))
    dev.add_argument("--dashboard-port", type=int, default=5174)
    dev.add_argument("--no-dashboard", action="store_true", help="Run the server only")
    dev.add_argument("--demo", action="store_true", help="Load sample agents/requests (default: empty)")
    dev.add_argument("--path", default=None, help="Repo root to find dashboard/ (default: cwd)")

    args = parser.parse_args(argv)
    if args.command == "dev":
        return run_dev(
            port=args.port,
            dashboard_port=args.dashboard_port,
            dashboard=not args.no_dashboard,
            seed=args.demo,
            path=args.path,
        )
    _run_server_only(int(os.getenv("PORT", "4100")))
    return 0


if __name__ == "__main__":
    sys.exit(main())
