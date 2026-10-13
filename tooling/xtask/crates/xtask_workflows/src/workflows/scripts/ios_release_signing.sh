set -euo pipefail
if [ -z "${APPLE_DISTRIBUTION_CERTIFICATE_BASE64:-}" ]; then
  echo "No Apple Distribution certificate secret; relying on Xcode cloud signing" \
    "via the App Store Connect API key (-allowProvisioningUpdates)."
  exit 0
fi

certificate_path="$RUNNER_TEMP/apple-distribution.p12"
printf '%s' "$APPLE_DISTRIBUTION_CERTIFICATE_BASE64" | base64 --decode > "$certificate_path" 2>/dev/null \
  || printf '%s' "$APPLE_DISTRIBUTION_CERTIFICATE_BASE64" | base64 -D > "$certificate_path"

# Mirror configure_signing_identity.sh (DMG builds): the System keychain keeps
# the identity visible to xcodebuild without per-user keychain unlocking.
sudo security import "$certificate_path" \
  -k /Library/Keychains/System.keychain \
  -P "${APPLE_DISTRIBUTION_CERTIFICATE_PASSWORD:-}" \
  -A \
  -T /usr/bin/codesign \
  -T /usr/bin/security
sudo security set-key-partition-list \
  -S apple-tool:,apple:,codesign: \
  -s \
  -k "" \
  /Library/Keychains/System.keychain || true

identity=$(security find-identity -v -p codesigning /Library/Keychains/System.keychain \
  | awk -F '"' '/Apple Distribution/ { print $2; exit }')
if [ -z "$identity" ]; then
  echo "No Apple Distribution identity found in System.keychain after import" >&2
  security find-identity -v -p codesigning /Library/Keychains/System.keychain >&2 || true
  exit 1
fi
echo "Using signing identity: $identity"
