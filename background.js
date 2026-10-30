"use strict";

chrome.action.onClicked.addListener(tab => {
  if(!tab?.id) return;
  chrome.tabs.sendMessage(tab.id, {action:"toggleFloatingExtension"}).catch(() => {});
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if(message?.action !== "getReceptionHostTabId") return;
  sendResponse({tabId:sender.tab?.id ?? null});
});
