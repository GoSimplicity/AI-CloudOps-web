#!/bin/sh
set -eu
TARGET_FILE=${1:?Provide the app config path}
[ -f "$TARGET_FILE" ] || { echo "App configuration file is missing" >&2; exit 1; }
# jq reads the environment without shell splitting, preserving spaces and equals signs.
ORIGINAL_CONFIG=$(sed -n 's/^window\._VBEN_ADMIN_PRO_APP_CONF_=\({[^}]*}\);.*/\1/p' "$TARGET_FILE")
[ -n "$ORIGINAL_CONFIG" ] || { echo "App configuration is malformed" >&2; exit 1; }
CONFIG=$(printf '%s' "$ORIGINAL_CONFIG" | jq -ce '. + (env | with_entries(select(.key | startswith("VITE_GLOB_"))))')
TMP_FILE=$(mktemp "${TARGET_FILE}.XXXXXX")
trap 'rm -f "$TMP_FILE"' EXIT
printf 'window._VBEN_ADMIN_PRO_APP_CONF_=%s;Object.freeze(window._VBEN_ADMIN_PRO_APP_CONF_);Object.defineProperty(window,"_VBEN_ADMIN_PRO_APP_CONF_",{configurable:false,writable:false});\n' "$CONFIG" > "$TMP_FILE"
chmod 644 "$TMP_FILE"
mv "$TMP_FILE" "$TARGET_FILE"
