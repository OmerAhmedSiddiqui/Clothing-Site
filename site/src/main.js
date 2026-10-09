import './style.css'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'

gsap.registerPlugin(ScrollTrigger)

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
const $ = (s, el = document) => el.querySelector(s)
const $$ = (s, el = document) => [...el.querySelectorAll(s)]
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const smoothstep = (a, b, x) => {
  x = clamp((x - a) / (b - a), 0, 1)
  return x * x * (3 - 2 * x)
}

// ---------- Smooth scroll ----------
history.scrollRestoration = 'manual'
window.scrollTo(0, 0)
let lenis
if (!reduced) {
  lenis = new Lenis({ lerp: 0.08 })
  lenis.on('scroll', ScrollTrigger.update)
  gsap.ticker.add((t) => lenis.raf(t * 1000))
  gsap.ticker.lagSmoothing(0)
  lenis.stop()
}
$$('a[href^="#"]').forEach((a) =>
  a.addEventListener('click', (e) => {
    const target = a.getAttribute('href')
    if (!lenis || target.length < 2 || !$(target)) return
    e.preventDefault()
    lenis.scrollTo(target, { duration: 2 })
  })
)

// ---------- Frames ----------
// public/film/ is written by scripts/video-to-frames.sh; the manifest says how many frames there are.
const FILM = `${import.meta.env.BASE_URL}film/`
const frameUrl = (i) => `${FILM}frame_${String(i).padStart(4, '0')}.webp`
const canvas = $('.film__canvas')
const ctx = canvas.getContext('2d', { alpha: false })
let frames = []
let count = 1

// Draw the requested frame, or the nearest earlier one that has arrived.
let drawn = 0
function draw(index, force) {
  let i = clamp(Math.round(index), 1, count)
  while (i > 1 && !frames[i]?.naturalWidth) i--
  const img = frames[i]
  if (!img?.naturalWidth || (i === drawn && !force)) return
  drawn = i
  const cw = canvas.clientWidth
  const ch = canvas.clientHeight
  const s = Math.max(cw / img.naturalWidth, ch / img.naturalHeight)
  const w = img.naturalWidth * s
  const h = img.naturalHeight * s
  ctx.fillStyle = '#0d0b09'
  ctx.fillRect(0, 0, cw, ch)
  ctx.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h)
}

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  canvas.width = Math.round(canvas.clientWidth * dpr)
  canvas.height = Math.round(canvas.clientHeight * dpr)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  draw(drawn || 1, true)
}

// ---------- Chapters: fade in/out over their window, layers drift at their own depth ----------
const chapters = $$('.chapter').map((el) => ({
  el,
  from: parseFloat(el.dataset.from),
  to: parseFloat(el.dataset.to),
  layers: [...el.children].map((node) => ({ node, depth: parseFloat(node.dataset.depth || 0) })),
}))
const marks = chapters.map((c) => c.from)

function updateChapters(p) {
  for (const c of chapters) {
    const span = c.to - c.from
    const f = Math.min(0.045, span * 0.4)
    // The hero is already showing at the top, so it only fades out.
    const enter = c.from <= 0 ? 1 : smoothstep(c.from, c.from + f, p)
    const alpha = enter * (1 - smoothstep(c.to - f, c.to, p))
    c.el.style.opacity = alpha.toFixed(3)
    c.el.style.visibility = alpha > 0.001 ? 'visible' : 'hidden'
    if (alpha <= 0.001) continue
    const local = clamp((p - c.from) / span, 0, 1) - 0.5
    for (const L of c.layers) {
      L.node.style.transform = `translate3d(0, ${(-L.depth * local * 2).toFixed(2)}px, 0)`
    }
  }
}

const progressEl = $('.js-progress')
const chapterEl = $('.js-chapter')
function updateHud(p) {
  progressEl.style.transform = `scaleX(${p.toFixed(4)})`
  const n = marks.filter((m) => p >= m + 0.01).length - 1
  chapterEl.textContent = String(Math.max(0, n)).padStart(2, '0')
}

// ---------- Scroll → eased progress → render ----------
let target = 0
let current = 0
let raf = null
function tick() {
  current += (target - current) * (reduced ? 1 : 0.12)
  if (Math.abs(target - current) < 0.0002) current = target
  draw(1 + current * (count - 1))
  updateChapters(current)
  updateHud(current)
  raf = current === target ? null : requestAnimationFrame(tick)
}
const request = () => (raf ??= requestAnimationFrame(tick))

// ---------- Loader: start once the opening frames are in, stream the rest ----------
const fill = $('.js-load-fill')
const pct = $('.js-load-pct')
const shown = { v: 0 }
const setLoad = (p) =>
  gsap.to(shown, {
    v: p * 100,
    duration: 0.3,
    overwrite: true,
    onUpdate: () => {
      fill.style.transform = `scaleX(${shown.v / 100})`
      pct.textContent = Math.round(shown.v)
    },
  })

async function loadFilm() {
  try {
    count = (await (await fetch(`${FILM}manifest.json`)).json()).count
  } catch {
    count = 240
  }
  frames = new Array(count + 1)
  const first = Math.min(count, 48)
  let done = 0
  return new Promise((resolve) => {
    const onOne = (i) => {
      done++
      if (i === 1) draw(1, true)
      if (done <= first) setLoad(done / first)
      if (done === first) resolve()
    }
    // Opening frames first, in order, so the loader finishes quickly.
    for (let i = 1; i <= count; i++) {
      const img = new Image()
      img.decoding = 'async'
      img.onload = img.onerror = () => onOne(i)
      img.src = frameUrl(i)
      frames[i] = img
    }
  })
}

function start() {
  if (document.body.classList.contains('is-ready')) return
  resize()
  ScrollTrigger.create({
    trigger: '.film',
    start: 'top top',
    end: 'bottom bottom',
    onUpdate: (self) => {
      target = self.progress
      request()
    },
  })
  $$('.reveal').forEach((el) =>
    ScrollTrigger.create({ trigger: el, start: 'top 85%', once: true, onEnter: () => el.classList.add('is-in') })
  )
  updateChapters(0)
  document.body.classList.remove('is-loading')
  document.body.classList.add('is-ready')
  lenis?.start()
  ScrollTrigger.refresh()
}

window.addEventListener('resize', () => {
  resize()
  ScrollTrigger.refresh()
})

Promise.all([loadFilm(), document.fonts.ready]).then(() => setTimeout(start, 350))
// Never leave someone staring at the loader on a slow connection.
setTimeout(start, 9000)

// ---------- Fitting form ----------
const days = $('.js-days')
days.addEventListener('click', (e) => {
  const b = e.target.closest('.day')
  if (!b) return
  $$('.day', days).forEach((d) => {
    d.classList.toggle('is-active', d === b)
    d.setAttribute('aria-checked', d === b)
  })
})
$('.js-fitting').addEventListener('submit', (e) => {
  e.preventDefault()
  const btn = $('.btn-book')
  const name = $('input[type="text"]', e.target).value.trim().split(' ')[0]
  btn.textContent = `Thank you, ${name} — we'll call you about ${$('.day.is-active').textContent}`
  btn.disabled = true
})
