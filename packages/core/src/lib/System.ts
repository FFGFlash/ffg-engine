import { World } from './World'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class System<Args extends readonly unknown[] = any> {
  /** @internal */
  _getDeps: ((data: World['data']) => readonly unknown[]) | undefined
  /** @internal */
  _fn: ((...args: Args) => void | Promise<void>) | undefined
  /** @internal */
  _name: string | undefined
  /** @internal */
  _reads: Set<string> | undefined
  /** @internal */
  _writes: Set<string> | undefined
  /** @internal */
  _before: Set<string> | undefined
  /** @internal */
  _after: Set<string> | undefined
  /** @interal */
  _flags: SystemFlags | undefined

  deps<A extends readonly unknown[]>(deps: (data: World['data']) => Readonly<A>): System<A> {
    if (this._getDeps) throw new Error('Dependencies already set for this system.')
    this._getDeps = deps
    return this as unknown as System<A>
  }

  fn(fn: (...args: Args) => void | Promise<void>): this {
    if (this._fn) throw new Error('Function already set for this system.')
    this._fn = fn
    return this
  }

  name(name: string): this {
    this._name = name
    return this
  }

  before(...systems: string[]): this {
    if (!this._before) this._before = new Set()
    for (const system of systems) {
      if (this._after?.has(system))
        throw new Error(`System ${this._name} cannot be both before and after ${system}.`)
      if (this._before.has(system))
        throw new Error(`System ${system} is already set as a before dependency for ${this._name}.`)
      this._before.add(system)
    }
    return this
  }

  after(...systems: string[]): this {
    if (!this._after) this._after = new Set()
    for (const system of systems) {
      if (this._before?.has(system))
        throw new Error(`System ${this._name} cannot be both before and after ${system}.`)
      if (this._after.has(system))
        throw new Error(`System ${system} is already set as an after dependency for ${this._name}.`)
      this._after.add(system)
    }
    return this
  }

  flag(flag: keyof SystemFlags, value = true): this {
    if (!this._flags) this._flags = {}
    this._flags[flag] = value
    return this
  }
}

export enum SystemType {
  STARTUP,
  FIXED_UPDATE,
  UPDATE,
  RENDER,
}

export interface SystemFlags {
  sync?: boolean
}
