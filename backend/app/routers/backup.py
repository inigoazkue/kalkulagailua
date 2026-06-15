import os
import subprocess
from datetime import date
from urllib.parse import urlparse
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

router = APIRouter(prefix="/backup", tags=["backup"])


@router.get("/db")
async def download_db_backup():
    db_url = os.environ.get("DATABASE_URL", "postgresql+asyncpg://kalk:kalk@db:5432/kalkulagailua")
    parsed = urlparse(db_url.replace("postgresql+asyncpg://", "postgresql://"))

    env = {**os.environ, "PGPASSWORD": parsed.password or ""}
    result = subprocess.run(
        [
            "pg_dump",
            "-h", parsed.hostname or "db",
            "-p", str(parsed.port or 5432),
            "-U", parsed.username or "kalk",
            "-d", (parsed.path or "/kalkulagailua").lstrip("/"),
            "--no-password",
        ],
        capture_output=True,
        env=env,
    )

    if result.returncode != 0:
        raise HTTPException(status_code=500, detail=result.stderr.decode())

    filename = f"kalkulagailua_{date.today().isoformat()}.sql"
    return StreamingResponse(
        iter([result.stdout]),
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
