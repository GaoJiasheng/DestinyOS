#!/usr/bin/env bash
set -euo pipefail
mobile_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$mobile_root"
mode="${1:-archive}"
export SENTRY_DISABLE_AUTO_UPLOAD="${SENTRY_DISABLE_AUTO_UPLOAD:-true}"
export APP_VARIANT=production CONFIGURATION=Release
# Command-line signing uses an App Store Connect team API key; xcodebuild cannot see Xcode 26 GUI accounts.
# The .p8 lives outside the repo; key and issuer IDs are identifiers, not secrets.
asc_key_id="${ASC_KEY_ID:-HDV7627JM4}"
asc_issuer_id="${ASC_ISSUER_ID:-3659a31c-d035-4195-842f-d269268a59c3}"
asc_key_path="${ASC_KEY_PATH:-$HOME/.appstoreconnect/private_keys/AuthKey_${asc_key_id}.p8}"
auth=(-allowProvisioningUpdates)
if [[ -f "$asc_key_path" ]]; then
  auth+=(-authenticationKeyPath "$asc_key_path" -authenticationKeyID "$asc_key_id" -authenticationKeyIssuerID "$asc_issuer_id")
fi
case "$mode" in
  archive)
    npx expo prebuild --platform ios --clean
    xcodebuild archive -workspace ios/app.xcworkspace -scheme app -configuration Release \
      -destination 'generic/platform=iOS' -archivePath release/Tianji.xcarchive \
      "${auth[@]}" CODE_SIGN_STYLE=Automatic DEVELOPMENT_TEAM=D33974QQTD
    # Export to disk only; destination=export prevents submission/upload.
    xcodebuild -exportArchive -archivePath release/Tianji.xcarchive \
      -exportPath release -exportOptionsPlist release/ExportOptions.plist "${auth[@]}"
    ;;
  upload)
    # Uploads the existing archive to App Store Connect (TestFlight); run only after an explicit release decision.
    upload_options="$(mktemp -t tianji-upload).plist"
    sed 's|<string>export</string>|<string>upload</string>|' release/ExportOptions.plist > "$upload_options"
    xcodebuild -exportArchive -archivePath release/Tianji.xcarchive \
      -exportPath release/upload -exportOptionsPlist "$upload_options" "${auth[@]}"
    ;;
  simulator|integration)
    device="${2:?Pass the dedicated simulator UDID}"
    if [[ "$mode" == integration ]]; then
      # DESIGN-GAP: Real Worker integration changes only origin/metrics, never enables mock identity or diagnostic routes.
      export APP_VARIANT=development EAS_BUILD_PROFILE=integration API_BASE_URL=http://localhost:8787 EXPO_PUBLIC_BUILD_METRICS=true
    fi
    # DESIGN-GAP: SDK57 cleans by default; the Widget plugin is not idempotent on existing targets, so always regenerate native projects and install Pods.
    npx expo prebuild --platform ios --clean
    # DESIGN-GAP: Xcode preserves removed Pod resources in incremental .app products; recreate the product so disabled SDK bundles cannot survive a previous build.
    if [[ -d /tmp/Tianji-IOS-BUILD/Build/Products/Release-iphonesimulator/app.app ]]; then
      previous_product="$(mktemp -d /tmp/Tianji-previous-product-XXXXXX)"
      mv /tmp/Tianji-IOS-BUILD/Build/Products/Release-iphonesimulator/app.app "$previous_product/"
    fi
    xcodebuild -workspace ios/app.xcworkspace -scheme app -configuration Release \
      -sdk iphonesimulator -destination "platform=iOS Simulator,id=$device" \
      -derivedDataPath /tmp/Tianji-IOS-BUILD -jobs 4 ONLY_ACTIVE_ARCH=YES \
      -allowProvisioningUpdates CODE_SIGN_STYLE=Automatic DEVELOPMENT_TEAM=D33974QQTD CODE_SIGN_IDENTITY=- build
    xcrun simctl install "$device" /tmp/Tianji-IOS-BUILD/Build/Products/Release-iphonesimulator/app.app
    xcrun simctl launch "$device" pub.gavin.tianji
    ;;
  *) exit 2 ;;
esac
