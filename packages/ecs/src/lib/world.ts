import { Archetype, ArchetypeKey } from './archetype.js'
import { clone } from './clone.js'
import { Component, ComponentIDRegistry, ComponentMap, ComponentName } from './component.js'
import { Entity } from './entity.js'
import { Query } from './query.js'
import { ResourceName, Resource } from './resources.js'
import { System, SystemFlags } from './system.js'

export type EntityLocation = {
  archetype: ArchetypeKey
  index: number
}

export class World<SystemType extends string = string> {
  /**
   * The next entity ID to be assigned.
   * This is incremented each time a new entity is spawned.
   * It starts from 0 and goes up indefinitely.
   */
  private nextEntity = 0
  /**
   * Registry for components, allowing for unique identification and management of component types.
   * This registry is used to ensure that components can be referenced by their names
   */
  private componentRegistry = new ComponentIDRegistry()
  /**
   * A map of archetypes, where each archetype is identified by a unique key.
   * Archetypes are used to group entities based on their component composition.
   */
  private archetypes = new Map<ArchetypeKey, Archetype>()
  /**
   * A map that associates each entity with its location in the world.
   * The location is represented by an archetype key and an index within that archetype.
   * If an entity has no components, its location is set to null.
   */
  private entityLocations = new Map<Entity, EntityLocation | null>()
  /**
   * A map of resources, where each resource is identified by a unique name.
   * Resources are used to store global data that can be accessed by systems and components.
   */
  private resources = new Map<ResourceName, Resource>()
  /**
   * A map of systems, where each system is categorized by its type.
   * Systems are used to define the behavior and logic of the ECS (Entity-Component-System) architecture.
   */
  private systems = new Map<SystemType, System[]>()

  /**
   * Registers components in the world.
   * This method allows you to register one or more components by their names.
   * @param names A list of component names to register in the world.
   * @returns The current instance of the World for method chaining.
   */
  registerComponents(...names: ComponentName[]) {
    for (const name of names) this.componentRegistry.register(name)
    return this
  }

  /**
   * Spawns a new entity in the world.
   * This method creates a new entity.
   * @returns The newly created entity.
   */
  spawn(): Entity
  /**
   * Spawns a new entity with specified components.
   * This method creates a new entity and assigns the provided components to it.
   * @param components An object mapping component names to their data.
   * @template Names The type of components being spawned, extending ComponentName.
   * @return The newly created entity with the specified components.
   */
  spawn<Names extends ComponentName>(components: ComponentMap<Names>): Entity
  spawn<Names extends ComponentName>(components?: ComponentMap<Names>): Entity {
    const entity = this.nextEntity++
    if (components == null || Object.keys(components).length === 0) {
      this.entityLocations.set(entity, null)
      return entity
    }

    const componentSet = new Set<Names>(Object.keys(components) as Names[])
    const archetype = this.getOrCreateArchetype(componentSet)
    const index = archetype.addEntity(entity, components)
    this.entityLocations.set(entity, { archetype: archetype.key, index })

    return entity
  }

  /**
   * Adds a component to an entity.
   * This method allows you to add a specific component to an entity, creating a new archetype if necessary.
   * @template Names The type of the component being added, extending ComponentName.
   * @param entity The entity to which the component will be added.
   * @param name The name of the component to add.
   * @param data The data for the component being added.
   * @throws Error if the entity is not found in the world.
   * @returns The current instance of the World for method chaining.
   */
  addComponent<Names extends ComponentName>(entity: Entity, name: Names, data: Component<Names>) {
    if (!this.entityLocations.has(entity)) throw new Error(`Entity ${entity} not found.`)
    const location = this.entityLocations.get(entity)

    const names: ComponentName[] = [name]
    const components = { [name]: data } as ComponentMap<Names>

    if (location != null) {
      const archetype = this.archetypes.get(location.archetype)!
      if (archetype.signature.has(name)) {
        archetype.setComponentAt(name, location.index, data)
        return this
      }

      names.push(...(archetype.signature as ReadonlySet<ComponentName>))
      Object.assign(components, archetype.getComponentsAt(location.index))
      archetype.removeEntity(entity)
    }

    const newSignature = new Set(names)
    const newArchetype = this.getOrCreateArchetype(newSignature)
    const newIndex = newArchetype.addEntity(entity, components as ComponentMap)
    this.entityLocations.set(entity, { archetype: newArchetype.key, index: newIndex })

    return this
  }

