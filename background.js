'use strict';
chrome.action.onClicked.addListener(async tab => {
  try {
    const url = chrome.runtime.getURL('popup.html');
    const pages = await chrome.tabs.query({windowId: tab.windowId});
    const existing = pages.find(page => page.url?.split('?')[0] === url);
    const target = url + '?sourceTabId=' + tab.id;
    if (existing) {
      await chrome.tabs.update(existing.id, {url: target, active: true});
    } else {
      await chrome.tabs.create({windowId: tab.windowId, url: target});
    }
  } catch (error) {
    console.error('TabKeeper操作画面を開けませんでした:', error);
  }
});
