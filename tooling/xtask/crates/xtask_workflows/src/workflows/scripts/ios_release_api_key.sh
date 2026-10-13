set -euo pipefail
if [ -z "${APPLE_API_KEY:-}" ] || [ -z "${APPLE_API_ISSUER:-}" ] || [ -z "${APPLE_API_KEY_P8:-}" ]; then
  echo "The APPLE_API_KEY / APPLE_API_ISSUER / APPLE_API_KEY_P8 secrets are not configured." >&2
  echo "Generate a team key with the App Manager role in App Store Connect → Users and" >&2
  echo "Access → Integrations, then store the key id, issuer id, and the .p8 file" >&2
  echo "contents as those repository secrets." >&2
  exit 1
fi

# altool and the App Store Connect scripts read the key from the canonical
# private_keys directory (see apps/web/scripts/ios-release.sh).
key_dir="$HOME/.appstoreconnect/private_keys"
mkdir -p "$key_dir"
key_path="$key_dir/AuthKey_${APPLE_API_KEY}.p8"
printf '%s\n' "$APPLE_API_KEY_P8" > "$key_path"
chmod 600 "$key_path"
echo "Wrote App Store Connect API key to $key_path"
