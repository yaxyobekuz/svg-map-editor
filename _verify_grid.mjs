import { chromium } from 'playwright-core'

const URL = 'http://localhost:5175/'
const OUT = '/private/tmp/claude-501/-Users-yaxyobek-Desktop-svg-map-editor/77bd8858-2a29-4ea1-828a-8f0fb8d2843f/scratchpad'
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errors = []
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message))

await page.goto(URL, { waitUntil: 'networkidle' })
await page.waitForTimeout(2500)

// 1) grid should be visible: the pattern-filled rect exists
const gridRects = await page.locator('svg.svg-overlay rect[fill^="url(#grid"]').count()
console.log('grid pattern rects:', gridRects)
await page.screenshot({ path: `${OUT}/g1-grid.png` })

// 2) draw a rectangle
await page.getByTitle(/Rectangle chizish/).click()
const svg = page.locator('svg.svg-overlay')
const box = await svg.boundingBox()
const cx = box.x + box.width / 2
const cy = box.y + box.height / 2
await page.mouse.move(cx - 137, cy - 111) // deliberately off-grid start
await page.mouse.down()
await page.mouse.move(cx + 143, cy + 117, { steps: 8 })
await page.mouse.up()
await page.waitForTimeout(300)

// 3) enter vertex-edit (double-click)
await page.mouse.dblclick(cx, cy)
await page.waitForTimeout(300)
const circles = await page.locator('svg.svg-overlay circle').count()
console.log('vertex handles:', circles)

// 4) drag the top-left vertex to an OFF-GRID pixel and check it snaps.
// top-left vertex ≈ snapped(cx-137, cy-111). Grab the polygon points before.
function readPoly() {
  return page.evaluate(() => {
    const poly = document.querySelector('svg.svg-overlay polygon')
    return poly ? poly.getAttribute('points') : null
  })
}
// Drag first vertex to a clearly off-grid target (e.g. +7,+13 from a grid line)
// We'll drop near (cx-200+7, cy-160+13) — i.e. an arbitrary non-multiple offset.
const svgRect = await svg.boundingBox()
const targetClientX = svgRect.x + 247 // arbitrary
const targetClientY = svgRect.y + 193 // arbitrary
// the current top-left vertex is at snapped(cx-137,cy-111); start drag there
await page.mouse.move(cx - 140, cy - 113) // close enough to grab (r=5.5)
await page.mouse.down()
await page.mouse.move(targetClientX, targetClientY, { steps: 10 })
await page.mouse.up()
await page.waitForTimeout(300)
await page.screenshot({ path: `${OUT}/g2-vertex-snapped.png` })

const pts = await readPoly()
console.log('polygon points after drag:', pts)

// verify EVERY vertex x and y is a multiple of 20 (grid size), within rounding.
let allSnapped = true
if (pts) {
  for (const pair of pts.trim().split(/\s+/)) {
    const [x, y] = pair.split(',').map(Number)
    if (Math.abs(x % 20) > 0.5 && Math.abs((x % 20) - 20) > 0.5) allSnapped = false
    if (Math.abs(y % 20) > 0.5 && Math.abs((y % 20) - 20) > 0.5) allSnapped = false
  }
}
console.log('ALL vertices on 20px grid?', allSnapped)

// 5) toggle Snap OFF, drag again to an off-grid spot, expect NOT snapped
await page.getByTitle(/magnit/).click() // Snap toggle
await page.waitForTimeout(150)
await page.mouse.move(targetClientX, targetClientY) // grab the vertex we moved
await page.mouse.down()
await page.mouse.move(svgRect.x + 333, svgRect.y + 267, { steps: 8 }) // off-grid
await page.mouse.up()
await page.waitForTimeout(300)
const pts2 = await readPoly()
let anyOffGrid = false
if (pts2) {
  for (const pair of pts2.trim().split(/\s+/)) {
    const [x, y] = pair.split(',').map(Number)
    const offX = Math.min(Math.abs(x % 20), Math.abs((x % 20) - 20))
    const offY = Math.min(Math.abs(y % 20), Math.abs((y % 20) - 20))
    if (offX > 0.5 || offY > 0.5) anyOffGrid = true
  }
}
console.log('with snap OFF, some vertex off-grid?', anyOffGrid)

console.log('PAGE ERRORS:', errors.length ? errors : 'none')
await browser.close()
