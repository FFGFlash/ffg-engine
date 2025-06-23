/* eslint-disable @typescript-eslint/no-explicit-any */
export type Primitive = null | undefined | string | number | boolean | symbol | bigint

export type MaybeThisParameterType<T> = Exclude<T, Primitive> extends (...args: any) => any
  ? ThisParameterType<Exclude<T, Primitive>>
  : any

export type RemoveThis<T> = T extends (...args: any) => any
  ? (...args: Parameters<T>) => ReturnType<T>
  : T

export type MaybeReturnType<T> = T extends (...args: any) => any ? ReturnType<T> : T
