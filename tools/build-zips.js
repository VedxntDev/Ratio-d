/**
 * Builds both published zips from source, so neither can go stale.
 *
 *   ratiod-extension.zip   the loadable extension: manifest.json AT THE ROOT
 *                          (Chrome refuses an archive with a wrapper folder)
 *   ratiod-full-project.zip  the whole repo for review
 *
 * Files come from `git ls-files`, so the archives track what is actually
 * committed rather than whatever happens to be in the working tree, and the
 * zips themselves are excluded so they cannot nest.
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const EXT_ZIP = path.join(ROOT, "ratiod-extension.zip");
const FULL_ZIP = path.join(ROOT, "ratiod-full-project.zip");
const JUNK = /(^|\/)(\.DS_Store|__MACOSOSX|Thumbs\.db)$/;

const sh = (...args) => execFileSync(args[0], args.slice(1), { cwd: ROOT, encoding: "utf8" });

/** Replace a zip with `entries` (paths relative to ROOT). */
function build(zipPath, entries) {
  fs.rmSync(zipPath, { force: true });
  // -X drops extra file attributes, -r recurses. Run from ROOT so the archive
  // stores paths relative to the repo, not to an absolute directory.
  sh("zip", "-r", "-X", "-q", path.relative(ROOT, zipPath) || zipPath, ...entries);
  return fs.statSync(zipPath).size;
}

// ---- 1. extension zip: only what the manifest references plus its assets ----
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "extension", "manifest.json"), "utf8"));
const extEntries = [
  "extension/manifest.json",
  ...(manifest.background ? [path.join("extension", manifest.background.service_worker)] : []),
  ...(manifest.content_scripts || []).flatMap((cs) => (cs.js || []).map((f) => path.join("extension", f))),
  ...(manifest.content_scripts || []).flatMap((cs) =>
    (cs.css || []).map((f) => path.join("extension", f))),
  ...new Set([...Object.values(manifest.icons || {}), ...Object.values(manifest.action?.default_icon || {})]
    .map((f) => path.join("extension", f))),
].filter((f) => fs.existsSync(path.join(ROOT, f)));

// Rewrite so manifest.json sits at the archive root, as Chrome requires.
const stage = fs.mkdtempSync(path.join(require("os").tmpdir(), "ratiod-ext-"));
for (const rel of extEntries) {
  const dest = path.join(stage, path.relative("extension", rel));
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(path.join(ROOT, rel), dest);
}
// NB: this must NOT use sh(), which pins cwd to ROOT - that would archive the
// whole repository into the extension zip instead of the staged directory.
execFileSync("zip", ["-r", "-X", "-q", EXT_ZIP, "."], { cwd: stage, stdio: "ignore" });
fs.rmSync(stage, { recursive: true, force: true });

// ---- 2. full project zip: every tracked file except the archives ----
const tracked = sh("git", "ls-files").split("\n").map((s) => s.trim()).filter(Boolean);
const fullEntries = tracked.filter((f) => !JUNK.test(f) &&
  f !== "ratiod-extension.zip" && f !== "ratiod-full-project.zip");

const extSize = fs.statSync(EXT_ZIP).size;
const fullSize = build(FULL_ZIP, fullEntries);

console.log(`ratiod-extension.zip    ${String(extSize).padStart(7)} bytes  ${extEntries.length} files`);
console.log(`ratiod-full-project.zip ${String(fullSize).padStart(7)} bytes  ${fullEntries.length} files`);

// Confirm manifest really is at the root of the extension archive.
const root = execFileSync("unzip", ["-Z1", EXT_ZIP], { encoding: "utf8" })
  .split("\n").map((s) => s.trim()).filter(Boolean);
if (!root.includes("manifest.json")) {
  console.error("manifest.json is not at the archive root - Chrome will refuse this zip");
  process.exit(1);
}
if (root.some((f) => JUNK.test(f))) {
  console.error("archive contains OS junk files");
  process.exit(1);
}
console.log("manifest.json is at the archive root; no junk files present.");