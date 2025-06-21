import cloneDeep from 'clone-deep'
import { Clone } from './symbols.js'

export function clone<T>(val: T) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return cloneDeep<T>(val, function clone(v: any) {
    if (typeof v === 'object' && v !== null && Clone in v && typeof v[Clone] === 'function')
      return v[Clone]()
    const res = new v.constructor()
    for (const key in v) res[key] = cloneDeep(v[key], clone)
    return res
  })
}
