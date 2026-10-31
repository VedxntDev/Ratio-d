/**
 * Verifies the Firefox Mozilla Add-on (AMO) package compliance and structure.
 * Tests ratiod-firefox.zip and ratiod-firefox.xpi against Mozilla MV3 requirements.
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const FF_ZIP = path.join(ROOT, "ratiod-firefox.zip");
const FF_XPI = path.join(ROOT, "ratiod-firefox.xpi");
const MANIFEST_SRC = path.join(ROOT, "extension", "manifest.json");

if (process.platform === "win32") {
  const gitUsrBin = "C:\\Program Files\\Git\\usr\\bin";
  if (fs.existsSync(gitUsrBin) && !process.env.PATH.includes(gitUsrBin)) {
    process.env.PATH = gitUsrBin + path.delimiter + process.env.PATH;
  }
}

const norm = (s) => (typeof s === "string" ? s.replace(/\r\n/g, "\n") : s);

function unzipList(z) {
  try {
    return execFileSync("unzip", ["-Z1", z], { encoding: "utf8" })
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
  } catch {
    const script = "import sys, zipfile\nwith zipfile.ZipFile(sys.argv[1]) as z:\n  for n in z.namelist(): print(n)";
    return execFileSync("python", ["-c", script, z], { encoding: "utf8" })
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
  }
}

function unzipRead(z, entry, encoding) {
  try {
    return execFileSync("unzip", ["-p", z, entry], encoding ? { encoding } : {});
  } catch {
    const script = "import sys, zipfile\nwith zipfile.ZipFile(sys.argv[1]) as z:\n  sys.stdout.buffer.write(z.read(sys.argv[2]))";
    return execFileSync("python", ["-c", script, z, entry], encoding ? { encoding } : {});
  }
}

let failures = 0;
function check(label, ok, detail) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? "  -> " + detail : ""}`);
  if (!ok) failures++;
}

console.log("=== FIREFOX MOZILLA ADD-ON (AMO) COMPLIANCE TEST ===");

// 1. Archive existence and sizes
check("ratiod-firefox.zip exists", fs.existsSync(FF_ZIP));
check("ratiod-firefox.xpi exists", fs.existsSync(FF_XPI));
if (!fs.existsSync(FF_ZIP) || !fs.existsSync(FF_XPI)) {
  console.error("Firefox archives missing. Run 'node tools/build-zips.js' first.");
  process.exit(1);
}

const zipStat = fs.statSync(FF_ZIP);
const xpiStat = fs.statSync(FF_XPI);
check("ratiod-firefox.zip is not empty", zipStat.size > 5000, `${zipStat.size} bytes`);
check("ratiod-firefox.xpi matches zip size", zipStat.size === xpiStat.size, `${xpiStat.size} bytes`);

// 2. Listing and Root Structure
const listing = unzipList(FF_ZIP);
check("manifest.json at archive root", listing.includes("manifest.json"), listing.slice(0, 3).join(", "));
check("no OS junk files (.DS_Store / __MACOSX)", !listing.some((f) => /(^|\/)(\.DS_Store|__MACOSX|Thumbs\.db)/.test(f)));
check("no nested wrapper directory", !listing.some((f) => f.startsWith("extension/manifest.json") || f.startsWith("ratiod/")));

// 3. Manifest Verification
const rawManifest = unzipRead(FF_ZIP, "manifest.json", "utf8");
let manifest;
try {
  manifest = JSON.parse(rawManifest);
  check("manifest is valid JSON", true);
} catch (e) {
  check("manifest is valid JSON", false, e.message);
  process.exit(1);
}

check("manifest_version is 3", manifest.manifest_version === 3, String(manifest.manifest_version));
check("name present", Boolean(manifest.name), manifest.name);
check("version present", Boolean(manifest.version), manifest.version);
check("description present", Boolean(manifest.description));

// 4. Mozilla Gecko ID & Requirements (Mandatory for AMO MV3)
const gecko = manifest.browser_specific_settings?.gecko;
check("browser_specific_settings.gecko declared", Boolean(gecko));
check("gecko.id is present and formatted", Boolean(gecko && gecko.id && gecko.id.includes("@")), gecko ? gecko.id : "missing");
check("gecko.strict_min_version is at least 109.0", Boolean(gecko && parseFloat(gecko.strict_min_version) >= 109.0), gecko ? gecko.strict_min_version : "missing");
check("gecko.data_collection_permissions declared as ['none']",
  Array.isArray(gecko?.data_collection_permissions?.required) &&
  gecko.data_collection_permissions.required.includes("none"),
  JSON.stringify(gecko?.data_collection_permissions));

// 5. Content Security Policy
const csp = manifest.content_security_policy?.extension_pages || "";
check("content_security_policy for extension_pages declared", Boolean(csp), csp);
check("CSP disallows unsafe-eval", !csp.includes("'unsafe-eval'"));
check("CSP restricts script execution to self", csp.includes("script-src 'self'"));
check("CSP restricts object-src to self", csp.includes("object-src 'self'"));

// 6. Manifest Referenced Files Check
const referenced = [
  ...Object.values(manifest.icons || {}),
  ...(manifest.action?.default_popup ? [manifest.action.default_popup, "popup.js"] : []),
  ...(manifest.content_scripts || []).flatMap((cs) => cs.js || []),
];
const missing = referenced.filter((f) => !listing.includes(f));
check(`all ${referenced.length} manifest files packaged in archive`, missing.length === 0,
  missing.length ? "MISSING: " + missing.join(", ") : "all present");

// 7. Security: No Remote Scripts or Forbidden Dynamic Code
const jsEntries = listing.filter((f) => f.endsWith(".js"));
check("package contains JavaScript files", jsEntries.length > 0, `${jsEntries.length} scripts`);

let hasUnsafeEval = false;
let hasNewFunction = false;
let hasRemoteScript = false;

jsEntries.forEach((jsFile) => {
  const code = unzipRead(FF_ZIP, jsFile, "utf8");
  // Exclude third-party vendor parsing if any, but ensure our extension code is clean
  if (/\beval\s*\(/.test(code)) {
    hasUnsafeEval = true;
    console.error(`  -> Found eval() in ${jsFile}`);
  }
  if (/new\s+Function\s*\(/.test(code) && jsFile !== "jsQR.js") {
    hasNewFunction = true;
    console.error(`  -> Found new Function() in ${jsFile}`);
  }
  if (/<script[^>]+src=["']https?:/i.test(code)) {
    hasRemoteScript = true;
    console.error(`  -> Found remote script tag in ${jsFile}`);
  }
});

check("no eval() found in extension scripts", !hasUnsafeEval);
check("no dynamic new Function() in extension code", !hasNewFunction);
check("no remote scripts loaded", !hasRemoteScript);

// 8. Dual-API WebExtension Compatibility
const popupJs = unzipRead(FF_ZIP, "popup.js", "utf8");
const contentScriptJs = unzipRead(FF_ZIP, "content-script.js", "utf8");
const bannerJs = unzipRead(FF_ZIP, "banner.js", "utf8");

check("popup.js checks browser namespace fallback",
  popupJs.includes('typeof browser !== "undefined"') && popupJs.includes("chrome"));
check("content-script.js checks browser namespace fallback",
  contentScriptJs.includes('typeof browser !== "undefined"') && contentScriptJs.includes("chrome"));
check("banner.js checks browser namespace fallback",
  bannerJs.includes('typeof browser !== "undefined"') && bannerJs.includes("chrome"));

// 9. Parity with source files
check("manifest in archive matches extension/manifest.json",
  norm(rawManifest) === norm(fs.readFileSync(MANIFEST_SRC, "utf8")));
check("banner.js in archive matches extension/banner.js",
  norm(bannerJs) === norm(fs.readFileSync(path.join(ROOT, "extension", "banner.js"), "utf8")));
check("content-script.js in archive matches extension/content-script.js",
  norm(contentScriptJs) === norm(fs.readFileSync(path.join(ROOT, "extension", "content-script.js"), "utf8")));
check("popup.js in archive matches extension/popup.js",
  norm(popupJs) === norm(fs.readFileSync(path.join(ROOT, "extension", "popup.js"), "utf8")));

// 10. Icons validation
[16, 48, 128, 512].forEach((size) => {
  const iconPath = `icons/icon${size}.png`;
  const exists = listing.includes(iconPath);
  let validPng = false;
  if (exists) {
    const buf = unzipRead(FF_ZIP, iconPath);
    validPng = buf.subarray(1, 4).toString() === "PNG" && buf.length > 200;
  }
  check(`Firefox icon${size}.png is a valid PNG`, exists && validPng);
});

console.log(failures === 0
  ? "\nFIREFOX ADD-ON (AMO) PACKAGE PASSES ALL CHECKS"
  : `\n${failures} FIREFOX PACKAGING PROBLEM(S) FOUND`);
process.exit(failures === 0 ? 0 : 1);
