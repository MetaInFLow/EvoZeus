#!/bin/sh

# This gate is copied inline by the public install instruction. It must run
# before any checker or product asset GET. It performs no filesystem writes.

set -u

SCHEMA_VERSION="evozeus.install-preflight.v1"
if [ -n "${EVOZEUS_HOME:-}" ]; then
  HOME_ROOT="${EVOZEUS_HOME}"
elif [ -n "${HOME:-}" ]; then
  HOME_ROOT="${HOME}/.evozeus"
else
  HOME_ROOT=""
fi
TEMP_ROOT="${TMPDIR:-/tmp}"
MIN_AVAILABLE_KB=524288
HEAD_URL="${EVOZEUS_PREFLIGHT_HEAD_URL:-https://github.com/MetaInFLow/EvoZeus/releases/latest}"
HEAD_REQUESTS=0
LOCAL_PATH_UNSAFE=0

checked_at() {
  /bin/date -u "+%Y-%m-%dT%H:%M:%SZ"
}

path_present() {
  [ -e "$1" ] || [ -L "$1" ]
}

home_has_entries() {
  [ -d "${HOME_ROOT}" ] || return 1
  for entry in "${HOME_ROOT}"/* "${HOME_ROOT}"/.[!.]* "${HOME_ROOT}"/..?*; do
    path_present "${entry}" && return 0
  done
  return 1
}

preliminary_state() {
  if [ "${LOCAL_PATH_UNSAFE}" -eq 1 ]; then
    printf '%s' "unknown_or_unverifiable"
    return
  fi
  if [ -z "${HOME_ROOT}" ]; then
    printf '%s' "unknown_or_unverifiable"
    return
  fi
  if path_present "${HOME_ROOT}/bin/evozeus"; then
    printf '%s' "unknown_or_unverifiable"
  elif home_has_entries; then
    printf '%s' "unknown_or_unverifiable"
  else
    printf '%s' "not_installed"
  fi
}

state_evidence() {
  if [ "${LOCAL_PATH_UNSAFE}" -eq 1 ]; then
    printf '%s' "evozeus_home_path_unsafe"
    return
  fi
  if [ -z "${HOME_ROOT}" ]; then
    printf '%s' "home_environment_unavailable"
    return
  fi
  if path_present "${HOME_ROOT}/bin/evozeus"; then
    printf '%s' "local_cli_present_full_state_deferred"
  elif home_has_entries; then
    printf '%s' "local_markers_present_full_state_deferred"
  else
    printf '%s' "no_local_install_markers"
  fi
}

emit_blocked() {
  check_id="$1"
  code="$2"
  message="$3"
  action="$4"
  check_kind="${5:-dependency}"
  check_phase="${6:-checker_acquisition}"
  printf '%s\n' "{\"ok\":true,\"operation\":\"system.installPreflight\",\"schema_version\":\"${SCHEMA_VERSION}\",\"stage\":\"pre_fetch\",\"checked_at\":\"$(checked_at)\",\"writes\":false,\"status\":\"blocked\",\"executor\":{\"kind\":\"inline_pre_fetch_gate\",\"product_asset\":false,\"checksum_required\":false,\"acquisition_requires_network\":false},\"network\":{\"head_requests\":${HEAD_REQUESTS},\"asset_get_count\":0,\"payloads_saved\":0,\"product_assets_downloaded\":0},\"local_state\":{\"status\":\"$(preliminary_state)\",\"preliminary\":true,\"evidence\":[\"$(state_evidence)\"]},\"checks\":[{\"id\":\"${check_id}\",\"kind\":\"${check_kind}\",\"requirement\":\"required\",\"required\":true,\"phase\":[\"${check_phase}\"],\"status\":\"fail\",\"detected\":null,\"minimum_version\":null,\"alternatives\":[],\"remediation\":\"${action}\"}],\"fallbacks\":[],\"blockers\":[{\"check_id\":\"${check_id}\",\"code\":\"${code}\",\"message\":\"${message}\"}],\"remediation\":[{\"check_id\":\"${check_id}\",\"action\":\"${action}\"}],\"next_action\":{\"action\":\"stop_before_asset_get\",\"allowed\":false,\"writes_now\":false,\"product_asset_download_now\":false,\"registration_now\":false,\"approval_required\":false}}"
  exit 2
}

emit_unsafe_home_path() {
  LOCAL_PATH_UNSAFE=1
  emit_blocked "local_state" "LOCAL_STATE_PATH_UNSAFE" "EVOZEUS_HOME must be an absolute path whose existing components are real directories." "Use an absolute EVOZEUS_HOME path without symlink or non-directory components." "local_state" "step_0_before_environment_or_network"
}

validate_home_path() {
  case "${HOME_ROOT}" in
    /*) ;;
    *) emit_unsafe_home_path ;;
  esac

  remaining=${HOME_ROOT#/}
  current=""
  ancestor_missing=0
  while [ -n "${remaining}" ]; do
    case "${remaining}" in
      */*)
        component=${remaining%%/*}
        remaining=${remaining#*/}
        ;;
      *)
        component=${remaining}
        remaining=""
        ;;
    esac
    [ -n "${component}" ] || continue
    case "${component}" in
      .|..) emit_unsafe_home_path ;;
    esac
    current="${current}/${component}"
    [ "${ancestor_missing}" -eq 1 ] && continue
    [ -L "${current}" ] && emit_unsafe_home_path
    if [ -e "${current}" ]; then
      [ -d "${current}" ] || emit_unsafe_home_path
    else
      ancestor_missing=1
    fi
  done
}

