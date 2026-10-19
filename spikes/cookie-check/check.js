// Shared check, loaded by both the service worker (importScripts) and the content script.
// Two signals of a logged-in session:
//   1. /settings answers 200 when logged in, and 303 → /login when logged out.
//   2. A fan page's #pagedata blob has identities.fan set when logged in.
const PROBE_FAN_PAGE = "https://bandcamp.com/jiggypol";

function decodeEntities(s) {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

async function runSessionCheck(where) {
  const result = { where, at: new Date().toISOString() };
  try {
    const settings = await fetch("https://bandcamp.com/settings", {
      credentials: "include",
      redirect: "manual",
    });
    // A manual redirect shows up as type "opaqueredirect" (status 0).
    result.settings = { status: settings.status, type: settings.type };
    result.settingsSaysLoggedIn = settings.status === 200;
  } catch (e) {
    result.settingsError = String(e);
  }
  try {
    const page = await fetch(PROBE_FAN_PAGE, { credentials: "include" });
    const html = await page.text();
    const m = html.match(/id="pagedata" data-blob="([^"]*)"/);
    const data = m ? JSON.parse(decodeEntities(m[1])) : null;
    const fan = data && data.identities && data.identities.fan;
    result.identitiesFan = fan ? { id: fan.id, username: fan.username, name: fan.name } : null;
    result.pagedataFound = !!data;
  } catch (e) {
    result.pagedataError = String(e);
  }
  return result;
}
