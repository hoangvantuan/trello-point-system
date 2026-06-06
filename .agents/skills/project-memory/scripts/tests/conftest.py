import os
import subprocess
import sys
from pathlib import Path

import pytest

SCRIPTS = Path(__file__).resolve().parent.parent


@pytest.fixture
def run():
    """Chạy một script CLI như subprocess, ghi memory vào root chỉ định."""
    def _run(script, *args, root):
        env = {**os.environ, "PROJECT_MEMORY_ROOT": str(root)}
        return subprocess.run(
            [sys.executable, str(SCRIPTS / script), *args],
            capture_output=True, text=True, env=env,
        )
    return _run
