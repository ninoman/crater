// check.js is injected before this file (see manifest), so runSessionCheck is in scope.
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === "check-from-content") {
    runSessionCheck("content script (" + location.host + ")").then(sendResponse, (e) =>
      sendResponse({ where: "content script", error: String(e) })
    );
    return true;
  }
});
