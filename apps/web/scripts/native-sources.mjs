#!/usr/bin/env bun
// Which in-repo source trees compile into the native mobile apps.
//
// The iOS merge gate, the App Store release, and the Android equivalents
// need one answer to "did this change touch native code?": the Tauri app
// under apps/web/tauri plus every in-repo crate it depends on (transitively,
// per platform). That answer lives in apps/web/native-sources.json so that
// shell, Node and the workflow generator can read it without cargo. This
// script derives it from the Cargo manifests and either writes the file
// (`just native-sources`) or checks that it is current (`--check`, run by
// the iOS Native Check on every PR with native changes).
//
// Derivation: start at apps/web/tauri/src-tauri/Cargo.toml and follow every
// `path` dependency in [dependencies], [build-dependencies] and the
// [target.'cfg(...)'.*] sections whose cfg holds for the platform;
// dev-dependencies are not shipped, and optional dependencies are skipped
// (cargo only compiles them when a feature asks; following them pulls in
// most of the backend). `--verify` cross-checks the walk against
// `cargo metadata --filter-platform` where a toolchain is available (the
// release workflow does this before every build). Everything under
// apps/web/tauri collapses into that one root.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { exit } from "node:process";
import { fileURLToPath } from "node:url";

const appDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const repoRoot = path.dirname(path.dirname(appDir));
const OUTPUT = path.join(appDir, "native-sources.json");
const TAURI_ROOT = "apps/web/tauri";
const APP_MANIFEST = `${TAURI_ROOT}/src-tauri/Cargo.toml`;

/// cfg predicates per platform, as `cargo metadata --filter-platform` sees them.
export const PLATFORMS = {
  ios: { triple: "aarch64-apple-ios", target_os: "ios", target_arch: "aarch64", target_family: "unix", target_env: "", target_vendor: "apple" },
  android: { triple: "aarch64-linux-android", target_os: "android", target_arch: "aarch64", target_family: "unix", target_env: "", target_vendor: "unknown" },
};

/// Evaluate a `cfg(...)` expression (the key of a [target.'…'] table) for a
/// platform. Plain target triples are matched on their target_os.
export function cfgHolds(expr, platform) {
  const target = PLATFORMS[platform];
  const text = expr.trim();
  if (!text.startsWith("cfg(")) {
    return text.includes(`-${target.target_os}`) || text.includes(`-${target.target_vendor}-${target.target_os}`);
  }
  const tokens = text.match(/[a-z_]+|"[^"]*"|[(),=]/g) ?? [];
  let i = 0;
  const peek = () => tokens[i];
  const take = (expected) => {
    const token = tokens[i++];
    if (expected && token !== expected) {
      throw new Error(`cfg ${JSON.stringify(expr)}: expected ${expected}, got ${token}`);
    }
    return token;
  };
  function predicate() {
    const name = take();
    if (name === "any" || name === "all" || name === "not") {
      take("(");
      const parts = [];
      while (peek() !== ")") {
        parts.push(predicate());
        if (peek() === ",") take(",");
      }
      take(")");
      if (name === "not") return !parts[0];
      return name === "any" ? parts.some(Boolean) : parts.every(Boolean);
    }
    if (peek() === "=") {
      take("=");
      const value = JSON.parse(take());
      if (name in target) return target[name] === value;
      return false; // feature = "…" and friends never gate shipped code here
    }
    if (name === "unix") return target.target_family === "unix";
    if (name === "windows") return target.target_family === "windows";
    return false;
  }
  take("cfg");
  take("(");
  const result = predicate();
  take(")");
  return result;
}

async function parseToml(text) {
  if (globalThis.Bun?.TOML) return Bun.TOML.parse(text);
  const { parse } = await import("smol-toml");
  return parse(text);
}

function depTables(manifest, platform) {
  const tables = [manifest.dependencies, manifest["build-dependencies"]];
  for (const [cfg, section] of Object.entries(manifest.target ?? {})) {
    if (!cfgHolds(cfg, platform)) continue;
    tables.push(section.dependencies, section["build-dependencies"]);
  }
  return tables.filter(Boolean);
}

