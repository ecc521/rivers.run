# App Store & Play Store Metadata

This folder contains the source-of-truth text for all app store listings. The structure mirrors [Fastlane's metadata conventions](https://docs.fastlane.tools/actions/deliver/#available-metadata-folder-options), so it works both as a human-readable reference and as a drop-in for automated Fastlane uploads if adopted later.

## Folder Structure

```
metadata/
├── README.md                        ← You are here
├── ios/
│   └── en-US/
│       ├── name.txt                 # App title (30 char max)
│       ├── subtitle.txt             # iOS subtitle (30 char max)
│       ├── description.txt          # Full description (4000 char max, plain text)
│       ├── keywords.txt             # Comma-separated (100 char max total)
│       ├── release_notes.txt        # "What's New" for current version (4000 char max)
│       └── promotional_text.txt     # Updatable without app review (170 char max)
├── android/
│   └── en-US/
│       ├── title.txt                # App title (30 char max)
│       ├── short_description.txt    # Short description (80 char max)
│       ├── full_description.txt     # Full description (4000 char max, plain text)
│       └── changelogs/
│           └── default.txt          # Release notes for current version
└── release_notes/
    ├── STRATEGY.md                  # Writing conventions & templates
    └── archive/                     # Past release notes, one file per version
```

## How to Use

### Manual workflow (current)
1. Edit the text files in this folder
2. Copy-paste into [App Store Connect](https://appstoreconnect.apple.com) or [Google Play Console](https://play.google.com/console)
3. After publishing, archive the release notes to `release_notes/archive/vX.Y.Z.md`

### Fastlane workflow (future, optional)
1. Install Fastlane: `gem install fastlane`
2. Set up API credentials:
   - iOS: App Store Connect API Key (`.p8` file)
   - Android: Google Play service account JSON
3. Upload metadata:
   - iOS: `fastlane deliver --skip_binary_upload --skip_screenshots`
   - Android: `fastlane supply --skip_upload_apk --skip_upload_aab`

## Character Limits Reference

| Field | Platform | Max Length |
|---|---|---|
| Title / Name | Both | 30 chars |
| Subtitle | iOS only | 30 chars |
| Short Description | Android only | 80 chars |
| Full Description | Both | 4000 chars |
| Keywords | iOS only | 100 chars |
| Promotional Text | iOS only | 170 chars |
| Release Notes | iOS | 4000 chars |
| Release Notes | Android | No hard limit (~500 shows without truncation) |

## Screenshots

Screenshots are generated via Playwright (not Fastlane) and output to `artifacts/screenshots/`. See:
- Test spec: `tests/screenshots.spec.ts`
- Config: `playwright.config.ts`
- Run: `npm run screenshots`
