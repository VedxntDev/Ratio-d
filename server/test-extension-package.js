/**
 * Verifies the published extension ZIP is actually loadable by Chrome.
 * This is the artefact a judge downloads, so a packaging mistake here is
 * the most visible possible failure.
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const ZIP = path.join(ROOT, "ratiod-extension.zip");

let failures = 0;
function check(label, ok, detail) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? "  -> " + detail : ""}`);
  if (!ok) failures++;
}

check("zip exists", fs.existsSync(ZIP));
if (!fs.existsSync(ZIP)) process.exit(1);
check("zip is not empty", fs.statSync(ZIP).size > 5000, `${fs.statSync(ZIP).size} bytes`);

const listing = execFileSync("unzip", ["-Z1", ZIP], { encoding: "utf8" })
  .split("\n")
  .map((s) => s.trim())
  .filter(Boolean);

check("manifest.json at archive root", listing.includes("manifest.json"), listing.slice(0, 3).join(", "));

const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "extension", "manifest.json"), "utf8"));
check("manifest is valid JSON", Boolean(manifest));
check("manifest_version is 3", manifest.manifest_version === 3, String(manifest.manifest_version));
check("name present", Boolean(manifest.name), manifest.name);
check("version present", Boolean(manifest.version), manifest.version);
check("description present", Boolean(manifest.description));
check("background service_worker declared", Boolean(manifest.background && manifest.background.service_worker));
check("gmail content script declared",
  manifest.content_scripts?.[0]?.matches?.includes("https://mail.google.com/*"));
check("host_permissions include the live API",
  manifest.host_permissions.some((h) => h.includes("ratio-d.vercel.app")),
  manifest.host_permissions.join(", "));

// Every file the manifest references must actually be in the archive.
const referenced = [
  ...Object.values(manifest.icons || {}),
  ...(manifest.background ? [manifest.background.service_worker] : []),
  ...(manifest.content_scripts || []).flatMap((cs) => cs.js || []),
];
const missing = referenced.filter((f) => !listing.includes(f));
check(`all ${referenced.length} manifest-referenced files packaged`, missing.length === 0,
  missing.length ? "MISSING: " + missing.join(", ") : "none missing");

// Required scripts must not be minified away or empty.
["background.js", "content-script.js", "banner.js", "banner.css"].forEach((f) => {
  check(`${f} packaged and non-empty`,
    listing.includes(f) &&
      fs.statSync(path.join(ROOT, "extension", f)).size > 100);
});

// The zip must match the source of truth, not a stale build.
const manifestInZip = execFileSync("unzip", ["-p", ZIP, "manifest.json"], { encoding: "utf8" });
check("zip manifest matches source", manifestInZip === fs.readFileSync(path.join(ROOT, "extension", "manifest.json"), "utf8"));

console.log(failures === 0
  ? "\nEXTENSION PACKAGE IS LOADABLE"
  : `\n${failures} PACKAGING PROBLEM(S) FOUND`);
process.exit(failures === 0 ? 0 : 1);
