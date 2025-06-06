import raf from 'raf'
import { Archetype, ArchetypeMap, Components } from './Archetype'
import { ComponentArray, ComponentMap, ComponentName, ComponentType } from './Component'
import { data } from './Data'
import { Entity } from './Entity'
import { Query } from './Query'
import { ResourceName, ResourceType } from './Resource'
import { runScheduler, topologicalSort } from './Scheduler'
import { System, SystemFlags, SystemType } from './System'

export class World {
  private nextEntityId = 0
  private componentMap = new ComponentMap()
  private entities = new Map<Entity, Archetype | null>()
  private archetypes = new ArchetypeMap(this.componentMap)
  private resources = new Map<ResourceName, ResourceType>()
  private systems = new Map<SystemType, System[]>()
  private controller?: AbortController

  get data() {
    const { archetypes } = this

    return {
      res: <T extends ResourceName>(name: T) => data(this.getResource(name), true),
      mutRes: <T extends ResourceName>(name: T) => data(this.getResource(name)),
      get query() {
        return new Query(archetypes)
      },
      commands: {
        spawn: <N extends ComponentName>(components: Components<N>): Entity => {
          const entity = this.createEntity()
          this.setComponents(entity, components)
          return entity
        },
      },
    }
  }

  /** @internal */
  getTrackedData(reads: Set<string>, writes: Set<string>, flags: SystemFlags) {
    return new Proxy(this.data, {
      get(target, prop, receiver) {
        if (prop === 'res') {
          return (name: ResourceName) => {
            if (!writes.has(name)) reads.add(`resource:${name}`)
            return target[prop](name)
          }
        } else if (prop === 'mutRes') {
          return (name: ResourceName) => {
            if (reads.has(name)) reads.delete(name)
            writes.add(`resource:${name}`)
            return target[prop](name)
          }
        } else if (prop === 'query') {
          return new Proxy(target[prop], {
            get(qTarget, qProp, qReceiver) {
              if (qProp === 'read') {
                return (...names: ComponentName[]) => {
                  for (const name of names) {
                    if (!writes.has(name)) reads.add(`component:${name}`)
                  }
                  return qTarget[qProp](...names)
                }
              } else if (qProp === 'write') {
                return (...names: ComponentName[]) => {
                  for (const name of names) {
                    if (reads.has(name)) reads.delete(name)
                    writes.add(`component:${name}`)
                  }
                  return qTarget[qProp](...names)
                }
              }

              return Reflect.get(qTarget, qProp, qReceiver)
            },
          })
        } else if (prop === 'commands') {
          flags.sync = true
        }

        return Reflect.get(target, prop, receiver)
      },
    })
  }

  addResource<T extends ResourceName>(name: T, resource: ResourceType<T>): this {
    if (this.resources.has(name)) throw new Error(`Resource "${name}" already exists.`)
    this.resources.set(name, resource)
    return this
  }

  getResource<T extends ResourceName>(name: T): ResourceType<T> {
    if (!this.resources.has(name)) throw new Error(`Resource "${name}" does not exist.`)
    return this.resources.get(name) as ResourceType<T>
  }

  /**
   * Explicity register a component by name. This is used to optimize how components are stored and accessed in the ECS.
   *
   * This method is not required to use the ECS as components can be registered automatically when they are first used,
   * but is useful for ensuring that components are registered in a specific order or to avoid potential issues with component IDs.
   *
   * @param name The name of the component to register.
   * @returns
   */
  registerComponents(...name: ComponentName[]): this {
    name.forEach(n => this.componentMap.register(n))
    return this
  }

  getComponentId(name: ComponentName): number {
    return this.componentMap.get(name)
  }

  createEntity(): Entity {
    const id = this.nextEntityId++
    this.entities.set(id, null)
    return id
  }

  createSystem(): System {
    return new System()
  }

  registerSystems(type: SystemType, system: System, ...systems: System[]): this {
    if (!this.systems.has(type)) this.systems.set(type, [])
    systems.unshift(system)
    for (const sys of systems) {
      if (this.systems.get(type)!.some(s => s._name === sys._name)) {
        throw new Error(`System "${sys._name}" already exists in type "${type}".`)
      }
      this.systems.get(type)!.push(sys)
    }
    return this
  }

  setComponents<N extends ComponentName>(entity: Entity, components: Components<N>): this {
    if (!this.entities.has(entity)) throw new Error(`Entity ${entity} does not exist.`)
    const archetype = this.entities.get(entity)
    if (archetype != null) {
      archetype.removeEntity(entity)

      if (archetype.size === 0) {
        this.archetypes.delete(Array.from(archetype.signature))
      }
    }

    const newArchetype = this.archetypes.getOrCreate(Object.keys(components) as ComponentName[])
    newArchetype.addEntity(entity, components as Components)
    this.entities.set(entity, newArchetype)
    return this
  }

