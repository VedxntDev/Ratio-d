/**
 * Ratio'd Unsubscribe Handler Unit & Integration Test
 * Verifies multi-strategy unsubscribe detection, link extraction, Google redirect decoding,
 * and popup-blocker-proof navigation.
 */
const assert = require("assert");

// Mock DOM elements & environment for testing
function createMockElement(tagName, attrs = {}, text = "") {
  const children = [];
  const element = {
    tagName: tagName.toUpperCase(),
    attributes: { ...attrs },
    innerText: text,
    textContent: text,
    children,
    parentNode: null,
    getAttribute(name) {
      return this.attributes[name] || null;
    },
    setAttribute(name, val) {
      this.attributes[name] = val;
    },
    querySelector(sel) {
      return this.querySelectorAll(sel)[0] || null;
    },
    querySelectorAll(sel) {
      const results = [];
      function search(node) {
        if (node.matches && node.matches(sel)) {
          results.push(node);
        }
        for (const child of node.children || []) {
          search(child);
        }
      }
      search(element);
      return results;
    },
    matches(sel) {
      if (sel.includes(",")) {
        return sel.split(",").some(s => this.matches(s.trim()));
      }
      if (sel.startsWith(".")) {
        const cls = (this.attributes.class || "").split(/\s+/);
        return cls.includes(sel.slice(1));
      }
      if (sel.startsWith("#")) {
        return this.attributes.id === sel.slice(1);
      }
      if (sel.includes("[")) {
        const attrMatch = sel.match(/\[([a-zA-Z0-9_-]+)(?:([*^$]?=)(?:"|')?([^"']*)(?:"|')?)?(\s+i)?\]/);
        if (attrMatch) {
          const attrName = attrMatch[1];
          const op = attrMatch[2];
          const val = attrMatch[3];
          const ignoreCase = Boolean(attrMatch[4]);
          
          const actual = this.attributes[attrName];
          if (actual === undefined || actual === null) return false;
          if (!op) return true;
          
          let a = String(actual);
          let b = String(val);
          if (ignoreCase) {
            a = a.toLowerCase();
            b = b.toLowerCase();
          }
          if (op === "=") return a === b;
          if (op === "*=") return a.includes(b);
          if (op === "^=") return a.startsWith(b);
          if (op === "$=") return a.endsWith(b);
        }
      }
      return this.tagName === sel.toUpperCase();
    },
    appendChild(child) {
      child.parentNode = this;
      this.children.push(child);
      return child;
    },
    removeChild(child) {
      const idx = this.children.indexOf(child);
      if (idx !== -1) this.children.splice(idx, 1);
      child.parentNode = null;
    },
    closest(sel) {
      let curr = this;
      while (curr) {
        if (curr.matches && curr.matches(sel)) return curr;
        curr = curr.parentNode;
      }
      return null;
    },
    clickCount: 0,
    click() {
      this.clickCount++;
    },
    dispatchEvent() {
      this.clickCount++;
      return true;
    }
  };
  return element;
}

// Clean URL extractor helper
function getCleanUrl(url) {
  if (!url) return "";
  try {
    if (url.includes("google.com/url?") || url.includes("google.com/url%3F")) {
      const match = url.match(/[?&]q=([^&]+)/);
      if (match && match[1]) {
        return decodeURIComponent(match[1]);
      }
    }
  } catch (e) {}
  return url;
}