  /**
   * Removes a component from an entity.
   * This method allows you to remove a specific component from an entity.
   * @param entity The entity from which to remove the component.
   * @param name The name of the component to remove.
   * @throws Error if the entity is not found in the world or if the component is not part of the entity's archetype.
   * @returns The current instance of the World for method chaining.
   */
  removeComponent(entity: Entity, name: ComponentName) {
    if (!this.entityLocations.has(entity)) throw new Error(`Entity ${entity} not found.`)
    const location = this.entityLocations.get(entity)

    if (location == null) return this // Entity has no components, nothing to remove

    const archetype = this.archetypes.get(location.archetype)!
    if (!archetype.signature.has(name)) return this // Component not part of the archetype

    const components = archetype.getComponentsAt(location.index) as Partial<ComponentMap>
    delete components[name] // Remove the component from the map
    const newSignature = new Set(archetype.signature)
    newSignature.delete(name)

    archetype.removeEntity(entity)
    // If the archetype is now empty, we can remove it
    if (archetype.size === 0) {
      this.archetypes.delete(archetype.key)
    }

    if (newSignature.size === 0) {
      this.entityLocations.set(entity, null)
      return this
    }

    const newArchetype = this.getOrCreateArchetype(newSignature)
    const newIndex = newArchetype.addEntity(entity, components as ComponentMap)
    this.entityLocations.set(entity, { archetype: newArchetype.key, index: newIndex })

    return this
  }

  /**
   * Sets multiple components for an entity.
   * This method allows you to set multiple components at once, replacing any existing components
   * @template Names The type of components being set, extending ComponentName.
   * @param entity The entity to set components for.
   * @param components An object mapping component names to their data.
   * @throws Error if the entity is not found in the world.
   * @returns The current instance of the World for method chaining.
   */
  setComponents<Names extends ComponentName>(entity: Entity, components: ComponentMap<Names>) {
    if (!this.entityLocations.has(entity)) throw new Error(`Entity ${entity} not found.`)
    const location = this.entityLocations.get(entity)

    if (location != null) {
      const archetype = this.archetypes.get(location.archetype)!
      archetype.removeEntity(entity)
    }

    const componentSet = new Set<Names>(Object.keys(components) as Names[])
    const archetype = this.getOrCreateArchetype(componentSet)
    const index = archetype.addEntity(entity, components)
    this.entityLocations.set(entity, { archetype: archetype.key, index })

    return this
  }

  /**
   * Removes an entity from the world.
   * @param entity The entity to remove.
   * @throws Error if the entity is not found in the world.
   * @returns The current instance of the World for method chaining.
   */
  removeEntity(entity: Entity) {
    if (!this.entityLocations.has(entity)) throw new Error(`Entity ${entity} not found.`)
    const location = this.entityLocations.get(entity)

    if (location == null) {
      this.entityLocations.delete(entity)
      return this // Entity has no components, nothing to remove
    }

    const archetype = this.archetypes.get(location.archetype)!
    archetype.removeEntity(entity)

    // If the archetype is now empty, we can remove it
    if (archetype.size === 0) {
      this.archetypes.delete(archetype.key)
    }

    this.entityLocations.delete(entity)
    return this
  }

  /**
   * Initializes all systems in the world.
   * This method iterates through all registered systems and calls their `_getDeps` method
   * to set up their dependencies.
   * It ensures that each system has its dependencies properly defined before they are run.
   * @returns The current instance of the World for method chaining.
   */
  initializeSystems(): this {
    for (const [type, systems] of this.systems.entries()) {
      // Setup dependencies for each system
      for (const system of systems) {
        if (
          typeof system._getDeps !== 'function' ||
          system._reads != null ||
          system._writes != null
        )
          continue
        system._reads = new Set<string>()
        system._writes = new Set<string>()
        system._flags ??= {}
        const data = this.getTrackedData(system._reads, system._writes, system._flags)
        system._getDeps(data)
      }

      // Sort systems by their dependencies

      this.systems.set(type, topologicalSort(systems))
    }

    return this
  }

