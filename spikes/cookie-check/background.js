importScripts("check.js");

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === "check-from-worker") {
    runSessionCheck("service worker").then(sendResponse);
    return true; // keep the channel open for the async response
  }
});
