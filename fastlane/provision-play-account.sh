#!/usr/bin/env bash
# Provision a Google Play service account for a new app.
#
# Usage:
#   ./provision-play-account.sh <app-slug> <package-name>
#
# Example:
#   ./provision-play-account.sh rivers-run run.rivers.twa
#   ./provision-play-account.sh my-game com.tucker.mygame
#
# Prerequisites:
#   - gcloud CLI installed and authenticated (gcloud auth login)
#   - tucker-play-console project exists (run once: see SETUP.md)
#
# After running:
#   1. Invite the printed service account email in Play Console:
#      Users and permissions → Invite new users
#      → App permissions: select the specific app only
#      → Permission group: Fastlane Metadata (or Release manager + Manage store presence)

set -euo pipefail

GCLOUD_PROJECT="${GCLOUD_PROJECT:-}"
KEYS_DIR="${FASTLANE_KEYS_DIR:-$HOME/Documents/Keys}"

if [[ -z "$GCLOUD_PROJECT" ]]; then
  echo "Error: GCLOUD_PROJECT is not set. Run: source fastlane/.env"
  exit 1
fi

if [[ $# -ne 2 ]]; then
  echo "Usage: $0 <app-slug> <package-name>"
  echo "  e.g. $0 rivers-run run.rivers.twa"
  exit 1
fi

APP_SLUG="$1"
PACKAGE_NAME="$2"
SA_NAME="fastlane-${APP_SLUG}"
SA_EMAIL="${SA_NAME}@${GCLOUD_PROJECT}.iam.gserviceaccount.com"
KEY_FILE="${KEYS_DIR}/play-store-${APP_SLUG}.json"

echo "→ Creating service account: ${SA_NAME}"
gcloud iam service-accounts create "${SA_NAME}" \
  --display-name="Fastlane - ${PACKAGE_NAME}" \
  --project="${GCLOUD_PROJECT}"

echo "→ Generating key: ${KEY_FILE}"
mkdir -p "${KEYS_DIR}"
gcloud iam service-accounts keys create "${KEY_FILE}" \
  --iam-account="${SA_EMAIL}" \
  --project="${GCLOUD_PROJECT}"

echo ""
echo "✓ Done. Next step — invite in Play Console:"
echo "  Email:   ${SA_EMAIL}"
echo "  Key:     ${KEY_FILE}"
echo "  Scope:   App permissions → ${PACKAGE_NAME} only"
echo "  Role:    Fastlane Metadata permission group"
echo ""
echo "  Then add to your app's Appfile:"
echo "  json_key_file(File.expand_path(\"~/Documents/Keys/play-store-${APP_SLUG}.json\"))"
echo "  package_name(\"${PACKAGE_NAME}\")"
