#!/usr/bin/env python3
"""Build or verify the source-only, reproducible infrastructure download."""
# Copyright © 2026 Christopher Snow.
import argparse
import ast
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

root = Path(__file__).resolve().parent.parent
files = ["README.md", "Dockerfile", "compose.yaml", "lab.py"]
source = root / "harnesses/infrastructure"
destination = root / "public/harnesses/infrastructure.zip"
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--check", action="store_true")
args = parser.parse_args()
ast.parse((source / "lab.py").read_text())
ast.parse((root / "public/templates/decision-runner.py").read_text())
if args.check:
    with ZipFile(destination) as archive:
        assert sorted(archive.namelist()) == sorted("infrastructure/" + name for name in files)
        for name in files:
            assert archive.read("infrastructure/" + name) == (source / name).read_bytes(), name + " differs from the download"
    print("Harness download matches its source; Python syntax checked.")
else:
    destination.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(destination, "w", compression=ZIP_DEFLATED, compresslevel=9) as archive:
        for name in files:
            entry = ZipInfo("infrastructure/" + name, date_time=(2026, 1, 1, 0, 0, 0))
            entry.compress_type = ZIP_DEFLATED
            entry.external_attr = 0o100644 << 16
            archive.writestr(entry, (source / name).read_bytes())
    print("Wrote", destination.relative_to(root))
