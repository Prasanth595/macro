#!/usr/bin/env python3
"""Merge retired agent services' Doppler config into the harness, without logging values."""
import argparse
import json
import subprocess
import tempfile
from urllib.parse import urlsplit, urlunsplit


def download(project, config):
    result = subprocess.run(
        ["doppler", "secrets", "download", "--project", project, "--config", config,
         "--format", "json", "--no-file"], capture_output=True, text=True, check=False,
    )
    if result.returncode:
        raise SystemExit(f"Unable to read {project}/{config}; no values were printed.")
    return json.loads(result.stdout)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", choices=["dev", "prd"], required=True)
    parser.add_argument("--apply", action="store_true", help="Write the merged configuration")
    args = parser.parse_args()
    target = download("agent-harness-service", args.config)
    merged = dict(target)
    # Existing harness settings win, including rollout gates and credentials.
    for project in ["document-cognition", "mcp-server", "agent-schedule-service", "preview-gateway"]:
        for key, value in download(project, args.config).items():
            if not key.startswith("DOPPLER_") and key not in ["PORT", "ENVIRONMENT"]:
                if not merged.get(key):
                    merged[key] = value
    gateway = "https://gateway.macro.com" if args.config == "prd" else "https://dev-gateway.macro.com"
    merged["MCP_PUBLIC_URL"] = gateway + "/mcp"
    merged["MCP_CLIENT_PUBLIC_URL"] = gateway + "/cognition"
    if merged.get("PIPEDREAM_WEBHOOK_URI"):
        webhook = urlsplit(merged["PIPEDREAM_WEBHOOK_URI"])
        destination = urlsplit(gateway)
        merged["PIPEDREAM_WEBHOOK_URI"] = urlunsplit((
            destination.scheme, destination.netloc, "/cognition/pipedream/mcp/webhook",
            webhook.query, "",
        ))
    updates = {key: value for key, value in merged.items() if target.get(key) != value}
    print(f"agent-harness-service/{args.config}: {len(updates)} keys to merge")
    print(", ".join(sorted(updates)))
    if args.apply and updates:
        # TemporaryFile is mode 0600 and removed when the context exits. Doppler's
        # own output can contain values, so consume it without forwarding it.
        with tempfile.NamedTemporaryFile(mode="w+", suffix=".json") as config_file:
            json.dump(updates, config_file)
            config_file.flush()
            result = subprocess.run(
                ["doppler", "secrets", "upload", config_file.name, "--project",
                 "agent-harness-service", "--config", args.config, "--silent"],
                capture_output=True, text=True, check=False,
            )
        if result.returncode:
            raise SystemExit("Doppler upload failed; provider output suppressed to protect values.")
        actual = download("agent-harness-service", args.config)
        if any(actual.get(key) != value for key, value in updates.items()):
            raise SystemExit("Merged configuration did not round-trip.")
        print("Merged configuration verified.")


if __name__ == "__main__":
    main()
