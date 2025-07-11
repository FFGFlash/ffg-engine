/* eslint-disable @typescript-eslint/no-explicit-any */
function getType(value: any): string {
  return Object.prototype.toString.call(value).slice(8, -1)
}

export function isPlainObject(value: any): value is Record<string, any> {
  if (getType(value) !== 'Object') return false
  return value.constructor === Object && Object.getPrototypeOf(value) === Object.prototype
}
