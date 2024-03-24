import * as browser from 'webextension-polyfill'

async function getInvokeShortcut(): Promise<string | null> {
  const invokeCmd = [...(await browser.commands.getAll())].filter(c => c.name === 'invoke')[0]
  return invokeCmd.shortcut && !!invokeCmd.shortcut.length ? invokeCmd.shortcut : null
}

async function invoke(tab: browser.Tabs.Tab, showShortcut: boolean) {
  const shortcut = showShortcut ? await getInvokeShortcut() : null
  try {
    await browser.tabs.sendMessage(tab.id, { cmd: 'invoke', shortcut })
  }
  catch (e) { }
}

browser.runtime.onInstalled.addListener(async () => {
  browser.contextMenus.create({
    id: 'iucInvoke',
    title: browser.i18n.getMessage('invoke_cmd_desc'),
    contexts: ['all'],
  })
})

browser.commands.onCommand.addListener(async (command) => {
  if (command === 'invoke') {
    const [tab] = await browser.tabs.query({ active: true, lastFocusedWindow: true })
    await invoke(tab, false)
  }
})

browser.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'iucInvoke')
    await invoke(tab, true)
})
