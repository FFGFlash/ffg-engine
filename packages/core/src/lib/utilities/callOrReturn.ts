/* eslint-disable @typescript-eslint/no-explicit-any */

import { MaybeReturnType } from '../types.js'

export function callOrReturn<T>(
  value: T,
  context: any = undefined,
  ...props: any[]
): MaybeReturnType<T> {
  if (typeof value === 'function') {
    if (context) return value.bind(context)(...props)
    return value(...props)
  }
  return value as MaybeReturnType<T>
}
