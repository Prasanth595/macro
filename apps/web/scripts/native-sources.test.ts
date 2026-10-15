import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { cfgHolds, nativeSources } from "./native-sources.mjs";

describe("cfgHolds", () => {
  it("evaluates target_os, any/all/not and the unix/windows shorthands", () => {
    expect(cfgHolds('cfg(target_os = "ios")', "ios")).toBe(true);
    expect(cfgHolds('cfg(target_os = "ios")', "android")).toBe(false);
    expect(cfgHolds('cfg(any(target_os = "android", target_os = "ios"))', "ios")).toBe(true);
    expect(cfgHolds('cfg(any(target_os = "macos", windows, target_os = "linux"))', "ios")).toBe(false);
    expect(cfgHolds('cfg(not(target_arch = "wasm32"))', "ios")).toBe(true);
    expect(cfgHolds('cfg(target_arch = "wasm32")', "ios")).toBe(false);
    expect(cfgHolds('cfg(all(unix, not(target_os = "android")))', "ios")).toBe(true);
    expect(cfgHolds('cfg(all(unix, not(target_os = "android")))', "android")).toBe(false);
    expect(cfgHolds("cfg(windows)", "ios")).toBe(false);
    expect(cfgHolds('cfg(feature = "x")', "ios")).toBe(false);
  });

  it("matches plain target triples on their OS", () => {
    expect(cfgHolds("aarch64-apple-ios", "ios")).toBe(true);
    expect(cfgHolds("x86_64-unknown-linux-gnu", "ios")).toBe(false);
  });
});

describe("nativeSources", () => {
  it("follows path dependencies per platform, skipping dev and optional ones", async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "native-sources-"));
    const manifest = (rel, text) => {
      mkdirSync(path.join(root, rel), { recursive: true });
      writeFileSync(path.join(root, rel, "Cargo.toml"), text);
    };
    manifest("apps/web/tauri/src-tauri", `
[package]
name = "app"
[dependencies]
plugin = { path = "../plugin" }
[build-dependencies]
build_helper = { path = "../../../../crates/build_helper" }
[dev-dependencies]
test_only = { path = "../../../../crates/test_only" }
[target.'cfg(target_os = "android")'.dependencies]
droid = { path = "../../../../crates/droid" }
[target.'cfg(any(target_os = "android", target_os = "ios"))'.dependencies]
mobile = { path = "../../../../crates/mobile" }
`);
    manifest("apps/web/tauri/plugin", `
[package]
name = "plugin"
[dependencies]
shared = { path = "../../../../crates/shared" }
maybe = { path = "../../../../crates/maybe", optional = true }
`);
    manifest("crates/shared", `
[package]
name = "shared"
[dependencies]
deep = { path = "../deep" }
[target.'cfg(target_arch = "wasm32")'.dependencies]
wasm_only = { path = "../wasm_only" }
`);
    for (const c of ["build_helper", "test_only", "droid", "mobile", "maybe", "deep", "wasm_only"]) {
      manifest(`crates/${c}`, `[package]\nname = "${c}"\n`);
    }
    expect(await nativeSources("ios", root)).toEqual([
      "apps/web/tauri",
      "crates/build_helper",
      "crates/deep",
      "crates/mobile",
      "crates/shared",
    ]);
    expect(await nativeSources("android", root)).toEqual([
      "apps/web/tauri",
      "crates/build_helper",
      "crates/deep",
      "crates/droid",
      "crates/mobile",
      "crates/shared",
    ]);
  });
});
