import type { World } from './world.js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class System<Args extends readonly unknown[] = any> {
  _getDeps: SystemDependencyCallback | undefined
  _fn: ((...args: Args) => void | Promise<void>) | undefined
  _name: string | undefined
  _reads: Set<string> | undefined
  _writes: Set<string> | undefined
  _before: Set<string | System> | undefined
  _after: Set<string | System> | undefined
  _flags: SystemFlags | undefined

  /**
   * Sets the dependency callback for this system.
   * This callback is used to determine the dependencies of the system,
   * which can include queries, resources or other data needed for the system to run.
   * @param deps A function that returns the dependencies for this system.
   * @returns This system instance with the dependencies set.
   * @throws Error if dependencies are already set for this system.
   */
  deps<A extends readonly unknown[]>(deps: SystemDependencyCallback<Readonly<A>>): System<A> {
    if (this._getDeps) throw new Error('Dependencies already set for this system.')
    this._getDeps = deps
    return this as unknown as System<A>
  }

  /**
   * Sets the callback function for this system.
   * This function will be executed when the system runs, and it should accept the dependencies
   * @param fn A callback function that will be executed when the system runs.
   * This function should accept the dependencies returned by the `deps` method.
   * @returns This system instance with the callback set.
   * @throws Error if a callback function is already set for this system.
   */
  callback(fn: (...args: Args) => void | Promise<void>): this {
    if (this._fn) throw new Error('Callback already set for this system.')
    this._fn = fn
    return this
  }

  /**
   * Sets the name of this system.
   * The name is used to identify the system in the world and can be used for debugging or logging purposes.
   * @param name The name of the system.
   * @returns This system instance with the name set.
   */
  name(name: string): this {
    this._name = name
    return this
  }

  /**
   * Registers systems that this system needs to run before.
   * @param systems A list of system names or system instances that this system should run before.
   * @returns This system instance with the before systems set.
   * @throws Error if this system is already set to run after any of the provided systems,
   * or if a system is already set to run before this system.
   */
  before(...systems: (string | System)[]): this {
    if (!this._before) this._before = new Set()
    for (const system of systems) {
      if (this._after?.has(system))
        throw new Error(`System "${system}" cannot be both before and after this system.`)
      if (this._before.has(system)) {
        console.warn(`System "${system}" is already set to run before this system.`)
        continue
      }
      this._before.add(system)
    }
    return this
  }

  /**
   * Registers systems that this system needs to run after.
   * @param systems A list of system names or system instances that this system should run after.
   * @returns This system instance with the after systems set.
   * @throws Error if this system is already set to run before any of the provided systems,
   * or if a system is already set to run after this system.
   */
  after(...systems: (string | System)[]): this {
    if (!this._after) this._after = new Set()
    for (const system of systems) {
      if (this._before?.has(system))
        throw new Error(`System "${system}" cannot be both before and after this system.`)
      if (this._after.has(system)) {
        console.warn(`System "${system}" is already set to run after this system.`)
        continue
      }
      this._after.add(system)
    }
    return this
  }

  /**
   * Sets the flags for this system.
   * Flags can be used to control the behavior of the system, such as whether it runs synchronously or asynchronously.
   * @param flag The flag to set for this system.
   * This can be used to control the behavior of the system, such as whether it runs synchronously.
   * @param value The value to set for the flag. Defaults to true.
   * @returns This system instance with the flag set.
   */
  flag(flag: keyof SystemFlags, value = true): this {
    if (!this._flags) this._flags = {}
    this._flags[flag] = value
    return this
  }

  /**
   * Creates a new System instance from a declaration object.
   * This method is used to create a system with predefined dependencies, callback, name, flags, and execution order.
   * @param declaration The declaration object that defines the system.
   * @returns A new instance of the System class created from the declaration.
   */
  static from<A extends readonly unknown[]>(declaration: SystemDeclaration<A>): System<A> {
    const system = new System<A>()
    system._getDeps = declaration.deps
    system._fn = declaration.callback
    if (declaration.name != null) system._name = declaration.name
    if (declaration.flags != null) system._flags = declaration.flags
    if (declaration.before != null) system._before = new Set(declaration.before)
    if (declaration.after != null) system._after = new Set(declaration.after)
    return system
  }
}

export enum SystemType {
  STARTUP = 'startup',
  FIXED_UPDATE = 'fixedUpdate',
  UPDATE = 'update',
  LATE_UPDATE = 'lateUpdate',
  RENDER = 'render',
}

export interface SystemFlags {
  /**
   * Indicates whether the system should run in a synchronous manner.
   * If true, the system wont batch its execution and will run immediately.
   */
  sync?: boolean
}

export interface SystemDeclaration<T extends readonly unknown[] = readonly unknown[]> {
  /**
   * The name of the system.
   * This is used to identify the system in the world and can be used for debugging or logging purposes.
   */
  name?: string
  /**
   * The flags for this system, which can control its behavior.
   */
  flags?: SystemFlags
  /**
   * A function that returns the dependencies for this system.
   * This function is called with the world data and should return an array of dependencies.
   */
  deps: SystemDependencyCallback<T>
  /**
   * A callback function that will be executed when the system runs.
   * This function should accept the dependencies returned by the `deps` method.
   */
  callback: (...args: T) => void | Promise<void>
  /**
   * A list of system names or system instances that this system should run before.
   * This is used to control the execution order of systems.
   */
  before?: (string | System)[]
  /**
   * A list of system names or system instances that this system should run after.
   * This is used to control the execution order of systems.
   */
  after?: (string | System)[]
}

export type SystemDependencyCallback<T extends readonly unknown[] = readonly unknown[]> =
  /**
   * A function that returns the dependencies for a system.
   * This function is called with the world data and should return an array of dependencies
   * @param data The world data that the system can access.
   * This includes commands, queries, resources, and other data.
   * @returns An array of dependencies that the system needs to run.
   */
  (data: World['data']) => T
