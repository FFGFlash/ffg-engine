// eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-empty-interface
export interface ComponentRegistry {}

export type ComponentName = keyof ComponentRegistry
export type Component<T extends ComponentName = ComponentName> = ComponentRegistry[T] & object

export class ComponentIDRegistry {
  private componentToBit = new Map<string, number>()
  private nextBit = 0

  register(name: string): number {
    if (this.componentToBit.has(name)) return this.componentToBit.get(name) as number
    this.componentToBit.set(name, this.nextBit)
    return this.nextBit++
  }

  getBit(name: string): number {
    const bit = this.componentToBit.get(name)
    if (bit == null) throw new Error(`Component "${name}" is not registered.`)
    return bit
  }
}

export type ComponentStore<T extends ComponentName = ComponentName> = {
  [K in T]: Component<K>[]
}

export type ComponentMap<T extends ComponentName = ComponentName> = {
  [K in T]: Component<K>
}
