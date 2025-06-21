import {
  Component,
  ComponentIDRegistry,
  ComponentMap,
  ComponentName,
  ComponentStore,
} from './component.js'
import { Entity } from './entity.js'

export type ArchetypeKey = bigint

export class Archetype<N extends ComponentName = ComponentName> {
  private entities: Entity[] = []
  private components: ComponentStore<N>

  constructor(public readonly signature: ReadonlySet<N>, public readonly key: ArchetypeKey) {
    this.components = {} as ComponentStore<N>
    for (const name of signature) {
      this.components[name] = []
    }
  }

  addEntity(entity: Entity, components: ComponentMap<N>) {
    for (const name of this.signature) {
      if (!(name in components)) throw new Error(`Entity ${entity} is missing component "${name}"`)
      this.components[name].push(components[name])
    }
    return this.entities.push(entity) - 1
  }

  removeEntity(entity: Entity) {
    const index = this.entities.indexOf(entity)
    if (index === -1) throw new Error(`Entity ${entity} not found in archetype`)

    this.entities.splice(index, 1)
    for (const name of this.signature) {
      this.components[name].splice(index, 1)
    }
    return this
  }

  getEntityAt(index: number): Entity {
    if (index < 0 || index >= this.entities.length)
      throw new Error(`Index ${index} out of bounds for entity array`)
    return this.entities[index]
  }

  hasComponents(query: ArchetypeKey) {
    return Archetype.hasComponents(this.key, query)
  }

  setComponentAt<T extends N>(name: T, index: number, data: Component<T>) {
    if (!this.signature.has(name))
      throw new Error(`Component "${name}" is not part of this archetype`)
    if (index < 0 || index >= this.entities.length)
      throw new Error(`Index ${index} out of bounds for entity array`)
    this.components[name][index] = data
    return this
  }

  getComponentAt<T extends N>(name: T, index: number): Component<T> {
    if (!this.signature.has(name))
      throw new Error(`Component "${name}" is not part of this archetype`)
    if (index < 0 || index >= this.entities.length)
      throw new Error(`Index ${index} out of bounds for entity array`)
    return this.components[name][index] as Component<T>
  }

  getComponentsAt(index: number): ComponentMap<N> {
    if (index < 0 || index >= this.entities.length)
      throw new Error(`Index ${index} out of bounds for entity array`)
    const result: ComponentMap<N> = {} as ComponentMap<N>
    for (const name of this.signature) {
      result[name] = this.components[name][index]
    }
    return result
  }

  get size() {
    return this.entities.length
  }

  static getArchetypeKey(
    componentRegistry: ComponentIDRegistry,
    components: ReadonlySet<ComponentName>
  ): ArchetypeKey {
    return Array.from(components).reduce((mask, name) => {
      const bit = componentRegistry.getBit(name)
      return mask | (1n << BigInt(bit))
    }, 0n)
  }

  static hasComponents(source: ArchetypeKey, query: ArchetypeKey) {
    return (source & query) === query
  }
}
