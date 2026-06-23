# Fastlane Setup

## Architecture

One Google Cloud project hosts all app service accounts. Each app gets its own
service account, restricted to that app only in Play Console. Keys live locally
at `$FASTLANE_KEYS_DIR` (set in `fastlane/.env`) and are never committed.

```
$GCLOUD_PROJECT (GCloud project)
├── fastlane-rivers-run@...iam.gserviceaccount.com  →  rivers.run only
├── fastlane-app-two@...iam.gserviceaccount.com     →  app-two only
└── ...
```

See `fastlane/.env.example` for all required variables.

---

## One-Time GCloud Setup

```bash
# Install gcloud CLI if needed
brew install --cask google-cloud-sdk

# Authenticate and set your project (fill in $GCLOUD_PROJECT from .env)
gcloud auth login
gcloud projects create $GCLOUD_PROJECT --name "Tucker Play Console"
gcloud config set project $GCLOUD_PROJECT

# Enable the Google Play Developer API
gcloud services enable androidpublisher.googleapis.com
```

---

## Per-App Provisioning

Use the provisioning script — it reads `$GCLOUD_PROJECT` and `$FASTLANE_KEYS_DIR` from env:

```bash
source fastlane/.env
./fastlane/provision-play-account.sh <app-slug> <package-name>
# e.g. ./fastlane/provision-play-account.sh rivers-run run.rivers.twa
```

Then in **Play Console → Users and permissions → Invite new users**:
- Email: printed by the script on completion
- App permissions: select the specific app only
- Permission group: **Fastlane Metadata**

---

## Fastfile / Appfile Pattern

All secrets come from `fastlane/.env` (loaded automatically by fastlane). The
`Appfile` and `Fastfile` reference only `ENV[...]` — no credentials in committed files.

---

## iOS (App Store Connect)

One API key covers all apps — no per-app split needed. Set these in `fastlane/.env`:

```
ASC_KEY_ID=         # Key ID from App Store Connect → Users & Access → Integrations → API
ASC_ISSUER_ID=      # Issuer ID from same page
ASC_KEY_FILEPATH=   # Absolute path to the downloaded .p8 file
```

---

## Key Storage Reference

Keys live outside any repo under `$FASTLANE_KEYS_DIR` (`~/Documents/Keys/` by default).
The `.gitignore` also covers `fastlane/AuthKey*.p8` and `fastlane/play-store*.json` as
a second line of defence if keys are ever accidentally placed inside the repo.
