#!/usr/bin/env bash
#
# spawn-agent.sh — spawn a fresh, independent Codex process that follows a skill.
#
# This is the "fresh eyes" mechanism for the lead-issue workflow: the PM (Claude,
# in the main session) delegates reviewing/implementation to a SEPARATE process
# (Codex) that shares NO context with the PM. That independence is the whole point
# — it prevents the reviewer from anchoring on the PM's reasoning.
#
# Usage:
#   .workflow/bin/spawn-agent.sh --skill <name> [--args "<string>"] \
#       [--cd <dir>] [--model <model>] [--out <file>]
#
# Flags:
#   --skill   (required) skill directory under .claude/skills/<name>/SKILL.md
#   --args    free-form argument string appended to the prompt (e.g. a plan path,
#             or "<repo> <pr>"). Available to the skill as its "Arguments".
#   --cd      working root for the agent (default: current dir)
#   --model   Codex model override (default: Codex config default)
#   --out     file to receive the agent's final message
#             (default: .workflow/tmp/<skill>.last.md)
#
# Trust model: runs Codex with --dangerously-bypass-approvals-and-sandbox so it can
# use gh/git/npm without prompting. Run this only in a trusted local checkout — the
# same trust level as running Claude Code with permissions. Behavior is constrained
# by the skill instructions, not by the sandbox.
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

SKILL=""
ARGS=""
CD_DIR="$PWD"
MODEL=""
OUT=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skill) SKILL="$2"; shift 2;;
    --args)  ARGS="$2"; shift 2;;
    --cd)    CD_DIR="$2"; shift 2;;
    --model) MODEL="$2"; shift 2;;
    --out)   OUT="$2"; shift 2;;
    *) echo "spawn-agent: unknown flag: $1" >&2; exit 2;;
  esac
done

if [[ -z "$SKILL" ]]; then
  echo "spawn-agent: --skill is required" >&2
  exit 2
fi

SKILL_FILE="$REPO_ROOT/.claude/skills/$SKILL/SKILL.md"
if [[ ! -f "$SKILL_FILE" ]]; then
  echo "spawn-agent: skill not found: $SKILL_FILE" >&2
  exit 2
fi

if ! command -v codex >/dev/null 2>&1; then
  echo "spawn-agent: codex CLI not found on PATH" >&2
  exit 127
fi

mkdir -p "$REPO_ROOT/.workflow/tmp"
OUT="${OUT:-$REPO_ROOT/.workflow/tmp/$SKILL.last.md}"
LOG="$REPO_ROOT/.workflow/tmp/$SKILL.$(date +%s).log"

# Strip the YAML frontmatter (everything up to and including the second '---').
SKILL_BODY="$(awk 'BEGIN{f=0} /^---[[:space:]]*$/{f++; next} f>=2{print}' "$SKILL_FILE")"

# Static preamble via a quoted heredoc. Use `read -d ''` (not $(cat <<...)) because
# macOS bash 3.2 mis-parses here-docs nested inside command substitution. `read`
# returns non-zero at EOF, so guard with `|| true`.
PREAMBLE=""
read -r -d '' PREAMBLE <<'EOF' || true
You are a spawned, independent agent. You were launched as a SEPARATE process by an
orchestrator and you share NONE of its context. Your only inputs are the skill
instructions and arguments below. Judge everything on its own merits; do not assume
the orchestrator's conclusions are correct.

CRITICAL: Do NOT spawn further agents (do not call .workflow/bin/spawn-agent.sh). You
are a leaf process; spawning again would cause an infinite recursion.

Follow the skill instructions exactly. When finished, your FINAL message is the
deliverable the orchestrator reads: make it the complete, self-contained result the
skill asks for, not a chat reply.
EOF

PROMPT="$PREAMBLE

===== SKILL: $SKILL =====
$SKILL_BODY

===== ARGUMENTS =====
$ARGS"

echo "spawn-agent: skill=$SKILL cd=$CD_DIR out=$OUT" >&2
echo "spawn-agent: log=$LOG" >&2

set +e
codex exec \
  -C "$CD_DIR" \
  --skip-git-repo-check \
  --dangerously-bypass-approvals-and-sandbox \
  ${MODEL:+-m "$MODEL"} \
  -o "$OUT" \
  "$PROMPT" 2>&1 | tee "$LOG"
STATUS=${PIPESTATUS[0]}
set -e

if [[ $STATUS -ne 0 ]]; then
  echo "spawn-agent: codex exited with status $STATUS (see $LOG)" >&2
  exit $STATUS
fi

echo "spawn-agent: done. Final message written to $OUT" >&2
echo "$OUT"
