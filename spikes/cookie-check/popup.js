document.getElementById("run").addEventListener("click", async () => {
  const out = document.getElementById("out");
  const verdict = document.getElementById("verdict");
  out.textContent = "running…";
  verdict.textContent = "";

  const worker = await chrome.runtime.sendMessage({ type: "check-from-worker" });

  let content;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  try {
    content = await chrome.tabs.sendMessage(tab.id, { type: "check-from-content" });
  } catch (e) {
    content = { where: "content script", skipped: "active tab is not a bandcamp.com page" };
  }

  const loggedIn = (r) => !!(r && (r.settingsSaysLoggedIn || r.identitiesFan));
  verdict.textContent =
    `Service worker sees session: ${loggedIn(worker) ? "YES" : "NO"} · ` +
    `Content script sees session: ${content.skipped ? "n/a" : loggedIn(content) ? "YES" : "NO"}`;
  out.textContent = JSON.stringify({ worker, content }, null, 2);
});
