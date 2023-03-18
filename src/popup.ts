import * as browser from "webextension-polyfill"
import {Entity, From, Kind} from "./common"

function duration(s: number) {
  if (s < 60) {
    return `${s.toFixed(0)}s`
  }
  if (s < 3600) {
    return `${Math.floor(s / 60).toFixed(0)}m ${(s % 60).toFixed(0)}s`
  }
  return `${(s / 3600).toFixed(0)}h ${Math.floor((s % 3600) / 60).toFixed(0)}m`
}

(async () => {
  const spinner = document.getElementById("spinner")
  const emptyMessage = document.getElementById("empty")
  const instruct = document.getElementById("instruct")
  emptyMessage.textContent = browser.i18n.getMessage("empty")

  let showInstruction = setTimeout(() => {
    instruct.querySelector('div').textContent = browser.i18n.getMessage("usage")
    instruct.style.display = ""
    spinner.style.display = "none"
  }, 800)

  const port = browser.runtime.connect()
  port.onMessage.addListener(async (message) => {
    clearTimeout(showInstruction)
    instruct.style.display = "none"
    const {cmd} = message
    if (cmd === "show") {
      const {entities} = message
      await build(entities)
    }
    if (cmd === "videoFrame") {
      const {entityId, frame} = message
      videoFrame(entityId, frame)
    }
  })

  async function preview(entity: Entity): Promise<Element> {
    const el = document.createElement("img")
    el.id = entity.id
    el.src = entity.rendered != null ? entity.rendered : entity.src
    return el
    // let ret: Element
    // switch (entity.kind) {
    // case Kind.Source: {
    //   const el = document.createElement("img")
    //   el.src = entity.src
    //   ret = el
    //   break
    // }
    // case Kind.Video: {
    //   const el = document.createElement("video")
    //   el.src = entity.blob //entity.src
    //   el.muted = true
    //   el.loop = true
    //   el.autoplay = true
    //   el.controls = true
    //   try {
    //     await el.play()
    //   } catch (e) {
    //   }
    //   ret = el
    //   break
    // }
    // }
    // return ret
  }

  async function build(entities: Entity[]) {
    document.body.classList.remove("loading")
    spinner.style.display = "none"
    const main = document.querySelector("main")
    main.replaceChildren()
    emptyMessage.style.display = entities.length === 0 ? "" : "none"
    for (const e of entities) {
      const wrap = document.createElement("div")
      wrap.classList.add("img-wrap")
      wrap.dataset.kind = Kind[e.kind].toLowerCase()
      const el = await preview(e)
      wrap.appendChild(el)
      const element = document.createElement("div")
      element.classList.add("element")
      element.appendChild(wrap)
      const from = document.createElement("span")
      from.classList.add("from")
      from.textContent = browser.i18n.getMessage(`type_${From[e.from].toLowerCase()}`)
      element.appendChild(from)
      const size = document.createElement("span")
      size.classList.add("size")
      if (!!e.w && !!e.h) {
        size.textContent = `${e.w}x${e.h}`
      } else {
        size.classList.add("unknown")
        size.textContent = browser.i18n.getMessage("unknown_size")
      }
      if (e.duration !== null && !isNaN(e.duration)) {
        size.textContent += ` ⋅ ${duration(e.duration)}`
      }
      element.appendChild(size)
      const open = document.createElement("button")
      open.textContent = browser.i18n.getMessage("open")
      open.addEventListener("click", () => {
        window.open(e.src, "_blank")
      })
      element.appendChild(open)
      const copy = document.createElement("button")
      copy.textContent = browser.i18n.getMessage("copy_link")
      copy.addEventListener("click", () => {
        document.addEventListener("copy", function (evt) {
          evt.clipboardData.setData("text/plain", e.src)
          evt.preventDefault()
          copy.disabled = true
          copy.textContent = browser.i18n.getMessage("copy_copied")
          setTimeout(() => {
            copy.textContent = browser.i18n.getMessage("copy_link")
            copy.disabled = false
          }, 1000)
        }, {once: true})
        document.execCommand("copy")
      })
      element.appendChild(copy)
      const save = document.createElement("a")
      save.href = e.src
      save.download = "image_under_cursor"
      save.target = "_blank"
      save.textContent = browser.i18n.getMessage("save_as")
      // const save = document.createElement("button")
      // save.addEventListener('click', async () => {
      //   const a = document.createElement("a")
      //   a.href = e.src
      //   a.download = "asset.mp4"
      //   a.textContent = "Download"
      //   a.click()
      //   // const d = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><script>
      //   //   const a = document.createElement("a")
      //   //   a.href = e.src
      //   //   a.target = "_self"
      //   //   a.download = "image_under_cursor"
      //   //   a.textContent = "Download"
      //   //   debugger
      //   //   a.click()
      //   // </script></head></html>`
      //   // window.open("data:text/html,"+encodeURIComponent(d), "_blank")
      // })
      element.appendChild(save)
      main.appendChild(element)
    }
  }

  function videoFrame(uid, frame) {
    (document.getElementById(uid) as HTMLImageElement).src = frame
  }
})()