available_kb() {
  set -- $(df -Pk "$1" 2>/dev/null) || return 1
  while [ "$#" -gt 6 ]; do
    shift
  done
  [ "$#" -eq 6 ] || return 1
  printf '%s' "$4"
}

[ -n "${HOME_ROOT}" ] || emit_blocked "home" "HOME_UNSET" "HOME and EVOZEUS_HOME are both unset." "Set HOME or EVOZEUS_HOME, then rerun the pre-fetch gate."
validate_home_path

if home_has_entries; then
  emit_blocked "local_state" "EXISTING_INSTALL_REQUIRES_LOCAL_STATE_CHECK" "Existing EvoZeus state must be classified before checker acquisition." "Run the installed CLI version and Doctor checks with automatic refresh disabled; use the state-specific route." "local_state" "step_0_before_environment_or_network"
fi

target_parent="${HOME_ROOT%/*}"
[ -n "${target_parent}" ] || target_parent="/"
while [ ! -e "${target_parent}" ] && [ "${target_parent}" != "/" ]; do
  target_parent="${target_parent%/*}"
  [ -n "${target_parent}" ] || target_parent="/"
done

command -v node >/dev/null 2>&1 || emit_blocked "node" "NODE_MISSING" "Node.js is required before the checker can run." "Install Node.js 18.17.0 or newer, then rerun the pre-fetch gate."

node_version=$(node --version 2>/dev/null || true)
node_core=${node_version#v}
old_ifs=${IFS}
IFS=.
set -- ${node_core}
IFS=${old_ifs}
node_major=${1:-}
node_minor=${2:-}
node_patch=${3:-}
case "${node_major}:${node_minor}:${node_patch}" in
  *[!0-9:]*|:*|*::*|*:) emit_blocked "node" "NODE_VERSION_UNKNOWN" "The Node.js version could not be verified." "Install Node.js 18.17.0 or newer, then rerun the pre-fetch gate." ;;
esac
if [ "${node_major}" -lt 18 ] || { [ "${node_major}" -eq 18 ] && [ "${node_minor}" -lt 17 ]; }; then
  emit_blocked "node" "NODE_TOO_OLD" "Node.js 18.17.0 or newer is required." "Upgrade Node.js to 18.17.0 or newer, then rerun the pre-fetch gate."
fi

command -v python3 >/dev/null 2>&1 || emit_blocked "python" "PYTHON_MISSING" "Python is required by the current Stable product before checker acquisition." "Install Python 3.11.0 or newer, then rerun the pre-fetch gate."

python_version=$(python3 --version 2>/dev/null || true)
python_core=${python_version#Python }
old_ifs=${IFS}
IFS=.
set -- ${python_core}
IFS=${old_ifs}
python_major=${1:-}
python_minor=${2:-}
python_patch=${3:-}
case "${python_major}:${python_minor}:${python_patch}" in
  *[!0-9:]*|:*|*::*|*:) emit_blocked "python" "PYTHON_VERSION_UNKNOWN" "The Python version could not be verified." "Install Python 3.11.0 or newer, then rerun the pre-fetch gate." ;;
esac
if [ "${python_major}" -lt 3 ] || { [ "${python_major}" -eq 3 ] && [ "${python_minor}" -lt 11 ]; }; then
  emit_blocked "python" "PYTHON_TOO_OLD" "Python 3.11.0 or newer is required by the current Stable product." "Upgrade Python to 3.11.0 or newer, then rerun the pre-fetch gate."
