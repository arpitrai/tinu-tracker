#!/usr/bin/env bash
# Publish an over-the-air (EAS Update) release, but only if it is safe to.
#
#   scripts/release-ota.sh "What changed"      # publish
#   scripts/release-ota.sh --dry-run "..."     # every check, no publish
#
# Refuses to publish unless:
#   1. the working tree is clean and HEAD is pushed (the update is exactly
#      what's on GitHub),
#   2. the Jest suite passes,
#   3. the typecheck passes,
#   4. the update's runtime matches a store build on that platform. An update
#      for a runtime no installed build has reaches nobody, silently.
#
# On (4): eas.json and package.json scripts are inputs to the fingerprint, so
# editing them after a store build shifts the runtime even though no native
# code changed. When the only difference is eas.json, the script publishes
# with the build's own eas.json swapped in (it doesn't affect the JS bundle)
# and restores it afterwards. Any other difference is a real native change
# and that platform is skipped: it needs a store build, not an OTA update.
#
# Deliberately not an npm script: package.json scripts feed the fingerprint.
set -euo pipefail

cd "$(dirname "$0")/.."

DRY_RUN=0
if [[ "${1:-}" == "--dry-run" ]]; then DRY_RUN=1; shift; fi
MESSAGE="${1:-$(git log -1 --pretty=%s)}"
BRANCH=production

fail() { echo "✗ $*" >&2; exit 1; }
step() { echo "→ $*"; }

# Always put eas.json back, however the script exits.
EAS_BACKUP="$(mktemp)"
cp eas.json "$EAS_BACKUP"
trap 'cp "$EAS_BACKUP" eas.json; rm -f "$EAS_BACKUP"' EXIT

step "Checking the working tree"
[[ -z "$(git status --porcelain)" ]] || fail "Uncommitted changes. Commit them first so the update matches git."
git fetch -q origin
git merge-base --is-ancestor HEAD "origin/$(git rev-parse --abbrev-ref HEAD)" \
  || fail "HEAD isn't pushed. Push first so the update matches GitHub."

step "Running tests"
npx jest --ci --silent >/dev/null 2>&1 || fail "Tests failed. Run 'npm test' to see why."

step "Typechecking"
npx tsc --noEmit >/dev/null || fail "Typecheck failed. Run 'npx tsc --noEmit' to see why."

# Computed the way EAS computes it for builds and updates: with the production
# environment's variables loaded. `expo-updates runtimeversion:resolve` skips
# those and can report a different runtime than the build actually has.
local_runtime() {
  eas fingerprint:generate --platform "$1" --environment production --json --non-interactive 2>/dev/null \
    | sed -n '/^{/,$p' \
    | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).hash))'
}

latest_build() { # prints "<runtime> <commit> <build number>" for the newest finished production build
  eas build:list --platform "$1" --status finished --buildProfile production --limit 1 --json --non-interactive 2>/dev/null \
    | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const b=JSON.parse(s)[0]; if(b) console.log(b.runtimeVersion, b.gitCommitHash, b.appBuildVersion)})'
}

published=0
for platform in android ios; do
  step "[$platform] Matching against the latest store build"
  read -r build_runtime build_commit build_number <<<"$(latest_build "$platform")" || true
  [[ -n "${build_runtime:-}" ]] || { echo "  no finished production build, skipping"; continue; }

  cp "$EAS_BACKUP" eas.json
  runtime="$(local_runtime "$platform")"
  how="as-is"
  if [[ "$runtime" != "$build_runtime" ]]; then
    git show "$build_commit:eas.json" > eas.json
    runtime="$(local_runtime "$platform")"
    how="with build $build_number's eas.json"
  fi
  if [[ "$runtime" != "$build_runtime" ]]; then
    cp "$EAS_BACKUP" eas.json
    echo "  ✗ skipping: native changes since build $build_number (runtime $build_runtime)."
    echo "    This platform needs a new store build to get these changes."
    continue
  fi
  echo "  ✓ matches build $build_number ($build_runtime) $how"

  if [[ $DRY_RUN -eq 1 ]]; then
    echo "  (dry run: would publish to $BRANCH)"
  else
    step "[$platform] Publishing"
    eas update --branch "$BRANCH" --platform "$platform" --environment production \
      --message "$MESSAGE" --non-interactive 2>&1 | grep -E "Runtime version|Update group ID|Published" || fail "eas update failed"
  fi
  published=$((published + 1))
  cp "$EAS_BACKUP" eas.json
done

[[ $published -gt 0 ]] || fail "No platform had a matching store build. Nothing was published."
[[ $DRY_RUN -eq 1 ]] && echo "✓ Dry run passed: $published platform(s) ready." || echo "✓ Published to $published platform(s)."
