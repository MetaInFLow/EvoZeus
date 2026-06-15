from __future__ import annotations

import contextlib
import json
import sys
from pathlib import Path

from evozeus.core.session import SessionEnvelope
from evozeus.factors.base import FactorContext
from evozeus.factors.manifest import load_manifest
from evozeus.factors.packs import FactorPack, load_factor_from_pack


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("usage: python -m evozeus.factors.subprocess_worker <factor-pack-root>")

    pack_root = Path(sys.argv[1])
    payload = json.loads(sys.stdin.read())
    pack = FactorPack(root=pack_root, manifest=load_manifest(pack_root / "factor.json"))
    context = FactorContext(
        session=SessionEnvelope.model_validate(payload["session"]),
        config=payload.get("config") or {},
    )

    with contextlib.redirect_stdout(sys.stderr):
        factor = load_factor_from_pack(pack)
        result = factor.execute(context)

    sys.stdout.write(result.model_dump_json())


if __name__ == "__main__":
    main()
