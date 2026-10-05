import './style.css'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'

gsap.registerPlugin(ScrollTrigger)

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
const $ = (s, el = document) => el.querySelector(s)
const $$ = (s, el = document) => [...el.querySelectorAll(s)]

// ---------- Smooth scroll ----------
let lenis
if (!reduced) {
  lenis = new Lenis({ lerp: 0.09 })
  lenis.on('scroll', ScrollTrigger.update)
  gsap.ticker.add((t) => lenis.raf(t * 1000))
  gsap.ticker.lagSmoothing(0)
  $$('a[href^="#"]').forEach((a) =>
    a.addEventListener('click', (e) => {
      const target = a.getAttribute('href')
      if (target.length > 1 && $(target)) {
        e.preventDefault()
        lenis.scrollTo(target, { duration: 1.6 })
      }
    })
  )
}

// ---------- Split text helpers ----------
$$('.js-words').forEach((el) => {
  el.innerHTML = el.textContent.trim().split(/\s+/).map((w) => `<span class="w">${w}</span>`).join(' ')
})
$$('.js-split').forEach((el) => {
  el.innerHTML = [...el.textContent].map((c) => (c === ' ' ? ' ' : `<span class="ch">${c}</span>`)).join('')
})

// ---------- Loader: wait for images, count up, then reveal ----------
// Always start at the top so the hero story plays from the beginning.
history.scrollRestoration = 'manual'
window.scrollTo(0, 0)
document.body.classList.add('is-loading')
lenis?.stop()
// Only block on what's visible first (hero photo + fonts); the rest streams in behind.
const critical = [$('.hero__frame img')]
const total = critical.length + 1
let loaded = 0
const counter = { v: 0 }
const countEl = $('.js-count')
const bump = () => {
  loaded++
  gsap.to(counter, { v: Math.round((loaded / total) * 100), duration: 0.4, onUpdate: () => (countEl.textContent = Math.round(counter.v)) })
}
const imgReady = (i) => (i.complete ? Promise.resolve() : new Promise((r) => (i.onload = i.onerror = r)))
const ready = Promise.all([
  ...critical.map((i) => imgReady(i).then(bump)),
  document.fonts.ready.then(bump),
])
// Re-measure pinned sections once all photos have arrived.
window.addEventListener('load', () => ScrollTrigger.refresh())
gsap.to('.loader__word span', { y: 0, duration: 1, stagger: 0.05, ease: 'expo.out', delay: 0.1 })

// Intro tweens only touch .hero__in / clip-path / y, so they never fight the scroll timeline
// (which animates .hero__line, frame size and opacity) and scrolling can unlock immediately.
gsap.set('.hero__in', { yPercent: 110 })
gsap.set('.hero__frame', { clipPath: 'inset(100% 0% 0% 0%)' })
gsap.set('.hero__meta, .hero__scroll, .nav', { y: 16 })

Promise.all([ready, new Promise((r) => setTimeout(r, 900))]).then(() => {
  countEl.textContent = 100
  const unlock = () => {
    $('.loader').remove()
    document.body.classList.remove('is-loading')
    window.scrollTo(0, 0)
    lenis?.scrollTo(0, { immediate: true, force: true })
    lenis?.start()
    if (!reduced) initScroll()
    else $('.hero__over').style.opacity = 1
  }
  gsap.timeline()
    .to('.loader__word span', { y: '-110%', duration: 0.6, stagger: 0.025, ease: 'expo.in' })
    .to('.loader', { yPercent: -100, duration: 0.9, ease: 'expo.inOut' }, '-=0.15')
    .call(unlock)
    .to('.hero__in', { yPercent: 0, duration: 1.3, stagger: 0.1, ease: 'expo.out' }, '-=0.45')
    .to('.hero__frame', { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.3, ease: 'expo.out' }, '<0.1')
    .to('.hero__meta, .hero__scroll, .nav', { y: 0, duration: 1, stagger: 0.06, ease: 'expo.out' }, '<0.2')
})