  addComponent<T extends ComponentName>(
    entity: Entity,
    componentName: T,
    component: ComponentType<T>
  ): this {
    if (!this.entities.has(entity)) throw new Error(`Entity ${entity} does not exist.`)

    const archetype = this.entities.get(entity)
    const keys: ComponentName[] = [componentName]
    let oldValues: Components | undefined

    // If the entity already has an archetype, check if it has the component
    if (archetype != null) {
      const index = archetype.getEntityIndex(entity)

      // If the archetype already has the component, update it
      if (archetype.hasComponent(componentName)) {
        archetype.setComponentAt(componentName, index, component)
        return this
      }

      // If the archetype does not have the component, we need to move the entity to a new archetype
      keys.push(...archetype.signature)
      oldValues = archetype.getComponentsAt(index)
      archetype.removeEntity(entity)
      if (archetype.size === 0) this.archetypes.delete(Array.from(archetype.signature))
    }

    // Move the entity to a new archetype with the new component
    const newArchetype = this.archetypes.getOrCreate(keys)
    newArchetype.addEntity(entity, {
      ...oldValues,
      [componentName]: component,
    } as Components)
    this.entities.set(entity, newArchetype)

    return this
  }

  removeComponent(entity: Entity, componentName: ComponentName): this {
    if (!this.entities.has(entity)) throw new Error(`Entity ${entity} does not exist.`)
    const archetype = this.entities.get(entity)
    if (archetype == null) throw new Error(`Entity ${entity} does not have an archetype.`)
    if (!archetype.hasComponent(componentName))
      throw new Error(`Entity ${entity} does not have component "${componentName}".`)
    const index = archetype.getEntityIndex(entity)

    const oldKeys = Array.from(archetype.signature)
    const keys = oldKeys.filter(n => n !== componentName)
    const values = archetype.getComponentsAt(index)
    delete values[componentName]
    archetype.removeEntity(entity)
    if (archetype.size === 0) this.archetypes.delete(oldKeys)
    if (keys.length === 0) {
      this.entities.set(entity, null)
      return this
    }

    const newArchetype = this.archetypes.getOrCreate(keys)
    newArchetype.addEntity(entity, values)

    return this
  }

  getComponent<T extends ComponentName>(entity: Entity, componentName: T): ComponentType<T> {
    if (!this.entities.has(entity)) throw new Error(`Entity ${entity} does not exist.`)
    const archetype = this.entities.get(entity)
    if (archetype == null) throw new Error(`Entity ${entity} does not have an archetype.`)
    if (!archetype.hasComponent(componentName))
      throw new Error(`Entity ${entity} does not have component "${componentName}".`)
    const index = archetype.getEntityIndex(entity)
    return archetype.getComponentAt(componentName, index)
  }

  getComponents<N extends readonly ComponentName[]>(
    entity: Entity,
    ...names: N
  ): ComponentArray<N> {
    return names.map(name => this.getComponent(entity, name)) as unknown as ComponentArray<N>
  }

  private initializeSystems() {
    for (const systems of this.systems.values()) {
      for (const system of systems) {
        if (typeof system._getDeps !== 'function' || system._reads || system._writes) continue
        system._reads = new Set()
        system._writes = new Set()
        system._flags ??= {}
        const data = this.getTrackedData(system._reads, system._writes, system._flags)
        system._getDeps(data)
      }
    }
  }

  async start(options: LoopOptions = {}) {
    this.initializeSystems()

    const startupSystems = topologicalSort(this.systems.get(SystemType.STARTUP) || [])
    const fixedUpdateSystems = topologicalSort(this.systems.get(SystemType.FIXED_UPDATE) || [])
    const updateSystems = topologicalSort(this.systems.get(SystemType.UPDATE) || [])
    const renderSystems = topologicalSort(this.systems.get(SystemType.RENDER) || [])

    const FIXED_DT = options.timestep || 1000 / 60 // Default to 60 FPS

    await runScheduler(this, startupSystems)

    let last = performance.now()
    let acc = 0

    const loop = async () => {
      const now = performance.now()
      const delta = now - last
      last = now

      acc += delta

      while (acc >= FIXED_DT) {
        await runScheduler(this, fixedUpdateSystems)
        acc -= FIXED_DT
      }

      await runScheduler(this, updateSystems)
      await runScheduler(this, renderSystems)

      if (this.controller?.signal.aborted) return
      loopId = raf(loop)
    }

    let loopId = raf(loop)

    this.controller = new AbortController()

    this.controller.signal.addEventListener(
      'abort',
      () => {
        raf.cancel(loopId)
      },
      { once: true }
    )
  }

  stop() {
    if (!this.controller) return
    this.controller.abort()
  }
}

export interface LoopOptions {
  timestep?: number
}
