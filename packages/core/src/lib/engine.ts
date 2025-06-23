import { EventEmitter } from 'eventemitter3'
import { World } from '@ffg-engine/ecs'
import raf from 'raf'
import { Plugin, PluginManager } from './plugin.js'

export enum SystemType {
  STARTUP = 'startup',
  RENDER = 'render',
  FIXED_UPDATE = 'fixedUpdate',
  UPDATE = 'update',
}

export interface EngineEventMap {
  start: [event: { engine: Engine }]
  stop: [event: { engine: Engine }]
  pause: [event: { engine: Engine }]
  resume: [event: { engine: Engine }]
}

export class Engine extends EventEmitter<EngineEventMap> {
  private _plugins = new PluginManager(this)
  private _world = new World<SystemType>()
  private _handle: number | null = null

  private _now = 0
  private _delta = 0
  private _elapsed = 0
  private _last = 0
  private _frame = 0

  constructor() {
    super()

    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this

    const time: Time = {
      get rawDelta() {
        return self._delta
      },
      get now() {
        return self._now
      },
      get last() {
        return self._last
      },
      get unscaledDelta() {
        return this.rawDelta / 1000
      },
      get delta() {
        return this.unscaledDelta * this.timeScale
      },
      get elapsed() {
        return self._elapsed
      },
      get frame() {
        return self._frame
      },
      timeScale: 1,
    }

    this._world.addResource('time', time)
  }

  /**
   * The main world of the engine.
   * This is where all entities, components, and systems are managed.
   */
  get world() {
    return this._world
  }

  /**
   * Starts the engine's main loop.
   * This method initializes the world, sets up the time resource,
   * and begins the rendering and update loop.
   * It runs the systems in the following order:
   * 1. Startup systems
   * 2. Fixed update systems (at a fixed timestep)
   * 3. Update systems
   * 4. Render systems
   * @param timestep The fixed timestep for the engine, in milliseconds.
   * Defaults to 1000 / 60 (60 FPS).
   */
  async start(timestep = 1000 / 60) {
    if (this._handle != null) return

    this._plugins.setupPlugins()

    this.emit('start', { engine: this })

    const time = this._world.getResource('time')

    this._elapsed = 0
    this._frame = 0
    this._last = performance.now()
    time.timeScale = 1

    this._world.initializeSystems()
    await this._world.runSystems(SystemType.STARTUP)

    let accumulatedTime = 0

    const MAX_DELTA = 250

    const loop = async (now: number) => {
      if (this._handle == null) return

      const rawDelta = Math.min(now - time.last, MAX_DELTA)

      // Update time resource
      this._now = now
      this._delta = rawDelta
      this._elapsed += time.delta
      this._frame += 1

      accumulatedTime += rawDelta

      // Run fixed update systems
      this._delta = timestep
      while (accumulatedTime >= timestep) {
        await this._world.runSystems(SystemType.FIXED_UPDATE)
        accumulatedTime -= timestep
      }

      // Run update and render systems
      this._delta = rawDelta

      await this._world.runSystems(SystemType.UPDATE)
      await this._world.runSystems(SystemType.RENDER)

      this._last = now

      if (this._handle == null) return
      this._handle = raf(loop)
    }

    this._handle = raf(loop)
  }

  /**
   * Stops the engine's main loop.
   * This method cancels the current animation frame and resets the handle.
   */
  stop() {
    if (this._handle == null) return
    this.emit('stop', { engine: this })
    raf.cancel(this._handle)
    this._handle = null
  }

  /**
   * Pauses the engine's time scale.
   * This effectively stops all time-dependent systems from updating.
   */
  pause() {
    this.emit('pause', { engine: this })
    return this.setTimeScale(0)
  }

  /**
   * Resumes the engine's time scale.
   * This restores the time scale to normal (1), allowing systems to update again.
   */
  resume() {
    this.emit('resume', { engine: this })
    return this.setTimeScale(1)
  }

  /**
   * Sets the time scale for the engine.
   * This allows for time manipulation, such as slowing down or speeding up the game.
   * A scale of 1 is normal speed, 0 pauses the game, and values greater than 1 speed it up.
   * @param scale The new time scale factor.
   */
  setTimeScale(scale: number) {
    const time = this._world.getResource('time')
    time.timeScale = scale
  }

  addPlugin(plugin: Plugin) {
    this._plugins.add(plugin)
    return this
  }

  get plugins() {
    return this._plugins.plugins
  }

  removePlugin(name: string): this
  removePlugin(plugin: Plugin): this
  removePlugin(pluginOrName: Plugin | string) {
    this._plugins.remove(pluginOrName)
    return this
  }
}

export interface Time {
  /** Delta time since last frame, in seconds. */
  readonly delta: number
  /** Elapsed time since engine start, in seconds. */
  readonly elapsed: number
  /** Frame count since engine start */
  readonly frame: number
  /** Delta in milliseconds (raw) */
  readonly rawDelta: number
  /** Time of the last frame, in milliseconds */
  readonly last: number
  /** Time of the current frame, in milliseconds */
  readonly now: number
  /** Unscaled delta for time-scaling support */
  readonly unscaledDelta: number
  /** Time scale factor (1 = normal, 0 = paused) */
  timeScale: number
}

declare module '@ffg-engine/ecs' {
  interface ResourceRegistry {
    time: Time
  }
}
