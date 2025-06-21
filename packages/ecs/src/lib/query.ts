import { Archetype, ArchetypeKey } from './archetype.js'
import { clone } from './clone.js'
import { Component, ComponentIDRegistry, ComponentName } from './component.js'
import { Entity } from './entity.js'

export class Query<Accesses extends AccessList = []> {
  private accesses = new Map<ComponentName, AccessMode>()

  constructor(
    private componentRegistry: ComponentIDRegistry,
    private archetypes: Map<ArchetypeKey, Archetype>
  ) {}

  /**
   * Extends the query with additional components and their access modes.
   * This method allows you to add new components to the query, specifying whether
   * they should be accessed in 'read', 'write', or no access mode (false).
   * @param names The names of the components to extend the query with.
   * @param mode The access mode for the components. Can be 'read', 'write', or false (no access).
   * @returns The updated query with the new components and their access modes.
   * @throws Error if a component with the same name already exists in the query.
   */
  private extend<
    N extends readonly ComponentName[],
    M extends AccessMode,
    A extends AccessList = [...Accesses, ...MappedNamesToAccessList<N, M>]
  >(names: N, mode: M): Query<A> {
    for (const name of names) {
      if (this.accesses.has(name)) throw new Error(`Component ${name} already exists in the query.`)
      this.accesses.set(name, mode)
    }
    return this as unknown as Query<A>
  }

  /**
   * Adds components to the query with no access mode.
   * This means that the components will not be accessible for reading or writing.
   *
   * This is useful for querying data without needing to modify it or read it.
   * @param names The names of the components to include in the query with no access.
   * @returns The updated query with the new components included with no access.
   * @throws Error if a component with the same name already exists in the query.
   */
  with<
    N extends readonly ComponentName[],
    A extends AccessList = [...Accesses, ...MappedNamesToAccessList<N, false>]
  >(...names: N): Query<A> {
    return this.extend(names, false)
  }

  /**
   * Adds components to the query with read access mode.
   * This means that the components will be accessible for reading,
   * but not for writing.
   *
   * This is useful for querying data without modifying it.
   * @param names The names of the components to include in the query with read access.
   * @returns The updated query with the new components included with read access.
   * @throws Error if a component with the same name already exists in the query.
   */
  read<
    N extends readonly ComponentName[],
    A extends AccessList = [...Accesses, ...MappedNamesToAccessList<N, 'read'>]
  >(...names: N): Query<A> {
    return this.extend(names, 'read')
  }

  /**
   * Adds components to the query with write access mode.
   * This means that the components will be accessible for writing,
   * allowing you to modify their data.
   *
   * This is useful for systems that need to update component data.
   * @param names The names of the components to include in the query with write access.
   * @returns The updated query with the new components included with write access.
   * @throws Error if a component with the same name already exists in the query.
   */
  write<
    N extends readonly ComponentName[],
    A extends AccessList = [...Accesses, ...MappedNamesToAccessList<N, 'write'>]
  >(...names: N): Query<A> {
    return this.extend(names, 'write')
  }

  /**
   * Executes the query and returns an iterator over the results.
   * The results will be in the form of an array containing the entity
   * and the components specified in the query with their respective access modes.
   *
   * This method is used to retrieve entities and their components that match the query criteria.
   * @returns An iterator that yields arrays of entities and their components as specified in the query.
   */
  private *iterator() {
    const targets = [...this.accesses.keys()]

    const querySet = new Set(targets)
    const queryKey = Archetype.getArchetypeKey(this.componentRegistry, querySet)

    const accessors = targets.filter(n => this.accesses.get(n) !== false)

    for (const archetype of this.archetypes.values()) {
      if (!archetype.hasComponents(queryKey)) continue

      for (let i = 0; i < archetype.size; i++) {
        const entity = archetype.getEntityAt(i)

        const data = [
          entity,
          ...accessors.map(accessor => {
            const component = archetype.getComponentAt(accessor, i)
            const mode = this.accesses.get(accessor)
            if (mode === 'write') return component as Component
            return Object.freeze(clone(component))
          }),
        ] as unknown as QueryResult<Accesses>
        yield data
      }
    }
  }

  /**
   * Returns an iterator that yields the results of the query.
   * This allows you to iterate over the entities and their components
   * that match the query criteria.
   *
   * You can use this method in a for...of loop or with other iterable methods.
   * @returns An iterator that yields arrays of entities and their components as specified in the query.
   */
  *[Symbol.iterator]() {
    yield* this.iterator()
  }
}

export type AccessMode = 'read' | 'write' | false
export type AccessList = [ComponentName, AccessMode][]
export type AccessListToComponentData<T extends AccessList, A extends unknown[] = []> = T extends [
  infer Head,
  ...infer Tail
]
  ? Head extends [infer Name extends ComponentName, infer Mode extends AccessMode]
    ? Mode extends false
      ? AccessListToComponentData<Tail extends AccessList ? Tail : [], A>
      : Mode extends 'read'
      ? AccessListToComponentData<
          Tail extends AccessList ? Tail : [],
          [...A, Readonly<Component<Name>>]
        >
      : AccessListToComponentData<Tail extends AccessList ? Tail : [], [...A, Component<Name>]>
    : never
  : A
export type QueryResult<A extends AccessList> = [Entity, ...AccessListToComponentData<A>]
export type MappedNamesToAccessList<N extends readonly ComponentName[], M extends AccessMode> = {
  [K in keyof N]: [N[K], M]
}
