"""Where the app keeps its files, and the addresses it answers to.

**No BRAIN credentials here.** They are typed into the sign-in screen and sealed in the
local vault, and nothing reads them from the environment: seeding them from a file would
let a checked-out repository sign in as its owner.
"""

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


def _profile_number() -> int | None:
    profile = os.environ.get(PROFILE_VARIABLE)
    if profile is None:
        return None
    match = re.fullmatch(r"acc([1-9][0-9]*)", profile)
    if match is None:
        raise ValueError(f"{PROFILE_VARIABLE} must have the form acc1, acc2, etc.")
    number = int(match.group(1))
    if number > 57535:
        raise ValueError(f"{PROFILE_VARIABLE} must be between acc1 and acc57535")
    return number


PROFILE_NUMBER = _profile_number()
PROFILE_NAME = f"acc{PROFILE_NUMBER}" if PROFILE_NUMBER is not None else None


def _port_from_environment(variable: str, default: int) -> int:
    value = os.environ.get(variable, str(default))
    try:
        port = int(value)
    except ValueError as exc:
        raise ValueError(f"{variable} must be an integer from 1 to 65535") from exc
    if not 1 <= port <= 65535:
        raise ValueError(f"{variable} must be an integer from 1 to 65535")
    return port


def _profile_default(base: int) -> int:
    return base if PROFILE_NUMBER is None else base + PROFILE_NUMBER


#: Each account has its own directory for the database, catalog, and encryption key.
_default_data_dir = Path.home() / ".alpha-harness"
if PROFILE_NAME is not None:
    _default_data_dir /= PROFILE_NAME
DATA_DIR = Path(os.environ.get(DATA_DIR_VARIABLE, str(_default_data_dir))).expanduser().resolve()

PORT = _port_from_environment(PORT_VARIABLE, _profile_default(8000))
FRONTEND_PORT = _port_from_environment(
    FRONTEND_PORT_VARIABLE, _profile_default(5173)
)

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
