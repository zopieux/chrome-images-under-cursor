import * as browser from "webextension-polyfill"

browser.runtime.onInstalled.addListener(() => {
  const readyChannel = new MessageChannel()
  const portOfPopup = new Map()
  const popupOfMenu = new Map()

  browser.contextMenus.create({
    id: "context-iuc",
    title: browser.i18n.getMessage("invoke_cmd_desc"),
    contexts: ["all"]
  })

  browser.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    // console.log("runtime.onMessage bg", message.cmd, sender.id, sender.tab, sender.frameId)
    const {cmd} = message
    if (cmd === "videoFrame") {
      const {menuId, entityId, frame} = message
      const uuid = popupOfMenu.get(menuId)
      if (uuid === undefined) {
        return {keep: true}
      }
      const port = portOfPopup.get(uuid)
      if (port === undefined) {
        popupOfMenu.delete(menuId)
        return {keep: false}
      }
      port.postMessage({cmd: "videoFrame", entityId, frame})
      return {keep: true}
    }
  })

  browser.runtime.onConnect.addListener(port => {
    const popUid = crypto.randomUUID()
    portOfPopup.set(popUid, port)
    console.log("onConnect port of popup", popUid, "is", port)
    readyChannel.port1.postMessage({popUid})
    port.onDisconnect.addListener(() => {
      console.log("onDisconnect port of popup", popUid)
      portOfPopup.delete(popUid)
    })
  })

  async function doIt({tab, info}: { tab: browser.Tabs.Tab | null, info: any }) {
    // This *has* to be the very first invocation, otherwise the user interaction gets eaten
    // and we can't programmatically openPopup().
    await browser.browserAction.openPopup()
    if (tab === null) {
      const tabs = await browser.tabs.query({active: true, currentWindow: true})
      if (tabs.length == 0) {
        // TODO: fill popup with "empty" or some error?
        return
      }
      tab = tabs[0]
    }
    const tabId = tab.id
    const menuId = crypto.randomUUID()
    // const downloadFirst = info.modifiers.indexOf("Ctrl") >= 0
    const msg = {cmd: "invoke", media: {type: info.mediaType, src: info.srcUrl}, ctx: {menuId, tabId}}
    const details = !!tabId ? {tabId} : null
    const frames = await browser.webNavigation.getAllFrames(details)
    console.log(`Got ${frames.length} frames`)
    const replies = await Promise.allSettled(frames.map(f => {
      return browser.tabs.sendMessage(tab.id, msg, {frameId: f.frameId})
    }))
    const entities = replies.reduce((acc, rep) => rep.status === "fulfilled" ? [...acc, ...rep.value.entities] : acc, [])
    console.log(`Got ${entities.length} entities`)
    await new Promise((resolve, reject) => {
      readyChannel.port2.onmessage = (msg) => {
        const {popUid} = msg.data
        popupOfMenu.set(menuId, popUid)
        portOfPopup.get(popUid).postMessage({cmd: "show", entities})
        resolve(null)
      }
    })
  }

  browser.commands.onCommand.addListener(async (command) => {
    if (command === "invoke") {
      await doIt({tab: null, info: {}})
    }
  })

  browser.contextMenus.onClicked.addListener(async (info, tab) => {
    await doIt({tab, info})
  })
})
