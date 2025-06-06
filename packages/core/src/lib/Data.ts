import cloneDeep from 'clone-deep'

/**
 * Creates a deep clone of the provided value.
 * If the value has a `Clone` method defined, it will be called to create the clone.
 * This is useful for objects or classes that implement a custom cloning logic.
 * @param val The value to clone.
 * @returns A deep clone of the value.
 */
export function clone<T>(val: T) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cb = (v: any): T => {
    if (typeof v === 'object' && v != null && Clone in v && typeof v[Clone] === 'function')
      return v[Clone]()
    const res = new v.constructor()
    for (const key in v) {
      res[key] = cloneDeep(v[key], cb)
    }
    return res
  }

  return cloneDeep(val, cb)
}

export function data<T, F extends boolean = false>(
  value: T,
  readonly?: F
): F extends true ? Readonly<T> : T {
  if (readonly) return Object.freeze(clone(value))
  return value
}

/**
 * Symbol used to create a clone method for classes and objects.
 * This symbol should be used as a key in the object or class to define a method that returns a clone of the instance.
 * The method should return a new instance of the class or a deep clone of the object.
 */
export const Clone = Symbol('Clone')