fi

if command -v gh >/dev/null 2>&1; then
  download_tool="gh"
elif command -v curl >/dev/null 2>&1; then
  download_tool="curl"
else
  emit_blocked "download_tool" "DOWNLOAD_TOOL_MISSING" "Either gh or curl is required before any checker asset GET." "Install GitHub CLI or curl, then rerun the pre-fetch gate."
fi

if command -v shasum >/dev/null 2>&1; then
  checksum_tool="shasum"
elif command -v sha256sum >/dev/null 2>&1; then
  checksum_tool="sha256sum"
else
  emit_blocked "checksum_tool" "CHECKSUM_TOOL_MISSING" "A SHA-256 verifier is required before any checker asset GET." "Install shasum or sha256sum, then rerun the pre-fetch gate."
fi

command -v tar >/dev/null 2>&1 || emit_blocked "tar" "TAR_MISSING" "tar is required for the later verified product archive." "Install tar, then rerun the pre-fetch gate."

if command -v codex >/dev/null 2>&1; then
  agent_host="codex"
elif command -v claude >/dev/null 2>&1; then
  agent_host="claude"
else
  emit_blocked "agent_host" "AGENT_HOST_MISSING" "No supported Codex or Claude Code host was detected." "Install or expose Codex or Claude Code on PATH, then rerun the pre-fetch gate."
fi

command -v uname >/dev/null 2>&1 || emit_blocked "os_arch" "UNAME_MISSING" "uname is required to identify the operating system and architecture." "Install uname, then rerun the pre-fetch gate."
os_name=$(uname -s 2>/dev/null || true)
arch_name=$(uname -m 2>/dev/null || true)
case "${os_name}" in
  Darwin|Linux) ;;
  *) emit_blocked "os_arch" "OS_UNSUPPORTED" "Only macOS and Linux are supported by this installer." "Use a supported macOS or Linux host." ;;
esac
case "${arch_name}" in
  x86_64|amd64|arm64|aarch64) ;;
  *) emit_blocked "os_arch" "ARCH_UNSUPPORTED" "The current CPU architecture is unsupported." "Use x86_64 or arm64 hardware." ;;
esac

[ -d "${TEMP_ROOT}" ] && [ -r "${TEMP_ROOT}" ] && [ -w "${TEMP_ROOT}" ] && [ -x "${TEMP_ROOT}" ] || emit_blocked "temp_access" "TEMP_ACCESS_BLOCKED" "The temporary directory is not accessible." "Restore read, write, and traversal access to the temporary directory."
[ -d "${target_parent}" ] && [ -r "${target_parent}" ] && [ -w "${target_parent}" ] && [ -x "${target_parent}" ] || emit_blocked "target_parent_access" "TARGET_PARENT_ACCESS_BLOCKED" "The EvoZeus target parent directory is not accessible." "Restore read, write, and traversal access to the EvoZeus target parent directory."

command -v df >/dev/null 2>&1 || emit_blocked "disk_space" "DF_MISSING" "df is required for the read-only disk-space check." "Install df, then rerun the pre-fetch gate."
temp_available=$(available_kb "${TEMP_ROOT}" || true)
target_available=$(available_kb "${target_parent}" || true)
case "${temp_available}:${target_available}" in
  *[!0-9:]*|:*) emit_blocked "disk_space" "DISK_SPACE_UNKNOWN" "Available disk space could not be verified." "Make df available and rerun the pre-fetch gate." ;;
esac
[ "${temp_available}" -ge "${MIN_AVAILABLE_KB}" ] && [ "${target_available}" -ge "${MIN_AVAILABLE_KB}" ] || emit_blocked "disk_space" "DISK_SPACE_LOW" "At least 512 MiB must be available in both temporary and target filesystems." "Free at least 512 MiB, then rerun the pre-fetch gate."

if [ "${download_tool}" = "curl" ]; then
  HEAD_REQUESTS=1
  curl -fsSI "${HEAD_URL}" >/dev/null 2>&1 || emit_blocked "github_network" "GITHUB_UNREACHABLE" "GitHub Release metadata is unreachable by HEAD." "Restore GitHub HTTPS access, then rerun the pre-fetch gate."
