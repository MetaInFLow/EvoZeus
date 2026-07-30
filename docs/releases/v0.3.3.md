# EvoZeus v0.3.3

EvoZeus v0.3.3 fixes Harness status reporting.

`evozeus coevolve status` now executes the installed CoEvolve diagnosis and uses that result as the single source of truth for the current manifest path, wrapper version, migration requirement and layout conflict. Harness attach plans now identify `.evozeus-wrapper/` as the current layout and retain the two older directory names only for migration guidance.

The product set continues to pin EvoZeus Runtime v0.2.0, EvoZeus-CoEvolve v0.12.0 and EvoZeus Session Signal Skill v0.1.0.
