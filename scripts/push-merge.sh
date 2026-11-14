#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo 'Usage: stage the intended files, then run ./scripts/push-merge.sh "commit message"' >&2
  exit 2
}

[[ $# -eq 1 && -n "$1" ]] || usage
commit_message=$1
repo_root=$(git rev-parse --show-toplevel)
cd "$repo_root"

branch=$(git branch --show-current)
if [[ -z "$branch" ]]; then
  echo 'Error: detached HEAD; switch to a branch before publishing.' >&2
  exit 1
fi

gh auth status >/dev/null
git fetch origin main

if [[ "$branch" == 'main' ]]; then
  if git diff --cached --quiet; then
    echo 'Error: stage the intended changes before publishing.' >&2
    exit 1
  fi

  slug=$(printf '%s' "$commit_message" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-|-$//g' | cut -c1-36)
  branch="codex/${slug}-$(date -u +%Y%m%d%H%M%S)"
  git switch -c "$branch"
fi

git diff --cached --check
if git diff --cached --quiet; then
  ahead=$(git rev-list --count origin/main..HEAD)
  if [[ "$ahead" == '0' ]]; then
    echo 'Error: nothing is staged and this branch has no commits ahead of origin/main.' >&2
    exit 1
  fi
  echo "Resuming existing branch with $ahead commit(s) ahead of origin/main."
else
  git commit -m "$commit_message"
fi

ahead=$(git rev-list --count origin/main..HEAD)
if [[ "$ahead" == '0' ]]; then
  echo 'Error: this branch has no commits ahead of origin/main.' >&2
  exit 1
fi

if ! git merge-base --is-ancestor origin/main HEAD; then
  git rebase origin/main
fi

if git rev-parse --abbrev-ref --symbolic-full-name '@{u}' >/dev/null 2>&1; then
  git push --force-with-lease origin "$branch"
else
  git push --set-upstream origin "$branch"
fi

if pr_number=$(gh pr view "$branch" --json number --jq .number 2>/dev/null); then
  echo "Using existing PR #$pr_number."
else
  body_file=$(mktemp)
  trap 'rm -f "$body_file"' EXIT
  cat > "$body_file" <<'EOF'
Automated local changes. This workflow merges immediately without waiting for CI; check the GitHub Actions result after the merge and repair any failures in a follow-up change.
EOF
  gh pr create --base main --head "$branch" --title "$commit_message" --body-file "$body_file"
  pr_number=$(gh pr view "$branch" --json number --jq .number)
fi

review_decision=$(gh pr view "$pr_number" --json reviewDecision --jq .reviewDecision)
if [[ "$review_decision" == 'REVIEW_REQUIRED' || "$review_decision" == 'CHANGES_REQUESTED' ]]; then
  echo "Error: PR #$pr_number requires review ($review_decision); refusing to bypass it." >&2
  exit 1
fi

gh pr merge "$pr_number" --squash --admin
git fetch origin main
git switch main
git pull --ff-only origin main

echo "Merged PR #$pr_number into main without waiting for CI."
if ! gh pr checks "$pr_number"; then
  echo 'CI is still pending or has failed. Review the PR checks and repair in a follow-up change.'
fi