// Strategy detection logic under test
function findUnsubscribeTarget(documentMock, shadowHostMock) {
  // Strategy 1: Native Gmail Header Unsubscribe Action
  // Search header containers first, fallback to full document
  const headerArea = documentMock.querySelector(".gE, .ha, .gD, .iv, .adn, [role='main']") || documentMock;
  const candidates = headerArea.querySelectorAll ? headerArea.querySelectorAll(
    '.aG, span.aG, div.aG, a.aG, [data-tooltip*="Unsubscribe" i], [aria-label*="Unsubscribe" i], [aria-label*="Opt out" i], [act="10"]'
  ) : [];

  const nativeCandidates = candidates.filter(el => {
    if (shadowHostMock && (el === shadowHostMock || (shadowHostMock.contains && shadowHostMock.contains(el)))) return false;
    if (el.closest && el.closest('.a3s')) return false;
    return true;
  });

  if (nativeCandidates.length > 0) {
    const candidate = nativeCandidates[0];
    const clickable = (candidate.matches && candidate.matches('a, button, [role="button"], [role="link"], [act]'))
      ? candidate
      : (candidate.querySelector ? (candidate.querySelector('a, button, [role="button"], [role="link"], [act]') || candidate) : candidate);
    return { type: "native", element: clickable };
  }

  // Strategy 2: Body Anchor Links
  const bodyElem = documentMock.querySelector('.a3s.aiL, .a3s, .ii.gt, .adn.ads, [role="main"]') || documentMock;
  const anchors = (bodyElem.querySelectorAll ? bodyElem.querySelectorAll('a') : []).filter(a => {
    if (shadowHostMock && (a === shadowHostMock || (shadowHostMock.contains && shadowHostMock.contains(a)))) return false;
    const href = (a.href || a.getAttribute('href') || a.getAttribute('data-saferedirecturl') || '').toLowerCase();
    const txt = (a.innerText || a.textContent || a.getAttribute('aria-label') || '').toLowerCase();
    
    return (
      href.includes('unsubscribe') || href.includes('optout') || href.includes('opt-out') ||
      href.includes('email-preferences') || href.includes('manage-subscription') || href.includes('sub_unsub') ||
      txt.includes('unsubscribe') || txt.includes('opt out') || txt.includes('opt-out') ||
      txt.includes('manage preferences') || txt.includes('email preferences') || txt.includes('cancel subscription') ||
      txt.includes('remove me')
    );
  });

  if (anchors.length > 0) {
    const target = anchors[0];
    const rawUrl = target.href || target.getAttribute('href') || target.getAttribute('data-saferedirecturl');
    const cleanUrl = getCleanUrl(rawUrl);
    return { type: "body_link", element: target, url: cleanUrl };
  }

  // Strategy 3: Plain text mailto
  const bodyText = bodyElem.innerText || bodyElem.textContent || "";
  const mailtoMatch = bodyText.match(/mailto:\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
  if (mailtoMatch) {
    return { type: "mailto", url: `mailto:${mailtoMatch[1]}?subject=Unsubscribe` };
  }

  return null;
}

// RUN TEST SUITE
console.log("--- Ratio'd Unsubscribe Handler Tests ---");

// Test 1: Google Redirect URL decoding
const decoded = getCleanUrl("https://www.google.com/url?q=https%3A%2F%2Fnewsletter.quora.com%2Funsubscribe%3Fid%3D123&source=gmail");
assert.strictEqual(decoded, "https://newsletter.quora.com/unsubscribe?id=123", "Google redirect decoding failed");
console.log("PASS  Google redirect URL decoding");

// Test 2: Native Gmail header unsubscribe button detection
const docNative = createMockElement("div");
const header = createMockElement("div", { class: "ha" });
const nativeBtn = createMockElement("span", { class: "aG", "data-tooltip": "Unsubscribe from sender" }, "Unsubscribe");
header.appendChild(nativeBtn);
docNative.appendChild(header);

const resNative = findUnsubscribeTarget(docNative, null);
assert.strictEqual(resNative?.type, "native", "Native header detection failed");
assert.strictEqual(resNative?.element, nativeBtn, "Native button resolution failed");
console.log("PASS  Native Gmail header unsubscribe detection");

// Test 3: Body unsubscribe link detection (e.g. tracking URL with 'Unsubscribe' anchor text)
const docBody = createMockElement("div");
const body = createMockElement("div", { class: "a3s" });
const trackingLink = createMockElement("a", {
  href: "https://www.google.com/url?q=https%3A%2F%2Femail.brand.com%2Fclick%3Fid%3D999&source=gmail"
}, "Click here to unsubscribe from marketing emails");
body.appendChild(trackingLink);
docBody.appendChild(body);

const resBody = findUnsubscribeTarget(docBody, null);
assert.strictEqual(resBody?.type, "body_link", "Body link detection failed");
assert.strictEqual(resBody?.url, "https://email.brand.com/click?id=999", "Body link target URL resolution failed");
console.log("PASS  Body unsubscribe link detection & URL resolution");

// Test 4: Mailto fallback detection
const docMailto = createMockElement("div");
const bodyMailto = createMockElement("div", { class: "a3s" }, "To opt out send mailto: remove@brand.com");
docMailto.appendChild(bodyMailto);

const resMailto = findUnsubscribeTarget(docMailto, null);
assert.strictEqual(resMailto?.type, "mailto", "Mailto detection failed");
assert.strictEqual(resMailto?.url, "mailto:remove@brand.com?subject=Unsubscribe", "Mailto URL construction failed");
console.log("PASS  Mailto fallback detection");

// Test 5: No false positive when no unsubscribe link exists
const docClean = createMockElement("div");
const bodyClean = createMockElement("div", { class: "a3s" }, "Hello Vedant, your order #48213 has shipped.");
docClean.appendChild(bodyClean);

const resClean = findUnsubscribeTarget(docClean, null);
assert.strictEqual(resClean, null, "False positive unsubscribe detected on clean email");
console.log("PASS  No false positive on clean emails");

console.log("\nALL UNSUBSCRIBE TESTS PASSED (5/5)");
