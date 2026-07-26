# EvoZeus v0.3.0

EvoZeus v0.3.0 introduces a product-level Stable and single-UAT channel model.

Stable installs use immutable Release archives with exact commits and SHA-256. UAT uses isolated worktrees and one mutable `uat/current` candidate. A repaired UAT replaces the same candidate; a failed refresh continues the previous verified UAT. CLI, Doctor, reports and the CoEvolve SessionStart dispatcher expose the active channel so test output cannot be mistaken for formal output.

The product set pins EvoZeus Runtime v0.2.0, EvoZeus-CoEvolve v0.12.0 and EvoZeus Session Signal Skill v0.1.0.
