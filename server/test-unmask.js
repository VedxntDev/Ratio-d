/**
 * Unit & security regression suite for Safe Peek (server/unmask/tracer.js)
 */
const { isPrivateHost, traceRedirects } = require("./unmask/tracer");

let failures = 0;
function check(label, ok, detail) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? "  -> " + detail : ""}`);
  if (!ok) failures++;
}

console.log("=================================================");
console.log("       SAFE PEEK REDIRECT TRACER TEST SUITE      ");
console.log("=================================================\n");

// 1. SSRF Protection Tests
check("blocks localhost", isPrivateHost("localhost"));
check("blocks 127.0.0.1", isPrivateHost("127.0.0.1"));
check("blocks IPv6 ::1", isPrivateHost("::1"));
check("blocks 10.0.0.1 (private range)", isPrivateHost("10.0.0.1"));
check("blocks 172.16.0.5 (private range)", isPrivateHost("172.16.0.5"));
check("blocks 192.168.1.1 (private range)", isPrivateHost("192.168.1.1"));
check("blocks 169.254.169.254 (cloud metadata)", isPrivateHost("169.254.169.254"));
check("blocks .local mDNS domains", isPrivateHost("device.local"));
check("allows public domain google.com", !isPrivateHost("google.com"));
check("allows public domain bit.ly", !isPrivateHost("bit.ly"));
check("allows public domain microsoft.com", !isPrivateHost("microsoft.com"));

// 2. Protocol Security Checks
(async () => {
  try {
    await traceRedirects("file:///etc/passwd");
    check("blocks file:// protocol", false, "Allowed non-HTTP protocol");
  } catch (err) {
    check("blocks file:// protocol", /only HTTP and HTTPS are permitted/i.test(err.message), err.message);
  }

  try {
    await traceRedirects("ftp://ftp.example.com");
    check("blocks ftp:// protocol", false, "Allowed FTP protocol");
  } catch (err) {
    check("blocks ftp:// protocol", /only HTTP and HTTPS are permitted/i.test(err.message), err.message);
  }

  // 3. SSRF Execution Guard
  try {
    const res = await traceRedirects("http://127.0.0.1:8080/internal-api");
    check("blocks direct internal IP tracing", res.chain[0]?.error && /Forbidden host/i.test(res.chain[0].error));
  } catch (err) {
    check("blocks direct internal IP tracing", /Forbidden host/i.test(err.message));
  }

  // 4. Invalid input handling
  try {
    await traceRedirects("");
    check("rejects empty string", false);
  } catch (err) {
    check("rejects empty string", /Missing or invalid target URL/i.test(err.message));
  }

  console.log(`\nTests Completed. Failures: ${failures}`);
  process.exit(failures === 0 ? 0 : 1);
})();
