#!/usr/bin/env bash
#
# render-doc.sh — thin wrapper around render-doc.mjs.
# Renders a Markdown file (or every .md under a directory) to sibling .html.
#
#   .workflow/bin/render-doc.sh <file.md | dir>
#
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
exec node "$REPO_ROOT/.workflow/bin/render-doc.mjs" "$@"
