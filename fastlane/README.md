fastlane documentation
----

# Installation

Make sure you have the latest version of the Xcode command line tools installed:

```sh
xcode-select --install
```

For _fastlane_ installation instructions, see [Installing _fastlane_](https://docs.fastlane.tools/#installing-fastlane)

# Available Actions

## iOS

### ios metadata

```sh
[bundle exec] fastlane ios metadata
```

Upload metadata (descriptions, keywords, release notes) to App Store Connect

### ios fetch

```sh
[bundle exec] fastlane ios fetch
```

Download current live metadata from App Store Connect to metadata/ios/en-US/

----


## Android

### android metadata

```sh
[bundle exec] fastlane android metadata
```

Upload metadata (descriptions, release notes) to Google Play

----

This README.md is auto-generated and will be re-generated every time [_fastlane_](https://fastlane.tools) is run.

More information about _fastlane_ can be found on [fastlane.tools](https://fastlane.tools).

The documentation of _fastlane_ can be found on [docs.fastlane.tools](https://docs.fastlane.tools).
