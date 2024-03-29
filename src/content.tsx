import * as browser from 'webextension-polyfill'

import { render } from 'preact'
import { useState } from 'preact/hooks'
import { querySelectorAllDeep } from 'query-selector-shadow-dom'

// @ts-expect-error: Parcel mini-DSL is unsupported.
import * as contentCss from 'bundle-text:./content.sass'

enum Kind {
  Source, Video,
}

enum From {
  Image, Svg, Canvas, Video, Background, BackgroundCrop, Pseudo, PseudoCrop,
}

interface Entity {
  from: From
  kind: Kind
  rect: DOMRect | null
  src: string
  copy: string
  w?: number
  h?: number
  name?: string
  duration?: number
  rendered?: string
}

interface Point {
  x: number
  y: number
}

async function gen2array<T>(gen: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = []
  for await (const x of gen)
    out.push(x)

  return out
}

function* dedupe(things: Entity[]): Generator<Entity> {
  const seen = new Set()
  for (const thing of things) {
    delete thing.rect
    const j = JSON.stringify(thing)
    if (seen.has(j))
      continue
    seen.add(j)
    yield thing
  }
}

function isWithinRect({ x, y }: Point, r: DOMRect | null) {
  if (!r)
    return true
  return r.top <= y && r.bottom >= y && r.left <= x && r.right >= x
}

type Accessor<T> = (obj: T) => any

function comparatorOf<T>(accessors: Accessor<T>[]) {
  return function (a: T, b: T): number {
    for (const accessor of accessors) {
      const aValue = accessor(a)
      const bValue = accessor(b)
      if (aValue < bValue)
        return -1
      if (aValue > bValue)
        return 1
    }
    return 0
  }
}

const compareEntities = comparatorOf<Entity>([
  e => [From.Video, From.Image, From.Background, From.Svg, From.Canvas, From.Pseudo, From.BackgroundCrop, From.PseudoCrop].indexOf(e.from),
  e => -(e.w + e.h),
])

function encodeOptimizedSVGDataUri(svgString: string): string {
  // Credits: https://codepen.io/tigt/post/optimizing-svgs-in-data-uris
  const uriPayload
        = encodeURIComponent(svgString.replace(/[\n\r\t]+/g, ''))
          .replace(/%20/g, ' ')
          .replace(/%3D/g, '=')
          .replace(/%3A/g, ':')
          .replace(/%2F/g, '/')
          .replace(/%22/g, '\'')
  return `data:image/svg+xml,${uriPayload}`
}

function isCanvasEmpty(context: CanvasRenderingContext2D): boolean {
  return !new Uint32Array(context.getImageData(0, 0, context.canvas.width, context.canvas.height).data.buffer).some(x => x !== 0)
}

async function* img(el: HTMLImageElement): AsyncGenerator<Entity> {
  const src = el.src || el.currentSrc
  yield {
    from: From.Image,
    kind: Kind.Source,
    rect: el.getBoundingClientRect(),
    src,
    copy: src,
    w: el.width,
    h: el.height,
  }
}

async function* svg(el: SVGImageElement): AsyncGenerator<Entity> {
  let elClone = el
  const ns = el.getAttribute('xmlns')
  if (!(ns && ns.length)) {
    elClone = el.cloneNode(true) as SVGImageElement
    elClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  }
  yield {
    from: From.Svg,
    kind: Kind.Source,
    rect: el.getBoundingClientRect(),
    src: encodeOptimizedSVGDataUri(elClone.outerHTML),
    copy: elClone.outerHTML,
    name: 'image.svg',
  }
}

async function* canvas(el: HTMLCanvasElement): AsyncGenerator<Entity> {
  yield {
    from: From.Canvas,
    kind: Kind.Source,
    rect: el.getBoundingClientRect(),
    src: el.toDataURL('png'),
    copy: null,
    w: el.width,
    h: el.height,
  }
}

async function* video(el: HTMLVideoElement): AsyncGenerator<Entity> {
  let src = el.currentSrc
  if (src?.length === 0)
    src = el.querySelector('source')?.src
  if (src?.length === 0)
    return
  yield {
    from: From.Video,
    kind: Kind.Video,
    rect: el.getBoundingClientRect(),
    src,
    copy: src,
    w: el.videoWidth,
    h: el.videoHeight,
    duration: el.duration,
  }
}

