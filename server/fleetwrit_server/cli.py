"""`fleetwrit-server` console entrypoint: run the dev server with uvicorn."""

from __future__ import annotations

import os


def main() -> None:
    import uvicorn

    port = int(os.getenv("PORT", "4100"))
    uvicorn.run("fleetwrit_server.app:app", host="127.0.0.1", port=port, reload=False)


if __name__ == "__main__":
    main()
