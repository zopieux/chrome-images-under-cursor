'use strict';

(() => {
  chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
      id: 'context-iuc',
      title: chrome.i18n.getMessage('root_menu'),
      contexts: ['all']
    });
  });

  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (!tab)
      return;
    chrome.tabs.sendMessage(tab.id, 'show', null);
  });
})();
