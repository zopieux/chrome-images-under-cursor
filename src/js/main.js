'use strict';

const browser = require("webextension-polyfill");

(() => {

  function showInTab(tab) {
    browser.tabs.sendMessage(tab.id, 'show', null);
  }

  browser.runtime.onInstalled.addListener(() => {
    browser.contextMenus.create({
      id: 'context-iuc',
      title: browser.i18n.getMessage('root_menu'),
      contexts: ['all']
    });
  });

  browser.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (request.copy) {
      document.addEventListener('copy', function (e) {
        e.clipboardData.setData('text/plain', request.copy);
        e.preventDefault();
      }, { once: true });
      document.execCommand('copy');
    }
  });

  browser.contextMenus.onClicked.addListener((info, tab) => {
    if (!tab)
      return;
    showInTab(tab);
  });

  browser.commands.onCommand.addListener(function (command) {
    if (command !== "invoke")
      return;
    browser.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      tabs.forEach(tab => showInTab(tab));
    });
  });

})();
