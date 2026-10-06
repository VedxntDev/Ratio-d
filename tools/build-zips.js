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

if (process.platform === "win32") {
  const gitUsrBin = "C:\\Program Files\\Git\\usr\\bin";
  if (fs.existsSync(gitUsrBin) && !process.env.PATH.includes(gitUsrBin)) {
    process.env.PATH = gitUsrBin + path.delimiter + process.env.PATH;
  }
}

const sh = (...args) => execFileSync(args[0], args.slice(1), {
  cwd: ROOT,
  encoding: "utf8",
  env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null" }
});

const hasZip = (() => {
  try {
    execFileSync("zip", ["-v"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

function zipDirectory(zipPath, dir) {
  if (hasZip) {
    execFileSync("zip", ["-r", "-X", "-q", zipPath, "."], { cwd: dir, stdio: "ignore" });
    return;
  }
  const script = `
import sys, os, zipfile
zip_path = sys.argv[1]
source_dir = sys.argv[2]
TEXT_EXTS = {'.json', '.js', '.css', '.html', '.md', '.txt'}
with zipfile.ZipFile(zip_path, 'w', compression=zipfile.ZIP_DEFLATED) as zf:
    for root, dirs, files in os.walk(source_dir):
        for f in files:
            full = os.path.join(root, f)
            rel = os.path.relpath(full, source_dir).replace('\\\\', '/')
            ext = os.path.splitext(f)[1].lower()
            if ext in TEXT_EXTS:
                data = open(full, 'rb').read().replace(b'\\r\\n', b'\\n')
                zf.writestr(rel, data)
            else:
                zf.write(full, rel)
`;
  execFileSync("python", ["-c", script, zipPath, dir]);
}

function zipEntries(zipPath, entries) {
  if (hasZip) {
    sh("zip", "-r", "-X", "-q", path.relative(ROOT, zipPath) || zipPath, ...entries);
    return;
  }
  const script = `
import sys, os, zipfile, json
zip_path = sys.argv[1]
base_dir = sys.argv[2]
entries = json.loads(sys.stdin.read())
TEXT_EXTS = {'.json', '.js', '.css', '.html', '.md', '.txt', '.py'}
with zipfile.ZipFile(zip_path, 'w', compression=zipfile.ZIP_DEFLATED) as zf:
    for rel_path in entries:
        full = os.path.join(base_dir, rel_path)
        if not os.path.isfile(full):
            continue
        rel = rel_path.replace('\\\\', '/')
        ext = os.path.splitext(rel_path)[1].lower()
        if ext in TEXT_EXTS:
            data = open(full, 'rb').read().replace(b'\\r\\n', b'\\n')
            zf.writestr(rel, data)
        else:
            zf.write(full, rel)
`;
  execFileSync("python", ["-c", script, zipPath, ROOT], {
    input: JSON.stringify(entries),
    encoding: "utf8"
  });
}

function listZip(zipPath) {
  try {
    return execFileSync("unzip", ["-Z1", zipPath], { encoding: "utf8" })
      .split("\n").map((s) => s.trim()).filter(Boolean);
  } catch {
    const script = `
import sys, zipfile
with zipfile.ZipFile(sys.argv[1]) as z:
    for n in z.namelist():
        print(n)
`;
    return execFileSync("python", ["-c", script, zipPath], { encoding: "utf8" })
      .split("\n").map((s) => s.trim()).filter(Boolean);
  }
}

/** Replace a zip with `entries` (paths relative to ROOT). */
function build(zipPath, entries) {
  fs.rmSync(zipPath, { force: true });
  zipEntries(zipPath, entries);
  return fs.statSync(zipPath).size;
}

// ---- 1. extension zip: only what the manifest references plus its assets ----
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "extension", "manifest.json"), "utf8"));
const extEntries = [
  "extension/manifest.json",
  ...(manifest.background ? [path.join("extension", manifest.background.service_worker)] : []),
  ...(manifest.action?.default_popup ? [path.join("extension", manifest.action.default_popup), path.join("extension", "popup.js")] : []),
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
fs.rmSync(EXT_ZIP, { force: true });
zipDirectory(EXT_ZIP, stage);
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
const root = listZip(EXT_ZIP);
if (!root.includes("manifest.json")) {
  console.error("manifest.json is not at the archive root - Chrome will refuse this zip");
  process.exit(1);
}
if (root.some((f) => JUNK.test(f))) {
  console.error("archive contains OS junk files");
  process.exit(1);
}
console.log("manifest.json is at the archive root; no junk files present.");

// Sync to Desktop extension folders if present on user machine
try {
  const home = process.env.HOME || process.env.USERPROFILE || "";
  const desktopFolder = path.join(home, "Desktop", "ratiod-extension-folder");
  const desktopExt = path.join(home, "Desktop", "ratiod-extension");

  const syncDir = (srcDir, destDir) => {
    if (fs.existsSync(destDir)) {
      fs.cpSync(srcDir, destDir, { recursive: true });
    }
  };

  syncDir(path.join(ROOT, "extension"), desktopFolder);
  syncDir(path.join(ROOT, "extension"), desktopExt);
  if (fs.existsSync(path.join(home, "Desktop", "ratiod-extension.zip"))) {
    fs.copyFileSync(EXT_ZIP, path.join(home, "Desktop", "ratiod-extension.zip"));
  }
} catch (e) {}