else
  HEAD_REQUESTS=1
  gh api -X HEAD repos/MetaInFLow/EvoZeus/releases/latest --silent >/dev/null 2>&1 || emit_blocked "github_network" "GITHUB_UNREACHABLE" "GitHub Release metadata is unreachable by HEAD." "Restore GitHub API access, then rerun the pre-fetch gate."
fi

fallbacks=""
gate_status="ready"
if [ "${download_tool}" = "curl" ]; then
  fallbacks="{\"check_id\":\"download_tool\",\"selected\":\"curl\",\"reason\":\"gh is unavailable; curl is the supported fallback.\"}"
  gate_status="ready_with_fallbacks"
fi

printf '%s\n' "{\"ok\":true,\"operation\":\"system.installPreflight\",\"schema_version\":\"${SCHEMA_VERSION}\",\"stage\":\"pre_fetch\",\"checked_at\":\"$(checked_at)\",\"writes\":false,\"status\":\"${gate_status}\",\"executor\":{\"kind\":\"inline_pre_fetch_gate\",\"product_asset\":false,\"checksum_required\":false,\"acquisition_requires_network\":false},\"network\":{\"head_requests\":${HEAD_REQUESTS},\"asset_get_count\":0,\"payloads_saved\":0,\"product_assets_downloaded\":0},\"local_state\":{\"status\":\"$(preliminary_state)\",\"preliminary\":true,\"evidence\":[\"$(state_evidence)\"]},\"checks\":[{\"id\":\"node\",\"kind\":\"dependency\",\"requirement\":\"required\",\"required\":true,\"phase\":[\"checker_execution\",\"product_install\"],\"status\":\"pass\",\"detected\":\"${node_version}\",\"minimum_version\":\"18.17.0\",\"alternatives\":[],\"remediation\":\"Install Node.js 18.17.0 or newer.\"},{\"id\":\"python\",\"kind\":\"dependency\",\"requirement\":\"conditional\",\"required\":true,\"phase\":[\"current_stable_runtime_and_doctor\",\"coevolve_smoke\"],\"status\":\"pass\",\"detected\":\"${python_core}\",\"minimum_version\":\"3.11.0\",\"alternatives\":[],\"remediation\":\"Install Python 3.11.0 or newer for the current Stable product.\"},{\"id\":\"download_tool\",\"kind\":\"dependency\",\"requirement\":\"required_one_of\",\"required\":true,\"phase\":[\"checker_acquisition\",\"product_download\"],\"status\":\"pass\",\"detected\":\"${download_tool}\",\"minimum_version\":null,\"alternatives\":[\"gh\",\"curl\"],\"remediation\":\"Install GitHub CLI or curl.\"},{\"id\":\"checksum_tool\",\"kind\":\"dependency\",\"requirement\":\"required_one_of\",\"required\":true,\"phase\":[\"checker_verification\",\"product_verification\"],\"status\":\"pass\",\"detected\":\"${checksum_tool}\",\"minimum_version\":null,\"alternatives\":[\"shasum\",\"sha256sum\"],\"remediation\":\"Install shasum or sha256sum.\"},{\"id\":\"agent_host\",\"kind\":\"environment\",\"requirement\":\"required_one_of\",\"required\":true,\"phase\":[\"plugin_registration\"],\"status\":\"pass\",\"detected\":\"${agent_host}\",\"minimum_version\":null,\"alternatives\":[\"codex\",\"claude\"],\"remediation\":\"Install Codex or Claude Code.\"},{\"id\":\"disk_space\",\"kind\":\"environment\",\"requirement\":\"required\",\"required\":true,\"phase\":[\"checker_acquisition\",\"product_install\"],\"status\":\"pass\",\"detected\":{\"temp_available_kb\":${temp_available},\"target_available_kb\":${target_available}},\"minimum_version\":null,\"alternatives\":[],\"remediation\":\"Free at least 512 MiB.\"},{\"id\":\"github_network\",\"kind\":\"network\",\"requirement\":\"required\",\"required\":true,\"phase\":[\"checker_acquisition\",\"release_resolution\"],\"status\":\"pass\",\"detected\":{\"method\":\"HEAD\",\"payload_saved\":false},\"minimum_version\":null,\"alternatives\":[],\"remediation\":\"Restore GitHub HTTPS access.\"}],\"fallbacks\":[${fallbacks}],\"blockers\":[],\"remediation\":[],\"next_action\":{\"action\":\"fetch_and_verify_minimal_checker\",\"allowed\":true,\"writes_now\":false,\"product_asset_download_now\":false,\"registration_now\":false,\"approval_required\":false}}"
