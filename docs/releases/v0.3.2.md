# EvoZeus v0.3.2

EvoZeus v0.3.2 completes the single-UAT recovery path.

When the central `uat/current` manifest points to a previously verified candidate, the updater rechecks exact commits, local cleanliness, required files, smoke health and compatibility before reusing its isolated root. The current verified UAT remains active if any check fails. This preserves one user-visible UAT while supporting repaired candidates and executable rollback history.

The product set pins EvoZeus Runtime v0.2.0, EvoZeus-CoEvolve v0.12.0 and EvoZeus Session Signal Skill v0.1.0.
