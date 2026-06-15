#!/usr/bin/env node
import { LABEL_DEFS } from "./label-defs.mjs";
import { ensureLabel } from "./shared.mjs";

for (const name of Object.keys(LABEL_DEFS).sort()) {
  await ensureLabel(name);
  console.log(`label ok: ${name}`);
}
