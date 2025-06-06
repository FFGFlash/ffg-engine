import cloneDeep from 'clone-deep';

/**
 * Creates a deep clone of the provided value.
 * If the value has a `Clone` method defined, it will be called to create the clone.
 * This is useful for objects or classes that implement a custom cloning logic.
 * @param val The value to clone.
 * @returns A deep clone of the value.
 */
export function clone<T>(val: T) {
  return cloneDeep(val, (v) => {
    if (
      typeof v === 'object' &&
      v != null &&
      Clone in v &&
      typeof v[Clone] === 'function'
    )
      return v[Clone]();
    throw new Error(
      `Unable to clone value: ${v}. The value does not have a valid Clone method.`
    );
  });
}

export function data<T, F extends boolean = false>(
  value: T,
  readonly?: F
): F extends true ? Readonly<T> : T {
  if (readonly) return Object.freeze(clone(value));
  return value;
}

/**
 * Symbol used to create a clone method for classes and objects.
 * This symbol should be used as a key in the object or class to define a method that returns a clone of the instance.
 * The method should return a new instance of the class or a deep clone of the object.
 */
export const Clone = Symbol('Clone');
