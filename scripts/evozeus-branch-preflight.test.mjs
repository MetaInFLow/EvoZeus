import assert from "node:assert/strict";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  buildBranchPlan,
  collectGitFacts,
  collectGitHubIssueEvidence,
  collectGitHubPermissionEvidence,
  loadContributorBranchContract,
  resolvePlanDate,
  targetBranchFor
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
  const status = execute("git", ["status", "--porcelain=v1", "--untracked-files=all"], repo);
  return {
    head: git(repo, "rev-parse", "HEAD"),
    refs: git(repo, "for-each-ref", "--format=%(refname):%(objectname)"),
    status: { exit_code: status.status, stdout: status.stdout, stderr: status.stderr },
    worktrees: git(repo, "worktree", "list", "--porcelain")
  };
}

function fakeGitHubRunner({
  login = "alice",
  viewerPermission = "WRITE",
  repository,
  unavailable = false,
  identityUnavailable = false,
  permissionUnavailable = false,
  repositoryUnavailable = false,
  issue,
  issueUnavailable = false
} = {}) {
  repository ||= { private: false, archived: false, disabled: false, allow_forking: true };
  issue ||= { number: 44, state: "open", title: "Contributor branch contract", labels: [{ name: "governance" }] };
  return (command, args) => {
    assert.equal(command, "gh");
    if (unavailable) return { status: 1, stdout: "", stderr: "unavailable" };
    if (args[0] === "api" && args[1] === "user") {
      if (identityUnavailable) return { status: 1, stdout: "", stderr: "identity unavailable" };
      return { status: 0, stdout: JSON.stringify({ login }), stderr: "" };
    }
    if (args[0] === "api" && args[1] === "graphql") {
      if (permissionUnavailable) return { status: 1, stdout: "", stderr: "permission unavailable" };
      const data = { data: { repository: { viewerPermission } } };
      return { status: 0, stdout: JSON.stringify(data), stderr: "" };
    }
    if (args[0] === "api" && args[1] === "repos/MetaInFLow/EvoZeus") {
      if (repositoryUnavailable) return { status: 1, stdout: "", stderr: "repository unavailable" };
      return { status: 0, stdout: JSON.stringify(repository), stderr: "" };
    }
    if (args[0] === "api" && args[1] === "repos/MetaInFLow/EvoZeus/issues/44") {
      if (issueUnavailable) return { status: 1, stdout: "", stderr: "issue unavailable" };
      return { status: 0, stdout: JSON.stringify(issue), stderr: "" };
    }
    return { status: 1, stdout: "", stderr: "unexpected request" };
  };
}

