import * as browser from 'webextension-polyfill'

// @ts-expect-error: Parcel mini-DSL is unsupported.
import requestPermUrl from 'url:./request-perm.html'

const invokeCmd = 'invoke'
const invokeMenuId = 'iucInvoke'

async function getInvokeShortcut(): Promise<string | null> {
  const cmd = [...(await browser.commands.getAll())].filter(c => c.name === invokeCmd)[0]
  return cmd.shortcut && !!cmd.shortcut.length ? cmd.shortcut : null
}

async function invoke(tab: browser.Tabs.Tab, showShortcut: boolean) {
  const shortcut = showShortcut ? await getInvokeShortcut() : null
  try {
    await browser.tabs.sendMessage(tab.id, { cmd: invokeCmd, shortcut })
  }
  catch (e) { }
}

async function checkAndMaybeRequestPermission(url: string) {
  const contentScriptAllOrigins: browser.Permissions.AnyPermissions = {
    permissions: [],
    origins: ['*://*/*'],
  }
  const hasPerm = await browser.permissions.contains(contentScriptAllOrigins)
  if (!hasPerm)
    browser.tabs.create({ url })
}

browser.runtime.onInstalled.addListener(async (_info) => {
  browser.contextMenus.create({
    id: invokeMenuId,
    title: browser.i18n.getMessage('invoke_cmd_desc'),
    contexts: ['all'],
  })

  const permUrl = browser.runtime.getURL(requestPermUrl)
  const isFirefox = permUrl.startsWith('moz-extension://')
  if (isFirefox)
    await checkAndMaybeRequestPermission(permUrl)
})

browser.commands.onCommand.addListener(async (command) => {
  if (command === invokeCmd) {
    const [tab] = await browser.tabs.query({ active: true, lastFocusedWindow: true })
    await invoke(tab, false)
  }
})

browser.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === invokeMenuId)
    await invoke(tab, true)
})