function initScroll() {
  const mm = gsap.matchMedia()

  // ---------- 1. Hero: small frame grows to fill the screen ----------
  const hero = gsap.timeline({
    scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom bottom', scrub: 1 },
  })
  hero
    .to('.hero__frame', { width: '100vw', height: '100vh', ease: 'power2.inOut', duration: 1 })
    .to('.hero__frame img', { scale: 1, ease: 'power2.inOut', duration: 1 }, 0)
    .to('.hero__line--l', { xPercent: -60, opacity: 0, duration: 0.6 }, 0)
    .to('.hero__line--r', { xPercent: 60, opacity: 0, duration: 0.6 }, 0)
    .to('.hero__meta, .hero__scroll', { opacity: 0, duration: 0.3 }, 0)
    .to('.hero__over', { opacity: 1, y: 0, duration: 0.4 }, 0.85)
    .fromTo('.hero__over h2', { y: 60 }, { y: 0, duration: 0.4 }, 0.85)
    .to({}, { duration: 0.3 })

  // ---------- 2. Manifesto: words light up ----------
  gsap.to('.manifesto__text .w', {
    opacity: 1,
    stagger: 0.1,
    ease: 'none',
    scrollTrigger: { trigger: '.manifesto', start: 'top 70%', end: 'bottom 60%', scrub: true },
  })

  // ---------- Counters ----------
  $$('.js-num').forEach((el) => {
    const o = { v: 0 }
    ScrollTrigger.create({
      trigger: el,
      start: 'top 95%',
      once: true,
      onEnter: () => gsap.to(o, { v: +el.dataset.to, duration: 2, ease: 'power3.out', onUpdate: () => (el.textContent = Math.round(o.v)) }),
    })
  })

  // ---------- Product grid + general reveals ----------
  gsap.utils.toArray('.product').forEach((p, i) => {
    gsap.from(p, { y: 80, opacity: 0, duration: 1.3, ease: 'expo.out', delay: (i % 3) * 0.12, scrollTrigger: { trigger: p, start: 'top 90%' } })
  })
  gsap.utils.toArray('.collection__head h2, .atelier__copy > *, .footer__top > *').forEach((el) => {
    gsap.from(el, { y: 40, opacity: 0, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 90%' } })
  })
  gsap.fromTo('.atelier__img img', { scale: 1.25 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: '.atelier', start: 'top bottom', end: 'bottom top', scrub: true } })
  gsap.from('.footer__mark', { yPercent: 40, opacity: 0, ease: 'none', scrollTrigger: { trigger: '.footer', start: 'top bottom', end: 'bottom bottom', scrub: true } })

  // ---------- Desktop-only storytelling ----------
  mm.add('(min-width: 821px)', () => {
    // 3. Fabric: zoom out of the cloth, photos float up
    const fab = gsap.timeline({ scrollTrigger: { trigger: '.fabric', start: 'top top', end: 'bottom bottom', scrub: 1 } })
    fab
      .to('.fabric__bg img', { scale: 1, duration: 1, ease: 'none' }, 0)
      .from('.fabric__copy', { y: 80, opacity: 0, duration: 0.3 }, 0.05)
      .to('.fabric__card--a', { y: '-125vh', duration: 1, ease: 'none' }, 0.15)
      .to('.fabric__card--b', { y: '-150vh', duration: 1, ease: 'none' }, 0.3)
      .to('.fabric__stats', { opacity: 1, duration: 0.2 }, 0.5)

    // 4. The Cut: horizontal scroll
    const track = $('.cut__track')
    const dist = () => track.scrollWidth - window.innerWidth
    const horiz = gsap.to(track, {
      x: () => -dist(),
      ease: 'none',
      scrollTrigger: { trigger: '.cut', pin: '.cut__pin', start: 'top top', end: () => '+=' + dist(), scrub: 1, invalidateOnRefresh: true },
    })
    gsap.to('.cut__head', { opacity: 0.12, ease: 'none', scrollTrigger: { trigger: '.cut', start: 'top top', end: '+=600', scrub: true } })
    $$('.cut__img img').forEach((img) => {
      gsap.fromTo(img, { xPercent: -8 }, { xPercent: 8, ease: 'none', scrollTrigger: { trigger: img.parentNode, containerAnimation: horiz, start: 'left right', end: 'right left', scrub: true } })
    })

    // 5. Monochrome: parallax photos + letters rise
    $$('.mono__img').forEach((el) => {
      gsap.to(el, { y: () => +el.dataset.speed * window.innerHeight * 1.5, ease: 'none', scrollTrigger: { trigger: '.mono', start: 'top bottom', end: 'bottom top', scrub: true } })
    })
  })

  gsap.from('.mono__title .ch', {
    yPercent: 100,
    opacity: 0,
    stagger: 0.03,
    duration: 1.2,
    ease: 'expo.out',
    scrollTrigger: { trigger: '.mono', start: 'top 60%' },
  })
}
