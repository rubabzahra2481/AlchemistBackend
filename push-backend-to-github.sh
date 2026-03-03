#!/bin/bash
# Push only this backend folder to AlchemistBackend repo.
# Usage: GITHUB_PAT=your_pat ./push-backend-to-github.sh
# Or run from repo root: GITHUB_PAT=xxx ./backend/push-backend-to-github.sh

set -e
REPO_URL="https://github.com/rubabzahra2481/AlchemistBackend.git"
BACKEND_SRC="$(cd "$(dirname "$0")" && pwd)"
WORK_TREE="/tmp/AlchemistBackend_push_$$"

if [ -z "$GITHUB_PAT" ]; then
  echo "Set GITHUB_PAT (e.g. export GITHUB_PAT=ghp_xxx) then run again."
  exit 1
fi

echo "Cloning AlchemistBackend..."
git clone --depth 1 "https://${GITHUB_PAT}@github.com/rubabzahra2481/AlchemistBackend.git" "$WORK_TREE"
cd "$WORK_TREE"

echo "Syncing backend (excluding node_modules, dist)..."
rsync -a --delete \
  --exclude='node_modules' \
  --exclude='dist' \
  --exclude='.git' \
  --exclude='coverage' \
  --exclude='*.log' \
  "$BACKEND_SRC/" .

echo "Git add and status..."
git add -A
git status

echo "Commit and push..."
git config user.email "push@local" 2>/dev/null || true
git config user.name "Push" 2>/dev/null || true
git diff --staged --quiet && echo "No changes to commit." || git commit -m "chore: sync backend from diAgent (Decision Intelligence always on)"
git push "https://${GITHUB_PAT}@github.com/rubabzahra2481/AlchemistBackend.git" main

rm -rf "$WORK_TREE"
echo "Done. Backend pushed to $REPO_URL"
