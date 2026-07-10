#!/usr/bin/env bash
#
# gh-review-as-bot.sh — post a PR review from a .review-result.json produced by the
# review-pr skill. This is the ONLY sanctioned way to post a review; skills must not
# call `gh pr review` directly, so that posting rules live in exactly one place.
#
# Usage:
#   .workflow/bin/gh-review-as-bot.sh <repo> <pr-number> [result-json]
#
#   result-json defaults to .review-result.json
#
# Expected result JSON shape:
#   { "verdict": "APPROVE" | "REQUEST_CHANGES", "body": "<markdown review body>" }
#
# Identity / self-review limitation:
#   GitHub forbids the PR author from submitting a formal APPROVE / REQUEST_CHANGES
#   review on their own PR. So:
#     - If BOT_TOKEN is set (a PAT for a SEPARATE account / a bot), we post a formal
#       review as that identity (approve / request-changes).
#     - Otherwise we fall back to posting the verdict + body as a normal PR COMMENT,
#       which works even on your own PR. The verdict is still machine-readable in the
#       comment header so the lead-issue PM can act on it.
#   To get true bot-authored formal reviews, create a bot account (or use a GitHub App
#   installation token) and export BOT_TOKEN before calling this script.
#
set -euo pipefail

REPO="${1:?usage: gh-review-as-bot.sh <repo> <pr> [result-json]}"
PR="${2:?usage: gh-review-as-bot.sh <repo> <pr> [result-json]}"
RESULT="${3:-.review-result.json}"

if [[ ! -f "$RESULT" ]]; then
  echo "gh-review-as-bot: result file not found: $RESULT" >&2
  exit 2
fi

VERDICT="$(jq -r '.verdict // "REQUEST_CHANGES"' "$RESULT")"
BODY="$(jq -r '.body // ""' "$RESULT")"

if [[ -z "$BODY" ]]; then
  echo "gh-review-as-bot: empty review body in $RESULT" >&2
  exit 2
fi

post_formal() {
  local event
  case "$VERDICT" in
    APPROVE)          event="--approve";;
    REQUEST_CHANGES)  event="--request-changes";;
    *)                event="--comment";;
  esac
  gh pr review "$PR" --repo "$REPO" $event --body "$BODY"
}

post_comment_fallback() {
  # Prepend a machine-readable verdict header so the PM can parse it.
  local header="<!-- review-pr verdict: $VERDICT -->"
  gh pr comment "$PR" --repo "$REPO" --body "$header

$BODY"
}

if [[ -n "${BOT_TOKEN:-}" ]]; then
  echo "gh-review-as-bot: posting formal $VERDICT review as BOT_TOKEN identity" >&2
  GH_TOKEN="$BOT_TOKEN" post_formal
else
  echo "gh-review-as-bot: no BOT_TOKEN — posting $VERDICT as a PR comment (self-review is blocked by GitHub)" >&2
  post_comment_fallback
fi

echo "gh-review-as-bot: posted $VERDICT to $REPO#$PR" >&2
