import sys
import os

if sys.platform == "win32":
    import asyncio
    try:
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
        import uvicorn.loops.asyncio
        uvicorn.loops.asyncio.asyncio_loop_factory = lambda use_subprocess=False: asyncio.SelectorEventLoop
    except Exception:
        pass

import uvicorn

if __name__ == "__main__":
    print("Iniciando Kipustock en http://127.0.0.1:8000...")
    uvicorn.run(
        "backend.main:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
        reload_dirs=["backend", "scraper"],
        reload_excludes=["data", "data/*", "data/**", "*.db", "*.log"],
        loop="asyncio"
    )
