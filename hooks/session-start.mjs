#!/usr/bin/env node

const additionalContext = [
  "EvoZeus Lesson check is enabled for this Claude Code session.",
  "Do not announce this hook or print an EvoZeus startup banner unless the user explicitly invokes EvoZeus.",
  "At the end of a meaningful task, silently check whether the work exposed a reusable rule, failure pattern, workflow improvement, environment fix, or product behavior gap.",
  "When one exists, finish the user's requested result first, then add exactly one normal chat line: 🧙 EvoZeus · 捕捉到一条 Lesson｜<脱敏的一句话摘要>。要记录下来吗？",
  "This line is a proposal only. Do not persist a Lesson, create an Issue, modify a repository, or start a fix until the user explicitly confirms the corresponding action.",
  "Do not show raw capture JSON. Do not include secrets, customer data, private paths, unreleased code, or unnecessary identities in the summary."
].join(" ");

process.stdout.write(
  JSON.stringify({
    continue: true,
    suppressOutput: true,
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext
    }
  })
);
