# Release Notes Strategy

Guidelines for writing app store release notes ("What's New") for Rivers.run.

## How Rivers.run Ships

Rivers.run is a web app wrapped in Capacitor. **Most improvements ship over the air** — users get them automatically without updating the app binary. App store releases are less frequent and typically happen for:
- Native shell changes (permissions, deep links, bundle size)
- Capacitor or dependency upgrades
- Features that require a new app review

Because of this, release notes should cover the **biggest improvements since the last app store publish**, skewed towards more recent changes. Don't try to list every commit — pick the highlights that users will actually notice.

## Voice

- **Short, friendly, action-oriented** — written for paddlers, not developers
- First person plural ("we") is fine but not required
- Exclamation points sparingly — one per release max

## Template

```
Rivers.run vX.Y — [one-line summary]

• [Biggest new feature]
• [Second biggest feature or improvement]
• [Most noticeable improvement]
• [Bug fix users actually hit — skip internal-only fixes]

Questions or feedback? Reach out at support@rivers.run
```

Keep it flat — no section headers or emoji categories. Users see ~3 lines before "more" on iOS, so every line should be an actual feature.

## Platform Differences

| Platform | Max Length | Practical Guidance |
|---|---|---|
| iOS | 4,000 chars | Users see ~3 lines before "more" — lead with the best feature |
| Android | No hard limit | ~500 chars show without truncation — keep it tight |

For Android, write a condensed single-paragraph version of the iOS notes.

## Rules

1. **Lead with the most exciting feature** — it's the only line most people see
2. **Cover the highlights since last publish**, not just this binary's changes
3. **Skew towards recent** — users care about what's new *now*, not what shipped 3 months ago via OTA
4. **Never use dev jargon** — no "refactored", "migrated", "deprecated", "regression"
5. **Be specific** — "Maps load 2x faster" beats "Performance improvements"
6. **Bug-fix-only releases** — just 1–2 lines, no emoji headers:
   ```
   Fixed an issue where flow notifications weren't delivered for some gauges. Improved offline map reliability.
   ```
7. **Include a call-to-action** when relevant — "Try the new list editor!"
8. **Always end with support email** for major releases

## After Publishing

1. Copy the release notes content to `release_notes/archive/vX.Y.Z.md`
2. Update `release_notes.txt` / `changelogs/default.txt` with the next version's notes when ready

## Examples

### Major release (v5)
```
Rivers.run v5 — a major update!

• Custom river lists — build and organize your own paddling lists
• New bottom navigation bar for quick access to Map, Search, Lists, and Settings
• Significantly smaller app size — faster downloads
• Maps load faster and cache more reliably offline
• Fixed river detail pages loading from shared links

Questions or feedback? Reach out at support@rivers.run
```

### Minor release (v5.1)
```
Rivers.run v5.1

• Search results now sort by distance when using your location
• Flow graphs show the last 7 days by default
• Fixed notification timing for Canadian gauges
```

### Patch / shell-only release (v5.1.1)
```
Fixed an issue where some UK/Ireland gauges weren't loading. Improved dark mode contrast on the map.
```
