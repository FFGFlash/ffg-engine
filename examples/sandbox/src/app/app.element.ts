import { Engine, SystemType } from '@ffg-engine/core'
import styles from './app.module.css'

export class AppElement extends HTMLElement {
  public static observedAttributes = []

  async connectedCallback() {
    this.classList.add(styles.app)
    const canvas = document.createElement('canvas')
    canvas.id = 'game'
    canvas.width = 800
    canvas.height = 600
    this.appendChild(canvas)

    const engine = new Engine()

    const world = engine.world
      .registerComponents('player', 'position', 'velocity', 'circle', 'rectangle', 'color')
      .addResource('canvas', { value: canvas })
      .addResource('context', { value: null })
      .addResource('input', new Map())
      .addResource('debug', { fps: 0, averageFPS: 0 })

    const setupCanvas = world
      .createSystem()
      .deps(data => [data.mutRes('canvas'), data.mutRes('context'), data.mutRes('input')])
      .callback((canvas, context, input) => {
        context.value = canvas.value.getContext('2d')
        if (!context.value) throw new Error('Failed to get canvas context')

        canvas.value.tabIndex = 0

        canvas.value.addEventListener('keydown', e => {
          input.set(e.key, 1)
          console.log(`Key pressed: ${e.key}`)
        })

        canvas.value.addEventListener('keyup', e => {
          input.set(e.key, 0)
          console.log(`Key released: ${e.key}`)
        })

        canvas.value.addEventListener('blur', () => {
          input.clear()
        })
      })

    const startup = world
      .createSystem()
      .deps(data => [data.commands.spawn, data.res('canvas')])
      .after(setupCanvas)
      .callback((spawn, canvas) => {
        spawn({
          player: {},
          position: { x: canvas.value.width / 2, y: canvas.value.height / 2 },
          velocity: { x: 0, y: 0 },
          circle: { radius: 10 },
          color: { value: 'blue' },
        })
      })

    const updatePlayerMovement = world
      .createSystem()
      .deps(data => [data.query.write('velocity').with('player'), data.res('input')])
      .callback((query, input) => {
        for (const [, vel] of query) {
          vel.x =
            ((input.get('ArrowRight') || input.get('d') || 0) -
              (input.get('ArrowLeft') || input.get('a') || 0)) *
            250
          vel.y =
            ((input.get('ArrowDown') || input.get('s') || 0) -
              (input.get('ArrowUp') || input.get('w') || 0)) *
            250
        }
      })

    const updatePositions = world
      .createSystem()
      .after(updatePlayerMovement)
      .deps(data => [data.query.write('position').read('velocity'), data.res('time')])
      .callback((query, time) => {
        for (const [, position, velocity] of query) {
          position.x += velocity.x * time.delta
          position.y += velocity.y * time.delta
        }
      })

    const updateDebugInfo = world
      .createSystem()
      .deps(data => [data.mutRes('debug'), data.res('time')])
      .callback((debug, time) => {
        debug.averageFPS = Math.round(time.frame / time.elapsed)
        if (!debug._fpsConunter) debug._fpsConunter = 0
        if (!debug._fpsElapsed) debug._fpsElapsed = 0

        debug._fpsConunter++
        debug._fpsElapsed += time.delta

        if (debug._fpsElapsed >= 1) {
          debug.fps = debug._fpsConunter
          debug._fpsConunter = 0
          debug._fpsElapsed = 0
        }
      })

    const clearCanvas = world
      .createSystem()
      .deps(data => [data.mutRes('context')])
      .callback(context => {
        if (!context.value) return
        context.value.fillStyle = 'white'
        context.value.fillRect(0, 0, context.value.canvas.width, context.value.canvas.height)
      })

    const drawFPS = world
      .createSystem()
      .deps(data => [data.mutRes('context'), data.res('debug')])
      .after(clearCanvas)
      .callback((context, debug) => {
        if (!context.value) return
        context.value.fillStyle = 'black'
        context.value.font = '16px Arial'
        context.value.fillText(`FPS: ${debug.fps}`, 10, 20)
        context.value.fillText(`Avg FPS: ${debug.averageFPS}`, 10, 40)
      })

    const drawCircles = world
      .createSystem()
      .deps(data => [data.query.read('position', 'circle', 'color'), data.mutRes('context')])
      .after(clearCanvas)
      .before(drawFPS)
      .callback((query, context) => {
        if (!context.value) return
        for (const [, position, circle, color] of query) {
          context.value.fillStyle = color.value
          context.value.beginPath()
          context.value.arc(position.x, position.y, circle.radius, 0, Math.PI * 2)
          context.value.fill()
          context.value.closePath()
        }
      })

    const drawRectangles = world
      .createSystem()
      .deps(data => [data.query.read('position', 'rectangle', 'color'), data.mutRes('context')])
      .after(clearCanvas)
      .before(drawFPS)
      .callback((query, context) => {
        if (!context.value) return
        for (const [, position, rectangle, color] of query) {
          context.value.fillStyle = color.value
          context.value.fillRect(
            position.x - rectangle.width / 2,
            position.y - rectangle.height / 2,
            rectangle.width,
            rectangle.height
          )
        }
      })

    world
      .registerSystems(SystemType.STARTUP, startup, setupCanvas)
      .registerSystems(SystemType.FIXED_UPDATE, updatePositions, updatePlayerMovement)
      .registerSystems(SystemType.UPDATE, updateDebugInfo)
      .registerSystems(SystemType.RENDER, drawFPS, drawCircles, drawRectangles, clearCanvas)

    await engine.start()
  }
}
customElements.define('ffg-engine-root', AppElement)

declare module '@ffg-engine/ecs' {
  interface ComponentRegistry {
    player: Record<never, never>
    position: { x: number; y: number }
    velocity: { x: number; y: number }
    circle: { radius: number }
    rectangle: { width: number; height: number }
    color: { value: string }
  }

  interface ResourceRegistry {
    canvas: { value: HTMLCanvasElement }
    context: { value: CanvasRenderingContext2D | null }
    input: Map<string, number>
    debug: { fps: number; averageFPS: number; _fpsConunter?: number; _fpsElapsed?: number }
  }
}
