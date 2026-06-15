#!/usr/bin/env node
import { getPullRequest, upsertMarkerComment } from "./shared.mjs";

const marker = process.env.EVOZEUS_MARKER;
const body = process.env.EVOZEUS_COMMENT_BODY;
if (!marker || !body) {
  throw new Error("EVOZEUS_MARKER and EVOZEUS_COMMENT_BODY are required");
}

const pr = getPullRequest();
await upsertMarkerComment(pr.number, marker, body);
