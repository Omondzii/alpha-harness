"""Where the app keeps its files, and the addresses it answers to.

**No BRAIN credentials here.** They are typed into the sign-in screen and sealed in the
local vault, and nothing reads them from the environment: seeding them from a file would
let a checked-out repository sign in as its owner.
"""

import hashlib
import os
import re
from dataclasses import dataclass
from pathlib import Path

# Not a setting: the sign-in screen sends the password here, so no file may redirect it.
BRAIN_API_BASE = "https://api.worldquantbrain.com"

DATA_DIR_VARIABLE = "ALPHA_HARNESS_DATA_DIR"
PORT_VARIABLE = "ALPHA_HARNESS_PORT"
FRONTEND_PORT_VARIABLE = "ALPHA_HARNESS_FRONTEND_PORT"
PROFILE_VARIABLE = "ALPHA_HARNESS_PROFILE"


def _profile() -> tuple[str | None, int | None]:
    name = os.environ.get(PROFILE_VARIABLE)
    if name is None:
        return None, None
    if not re.fullmatch(r"[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?", name):
        raise ValueError(
            f"{PROFILE_VARIABLE} must be a lowercase name with only letters, numbers, "
            "and internal hyphens (up to 32 characters)."
        )
    numbered = re.fullmatch(r"acc([1-9][0-9]*)", name)
    number = int(numbered.group(1)) if numbered else None
    if number is not None and number > 57535:
        raise ValueError(f"{PROFILE_VARIABLE} must be between acc1 and acc57535")
    return name, number


PROFILE_NAME, PROFILE_NUMBER = _profile()


def _port_from_environment(variable: str, default: int) -> int:
    value = os.environ.get(variable, str(default))
    try:
        port = int(value)
    except ValueError as exc:
        raise ValueError(f"{variable} must be an integer from 1 to 65535") from exc
    if not 1 <= port <= 65535:
        raise ValueError(f"{variable} must be an integer from 1 to 65535")
    return port


def _default_ports() -> tuple[int, int]:
    if PROFILE_NAME is None:
        return 8000, 5173
    if PROFILE_NUMBER is not None:
        return 8000 + PROFILE_NUMBER, 5173 + PROFILE_NUMBER
    slot = int.from_bytes(hashlib.sha256(PROFILE_NAME.encode()).digest()[:4], "big") % 20_000
    return 10_000 + slot, 30_000 + slot


#: Each account has its own directory for the database, catalog, and encryption key.
_default_data_dir = Path.home() / ".alpha-harness"
if PROFILE_NAME is not None:
    _default_data_dir /= PROFILE_NAME
DATA_DIR = Path(os.environ.get(DATA_DIR_VARIABLE, str(_default_data_dir))).expanduser().resolve()

_default_backend_port, _default_frontend_port = _default_ports()
PORT = _port_from_environment(PORT_VARIABLE, _default_backend_port)
FRONTEND_PORT = _port_from_environment(FRONTEND_PORT_VARIABLE, _default_frontend_port)

#: The pages that may open the telemetry socket: the Vite dev server, and the built UI the
#: backend serves itself on its configured loopback port.
ALLOWED_ORIGINS = frozenset(
    {
        f"http://localhost:{FRONTEND_PORT}",
        f"http://127.0.0.1:{FRONTEND_PORT}",
        f"http://localhost:{PORT}",
        f"http://127.0.0.1:{PORT}",
    }
)


@dataclass(frozen=True, slots=True)
class Settings:
    """Where local state lives."""

    data_dir: Path = DATA_DIR

    @property
    def sqlite_path(self) -> Path:
        """Operational state: credentials, sessions, simulation records, templates."""
        return self.data_dir / "harness.db"

    @property
    def duckdb_path(self) -> Path:
        """Analytical store: the data-field catalog."""
        return self.data_dir / "catalog.duckdb"

    @property
    def key_path(self) -> Path:
        """AES-GCM master key. Created 0600 on first run."""
        return self.data_dir / "key"

    def ensure_data_dir(self) -> None:
        self.data_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
