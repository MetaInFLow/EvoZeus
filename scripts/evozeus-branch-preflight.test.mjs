import assert from "node:assert/strict";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  buildBranchPlan,
  collectGitFacts,
  collectGitHubPermissionEvidence,
  loadContributorBranchContract
} from "./evozeus-branch-preflight.mjs";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const CONTRACT = join(ROOT, "contracts", "v1", "contributor-branch-contract.json");
const FIXED_NOW = "2026-07-31T00:00:00.000Z";
const contract = loadContributorBranchContract(CONTRACT);

function execute(command, args, cwd) {
  return spawnSync(command, args, { cwd, encoding: "utf8", shell: false });
}

function git(cwd, ...args) {
  const result = execute("git", args, cwd);
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function createFixture() {
  const root = mkdtempSync(join(tmpdir(), "evozeus-branch-preflight-"));
  const repo = join(root, "repo");
  mkdirSync(repo);
  git(repo, "init", "-b", "main");
  git(repo, "config", "user.name", "Branch Test");
  git(repo, "config", "user.email", "branch-test@example.com");
  writeFileSync(join(repo, "fixture.txt"), "base\n");
  git(repo, "add", "fixture.txt");
  git(repo, "commit", "-m", "test: base");
  git(repo, "remote", "add", "origin", "https://github.com/MetaInFLow/EvoZeus.git");
  git(repo, "update-ref", "refs/remotes/origin/main", "HEAD");
  return { root, repo, worktree: join(root, "worktree") };
}

function fixtureFor(context) {
  const fixture = createFixture();
  context.after(() => rmSync(fixture.root, { recursive: true, force: true }));
  return fixture;
}

function snapshot(repo) {
  return {
    head: git(repo, "rev-parse", "HEAD"),
    refs: git(repo, "for-each-ref", "--format=%(refname):%(objectname)"),
    status: git(repo, "status", "--porcelain=v1", "--untracked-files=all"),
    worktrees: git(repo, "worktree", "list", "--porcelain")
  };
}

function fakeGitHubRunner({ login = "alice", viewerPermission = "WRITE", repository, unavailable = false } = {}) {
  repository ||= { private: false, archived: false, disabled: false, allow_forking: true };
  return (command, args) => {
    assert.equal(command, "gh");
    if (unavailable) return { status: 1, stdout: "", stderr: "unavailable" };
    if (args[0] === "api" && args[1] === "user") {
      return { status: 0, stdout: JSON.stringify({ login }), stderr: "" };
    }
    if (args[0] === "api" && args[1] === "graphql") {
      const data = { data: { repository: { viewerPermission } } };
      return { status: 0, stdout: JSON.stringify(data), stderr: "" };
    }
    if (args[0] === "api" && args[1] === "repos/MetaInFLow/EvoZeus") {
      return { status: 0, stdout: JSON.stringify(repository), stderr: "" };
    }
    return { status: 1, stdout: "", stderr: "unexpected request" };
  };
}

function runPlan(fixture, overrides = {}) {
  const github = overrides.github;
  const resumePlanPath = overrides.resume_plan;
  const values = {
    profile: "evozeus_core_direct",
    repo: "MetaInFLow/EvoZeus",
    repo_path: fixture.repo,
    base: "origin/main",
    issue: "MetaInFLow/EvoZeus#44",
    actor: "alice",
    type: "dev",
    component: "governance",
    summary: "branch-contract",
    permission: "direct",
    worktree: fixture.worktree,
    date: "20260731",
    now: FIXED_NOW,
    ...overrides
  };
  delete values.github;
  delete values.resume_plan;

  const before = snapshot(fixture.repo);
  const branch = `codex/${values.type}/${values.date}-${values.component}-${values.summary}`;
  const facts = collectGitFacts(values.repo_path, values.base, branch);
  const evidence = collectGitHubPermissionEvidence(values.repo, values.now, fakeGitHubRunner(github));
  const resumePlan = resumePlanPath ? JSON.parse(readFileSync(resumePlanPath, "utf8")) : null;
  const plan = buildBranchPlan(values, contract, facts, evidence, resumePlan);
  const result = { status: plan.blockers.length > 0 ? 2 : 0, stderr: "" };
  const after = snapshot(fixture.repo);
  assert.deepEqual(after, before, "branch planner must not mutate Git state");
  assert.equal(plan.writes, false);
  return { result, plan };
}

function blockerCodes(plan) {
  return plan.blockers.map(({ code }) => code);
}

test("contract exposes the four required profiles", () => {
  const contract = JSON.parse(readFileSync(CONTRACT, "utf8"));
  const expected = ["evozeus_core_direct", "uat_repair_development", "community_contribution", "coevolve_target_skillware_consumer"];
  assert.deepEqual(Object.keys(contract.profiles), expected);
  assert.deepEqual(contract.host_compatibility, {
    supported_hosts: ["codex", "claude"],
    plan_semantics: "identical",
    host_input_to_planner: false
  });
});

test("plans a clean new direct contribution with zero writes", (context) => {
  const fixture = fixtureFor(context);
  const { result, plan } = runPlan(fixture);
  assert.equal(result.status, 0, result.stderr);
  const actual = [plan.resume.decision, plan.repo.canonical, plan.base.ref, plan.issue.reference,
    plan.actor.id, plan.actor.verified, plan.permission_path.resolved, plan.permission_evidence.source,
    plan.permission_evidence.checked_at, plan.worktree.isolated];
  const expected = ["new", "MetaInFLow/EvoZeus", "origin/main", "MetaInFLow/EvoZeus#44",
    "alice", true, "direct", "github_api", FIXED_NOW, true];
  assert.deepEqual(actual, expected);
  assert.equal(plan.branch.target, "codex/dev/20260731-governance-branch-contract");
  assert.equal(plan.next_write_action, "create_direct_branch_in_isolated_worktree");
  assert.deepEqual(plan.blockers, []);
});

test("resolves ADMIN and WRITE viewers to direct from GitHub evidence", (context) => {
  const fixtures = [createFixture(), createFixture()];
  context.after(() => fixtures.forEach(({ root }) => rmSync(root, { recursive: true, force: true })));
  for (const [index, viewerPermission] of ["ADMIN", "WRITE"].entries()) {
    const { result, plan } = runPlan(fixtures[index], { github: { viewerPermission } });
    assert.equal(result.status, 0);
    assert.equal(plan.permission_path.resolved, "direct");
    assert.equal(plan.permission_evidence.repository.viewer_permission, viewerPermission);
  }
});

test("resolves a READ viewer with public fork policy to fork", (context) => {
  const fixture = fixtureFor(context);
  const { result, plan } = runPlan(fixture, {
    profile: "community_contribution",
    type: "docs",
    component: "docs",
    permission: "fork",
    github: { viewerPermission: "READ" }
  });
  assert.equal(result.status, 0);
  assert.equal(plan.permission_path.resolved, "fork");
  assert.equal(plan.repo.source, "alice/EvoZeus");
  const bypass = runPlan(fixture, { github: { viewerPermission: "READ" } }).plan;
  assert.equal(bypass.permission_path.resolved, "fork");
  assert(blockerCodes(bypass).includes("permission_expectation_mismatch"));
});

test("blocks when the expected actor differs from gh api user", (context) => {
  const fixture = fixtureFor(context);
  const { result, plan } = runPlan(fixture, { github: { login: "bob" } });
  assert.equal(result.status, 2);
  assert(blockerCodes(plan).includes("actor_mismatch"));
  assert.equal(plan.actor.id, "bob");
});

test("resumes only the matching owner, base, key, branch, and worktree", (context) => {
  const fixture = fixtureFor(context);
  const initial = runPlan(fixture).plan;
  git(fixture.repo, "worktree", "add", "-b", initial.branch.target, fixture.worktree, "origin/main");
  const resumePath = join(fixture.root, "resume-plan.json");
  writeFileSync(resumePath, JSON.stringify(initial));

  const { result, plan } = runPlan(fixture, { resume_plan: resumePath });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(plan.resume.decision, "resume");
  assert.equal(plan.worktree.registered, true);
  assert.equal(plan.next_write_action, "resume_existing_branch_in_isolated_worktree");
});

test("blocks a dirty tree", (context) => {
  const fixture = fixtureFor(context);
  writeFileSync(join(fixture.repo, "dirty.txt"), "dirty\n");
  const { result, plan } = runPlan(fixture);
  assert.equal(result.status, 2);
  assert(blockerCodes(plan).includes("dirty_tree"));
});

test("blocks a clean isolated worktree when the canonical checkout is dirty", (context) => {
  const fixture = fixtureFor(context);
  git(fixture.repo, "worktree", "add", "-b", "inspection", fixture.worktree, "origin/main");
  writeFileSync(join(fixture.repo, "canonical-dirty.txt"), "dirty\n");
  const { result, plan } = runPlan(fixture, {
    repo_path: fixture.worktree,
    worktree: join(fixture.root, "planned-worktree")
  });
  assert.equal(result.status, 2);
  assert(!blockerCodes(plan).includes("dirty_tree"));
  assert(blockerCodes(plan).includes("canonical_checkout_dirty"));
  assert.deepEqual([plan.worktree.current_checkout.dirty_entry_count,
    plan.worktree.canonical_checkout.dirty_entry_count], [0, 1]);
});

test("blocks direct use of a protected checkout as the contribution worktree", (context) => {
  const fixture = fixtureFor(context);
  const { result, plan } = runPlan(fixture, { worktree: fixture.repo });
  assert.equal(result.status, 2);
  assert(blockerCodes(plan).includes("protected_checkout_write"));
});

test("blocks a new plan when HEAD is not the requested base commit", (context) => {
  const fixture = fixtureFor(context);
  writeFileSync(join(fixture.repo, "fixture.txt"), "new head\n");
  git(fixture.repo, "add", "fixture.txt");
  git(fixture.repo, "commit", "-m", "test: move head");
  const { result, plan } = runPlan(fixture);
  assert.equal(result.status, 2);
  assert(blockerCodes(plan).includes("wrong_base_commit"));
});

test("blocks a branch collision without matching resume metadata", (context) => {
  const fixture = fixtureFor(context);
  git(fixture.repo, "branch", "codex/dev/20260731-governance-branch-contract", "origin/main");
  const { result, plan } = runPlan(fixture);
  assert.equal(result.status, 2);
  assert(blockerCodes(plan).includes("branch_collision"));
});

test("blocks stale ownership metadata", (context) => {
  const fixture = fixtureFor(context);
  const initial = runPlan(fixture).plan;
  git(fixture.repo, "branch", initial.branch.target, "origin/main");
  initial.ownership.checked_at = "2026-06-01T00:00:00.000Z";
  const resumePath = join(fixture.root, "stale-plan.json");
  writeFileSync(resumePath, JSON.stringify(initial));
  const { result, plan } = runPlan(fixture, { resume_plan: resumePath });
  assert.equal(result.status, 2);
  assert(blockerCodes(plan).includes("stale_ownership"));
});

test("selects deterministic fork-only and local-patch fallbacks", (context) => {
  const forkFixture = createFixture();
  const localFixture = createFixture();
  context.after(() => rmSync(forkFixture.root, { recursive: true, force: true }));
  context.after(() => rmSync(localFixture.root, { recursive: true, force: true }));

  const fork = runPlan(forkFixture, {
    profile: "community_contribution",
    type: "docs",
    component: "docs",
    permission: "fork",
    github: { viewerPermission: "READ" }
  }).plan;
  assert.equal(fork.permission_path.mode, "fork_pull_request");
  assert.equal(fork.repo.source, "alice/EvoZeus");
  assert.equal(fork.next_write_action, "create_fork_branch_in_isolated_worktree");

  const local = runPlan(localFixture, {
    profile: "community_contribution",
    type: "docs",
    component: "docs",
    permission: "local",
    github: {
      viewerPermission: "READ",
      repository: { private: true, archived: false, disabled: false, allow_forking: false }
    }
  }).plan;
  assert.equal(local.permission_path.mode, "local_patch");
  assert.equal(local.permission_path.push_allowed, false);
  assert.equal(local.permission_path.pull_request_allowed, false);
  assert.equal(local.next_write_action, "create_local_patch_branch_in_isolated_worktree");
});

test("GitHub unavailability fails closed to local and cannot grant direct or fork", (context) => {
  const directFixture = createFixture();
  const localFixture = createFixture();
  context.after(() => rmSync(directFixture.root, { recursive: true, force: true }));
  context.after(() => rmSync(localFixture.root, { recursive: true, force: true }));

  const direct = runPlan(directFixture, { github: { unavailable: true } }).plan;
  assert.equal(direct.permission_path.resolved, "local");
  assert.equal(direct.permission_evidence.source, "unavailable");
  assert(blockerCodes(direct).includes("permission_expectation_mismatch"));

  const local = runPlan(localFixture, {
    profile: "community_contribution",
    type: "docs",
    component: "docs",
    permission: "local",
    github: { unavailable: true }
  }).plan;
  assert.deepEqual(local.blockers, []);
  assert.equal(local.permission_path.push_allowed, false);
  assert.equal(local.permission_path.pull_request_allowed, false);
});

test("keeps UAT repair on a development branch without a user channel claim", (context) => {
  const fixture = fixtureFor(context);
  git(fixture.repo, "update-ref", "refs/remotes/origin/uat/current", "HEAD");
  const { result, plan } = runPlan(fixture, {
    profile: "uat_repair_development",
    base: "origin/uat/current",
    type: "bug",
    component: "skill",
    summary: "repair-candidate"
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(plan.branch.target, /^codex\/bug\//);
  assert.equal(plan.branch.class, "development");
  assert.equal(plan.branch.user_channel_claim, "forbidden");
});

test("rejects malicious branch characters without shell execution or writes", (context) => {
  const fixture = fixtureFor(context);
  const marker = join(fixture.root, "pwned");
  const { result, plan } = runPlan(fixture, { summary: `safe;touch-${marker}` });
  assert.equal(result.status, 2);
  assert(blockerCodes(plan).includes("invalid_summary"));
  assert.equal(resolve(marker), marker);
  assert.equal(existsSync(marker), false);
});
