from __future__ import annotations

from evozeus.factors.builtins import builtin_factors


def main() -> None:
    factors = builtin_factors()
    factor_ids = [factor.manifest.id for factor in factors]
    assert len(factors) >= 3
    assert "default.tool_failure" in factor_ids
    print(f"scan factors ok: count={len(factors)} ids={','.join(factor_ids)}")


if __name__ == "__main__":
    main()
