import * as browser from "webextension-polyfill"
import {Entity, From, Kind} from "./common"

function consoleReport(...args) {
  console.debug("[ImagesUnderCursor]", ...args)
}

async function gen2array<T>(gen: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = []
  for await(const x of gen) {
    out.push(x)
  }
  return out
}

function canvasEmpty(context: CanvasRenderingContext2D): boolean {
  return !new Uint32Array(context.getImageData(0, 0, context.canvas.width, context.canvas.height).data.buffer).some(x => x !== 0)
}

async function render(e: Entity, ctx: object): Promise<string> {
  function doRender(resolve, reject, image, width, height) {
    if (width === 0 || height === 0) {
      return reject("zero-sized image")
    }
    const canvas = document.createElement("canvas")
    // We have no idea if this is indeed pixels; this is just best-effort.
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext("2d")
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
    const png = canvas.toDataURL("webp")
    if (png === "data:,") return reject("empty image")
    resolve(png)
  }

  return new Promise((resolve, reject) => {
    if (e.src.startsWith("blob:")) {
      reject("blob")
      return
    }
    if (e.kind === Kind.Source) {
      if (e.src.match(/^data:image\\/)) {
        resolve(e.src)
        return
      }
      const img = new Image()
      img.onload = () => doRender(resolve, reject, img, img.width, img.height)
      img.src = e.src
    } else {
      const vid = document.createElement("video")
      vid.onloadeddata = () => doRender(resolve, reject, vid, vid.videoWidth, vid.videoHeight)

      const getFrame = () => {
        doRender(async (png) => {
          const {keep} = await browser.runtime.sendMessage({cmd: "videoFrame", entityId: e.id, frame: png, ...ctx})
          if (keep) requestAnimationFrame(getFrame)
        }, () => {
        }, vid, vid.videoWidth, vid.videoHeight)
      }

      vid.onplay = () => {
        getFrame()
      }
      vid.muted = true
      vid.src = e.src
      vid.load()
      vid.play()
    }
  })
}

enum MouseState {
  Listening, Clearing, Inhibit
}