function* parseCss(s: string): Generator<string> {
  for (const match of s.matchAll(/url\s*\((?<q>['"])?(?<url>.+?)\k<q>\s*\)/gi))
    yield match.groups.url
}

async function* croppedCss(url: string, style: CSSStyleDeclaration, from: From): AsyncGenerator<Entity> {
  if (style.backgroundPositionX == null || style.backgroundPositionY == null || style.width == null || style.height == null)
    return
  const promise: Promise<Entity> = new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      const canvas = document.createElement('canvas')
      // We have no idea if this is indeed pixels; this is just best-effort.
      canvas.width = Number.parseInt(style.width, 10)
      canvas.height = Number.parseInt(style.height, 10)
      const ctx = canvas.getContext('2d')
      ctx.drawImage(image, -Number.parseInt(style.backgroundPositionX, 10), -Number.parseInt(style.backgroundPositionY, 10), canvas.width, canvas.height, 0, 0, canvas.width, canvas.height)
      try {
        if (isCanvasEmpty(ctx)) {
          reject(new Error('empty canvas'))
        }
        else {
          resolve({
            from,
            kind: Kind.Source,
            rect: null, // FIXME
            src: canvas.toDataURL('png'),
            copy: null,
            w: canvas.width,
            h: canvas.height,
          })
        }
      }
      catch (e) { reject(e) }
    }
    image.src = url
  })
  try {
    yield await promise
  }
  catch (e) { }
}

async function* cssProperty(el: Element, style: CSSStyleDeclaration, cssString: string): AsyncGenerator<Entity> {
  for (const url of parseCss(cssString)) {
    yield {
      from: From.Background,
      kind: Kind.Source,
      rect: el.getBoundingClientRect(),
      src: url,
      copy: url,
    }
    yield * croppedCss(url, style, From.BackgroundCrop)
  }
}

async function* css(el: Element): AsyncGenerator<Entity> {
  for (const kind of [undefined, ':before', ':after']) {
    try {
      const style = window.getComputedStyle(el, kind)
      yield * cssProperty(el, style, style.backgroundImage.toString())
      yield * cssProperty(el, style, style.maskImage.toString())
      yield * cssProperty(el, style, style.content.toString())
    }
    catch (e) { }
  }
}

async function* inner(el: HTMLElement, pos: Point, depth: number): AsyncGenerator<Entity> {
  for (const subEl of querySelectorAllDeep('img, svg, video, canvas', el))
    yield * finder(subEl, pos, depth)
}

async function* finder(el, pos: Point, depth: number): AsyncGenerator<Entity> {
  yield * css(el)
  if (depth <= 1 && isWithinRect(pos, el.getBoundingClientRect()))
    yield * inner(el, pos, depth + 1)
  if (el instanceof HTMLImageElement)
    yield * img(el)
  else if (el instanceof SVGElement && el.tagName.toLowerCase() === 'svg')
    yield * svg(el as SVGImageElement)
  else if (el instanceof HTMLCanvasElement)
    yield * canvas(el)
  else if (el instanceof HTMLVideoElement)
    yield * video(el)
}

async function findEntities(pos: Point): Promise<Entity[]> {
  const { x, y } = pos
  const generators = document.elementsFromPoint(x, y).map(el => finder(el, pos, 0)).flatMap(gen2array)
  const allEntities = [...(await Promise.all(generators)).flatMap(e => e)]
  const withinRect = allEntities.filter(e => isWithinRect(pos, e.rect))
  return [...dedupe(withinRect)].sort(compareEntities)
}

function OneImage({ entity }) {
  const [copying, setCopying] = useState(false)
  function copy(e, entity: Entity) {
    navigator.clipboard.writeText(entity.copy)
    setCopying(true)
    setTimeout(() => setCopying(false), 1000)
  }
  return (
    <>
      <a href={entity.src} target="_blank">
        <img src={entity.rendered ? entity.rendered : entity.src} />
      </a>
      <div className="col">
        <span>{browser.i18n.getMessage(`type_${From[entity.from].toLowerCase()}`)}</span>
        <span className="size">{entity.w !== undefined && entity.h !== undefined ? `${entity.w} × ${entity.h}` : <>&nbsp;</>}</span>
        {entity.copy
          ? (
            <button onClick={e => copy(e, entity)} disabled={copying}>
              {browser.i18n.getMessage(copying ? 'copy_copied' : 'copy_link')}
            </button>
            )
          : null}
      </div>
    </>
  )
}

function Empty() {
  return <div className="empty">{browser.i18n.getMessage('empty')}</div>
}

function findAndShow(pos: Point, shortcut?: string): Promise<void> {
  return new Promise((resolve, _reject) => {
    findEntities(pos).then((entities) => {
      const shadow = document.createElement('div')
      shadow.style.position = 'absolute'
      shadow.style.zIndex = '2147483647'
      shadow.style.top = '0'
      shadow.style.bottom = '0'
      shadow.style.left = '0'
      shadow.style.right = '0'
      shadow.style.background = 'transparent'
      const shadowRoot = shadow.attachShadow({ mode: 'open' })
      function close() {
        try {
          document.removeEventListener('keydown', closeOnEscape)
          document.body.removeChild(shadow)
        }
        catch (e) { }
        resolve()
      }
      function closeOnEscape(e: KeyboardEvent) {
        if (e.key === 'Escape')
          close()
      }
      function ignore(e) {
        e.stopPropagation()
        e.preventDefault()
      }
      document.addEventListener('keydown', closeOnEscape)
      render(
        <>
          <style>{contentCss}</style>
          <main onClick={close}>
            <div>
              <span className="logo" onClick={ignore} />
              <div className="scroll" onClick={ignore}>
                {entities.map((entity, i) => (
                  <section key={i}>
                    <OneImage entity={entity} />
                  </section>
                ))}
                {!entities.length ? <Empty /> : null}
              </div>
              {shortcut
                ? (
                  <div className="shortcut">
                    {browser.i18n.getMessage('shortcut', [shortcut])}
                  </div>
                  )
                : null}
            </div>
          </main>
        </>,
        shadowRoot,
      )
      document.body.append(shadow)
    })
  })
}

(async () => {
  let clientPos: Point = null
  let ignore = false

  browser.runtime.onMessage.addListener(async (request, _sender, _sendResponse) => {
    const { cmd } = request
    if (ignore || !clientPos || cmd !== 'invoke')
      return
    const { shortcut } = request
    ignore = true
    await findAndShow(clientPos, shortcut)
    ignore = false
  })

  document.addEventListener('mousemove', async (e) => {
    if (ignore)
      return
    clientPos = {
      x: e.clientX,
      y: e.clientY,
    }
  })
})()
