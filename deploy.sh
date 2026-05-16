#!/bin/bash
# Deploy Household Expense Tracker to AWS.
#
# Usage:
#   ./deploy.sh test                 # deploy to test (CloudFront URL)
#   ./deploy.sh prod                 # deploy to prod (expense.datastackai.academy)
#   ./deploy.sh test --diff-only     # cdk diff, no deploy

set -euo pipefail

ENV=${1:-test}
DIFF_ONLY=0
for arg in "$@"; do
    case "$arg" in
        --diff-only) DIFF_ONLY=1 ;;
    esac
done

if [[ "$ENV" != "test" && "$ENV" != "prod" ]]; then
    echo "Unknown environment: $ENV (expected 'test' or 'prod')" >&2
    exit 1
fi

STACK="ExpenseTrackerStack-$ENV"
echo "=== Deploying $STACK ==="

# --- 1. Build the frontend -------------------------------------------------
echo ""
echo "[1/3] Building frontend..."
cd frontend
npm run build -- --logLevel warn
cd ..

# Create dist-mutable with files that need no-cache headers
rm -rf dist-mutable
mkdir -p dist-mutable
cp frontend/dist/index.html dist-mutable/
if [[ -f frontend/dist/manifest.json ]]; then
    cp frontend/dist/manifest.json dist-mutable/
fi

# --- 2. CDK bootstrap + deps -----------------------------------------------
echo ""
echo "[2/3] Preparing CDK..."
pushd infra > /dev/null

if [[ ! -d ".venv" ]]; then
    python3 -m venv .venv
fi
source .venv/bin/activate
pip install -q -r requirements.txt

# --- 3. Diff, then deploy (or just diff if --diff-only) --------------------
echo ""
echo "[3/3] Synthesizing CDK diff..."
cdk diff "$STACK" || true

if [[ "$DIFF_ONLY" == "1" ]]; then
    echo ""
    echo "Diff-only run complete — skipping deploy."
    popd > /dev/null
    exit 0
fi

if [[ "$ENV" == "prod" ]]; then
    echo ""
    read -p "Proceed with prod deploy? [y/N] " confirm
    if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
        echo "Aborted."
        popd > /dev/null
        exit 1
    fi
fi

echo ""
echo "Deploying $STACK..."
cdk deploy "$STACK" --require-approval never --outputs-file cdk.outputs.json

popd > /dev/null

# --- 4. Post-deploy smoke test --------------------------------------------
echo ""
echo "=== DEPLOYMENT COMPLETE ==="
if [[ -f infra/cdk.outputs.json ]]; then
    site_url=$(python3 -c "
import json, sys
outs = json.load(open('infra/cdk.outputs.json'))['$STACK']
print(outs.get('DomainUrl') or outs.get('SiteUrl') or '')
")
    if [[ -n "$site_url" ]]; then
        echo "Site URL: $site_url"
        status=$(curl -o /dev/null -s -w "%{http_code}" --max-time 10 "$site_url/" || echo "timeout")
        echo "Smoke test → HTTP $status"
    fi
fi
