// Google Analytics 4 for the Momiji sites, with Google's Consent Mode v2 and a
// small cookie banner. The same file is in landing/src, frontend/src and
// hugo/sakuryo/static/js (the blog), so change all three together.
//
// The visitor's choice is a cookie on .momiji.app, so answering the banner on
// one site (momiji.app, the app, the blog) answers it for all of them.
// No window when landing/scripts/prerender.js renders pages, hence the guards.

const CONSENT_COOKIE = "momiji_consent";
const ONE_YEAR = 60 * 60 * 24 * 365;

// Where analytics waits for a yes: the EEA, the UK and Switzerland. Elsewhere
// it runs until the visitor says no. Google applies this by the visitor's IP.
const OPT_IN_REGIONS = [
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU",
  "IS", "IE", "IT", "LV", "LI", "LT", "LU", "MT", "NL", "NO", "PL", "PT", "RO",
  "SK", "SI", "ES", "SE", "GB", "CH",
];

let started = false;
let privacyUrl = "https://momiji.app/privacy";

// gtag.js reads the arguments object itself, so this can't be an arrow function
function gtag() {
  window.dataLayer.push(arguments);
}

const cookieDomain = () =>
  location.hostname === "momiji.app" || location.hostname.endsWith(".momiji.app") ? "; domain=.momiji.app" : "";

const readChoice = () => {
  const match = document.cookie.match(new RegExp(`(?:^|; )${CONSENT_COOKIE}=(granted|denied)`));
  return match ? match[1] : null;
};

const loadScript = (src) => {
  const script = document.createElement("script");
  script.async = true;
  script.src = src;
  document.head.appendChild(script);
};

// GA's own cookies (_ga, _ga_<id>), which it leaves behind when consent is withdrawn
const clearGaCookies = () => {
  for (const name of document.cookie.split("; ").map((c) => c.split("=")[0])) {
    if (name === "_ga" || name.startsWith("_ga_")) {
      document.cookie = `${name}=; max-age=0; path=/`;
      document.cookie = `${name}=; max-age=0; path=/${cookieDomain()}`;
    }
  }
};

// Starts GA (and Tag Manager, if given an ID). Call once, and only where
// analytics should run (prod), before anything is tracked.
export function initAnalytics({ gaId, gtmId, privacyPolicyUrl } = {}) {
  if (typeof window === "undefined" || started || !gaId) return;
  started = true;
  if (privacyPolicyUrl) privacyUrl = privacyPolicyUrl;

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || gtag;

  // Momiji runs no ads, so the ad signals are always off; only analytics asks
  const noAds = { ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" };
  gtag("consent", "default", { ...noAds, analytics_storage: "denied", region: OPT_IN_REGIONS, wait_for_update: 500 });
  gtag("consent", "default", { ...noAds, analytics_storage: "granted" });
  const choice = readChoice();
  if (choice) gtag("consent", "update", { analytics_storage: choice });

  gtag("js", new Date());
  gtag("config", gaId);
  loadScript(`https://www.googletagmanager.com/gtag/js?id=${gaId}`);

  // Tag Manager comes after the consent defaults above, so its tags honor them
  if (gtmId) {
    window.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });
    loadScript(`https://www.googletagmanager.com/gtm.js?id=${gtmId}`);
  }

  if (!choice) {
    if (document.body) showConsentBanner();
    else document.addEventListener("DOMContentLoaded", showConsentBanner);
  }
}

// A GA4 event, e.g. track("search", { search_term: "猫" }). Does nothing where
// analytics isn't running (local dev, dev.momiji.app).
export function track(name, params = {}) {
  if (started) gtag("event", name, params);
}

// Ties later events to a signed-in account (an opaque ID, never an email), so
// GA can follow one learner across devices and visits.
export function identify(userId) {
  if (started) gtag("set", { user_id: userId || null });
}

export function setConsent(choice) {
  if (typeof document === "undefined") return;
  const secure = location.protocol === "https:" ? "; secure" : "";
  document.cookie = `${CONSENT_COOKIE}=${choice}; max-age=${ONE_YEAR}; path=/; samesite=lax${cookieDomain()}${secure}`;
  if (started) gtag("consent", "update", { analytics_storage: choice });
  if (choice === "denied") clearGaCookies();
}

// The banner asking about analytics cookies. Also what a "Cookie settings"
// link opens, so a visitor can change their answer.
export function showConsentBanner() {
  if (typeof document === "undefined" || document.getElementById("momiji-consent")) return;

  const banner = document.createElement("div");
  banner.id = "momiji-consent";
  banner.setAttribute("role", "dialog");
  banner.setAttribute("aria-label", "Cookie choice");
  banner.style.cssText =
    "position:fixed;left:16px;right:16px;bottom:16px;z-index:2147483647;max-width:560px;margin:0 auto;" +
    "padding:16px;border-radius:8px;background:#2C1810;color:#FDF6EC;box-shadow:0 4px 16px rgba(0,0,0,.3);" +
    "font:14px/1.5 system-ui,-apple-system,sans-serif;";

  const text = document.createElement("p");
  text.style.cssText = "margin:0 0 12px;";
  text.append("Momiji uses Google Analytics cookies to see which features people use, so we can make it better. No ads, and nothing is sold. ");
  const link = document.createElement("a");
  link.href = privacyUrl;
  link.textContent = "Privacy policy";
  link.style.cssText = "color:#E67E22;text-decoration:underline;";
  text.append(link);

  const buttons = document.createElement("div");
  buttons.style.cssText = "display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;";
  const button = (label, choice, primary) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.style.cssText =
      "cursor:pointer;padding:8px 16px;border-radius:6px;font:inherit;font-weight:600;" +
      (primary ? "border:0;background:#E67E22;color:#fff;" : "border:1px solid #8B6355;background:transparent;color:#FDF6EC;");
    b.addEventListener("click", () => {
      setConsent(choice);
      banner.remove();
    });
    return b;
  };
  buttons.append(button("Decline", "denied", false), button("Accept", "granted", true));

  banner.append(text, buttons);
  document.body.appendChild(banner);
}