  /**
   * Retrieves all systems of a specific type.
   * @param type The type of systems to retrieve.
   * @returns An array of systems of the specified type.
   */
  getSystems(type: SystemType): System[] {
    if (!this.systems.has(type)) return []
    return this.systems.get(type)!
  }

  /**
   * Runs all systems of a specific type.
   * This method executes each system's callback function, passing in the dependencies
   * @param type The type of systems to run.
   * @returns The current instance of the World for method chaining.
   */
  async runSystems(type: SystemType) {
    if (!this.systems.has(type)) return
    const systems = this.systems.get(type)!
    const batches = batchSystems(systems)
    for (const batch of batches) {
      const promises = batch.map(system => {
        const args = system._getDeps?.(this.data) ?? []
        return system._fn?.(...args)
      })
      await Promise.all(promises)
    }
  }

  /**
   * Provides access to the world data, including queries and resources.
   * This method returns an object with methods to query components and access resources.
   */
  get data() {
    const { archetypes, componentRegistry } = this

    return {
      get query() {
        return new Query(componentRegistry, archetypes)
      },
      res: <T extends ResourceName>(name: T) =>
        Object.freeze(clone(this.getResource(name))) as Readonly<Resource<T>>,
      mutRes: <T extends ResourceName>(name: T) => this.getResource(name),
      commands: {
        spawn: <N extends ComponentName>(components: ComponentMap<N>) => {
          return this.spawn(components)
        },
      },
    }
  }

  /**
   * Adds a resource to the world.
   * This method allows you to add a resource with a specific name and type.
   * @template Names The type of the resource being added, extending ResourceName.
   * @param name The name of the resource to add.
   * @param resource The resource to add, which must match the type associated with the name.
   * @throws Error if a resource with the same name already exists.
   * @returns The current instance of the World for method chaining.
   */
  addResource<Names extends ResourceName>(name: Names, resource: Resource<Names>) {
    if (this.resources.has(name)) throw new Error(`Resource "${name}" already exists.`)
    this.resources.set(name, resource)
    return this
  }

  /**
   * Retrieves a resource by its name.
   * This method allows you to access a resource that has been previously added to the world.
   * @template Names The type of the resource being retrieved, extending ResourceName.
   * @param name The name of the resource to retrieve.
   * @throws Error if the resource with the specified name does not exist.
   * @returns The resource associated with the specified name.
   */
  getResource<Names extends ResourceName>(name: Names): Resource<Names> {
    if (!this.resources.has(name)) throw new Error(`Resource "${name}" not found.`)
    return this.resources.get(name)!
  }

  /**
   * Creates a new system.
   * @returns A new instance of the System class.
   */
  createSystem() {
    return new System()
  }

  /**
   * Registers one or more systems in the world.
   * This method allows you to register systems under a specific type.
   * @param type The type of systems to register.
   * @param system The system to register.
   * @param systems Additional systems to register.
   * @throws Error if no systems are provided to register.
   * @returns The current instance of the World for method chaining.
   */
  registerSystems(type: SystemType, system: System, ...systems: System[]): this
  registerSystems(type: SystemType, ...systems: System[]): this {
    if (systems.length === 0) throw new Error('At least one system must be provided to register.')
    if (!this.systems.has(type)) this.systems.set(type, [])
    for (const sys of systems) {
      if (this.systems.get(type)!.includes(sys)) {
        console.warn(`System "${sys._name}" is already registered under type "${type}".`)
        continue
      }
      this.systems.get(type)!.push(sys)
    }
    return this
  }

  /**
   * Provides a query interface for the world.
   * This method returns a new instance of the Query class, which allows you to query entities
   */
  get query() {
    return new Query(this.componentRegistry, this.archetypes)
  }

