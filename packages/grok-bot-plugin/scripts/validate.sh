#!/usr/bin/env bash
# Validate the plugin against the Agent Plugins 1.0.0 schemas and the skill
# rules in the Cursor docs. Run from anywhere: packages/grok-bot-plugin/scripts/validate.sh
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
schemas="$(mktemp -d)"
trap 'rm -rf "$schemas"' EXIT

for name in plugin mcp; do
  curl -sSfL -o "$schemas/$name.schema.json" \
    "https://agent-plugins.org/schemas/1.0.0/$name.schema.json"
  bunx --bun ajv-cli@5.0.0 validate --spec=draft2020 --strict=false \
    -s "$schemas/$name.schema.json" -d "$root/$name.json"
done

status=0
for skill in "$root"/skills/*/SKILL.md; do
  folder="$(basename "$(dirname "$skill")")"
  name="$(sed -n '2,/^---$/s/^name: //p' "$skill")"
  description="$(sed -n '2,/^---$/s/^description: //p' "$skill")"
  if [[ "$(head -1 "$skill")" != "---" ]]; then
    echo "$skill: missing frontmatter"; status=1
  fi
  if [[ "$name" != "$folder" || ! "$name" =~ ^[a-z0-9-]+$ ]]; then
    echo "$skill: name '$name' must be lowercase-hyphenated and match '$folder'"; status=1
  fi
  if [[ -z "$description" ]]; then
    echo "$skill: description is required"; status=1
  fi
  if ! grep -qF -f <(head -1 "$root/RULES.md") "$skill" ||
     [[ "$(tail -n "$(wc -l < "$root/RULES.md")" "$skill")" != "$(cat "$root/RULES.md")" ]]; then
    echo "$skill: must end with RULES.md, unchanged"; status=1
  fi
done
[[ $status -eq 0 ]] && echo "skills valid"
exit $status
