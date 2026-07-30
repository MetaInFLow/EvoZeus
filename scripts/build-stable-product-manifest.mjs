#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { validateProductManifest } from "./evozeus-channels.mjs";

function options(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!["--input", "--core-archive", "--core-commit", "--output"].includes(key)) {
      throw new Error(`unknown argument: ${key}`);
    }
    result[key.slice(2)] = argv[++index];
  }
  for (const required of ["input", "core-archive", "core-commit", "output"]) {
    if (!result[required]) throw new Error(`missing --${required}`);
  }
  return result;
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

const args = options(process.argv.slice(2));
const input = JSON.parse(readFileSync(resolve(args.input), "utf8"));
const manifest = {
  schema_version: "evozeus.product-channel.v2",
  product_version: input.product_version,
  channel: "stable",
  generated_at: new Date().toISOString(),
  components: {
    evozeus: {
      version: input.product_version,
      commit: args["core-commit"],
      source: {
        kind: "release_archive",
        url: input.core.archive_url,
        ref: input.product_version,
        sha256: `sha256:${sha256(resolve(args["core-archive"]))}`
      },
      required_paths: input.core.required_paths
    },
    ...input.components
  },
  embedded: input.embedded,
  compatibility: input.compatibility
};
const issues = validateProductManifest(manifest, "stable");
if (issues.length > 0) {
  throw new Error(`generated Stable product manifest is invalid: ${issues.join("; ")}`);
}
writeFileSync(resolve(args.output), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify({ output: resolve(args.output), product_version: manifest.product_version }));
