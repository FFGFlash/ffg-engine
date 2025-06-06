import './app.element.css'
import { SystemType, World } from '@ffg-engine/core'

declare module '@ffg-engine/core' {
  interface ResourceRegistry {
    canvas: HTMLCanvasElement
    ctx: { value: CanvasRenderingContext2D | null }
    clearColor: { value: string | null }
    input: Map<string, number>
  }

  interface ComponentRegistry {
    player: Record<never, never>
    position: { x: number; y: number }
    velocity: { dx: number; dy: number }
    circle: { radius: number }
    color: { value: string }
    speed: { value: number }
  }
}

export class AppElement extends HTMLElement {
  public static observedAttributes = []

  connectedCallback() {
    const canvas = document.createElement('canvas')
    canvas.id = 'canvas'
    canvas.width = 800
    canvas.height = 600

    this.appendChild(canvas)

    const world = new World()
      .addResource('canvas', canvas)
      .addResource('ctx', { value: null })
      .addResource('clearColor', { value: 'white' })
      .addResource('input', new Map<string, number>())

    const setupCanvas = world
      .createSystem()
      .name('setupCanvas')
      .deps(data => [data.mutRes('canvas'), data.mutRes('ctx'), data.mutRes('input')])
      .fn((canvas, ctx, input) => {
        ctx.value = canvas.getContext('2d')
        if (!ctx.value) throw new Error('Failed to get canvas context')

        canvas.tabIndex = 0

        canvas.addEventListener('keydown', e => {
          input.set(e.key, 1)
        })

        canvas.addEventListener('keyup', e => {
          input.set(e.key, 0)
        })
      })

    const setupGame = world
      .createSystem()
      .name('setupGame')
      .after('setupCanvas')
      .deps(data => [data.commands.spawn, data.res('canvas')])
      .fn((spawn, canvas) => {
        spawn({
          player: {},
          position: { x: canvas.width / 2, y: canvas.height / 2 },
          velocity: { dx: 0, dy: 0 },
          circle: { radius: 20 },
          color: { value: 'blue' },
          speed: { value: 5 },
        })
      })

    world.registerSystems(SystemType.STARTUP, setupCanvas, setupGame)

    const updatePlayerMovement = world
      .createSystem()
      .name('updatePlayerMovement')
      .deps(data => [data.query.with('player').read('speed').write('velocity'), data.res('input')])
      .fn((query, input) => {
        const [, speed, vel] = query.peek()!

        vel.dx = ((input.get('d') ?? 0) - (input.get('a') ?? 0)) * speed.value
        vel.dy = ((input.get('s') ?? 0) - (input.get('w') ?? 0)) * speed.value
      })

    const updatePositions = world
      .createSystem()
      .name('updatePositions')
      .after('updatePlayerMovement')
      .deps(data => [data.query.read('velocity').write('position'), data.res('canvas')])
      .fn((query, canvas) => {
        for (const [, vel, pos] of query) {
          pos.x += vel.dx
          pos.y += vel.dy

          // Loop the canvas
          if (pos.x < 0) pos.x = canvas.width
          if (pos.x > canvas.width) pos.x = 0
          if (pos.y < 0) pos.y = canvas.height
          if (pos.y > canvas.height) pos.y = 0
        }
      })

    world.registerSystems(SystemType.FIXED_UPDATE, updatePlayerMovement, updatePositions)

    const clearCanvas = world
      .createSystem()
      .name('clearCanvas')
      .deps(data => [data.mutRes('ctx'), data.res('clearColor')])
      .fn((ctx, clearColor) => {
        if (!ctx.value) return

        if (!clearColor.value) {
          ctx.value.clearRect(0, 0, ctx.value.canvas.width, ctx.value.canvas.height)
          return
        }

        ctx.value.fillStyle = clearColor.value
        ctx.value.fillRect(0, 0, ctx.value.canvas.width, ctx.value.canvas.height)
      })

    const drawCircles = world
      .createSystem()
      .name('drawCitcles')
      .deps(data => [data.mutRes('ctx'), data.query.read('position', 'circle', 'color')])
      .fn((ctx, query) => {
        if (!ctx.value) return

        for (const [, pos, circle, color] of query) {
          ctx.value.fillStyle = color.value
          ctx.value.beginPath()
          ctx.value.arc(pos.x, pos.y, circle.radius, 0, Math.PI * 2)
          ctx.value.fill()
        }
      })

    world.registerSystems(SystemType.RENDER, clearCanvas, drawCircles)

    world.start()
  }
}
customElements.define('ffg-game', AppElement)