function fakeGitFactsRunner({ heads = {}, unavailable = false, invalid = false } = {}) {
  return (command, args, options) => {
    if (command === "git" && args.includes("ls-remote")) {
      if (unavailable) return { status: 1, stdout: "", stderr: "remote unavailable" };
      const ref = args.at(-1);
      const branch = ref.replace(/^refs\/heads\//, "");
      const commit = heads[branch];
      if (!commit) return { status: 2, stdout: "", stderr: "" };
      if (invalid) return { status: 0, stdout: "invalid output\n", stderr: "" };
      return { status: 0, stdout: `${commit}\t${ref}\n`, stderr: "" };
    }
    return spawnSync(command, args, options);
  };
}

function runPlan(fixture, overrides = {}) {
  const github = overrides.github;
  const gitRemote = overrides.git_remote;
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
  delete values.git_remote;
  delete values.resume_plan;

  const resumePlan = resumePlanPath ? JSON.parse(readFileSync(resumePlanPath, "utf8")) : null;
  values.date = resolvePlanDate(values, resumePlan, "20260801");
  const before = snapshot(fixture.repo);
  const evidence = collectGitHubPermissionEvidence(values.repo, values.now, fakeGitHubRunner(github));
  const resolvedActor = evidence.identity.login || values.actor;
  const usesFork = evidence.source === "github_api"
    && ["READ", "TRIAGE"].includes(evidence.repository.viewer_permission)
    && evidence.repository.fork_allowed;
  const targetRepository = usesFork ? `${resolvedActor}/EvoZeus` : values.repo;
  const branch = targetBranchFor(values, resolvedActor);
  const baseBranch = values.base.replace(/^origin\//, "");
  const baseCommit = git(fixture.repo, "rev-parse", values.base);
  const remoteEvidence = {
    ...gitRemote,
    heads: { [baseBranch]: baseCommit, ...gitRemote?.heads }
  };
  const facts = collectGitFacts(
    values.repo_path,
    values.base,
    branch,
    values.worktree,
    targetRepository,
    fakeGitFactsRunner(remoteEvidence)
  );
  const issueNumber = Number(String(values.issue).split("#").at(-1));
  const issueEvidence = collectGitHubIssueEvidence(values.repo, issueNumber, values.now, fakeGitHubRunner(github));
  const plan = buildBranchPlan(values, contract, facts, evidence, issueEvidence, resumePlan);
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
  assert.equal(contract.resume.matching_branch_without_worktree,
    "recreate_resume_worktree_for_existing_branch");
  assert.equal(contract.resume.matching_branch_with_prunable_worktree,
    "prune_and_recreate_resume_worktree_for_existing_branch");
  assert.equal(contract.resume.missing_cli_date_source, "validated_resume_plan_target_branch");
  assert.deepEqual(contract.resume.evidence_requirements, {
    writes: false,
    blockers: "empty",
    decision: ["new", "resume"],
    next_write_action: "not_blocked"
  });
  assert.equal(contract.worktree.registered_worktree_descendant, "block");
  assert.equal(contract.worktree.dangling_symlink_path, "occupied_and_blocked");
  assert.equal(contract.blocking_handling.current_checkout_status_unavailable, "block");
  assert.equal(contract.branch_naming.template, "codex/{type}/{yyyymmdd}-{actor}-{component}-{summary}");
  assert.equal(contract.branch_naming.max_leaf_bytes, 240);
  assert.equal(contract.worktree.requested_registered_worktree_status_evidence, "required");
  assert.equal(contract.permission_resolution.direct_repository_state, "not_archived_and_not_disabled");
  assert.equal(contract.remote_resolution.push_urls,
    "every_effective_origin_push_url_must_match_canonical_github_repo");
  assert.equal(contract.remote_resolution.target_branch_state,
    "live_git_ls_remote_effective_origin_required");
  assert.equal(contract.remote_resolution.canonical_base_state,
    "live_git_ls_remote_effective_origin_required");
  assert.equal(contract.remote_resolution.fork_target_remote,
    "configured_remote_with_exact_actor_fork_fetch_and_push_urls_required");
});

test("plans a clean new direct contribution with zero writes", (context) => {
  const fixture = fixtureFor(context);
  const { result, plan } = runPlan(fixture);
  assert.equal(result.status, 0, result.stderr);
  const actual = [plan.resume.decision, plan.repo.canonical, plan.base.ref, plan.issue.reference,
    plan.actor.id, plan.actor.verified, plan.permission_path.resolved, plan.permission_evidence.source,
    plan.permission_evidence.checked_at, plan.issue_evidence.source, plan.worktree.isolated];
  const expected = ["new", "MetaInFLow/EvoZeus", "origin/main", "MetaInFLow/EvoZeus#44",
    "alice", true, "direct", "github_api", FIXED_NOW, "github_api", true];
  assert.deepEqual(actual, expected);
  assert.equal(plan.branch.target, "codex/dev/20260731-alice-governance-branch-contract");
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

test("binds deterministic target branches to the verified actor", (context) => {
  const fixture = fixtureFor(context);
  const alice = runPlan(fixture).plan;
  const bob = runPlan(fixture, { actor: "bob", github: { login: "bob" } }).plan;

  assert.deepEqual(alice.blockers, []);
  assert.deepEqual(bob.blockers, []);
  assert.equal(alice.branch.target, "codex/dev/20260731-alice-governance-branch-contract");
  assert.equal(bob.branch.target, "codex/dev/20260731-bob-governance-branch-contract");
  assert.notEqual(alice.branch.target, bob.branch.target);
  assert.notEqual(alice.resume.key, bob.resume.key);
});

test("resolves archived or disabled repositories away from direct", (context) => {
  const cases = [
    { archived: true, disabled: false },
    { archived: false, disabled: true }
  ];
  const fixtures = cases.map(() => createFixture());
  context.after(() => fixtures.forEach(({ root }) => rmSync(root, { recursive: true, force: true })));

  for (const [index, state] of cases.entries()) {
    const { result, plan } = runPlan(fixtures[index], {
      github: {
        viewerPermission: "ADMIN",
        repository: { private: false, allow_forking: true, ...state }
      }
    });
    assert.equal(result.status, 2);
    assert.equal(plan.permission_path.resolved, "local");
    assert.equal(plan.permission_evidence.repository.write_allowed, false);
    assert(blockerCodes(plan).includes("permission_expectation_mismatch"));
  }
});

test("resolves a READ viewer with public fork policy to fork", (context) => {
  const fixture = fixtureFor(context);
  git(fixture.repo, "remote", "add", "alice", "https://github.com/alice/EvoZeus.git");
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
  assert.equal(plan.branch.remote_name, "alice");
  assert.equal(plan.branch.remote_repository, "alice/EvoZeus");
  const liveFork = runPlan(fixture, {
    profile: "community_contribution",
    type: "docs",
    component: "docs",
    permission: "fork",
    github: { viewerPermission: "READ" },
    git_remote: { heads: { [plan.branch.target]: git(fixture.repo, "rev-parse", "HEAD") } }
  }).plan;
  assert(blockerCodes(liveFork).includes("branch_collision"));
  const bypass = runPlan(fixture, { github: { viewerPermission: "READ" } }).plan;
  assert.equal(bypass.permission_path.resolved, "fork");
  assert(blockerCodes(bypass).includes("permission_expectation_mismatch"));
});

test("blocks fork planning without an exact configured fork remote", (context) => {
  const fixture = fixtureFor(context);
  const { result, plan } = runPlan(fixture, {
    profile: "community_contribution",
    type: "docs",
    component: "docs",
    permission: "fork",
    github: { viewerPermission: "READ" }
  });
  assert.equal(result.status, 2);
  assert(blockerCodes(plan).includes("target_remote_status_unavailable"));
  assert.equal(plan.branch.remote_name, null);
  assert.equal(plan.branch.remote_repository, "alice/EvoZeus");

  git(fixture.repo, "remote", "add", "alice", "https://github.com/alice/EvoZeus.git");
  git(fixture.repo, "remote", "set-url", "--push", "alice", "https://evilgithub.com/alice/EvoZeus.git");
  const unsafe = runPlan(fixture, {
    profile: "community_contribution",
    type: "docs",
    component: "docs",
    permission: "fork",
    github: { viewerPermission: "READ" }
  }).plan;
  assert(blockerCodes(unsafe).includes("target_remote_status_unavailable"));
  assert.equal(unsafe.branch.remote_name, null);
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

test("blocks a dirty requested resume worktree", (context) => {
  const fixture = fixtureFor(context);
  const initial = runPlan(fixture).plan;
  git(fixture.repo, "worktree", "add", "-b", initial.branch.target, fixture.worktree, "origin/main");
  writeFileSync(join(fixture.worktree, "untracked.txt"), "unknown edits\n");
  const resumePath = join(fixture.root, "resume-plan.json");
  writeFileSync(resumePath, JSON.stringify(initial));

  const { result, plan } = runPlan(fixture, { resume_plan: resumePath });
  assert.equal(result.status, 2);
  assert(blockerCodes(plan).includes("requested_worktree_dirty"));
  assert.equal(plan.worktree.registered, false);
  assert.equal(plan.worktree.requested_checkout.status_available, true);
  assert.equal(plan.worktree.requested_checkout.dirty_entry_count, 1);
});

test("recovers the original branch date from a matching resume plan", (context) => {
  const fixture = fixtureFor(context);
  const initial = runPlan(fixture).plan;
  git(fixture.repo, "worktree", "add", "-b", initial.branch.target, fixture.worktree, "origin/main");
  const resumePath = join(fixture.root, "resume-plan.json");
  writeFileSync(resumePath, JSON.stringify(initial));

  const { result, plan } = runPlan(fixture, { date: undefined, resume_plan: resumePath });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(plan.resume.decision, "resume");
  assert.equal(plan.branch.target, initial.branch.target);
  assert.equal(plan.branch.target.includes("20260801"), false);
});

test("offers an explicit zero-write recovery action for a matching resume branch without a worktree", (context) => {
  const fixture = fixtureFor(context);
  const initial = runPlan(fixture).plan;
  git(fixture.repo, "branch", initial.branch.target, "origin/main");
  const resumePath = join(fixture.root, "resume-plan.json");
  writeFileSync(resumePath, JSON.stringify(initial));

  const { result, plan } = runPlan(fixture, { resume_plan: resumePath });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(plan.resume.decision, "resume");
  assert.equal(plan.worktree.registered, false);
  assert.equal(plan.next_write_action, "recreate_resume_worktree_for_existing_branch");
  assert.equal(existsSync(fixture.worktree), false);
});

test("offers cleanup and recreation when a matching registered worktree is prunable", (context) => {
  const fixture = fixtureFor(context);
  const initial = runPlan(fixture).plan;
  git(fixture.repo, "worktree", "add", "-b", initial.branch.target, fixture.worktree, "origin/main");
  const resumePath = join(fixture.root, "resume-plan.json");
  writeFileSync(resumePath, JSON.stringify(initial));
  rmSync(fixture.worktree, { recursive: true, force: true });

  const { result, plan } = runPlan(fixture, { resume_plan: resumePath });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(plan.resume.decision, "resume");
  assert.equal(plan.worktree.registered, false);
  assert.equal(plan.worktree.registration_present, true);
  assert.equal(plan.worktree.registration_prunable, true);
  assert.equal(plan.next_write_action, "prune_and_recreate_resume_worktree_for_existing_branch");
  assert.equal(existsSync(fixture.worktree), false);
});

test("blocks a prunable worktree registration while its path remains occupied", (context) => {
  const fixture = fixtureFor(context);
  const initial = runPlan(fixture).plan;
  git(fixture.repo, "worktree", "add", "-b", initial.branch.target, fixture.worktree, "origin/main");
  const resumePath = join(fixture.root, "resume-plan.json");
  writeFileSync(resumePath, JSON.stringify(initial));
  rmSync(join(fixture.worktree, ".git"));

  const { result, plan } = runPlan(fixture, { resume_plan: resumePath });
  assert.equal(result.status, 2);
  assert(blockerCodes(plan).includes("prunable_worktree_path_occupied"));
  assert.equal(plan.worktree.registration_prunable, true);
  assert.equal(plan.next_write_action, "blocked");
  assert.equal(existsSync(join(fixture.worktree, "fixture.txt")), true);
});

test("rejects a blocked plan as resume ownership evidence", (context) => {
  const fixture = fixtureFor(context);
  git(fixture.repo, "branch", "codex/dev/20260731-alice-governance-branch-contract", "origin/main");
  const blocked = runPlan(fixture).plan;
  assert(blockerCodes(blocked).includes("branch_collision"));
  const resumePath = join(fixture.root, "blocked-plan.json");
  writeFileSync(resumePath, JSON.stringify(blocked));

  const { result, plan } = runPlan(fixture, { resume_plan: resumePath });
  assert.equal(result.status, 2);
  assert(blockerCodes(plan).includes("resume_evidence_invalid"));
  assert.equal(plan.resume.decision, "blocked");
});

test("blocks a resumed branch that does not descend from the saved base", (context) => {
  const fixture = fixtureFor(context);
  const initial = runPlan(fixture).plan;
  const tree = git(fixture.repo, "rev-parse", "HEAD^{tree}");
  const unrelated = git(fixture.repo, "commit-tree", tree, "-m", "unrelated root");
  git(fixture.repo, "branch", initial.branch.target, unrelated);
  const resumePath = join(fixture.root, "resume-plan.json");
  writeFileSync(resumePath, JSON.stringify(initial));

  const { result, plan } = runPlan(fixture, { resume_plan: resumePath });
  assert.equal(result.status, 2);
  assert(blockerCodes(plan).includes("resume_branch_wrong_base"));
  assert.equal(plan.resume.decision, "blocked");
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

test("blocks when the current linked checkout status is unavailable", (context) => {
  const fixture = fixtureFor(context);
  git(fixture.repo, "worktree", "add", "-b", "inspection", fixture.worktree, "origin/main");
  const indexPath = resolve(fixture.worktree, git(fixture.worktree, "rev-parse", "--git-path", "index"));
  writeFileSync(indexPath, "corrupt-index\n");

  const { result, plan } = runPlan(fixture, {
    repo_path: fixture.worktree,
    worktree: join(fixture.root, "planned-worktree")
  });
  assert.equal(result.status, 2);
  assert(blockerCodes(plan).includes("current_checkout_status_unavailable"));
  assert.equal(plan.worktree.current_checkout.status_available, false);
  assert.equal(plan.worktree.current_checkout.status_reason, "git_status_failed");
  assert.equal(plan.worktree.canonical_checkout.status_available, true);
});

test("blocks direct use of a protected checkout as the contribution worktree", (context) => {
  const fixture = fixtureFor(context);
  const { result, plan } = runPlan(fixture, { worktree: fixture.repo });
  assert.equal(result.status, 2);
  assert(blockerCodes(plan).includes("protected_checkout_write"));
});

test("blocks a nonexistent worktree nested under the canonical checkout", (context) => {
  const fixture = fixtureFor(context);
  const nestedWorktree = join(fixture.repo, "nested", "planned-worktree");
  const { result, plan } = runPlan(fixture, { worktree: nestedWorktree });
  assert.equal(result.status, 2);
  assert(blockerCodes(plan).includes("canonical_checkout_write"));
  assert.equal(plan.worktree.isolated, false);
  assert.equal(existsSync(nestedWorktree), false);

  const canonicalAlias = join(fixture.root, "canonical-alias");
  const nestedThroughAlias = join(canonicalAlias, "missing", "planned-worktree");
  symlinkSync(fixture.repo, canonicalAlias, "dir");
  const aliased = runPlan(fixture, { worktree: nestedThroughAlias }).plan;
  assert(blockerCodes(aliased).includes("canonical_checkout_write"));
  assert.equal(aliased.worktree.isolated, false);
  assert.equal(existsSync(nestedThroughAlias), false);
});

test("blocks a requested path nested under any registered contribution worktree", (context) => {
  const fixture = fixtureFor(context);
  const outer = join(fixture.root, "outer-worktree");
  git(fixture.repo, "worktree", "add", "-b", "outer-contribution", outer, "origin/main");
  const nested = join(outer, "nested-worktree");

  const { result, plan } = runPlan(fixture, { worktree: nested });
  assert.equal(result.status, 2);
  assert(blockerCodes(plan).includes("registered_worktree_descendant"));
  assert.equal(plan.worktree.isolated, false);
  assert.equal(existsSync(nested), false);
  assert.equal(git(outer, "status", "--porcelain=v1", "--untracked-files=all"), "");
});

test("treats a dangling symlink at the requested worktree path as occupied", (context) => {
  const fixture = fixtureFor(context);
  symlinkSync(join(fixture.root, "missing-target"), fixture.worktree, "dir");

  const { result, plan } = runPlan(fixture);
  assert.equal(result.status, 2);
  assert(blockerCodes(plan).includes("worktree_collision"));
  assert.equal(plan.next_write_action, "blocked");
  assert.equal(existsSync(fixture.worktree), false);

  const fileAncestor = join(fixture.root, "regular-file");
  writeFileSync(fileAncestor, "occupied\n");
  const belowFile = runPlan(fixture, { worktree: join(fileAncestor, "child") }).plan;
  assert(blockerCodes(belowFile).includes("worktree_collision"));

  const danglingAncestor = join(fixture.root, "dangling-ancestor");
  symlinkSync(join(fixture.root, "missing-directory"), danglingAncestor, "dir");
  const belowDangling = runPlan(fixture, { worktree: join(danglingAncestor, "child") }).plan;
  assert(blockerCodes(belowDangling).includes("worktree_collision"));
});

test("accepts exact GitHub HTTPS, SSH, and scp-like origins and rejects lookalike hosts", (context) => {
  const fixture = fixtureFor(context);
  const accepted = [
    "https://github.com/MetaInFLow/EvoZeus.git",
    "ssh://git@github.com/MetaInFLow/EvoZeus.git",
    "git@github.com:MetaInFLow/EvoZeus.git"
  ];
  for (const origin of accepted) {
    git(fixture.repo, "remote", "set-url", "origin", origin);
    assert.deepEqual(runPlan(fixture).plan.blockers, [], origin);
  }

  const rejected = [
    "https://evilgithub.com/MetaInFLow/EvoZeus.git",
    "https://notgithub.com/github.com/MetaInFLow/EvoZeus.git",
    "git@evilgithub.com:MetaInFLow/EvoZeus.git"
  ];
  for (const origin of rejected) {
    git(fixture.repo, "remote", "set-url", "origin", origin);
    assert(blockerCodes(runPlan(fixture).plan).includes("missing_origin_identity"), origin);
  }
});

test("validates every effective origin push URL after Git rewrites", (context) => {
  const explicitPush = createFixture();
  const rewrittenPush = createFixture();
  context.after(() => rmSync(explicitPush.root, { recursive: true, force: true }));
  context.after(() => rmSync(rewrittenPush.root, { recursive: true, force: true }));

  git(explicitPush.repo, "remote", "set-url", "--add", "--push", "origin", "https://github.com/MetaInFLow/EvoZeus.git");
  git(explicitPush.repo, "remote", "set-url", "--add", "--push", "origin", "https://evilgithub.com/MetaInFLow/EvoZeus.git");
  const explicitPlan = runPlan(explicitPush).plan;
  assert(blockerCodes(explicitPlan).includes("missing_origin_push_identity"));

  git(rewrittenPush.repo, "config", "url.https://evilgithub.com/.insteadOf", "https://github.com/");
  const rewrittenPlan = runPlan(rewrittenPush).plan;
  assert(blockerCodes(rewrittenPlan).includes("missing_origin_push_identity"));
});

test("uses live origin target state and blocks local divergence or unavailable evidence", (context) => {
  const target = "codex/dev/20260731-alice-governance-branch-contract";
  const liveFixture = createFixture();
  const staleFixture = createFixture();
  const divergedFixture = createFixture();
  const unavailableFixture = createFixture();
  const staleBaseFixture = createFixture();
  const fixtures = [liveFixture, staleFixture, divergedFixture, unavailableFixture, staleBaseFixture];
  context.after(() => fixtures.forEach(({ root }) => rmSync(root, { recursive: true, force: true })));

  const liveCommit = git(liveFixture.repo, "rev-parse", "HEAD");
  const live = runPlan(liveFixture, { git_remote: { heads: { [target]: liveCommit } } }).plan;
  assert(blockerCodes(live).includes("branch_collision"));

  git(staleFixture.repo, "update-ref", `refs/remotes/origin/${target}`, "HEAD");
  const stale = runPlan(staleFixture).plan;
  assert.deepEqual(stale.blockers, []);

  git(divergedFixture.repo, "branch", target, "origin/main");
  const diverged = runPlan(divergedFixture, {
    git_remote: { heads: { [target]: "f".repeat(40) } }
  }).plan;
  assert(blockerCodes(diverged).includes("target_branch_remote_mismatch"));

  const unavailable = runPlan(unavailableFixture, { git_remote: { unavailable: true } }).plan;
  assert(blockerCodes(unavailable).includes("target_remote_status_unavailable"));
  assert(blockerCodes(unavailable).includes("base_remote_status_unavailable"));

  const staleBase = runPlan(staleBaseFixture, {
    git_remote: { heads: { main: "e".repeat(40) } }
  }).plan;
  assert(blockerCodes(staleBase).includes("base_remote_mismatch"));
  assert.equal(staleBase.base.remote_commit, "e".repeat(40));
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
  git(fixture.repo, "branch", "codex/dev/20260731-alice-governance-branch-contract", "origin/main");
  const { result, plan } = runPlan(fixture);
  assert.equal(result.status, 2);
  assert(blockerCodes(plan).includes("branch_collision"));
});

test("binds the resume key to the full purpose including type", (context) => {
  const fixtures = [createFixture(), createFixture()];
  context.after(() => fixtures.forEach(({ root }) => rmSync(root, { recursive: true, force: true })));
  const development = runPlan(fixtures[0]).plan;
  const bug = runPlan(fixtures[1], { type: "bug" }).plan;

  assert.notEqual(development.branch.target, bug.branch.target);
  assert.notEqual(development.resume.key, bug.resume.key);
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

test("allows explicit Owner reconfirmation only for a matching stale resume plan", (context) => {
  const fixture = fixtureFor(context);
  const initial = runPlan(fixture).plan;
  git(fixture.repo, "branch", initial.branch.target, "origin/main");
  initial.ownership.checked_at = "2026-06-01T00:00:00.000Z";
  const resumePath = join(fixture.root, "stale-plan.json");
  writeFileSync(resumePath, JSON.stringify(initial));

  const refreshed = runPlan(fixture, { resume_plan: resumePath, reconfirm_owner: true }).plan;
  assert.deepEqual(refreshed.blockers, []);
  assert.equal(refreshed.resume.decision, "resume");
  assert.equal(refreshed.resume.owner_reconfirmed, true);
  assert.equal(refreshed.ownership.checked_at, FIXED_NOW);

  initial.actor.id = "mallory";
  writeFileSync(resumePath, JSON.stringify(initial));
  const mismatched = runPlan(fixture, { resume_plan: resumePath, reconfirm_owner: true }).plan;
  assert(blockerCodes(mismatched).includes("stale_ownership"));
  assert.equal(mismatched.resume.owner_reconfirmed, false);
});

test("selects deterministic fork-only and local-patch fallbacks", (context) => {
  const forkFixture = createFixture();
  const localFixture = createFixture();
  context.after(() => rmSync(forkFixture.root, { recursive: true, force: true }));
  context.after(() => rmSync(localFixture.root, { recursive: true, force: true }));
  git(forkFixture.repo, "remote", "add", "alice", "https://github.com/alice/EvoZeus.git");

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

test("GitHub unavailability resolves permission to local and blocks unverified Issue execution", (context) => {
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
  assert(blockerCodes(local).includes("issue_evidence_unavailable"));
  assert.equal(local.permission_path.push_allowed, false);
  assert.equal(local.permission_path.pull_request_allowed, false);
});

test("requires a live open Issue and Skill-feedback classification for CoEvolve", (context) => {
  const fixtures = Array.from({ length: 7 }, () => createFixture());
  context.after(() => fixtures.forEach(({ root }) => rmSync(root, { recursive: true, force: true })));

  const unavailable = runPlan(fixtures[0], { github: { issueUnavailable: true } }).plan;
  assert(blockerCodes(unavailable).includes("issue_evidence_unavailable"));

  const closed = runPlan(fixtures[1], {
    github: { issue: { number: 44, state: "closed", title: "Contributor branch contract", labels: [] } }
  }).plan;
  assert(blockerCodes(closed).includes("issue_not_open"));

  const pullRequest = runPlan(fixtures[2], {
    github: { issue: { number: 44, state: "open", title: "PR-shaped entity", labels: [], pull_request: {} } }
  }).plan;
  assert(blockerCodes(pullRequest).includes("issue_is_pull_request"));

  const mismatched = runPlan(fixtures[3], {
    github: { issue: { number: 45, state: "open", title: "Different Issue", labels: [] } }
  }).plan;
  assert(blockerCodes(mismatched).includes("issue_evidence_mismatch"));

  const notFeedback = runPlan(fixtures[4], { profile: "coevolve_target_skillware_consumer" }).plan;
  assert(blockerCodes(notFeedback).includes("issue_not_feedback"));

  const labelFeedback = runPlan(fixtures[5], {
    profile: "coevolve_target_skillware_consumer",
    github: {
      issue: { number: 44, state: "open", title: "Reusable defect", labels: [{ name: "skill-feedback" }] }
    }
  }).plan;
  assert.deepEqual(labelFeedback.blockers, []);
  assert.deepEqual(labelFeedback.issue_evidence.labels, ["skill-feedback"]);

  const titleFeedback = runPlan(fixtures[6], {
    profile: "coevolve_target_skillware_consumer",
    github: { issue: { number: 44, state: "open", title: "[Skill Feedback] Reusable defect", labels: [] } }
  }).plan;
  assert.deepEqual(titleFeedback.blockers, []);
});

test("partial GitHub evidence always fails closed to local", (context) => {
  const cases = [
    { label: "missing identity", github: { identityUnavailable: true } },
    { label: "missing permission", github: { permissionUnavailable: true } },
    { label: "missing fork policy for WRITE", github: { repositoryUnavailable: true } },
    {
      label: "missing fork policy for READ",
      github: { viewerPermission: "READ", repositoryUnavailable: true },
      values: { profile: "community_contribution", type: "docs", component: "docs", permission: "fork" }
    },
    {
      label: "identity evidence only",
      github: { permissionUnavailable: true, repositoryUnavailable: true }
    },
    {
      label: "permission evidence only",
      github: { identityUnavailable: true, repositoryUnavailable: true }
    },
    {
      label: "fork-policy evidence only",
      github: { identityUnavailable: true, permissionUnavailable: true }
    }
  ];
  const fixtures = cases.map(() => createFixture());
  context.after(() => fixtures.forEach(({ root }) => rmSync(root, { recursive: true, force: true })));

  for (const [index, scenario] of cases.entries()) {
    const plan = runPlan(fixtures[index], { ...scenario.values, github: scenario.github }).plan;
    assert.equal(plan.permission_evidence.source, "github_api_partial", scenario.label);
    assert.equal(plan.permission_path.resolved, "local", scenario.label);
    assert(blockerCodes(plan).includes("permission_expectation_mismatch"), scenario.label);
  }
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

test("bounds the generated branch leaf below filesystem component limits", (context) => {
  const fixture = fixtureFor(context);
  const component = "a".repeat(240);
  const { result, plan } = runPlan(fixture, {
    profile: "community_contribution",
    component,
  });
  assert.equal(result.status, 2);
  assert(blockerCodes(plan).includes("branch_component_too_long"));
  assert(Buffer.byteLength(plan.branch.target.split("/").at(-1), "utf8") > 240);
});
