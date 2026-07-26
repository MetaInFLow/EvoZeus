# EvoZeus v0.3.4

EvoZeus v0.3.4 makes channel updates recoverable after an interrupted install.

When an interrupted process leaves the deterministic target root partially populated, the next update now identifies it as unreferenced, removes only that incomplete managed root, and retries the transaction. Current and rollback installations remain protected. This release includes the CoEvolve Harness status correction introduced in v0.3.3.

The product set continues to pin EvoZeus Runtime v0.2.0, EvoZeus-CoEvolve v0.12.0 and EvoZeus Session Signal Skill v0.1.0.
