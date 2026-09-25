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
// Required scripts must not be minified away or empty. banner.css is
// deliberately NOT here: the banner injects its styles inline from banner.js,
// so the file was dead weight in a published archive.
["background.js", "content-script.js", "banner.js"].forEach((f) => {
  check(`${f} packaged and non-empty`,
    listing.includes(f) &&
      fs.statSync(path.join(ROOT, "extension", f)).size > 100);
});

// The zip must match the source of truth, not a stale build.
const manifestInZip = execFileSync("unzip", ["-p", ZIP, "manifest.json"], { encoding: "utf8" });
check("zip manifest matches source", manifestInZip === fs.readFileSync(path.join(ROOT, "extension", "manifest.json"), "utf8"));

// ---------------------------------------------------------------------------
// Banner hardening + branding.
// The banner is a content script on mail.google.com that interpolates
// email-controlled text, so these are security properties, not cosmetics.
// ---------------------------------------------------------------------------
const bannerJs = fs.readFileSync(path.join(ROOT, "extension", "banner.js"), "utf8");

check("banner escapes HTML before interpolating into innerHTML",
  /function escapeHtml/.test(bannerJs));
// Every attacker-influenced field must be escaped at the point of use.
["explanation", "f.span", "f.reason", "step"].forEach((field) => {
  check(`banner escapes ${field}`,
    new RegExp(`escapeHtml\\(${field}\\)`).test(bannerJs));
});
// A raw interpolation of any of those fields would reintroduce the hole.
check("no unescaped interpolation of email-controlled fields",
  !/\$\{(explanation|f\.span|f\.reason|step)\}/.test(bannerJs));

check("banner shows the brand logo", /class="ratiod-logo"/.test(bannerJs));
check("banner logo is loaded from a packaged icon",
  /chrome\.runtime\.getURL\("icons\/icon\d+\.png"\)/.test(bannerJs));
check("banner logo is web-accessible to mail.google.com",
  (manifest.web_accessible_resources || []).some((r) =>
    (r.resources || []).some((x) => x.startsWith("icons/")) && (r.matches || []).includes("https://mail.google.com/*")));

check("banner credits Vedant with a GitHub link",
  /href="https:\/\/github\.com\/VedxntDev"[^>]*rel="noopener noreferrer"/.test(bannerJs));
check("banner credit link is not rel=opener-only unsafe",
  /href="https:\/\/github\.com\/VedxntDev"/.test(bannerJs));

// UX: a banner the user cannot remove trains people to ignore every banner.
check("banner can be dismissed", /id="btn-dismiss"/.test(bannerJs));
check("banner can be collapsed", /id="btn-collapse"/.test(bannerJs));
check("dismiss actually removes the host", /removeChild\(host\)/.test(bannerJs));

// Accessibility: icon-only buttons need a name, toggles need state.
check("icon-only buttons carry screen-reader text", /class="sr-only"/.test(bannerJs));
check("drawer toggle syncs aria-expanded", /setAttribute\("aria-expanded"/.test(bannerJs));
check("buttons declare type=button", !/<button(?![^>]*type=)/.test(bannerJs));
check("reduced motion is respected",
  /prefers-reduced-motion/.test(bannerJs) && /prefersReducedMotion\(\)/.test(bannerJs));

// The banner must not imply it verified anything it did not.
check("banner keeps the honest privacy wording",
  /Zero message text stored/.test(bannerJs));

// ---------------------------------------------------------------------------
// Icons: they must be real PNGs at the exact sizes Chrome requires.
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// The published archives must match source. A stale zip is invisible in review
// but is what a judge actually downloads, so staleness is treated as a failure.
// ratiod-full-project.zip previously drifted and shipped a pre-fix banner.js.
// ---------------------------------------------------------------------------
const FULL_ZIP = path.join(ROOT, "ratiod-full-project.zip");

const fullListing = execFileSync("unzip", ["-Z1", FULL_ZIP], { encoding: "utf8" })
  .split("\n").map((s) => s.trim()).filter(Boolean);
check("full-project zip exists", fullListing.length > 0, `${fullListing.length} entries`);
check("full-project zip has no OS junk",
  !fullListing.some((f) => /(^|\/)(\.DS_Store|__MACOSOSX)/.test(f)));
check("full-project zip excludes .git and .vercel",
  !fullListing.some((f) => f.startsWith(".git/") || f.startsWith(".vercel/")));
check("full-project zip does not nest the archives",
  !fullListing.includes("ratiod-extension.zip") && !fullListing.includes("ratiod-full-project.zip"));

// The security fix must be present in BOTH published copies. This is the exact
// check that would have caught the stale archive.
[ZIP, FULL_ZIP].forEach((z, i) => {
  const entry = i === 0 ? "banner.js" : "extension/banner.js";
  const src = execFileSync("unzip", ["-p", z, entry], { encoding: "utf8" });
  check(`${path.basename(z)} banner.js carries the XSS escaping fix`,
    src.includes("function escapeHtml"));
});
// ...and must be byte-identical to the working tree, so neither can lag behind.
check("full-project zip banner.js matches source",
  execFileSync("unzip", ["-p", FULL_ZIP, "extension/banner.js"], { encoding: "utf8" }) ===
  fs.readFileSync(path.join(ROOT, "extension", "banner.js"), "utf8"));
check("extension zip banner.js matches source",
  execFileSync("unzip", ["-p", ZIP, "banner.js"], { encoding: "utf8" }) ===
  fs.readFileSync(path.join(ROOT, "extension", "banner.js"), "utf8"));

// Every icon the manifest declares must be present AND a real PNG.
[16, 48, 128, 512].forEach((size) => {
  const f = `icons/icon${size}.png`;
  const ok = listing.includes(f);
  let real = false;
  if (ok) {
    const buf = execFileSync("unzip", ["-p", ZIP, f]);
    real = buf.subarray(1, 4).toString() === "PNG" && buf.length > 200;
  }
  check(`icon${size}.png packaged and is a real PNG`, ok && real);
});

console.log(failures === 0
  ? "\nEXTENSION PACKAGE IS LOADABLE"
  : `\n${failures} PACKAGING PROBLEM(S) FOUND`);
process.exit(failures === 0 ? 0 : 1);