/// Repo-relative directories of every in-repo crate the app compiles for the
/// platform, with apps/web/tauri collapsed to one root. Sorted.
export async function nativeSources(platform, root = repoRoot) {
  const seen = new Set();
  const queue = [path.join(root, APP_MANIFEST)];
  while (queue.length > 0) {
    const manifestPath = queue.pop();
    if (seen.has(manifestPath)) continue;
    seen.add(manifestPath);
    const manifest = await parseToml(readFileSync(manifestPath, "utf8"));
    for (const table of depTables(manifest, platform)) {
      for (const dep of Object.values(table)) {
        if (!dep || typeof dep !== "object" || !dep.path || dep.optional) continue;
        const target = path.resolve(path.dirname(manifestPath), dep.path, "Cargo.toml");
        if (existsSync(target)) queue.push(target);
      }
    }
  }
  const roots = new Set();
  for (const manifestPath of seen) {
    const rel = path.relative(root, path.dirname(manifestPath)).split(path.sep).join("/");
    roots.add(rel === TAURI_ROOT || rel.startsWith(`${TAURI_ROOT}/`) ? TAURI_ROOT : rel);
  }
  return [...roots].sort();
}

/// The same answer from cargo's own resolver (normal + build dependencies,
/// features resolved), for `--verify`.
function nativeSourcesFromCargo(platform, root = repoRoot) {
  const metadata = JSON.parse(
    execFileSync(
      "cargo",
      ["metadata", "--format-version", "1", "--filter-platform", PLATFORMS[platform].triple,
        "--manifest-path", path.join(root, TAURI_ROOT, "Cargo.toml")],
      { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 },
    ),
  );
  const packages = new Map(metadata.packages.map((pkg) => [pkg.id, pkg]));
  const nodes = new Map(metadata.resolve.nodes.map((node) => [node.id, node]));
  const seen = new Set();
  const queue = metadata.packages.filter((pkg) => pkg.name === "app").map((pkg) => pkg.id);
  while (queue.length > 0) {
    const id = queue.pop();
    if (seen.has(id)) continue;
    seen.add(id);
    for (const dep of nodes.get(id).deps) {
      if (dep.dep_kinds.some((kind) => kind.kind === null || kind.kind === "build")) queue.push(dep.pkg);
    }
  }
  const roots = new Set();
  for (const id of seen) {
    const manifestPath = packages.get(id).manifest_path;
    if (!manifestPath.startsWith(`${root}${path.sep}`)) continue;
    const rel = path.relative(root, path.dirname(manifestPath)).split(path.sep).join("/");
    roots.add(rel === TAURI_ROOT || rel.startsWith(`${TAURI_ROOT}/`) ? TAURI_ROOT : rel);
  }
  return [...roots].sort();
}

async function render() {
  const result = {
    "//": "Generated by `just native-sources` (apps/web/scripts/native-sources.mjs); do not edit. Source trees that compile into the native mobile apps, per platform.",
  };
  for (const platform of Object.keys(PLATFORMS)) {
    result[platform] = await nativeSources(platform);
  }
  return `${JSON.stringify(result, null, 2)}\n`;
}

if (import.meta.main ?? process.argv[1] === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes("--check");
  if (process.argv.includes("--verify")) {
    let failed = false;
    for (const platform of Object.keys(PLATFORMS)) {
      const walked = await nativeSources(platform);
      const resolved = nativeSourcesFromCargo(platform);
      if (JSON.stringify(walked) !== JSON.stringify(resolved)) {
        failed = true;
        console.error(`${platform}: the manifest walk and cargo metadata disagree.`);
        console.error(`  only in the walk:     ${walked.filter((p) => !resolved.includes(p)).join(", ") || "-"}`);
        console.error(`  only in cargo:        ${resolved.filter((p) => !walked.includes(p)).join(", ") || "-"}`);
      } else {
        console.log(`${platform}: manifest walk matches cargo metadata (${walked.length} source trees).`);
      }
    }
    if (failed) {
      console.error("Fix the walk in scripts/native-sources.mjs (an optional or feature-gated path dependency the app enables?).");
      exit(1);
    }
  }
  const content = await render();
  const current = existsSync(OUTPUT) ? readFileSync(OUTPUT, "utf8") : "";
  if (check) {
    if (current !== content) {
      console.error(
        `${path.relative(repoRoot, OUTPUT)} is out of date with the Cargo manifests: a crate the ` +
          "native app compiles was added or removed. Regenerate and commit it:\n" +
          "  cd apps/web && just native-sources",
      );
      exit(1);
    }
    console.log(`${path.relative(repoRoot, OUTPUT)} is current.`);
  } else {
    writeFileSync(OUTPUT, content);
    console.log(`${current === content ? "Unchanged" : "Wrote"} ${path.relative(repoRoot, OUTPUT)}.`);
  }
}
