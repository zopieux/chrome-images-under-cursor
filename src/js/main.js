'use strict';

(() => {

  function showInTab(tab) {
    chrome.tabs.sendMessage(tab.id, 'show', null);
  }

  chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
      id: 'context-iuc',
      title: chrome.i18n.getMessage('root_menu'),
      contexts: ['all']
    });
  });

  chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (request.copy) {
      document.addEventListener('copy', function (e) {
        e.clipboardData.setData('text/plain', request.copy);
        e.preventDefault();
      }, { once: true });
      document.execCommand('copy');
    }
  });

  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (!tab)
      return;
    showInTab(tab);
  });

  chrome.commands.onCommand.addListener(function (command) {
    if (command !== "invoke")
      return;
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      tabs.forEach(tab => showInTab(tab));
    });
  });

})();