  /**
   * Retrieves or creates an archetype based on the provided components.
   * This method checks if an archetype with the given components already exists.
   * @template T The type of components in the archetype, extending ComponentName.
   * @param components A set of component names that define the archetype.
   * @returns An instance of the Archetype class for the specified components.
   * @throws Error if the components set is empty.
   */
  private getOrCreateArchetype<T extends ComponentName>(components: ReadonlySet<T>): Archetype<T> {
    if (components.size === 0) throw new Error('Archetype must have at least one component')
    const key = Archetype.getArchetypeKey(this.componentRegistry, components)
    if (!this.archetypes.has(key))
      this.archetypes.set(key, new Archetype(components, key) as unknown as Archetype)
    return this.archetypes.get(key)! as unknown as Archetype<T>
  }

  /**
   * Creates a proxy object to track read and write operations on components and resources.
   * This method intercepts access to the world data, allowing for tracking of read and write operations.
   * @param reads A set to track read operations on components and resources.
   * @param writes A set to track write operations on components and resources.
   * @param flags An object to track system flags, such as whether the system is synchronous.
   * @returns A proxy object that intercepts access to the world data,
   * allowing for tracking of read and write operations on components and resources.
   */
  private getTrackedData(reads: Set<string>, writes: Set<string>, flags: SystemFlags) {
    return new Proxy(this.data, {
      get(target, prop) {
        if (prop === 'query') {
          const queryProxy = new Proxy(target.query, {
            get(queryTarget, queryProp) {
              if (queryProp === 'write') {
                return (...components: ComponentName[]) => {
                  components.forEach(name => writes.add(`component:${name}`))
                  queryTarget.write(...components)
                  return queryProxy
                }
              } else if (queryProp === 'read') {
                return (...components: ComponentName[]) => {
                  components.forEach(name => reads.add(`component:${name}`))
                  queryTarget.read(...components)
                  return queryProxy
                }
              }

              return Reflect.get(queryTarget, queryProp)
            },
          })
          return queryProxy
        } else if (prop === 'res') {
          return (name: ResourceName) => {
            reads.add(`resource:${name}`)
            return target.res(name)
          }
        } else if (prop === 'mutRes') {
          return (name: ResourceName) => {
            writes.add(`resource:${name}`)
            return target.mutRes(name)
          }
        } else if (prop === 'commands') {
          flags.sync = true
        }

        return Reflect.get(target, prop, target)
      },
    })
  }
}

function topologicalSort(systems: System[]): System[] {
  const nameToSystem = new Map(systems.map(s => [s._name, s]))
  const graph = new Map<System, Set<System>>(systems.map(s => [s, new Set()]))

  for (const system of systems) {
    for (const dep of system._after ?? []) {
      const depSystem = typeof dep === 'string' ? nameToSystem.get(dep) : dep
      if (depSystem) graph.get(system)!.add(depSystem)
    }

    for (const dep of system._before ?? []) {
      const depSystem = typeof dep === 'string' ? nameToSystem.get(dep) : dep
      if (depSystem) graph.get(depSystem)!.add(system)
    }
  }

  const visited = new Set<System>()
  const temp = new Set<System>()
  const result: System[] = []

  const visit = (system: System) => {
    if (visited.has(system)) return
    if (temp.has(system)) throw new Error(`Circular dependency detected: ${system._name}`)
    temp.add(system)

    for (const dep of graph.get(system) ?? []) {
      visit(dep)
    }

    temp.delete(system)
    visited.add(system)
    result.push(system)
  }

  for (const system of systems) {
    visit(system)
  }

  return result
}

function batchSystems(systems: System[]): System[][] {
  return systems.reduce<System[][]>((batches, system) => {
    const lastBatch = batches[batches.length - 1]
    if (lastBatch && !conflictsWithBatch(system, lastBatch)) lastBatch.push(system)
    else batches.push([system])
    return batches
  }, [])
}

function conflictsWithBatch(system: System, batch: System[]): boolean {
  return batch.some(other => systemsConflict(system, other))
}

function systemsConflict(a: System, b: System): boolean {
  if (a._flags?.sync || b._flags?.sync) return true

  const aReads = a._reads ?? new Set<string>()
  const aWrites = a._writes ?? new Set<string>()
  const bReads = b._reads ?? new Set<string>()
  const bWrites = b._writes ?? new Set<string>()

  for (const r of aReads) if (bWrites.has(r)) return true
  for (const w of aWrites) if (bReads.has(w) || bWrites.has(w)) return true

  return false
}