(async () => {
  let mousePos, clientPos, mouseEventState: MouseState = MouseState.Listening

  function encodeOptimizedSVGDataUri(svgString) {
    // Credits: https://codepen.io/tigt/post/optimizing-svgs-in-data-uris
    const uriPayload =
      encodeURIComponent(svgString.replace(/[\n\r\t]+/g, ""))
        .replace(/%20/g, " ")
        .replace(/%3D/g, "=")
        .replace(/%3A/g, ":")
        .replace(/%2F/g, "/")
        .replace(/%22/g, "'")
    return `data:image/svg+xml,${uriPayload}`
  }

  async function* img(el: HTMLImageElement): AsyncGenerator<Entity> {
    yield {from: From.Image, kind: Kind.Source, src: el.src, w: el.width, h: el.height}
  }

  async function* svg(el: SVGImageElement): AsyncGenerator<Entity> {
    let elClone = el
    const ns = el.getAttribute("xmlns")
    if (!(ns && ns.length)) {
      elClone = el.cloneNode(true) as SVGImageElement
      elClone.setAttribute("xmlns", "http://www.w3.org/2000/svg")
    }
    yield {
      from: From.Svg,
      kind: Kind.Source,
      src: encodeOptimizedSVGDataUri(elClone.outerHTML),
      name: "image.svg",
    }
  }

  async function* canvas(el: HTMLCanvasElement): AsyncGenerator<Entity> {
    yield {from: From.Canvas, kind: Kind.Source, src: el.toDataURL("png"), w: el.width, h: el.height}
  }

  async function* video(el: HTMLVideoElement): AsyncGenerator<Entity> {
    let src = el.src
    if (src?.length === 0)
      src = el.querySelector("source")?.src
    if (src?.length === 0)
      return
    yield {
      from: From.Video,
      kind: Kind.Video,
      src,
      w: el.videoWidth,
      h: el.videoHeight,
      duration: el.duration,
    }
  }

  function* parseCss(s: string): Generator<string> {
    for (const match of s.matchAll(/url\((?<q>['"])?(?<url>.+?)\k<q>\)/gi)) {
      yield match.groups.url
    }
  }

  async function* croppedCss(url: string, style: CSSStyleDeclaration, from: From) {
    if (style.backgroundPositionX == null || style.backgroundPositionY == null || style.width == null || style.height == null)
      return
    const promise: Promise<Entity> = new Promise((resolve, reject) => {
      const image = new Image()
      image.onload = () => {
        const canvas = document.createElement("canvas")
        // We have no idea if this is indeed pixels; this is just best-effort.
        canvas.width = parseInt(style.width, 10)
        canvas.height = parseInt(style.height, 10)
        const ctx = canvas.getContext("2d")
        ctx.drawImage(image,
          -parseInt(style.backgroundPositionX, 10),
          -parseInt(style.backgroundPositionY, 10),
          canvas.width, canvas.height,
          0, 0, canvas.width, canvas.height)
        try {
          if (canvasEmpty(ctx)) {
            reject("empty canvas")
          } else {
            resolve({
              from,
              kind: Kind.Source,
              src: canvas.toDataURL("png"),
              w: canvas.width, h: canvas.height
            })
          }
        } catch (e) {
          reject(e)
        }
      }
      image.src = url
    })
    try {
      yield await promise
    } catch (e) {
      consoleReport("Could not generate canvas:", e)
    }
  }

  async function* bg(el: Element): AsyncGenerator<Entity> {
    const style = window.getComputedStyle(el)
    for (const url of parseCss(style.backgroundImage.toString())) {
      yield {from: From.Background, src: url, kind: Kind.Source}
      yield* croppedCss(url, style, From.BackgroundCrop)
    }
  }

  async function* pseudo(el: Element) {
    for (const kind of [":before", ":after"]) {
      try {
        const style = window.getComputedStyle(el, kind)
        for (const url of parseCss(style["content"])) {
          yield {from: From.Pseudo, src: url, kind: Kind.Source}
          yield* croppedCss(url, style, From.PseudoCrop)
        }
      } catch (_) {
      }
    }
  }

  async function* inner(el: Element) {
    // Let's avoid recursing into elements that are basically the entire page.
    const tooLarge = (s: number, pageS: number) => s > 256 && s > pageS / 8
    if (tooLarge(el.clientWidth, document.body.clientWidth)
      || tooLarge(el.clientHeight, document.body.clientHeight)) {
      return
    }
    for (const e of el.querySelectorAll("img, svg, video, canvas")) {
      yield* await finder(e, false)
    }
  }

  async function* finder(el, recurse) {
    yield* await bg(el)
    yield* await pseudo(el)
    if (recurse !== false) yield* await inner(el)
    const other = (() => {
      switch (el.tagName.toLowerCase()) {
      case "img":
        return img(el as HTMLImageElement)
      case "svg":
        return svg(el as SVGImageElement)
      case "canvas":
        return canvas(el as HTMLCanvasElement)
      case "video":
        return video(el as HTMLVideoElement)
      }
    })()
    if (!!other) yield* await other
  }

  function uniqueEntity(value: Entity, idx: number, array: Entity[]) {
    return array.findIndex((e: Entity) => e.src === value.src) === idx
  }

  async function findEntities({x, y}: { x: number, y: number }): Promise<Entity[]> {
    const generators = document.elementsFromPoint(x, y).map(finder).flatMap(gen2array)
    return (await Promise.all(generators)).flatMap(e => e).filter(uniqueEntity).slice(0, 5).map(e => ({
      ...e,
      id: crypto.randomUUID()
    }))
  }

  document.addEventListener("mousedown", (e) => {
    if (e.button !== 2) return
    mouseEventState = MouseState.Inhibit
  })

  document.addEventListener("mousemove", e => {
    // When the contextual menu closes, there are a few mousemove events fired
    // before our "show" message is received (listener below).
    // Therefore, give some time (200ms works fine on my machine) for these to
    // fire before clearing the contextMenuInvoked flag so the next invocation
    // will point to the correct location.
    // The delay value is a trade-off:
    //   * if the delay is too small, the search might happen where the mouse
    //     is right after the context menu closes, which is silly.
    //   * if the delay is too large, and the user makes two searches quickly,
    //     both searches will point to the same location, which is also silly.
    if (mouseEventState === MouseState.Inhibit) {
      mouseEventState = MouseState.Clearing
      setTimeout(() => mouseEventState = MouseState.Listening, 200/*ms*/)
      return
    }
    if (mouseEventState === MouseState.Clearing) return
    mousePos = {x: e.pageX, y: e.pageY}
    clientPos = {x: e.clientX, y: e.clientY}
  })

  browser.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    const {cmd} = request
    if (cmd !== "invoke") return

    if (false) {
      const e = document.getElementById("heremark")
      if (e) e.remove()
      const heremark = document.createElement("div")
      heremark.id = "heremark"
      heremark.style.position = "absolute"
      heremark.style.width = "6px"
      heremark.style.height = "6px"
      heremark.style.backgroundColor = "red"
      heremark.style.borderRadius = "50%"
      heremark.style.transform = "translate(-3px -3px)"
      heremark.style.left = `${clientPos.x}px`
      heremark.style.top = `${clientPos.y}px`
      document.body.appendChild(heremark)
    }

    const {ctx} = request
    const entities = (await findEntities(clientPos)).filter(e => !e.src.startsWith("blob:"))
    const rendered = await Promise.allSettled(entities.map(e => render(e, ctx)))
    entities.forEach((e, i) => e.rendered = rendered[i].status === "fulfilled" ? rendered[i].value : null)
    return {entities}
  })
})()
