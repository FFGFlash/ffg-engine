import { Engine, SystemType } from '@ffg-engine/core'
import styles from './app.module.css'
import { InputPlugin } from '@ffg-engine/input'

export class AppElement extends HTMLElement {
  public static observedAttributes = []

  async connectedCallback() {
    this.classList.add(styles.app)
    const canvas = document.createElement('canvas')
    canvas.id = 'game'
    canvas.width = 800
    canvas.height = 600
    this.appendChild(canvas)

    const context = canvas.getContext('2d')
    if (!context) throw new Error('Failed to get canvas context')

    const engine = (window.engine = new Engine().addPlugin(
      InputPlugin.configure({ target: canvas })
    ))

    const world = engine.world
      .registerComponents(
        'player',
        'position',
        'velocity',
        'circle',
        'rectangle',
        'color',
        'friction'
      )
      .addResource('context', context)
      .addResource('debug', { fps: 0, averageFPS: 0 })

    const startup = world
      .createSystem()
      .deps(data => [data.commands.spawn, data.res('context')])
      .callback((spawn, context) => {
        const canvas = context.canvas
        const halfWidth = canvas.width / 2
        const halfHeight = canvas.height / 2

        spawn({
          player: {},
          position: { x: halfWidth, y: halfHeight },
          velocity: { x: 0, y: 0 },
          circle: { radius: 10 },
          color: { value: 'blue' },
        })

        for (let i = 0; i < 10000; i++) {
          spawn({
            position: {
              x: Math.random() * canvas.width,
              y: Math.random() * canvas.height,
            },
            velocity: { x: (Math.random() - 0.5) * 100, y: (Math.random() - 0.5) * 100 },
            circle: { radius: 5 + Math.random() * 15 },
            color: { value: `hsl(${Math.random() * 360}, 100%, 50%)` },
            friction: { strength: 1 },
          })
        }
      })

    const updatePlayerMovement = world
      .createSystem()
      .deps(data => [data.query.write('velocity').with('player'), data.res('input')])
      .callback((query, input) => {
        for (const [, vel] of query) {
          vel.x = (input.get('ArrowRight', 'd') - input.get('ArrowLeft', 'a')) * 250
          vel.y = (input.get('ArrowDown', 's') - input.get('ArrowUp', 'w')) * 250
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

    const updateFriction = world
      .createSystem()
      .deps(data => [data.query.write('velocity').read('friction'), data.res('time')])
      .before(updatePositions)
      .callback((query, time) => {
        for (const [, velocity, friction] of query) {
          if (friction.strength <= 0 || (velocity.x === 0 && velocity.y === 0)) continue

          const mag = Math.sqrt(velocity.x ** 2 + velocity.y ** 2)
          if (mag < 0.01) {
            velocity.x = 0
            velocity.y = 0
            continue
          }

          const normalizedX = velocity.x / mag
          const normalizedY = velocity.y / mag

          velocity.x -= normalizedX * friction.strength * time.delta
          velocity.y -= normalizedY * friction.strength * time.delta
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
        context.fillStyle = 'white'
        context.fillRect(0, 0, context.canvas.width, context.canvas.height)
      })

    const drawFPS = world
      .createSystem()
      .deps(data => [data.mutRes('context'), data.res('debug')])
      .after(clearCanvas)
      .callback((context, debug) => {
        context.fillStyle = 'black'
        context.font = '16px Arial'
        context.fillText(`FPS: ${debug.fps}`, 10, 20)
        context.fillText(`Avg FPS: ${debug.averageFPS}`, 10, 40)
      })

    const drawCircles = world
      .createSystem()
      .deps(data => [data.query.read('position', 'circle', 'color'), data.mutRes('context')])
      .after(clearCanvas)
      .before(drawFPS)
      .callback((query, context) => {
        for (const [, position, circle, color] of query) {
          context.fillStyle = color.value
          context.beginPath()
          context.arc(position.x, position.y, circle.radius, 0, Math.PI * 2)
          context.fill()
          context.closePath()
        }
      })

    const drawRectangles = world
      .createSystem()
      .deps(data => [data.query.read('position', 'rectangle', 'color'), data.mutRes('context')])
      .after(clearCanvas)
      .before(drawFPS)
      .callback((query, context) => {
        for (const [, position, rectangle, color] of query) {
          context.fillStyle = color.value
          context.fillRect(
            position.x - rectangle.width / 2,
            position.y - rectangle.height / 2,
            rectangle.width,
            rectangle.height
          )
        }
      })

    world
      .registerSystems(SystemType.STARTUP, startup)
      .registerSystems(
        SystemType.FIXED_UPDATE,
        updatePositions,
        updatePlayerMovement,
        updateFriction
      )
      .registerSystems(SystemType.UPDATE, updateDebugInfo)
      .registerSystems(SystemType.RENDER, drawFPS, drawCircles, drawRectangles, clearCanvas)

    await engine.start()
  }
}
customElements.define('ffg-engine-root', AppElement)

declare module '@ffg-engine/core' {
  interface ComponentRegistry {
    player: Record<never, never>
    position: { x: number; y: number }
    velocity: { x: number; y: number }
    circle: { radius: number }
    rectangle: { width: number; height: number }
    color: { value: string }
    friction: { strength: number }
  }

  interface ResourceRegistry {
    context: CanvasRenderingContext2D
    debug: { fps: number; averageFPS: number; _fpsConunter?: number; _fpsElapsed?: number }
  }
}

declare global {
  interface Window {
    engine: Engine
  }
}
