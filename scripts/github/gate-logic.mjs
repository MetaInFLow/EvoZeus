const PROOF_FIELDS = [
  "Command run",
  "Real environment or session tested",
  "Exact steps or command run after this patch",
  "Evidence after change",
  "Observed result after change",
  "Output after"
];

const SECTION_RULES = [
  {
    label: "type:candidate",
    prefix: "candidate",
    headings: ["Candidate summary", "Source session", "Evidence", "Operational rule", "When NOT to use", "Counterexamples", "Privacy checklist"]
  },
  {
    label: "type:code",
    prefix: "code/workflow",
    headings: ["Problem", "Scope", "Real behavior proof", "Tests", "Rollback plan"]
  },
  {
    label: "type:workflow",
    prefix: "code/workflow",
    headings: ["Problem", "Scope", "Real behavior proof", "Tests", "Rollback plan"]
  },
  {
    label: "type:skill-instruction",
    prefix: "skill instruction",
    headings: ["Instruction surface changed", "Agent behavior before / after", "Safety boundary", "Prompt injection risk", "Rollback plan"]
  },
  {
    label: "type:schema",
    prefix: "schema",
    headings: ["Schema changed", "Breaking or non-breaking", "Migration needed?", "Validator updated?", "Examples updated?"]
  }
];

const PRIVACY_PATTERNS = [
  ["private key", /-----BEGIN (RSA |OPENSSH |EC |DSA |)?PRIVATE KEY-----/i],
  ["github token", /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/],
  ["openai key", /\bsk-[A-Za-z0-9_-]{20,}\b/],
  ["aws access key", /\bAKIA[0-9A-Z]{16}\b/],
  ["bearer token", /\bBearer\s+[A-Za-z0-9._~+/-]+=*/i],
  ["dotenv content", /^\+\s*[A-Z0-9_]{3,}=.+$/m],
  ["email", /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i],
  ["phone-like number", /\b(?:\+?\d[\d\s().-]{8,}\d)\b/],
  ["private mac path", /\/Users\/[A-Za-z0-9._-]+\/[^\s)"']*/],
  ["internal url", /https?:\/\/[A-Za-z0-9.-]*(?:internal|corp|intranet|local)[A-Za-z0-9.-]*/i]
];

function addedPatchText(patch) {
  return (patch || "")
    .split("\n")
    .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
    .join("\n");
}

function hasPrivacyMatch(name, pattern, text) {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  const regex = new RegExp(pattern.source, flags);
  for (const match of text.matchAll(regex)) {
    if (name === "phone-like number" && /^\d{4}-\d{2}-\d{2}$/.test(match[0])) {
      continue;
    }
    return true;
  }
  return false;
}

export function hasHeading(body, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^##\\s+${escaped}\\s*$`, "im").test(body || "");
}

export function lineFieldFilled(body, field) {
  const escaped = field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|\\n)[^\\S\\n]*(?:[-*][^\\S\\n]*)?${escaped}:[^\\S\\n]*\\S`, "i").test(body || "");
}

export function evaluateProofGate({ labels, body }) {
  const missing = [];
  const labelSet = new Set(labels);

  for (const rule of SECTION_RULES) {
    if (!labelSet.has(rule.label)) continue;
    for (const heading of rule.headings) {
      if (!hasHeading(body, heading)) {
        missing.push(`missing ${rule.prefix} section: ${heading}`);
      }
    }
  }

  if (labelSet.has("type:governance") && !hasHeading(body, "Linked RFC") && !body.match(/RFC|maintainer discussion/i)) {
    missing.push("governance change needs Linked RFC or maintainer discussion");
  }

  const hasProofSection = hasHeading(body, "Real behavior proof") || hasHeading(body, "EvoZeus Evidence Proof");
  const filledEvidence = PROOF_FIELDS.some((field) => lineFieldFilled(body, field));
  if (!hasProofSection) {
    missing.push("real behavior proof is missing");
  } else if (!filledEvidence) {
    missing.push("real behavior proof fields are empty");
  }

  const mockOnly = Boolean(
    body.match(/\b(mock|mocks|unit tests?|lint|typecheck|type check|ci only)\b/i) &&
      !body.match(/\b(real session|local reproduction|manual run|command run|observed result)\b/i)
  );

  const proofLabels = [];
  if (mockOnly) proofLabels.push("proof:mock-only");
  if (missing.length > 0) proofLabels.push("proof:needed");
  if (!mockOnly && missing.length === 0) proofLabels.push("proof:supplied");
  if (missing.some((item) => item.includes("candidate"))) {
    proofLabels.push("candidate:needs-evidence");
  }

  return { labels: [...new Set(proofLabels)], missing, mockOnly };
}

export function planLabelPrefixUpdate({ current, prefixes, desired }) {
  const wanted = new Set(desired);
  const remove = current.filter((label) => prefixes.some((prefix) => label.startsWith(prefix)) && !wanted.has(label));
  const add = desired.filter((label) => !current.includes(label));
  return { add, remove };
}

export function planManagedLabelUpdate({ current, managed, desired }) {
  const managedSet = new Set(managed);
  const wanted = new Set(desired);
  const remove = current.filter((label) => managedSet.has(label) && !wanted.has(label));
  const add = desired.filter((label) => managedSet.has(label) && !current.includes(label));
  return { add, remove };
}

export function privacyFindingsForPatch(filename, patch) {
  const added = addedPatchText(patch);
  const findings = [];
  for (const [name, pattern] of PRIVACY_PATTERNS) {
    if (hasPrivacyMatch(name, pattern, added)) {
      findings.push(`${filename}: ${name}`);
    }
  }
  return findings;
}
