import { Archetype, ArchetypeMap, Components } from './Archetype';
import {
  ComponentArray,
  ComponentMap,
  ComponentName,
  ComponentType,
} from './Component';
import { data } from './Data';
import { Entity } from './Entity';
import { Query } from './Query';
import { ResourceName, ResourceType } from './Resource';

export class World {
  private nextEntityId = 0;
  private componentMap = new ComponentMap();
  private entities = new Map<Entity, Archetype | null>();
  private archetypes = new ArchetypeMap(this.componentMap);
  private resources = new Map<ResourceName, ResourceType>();

  get data() {
    const { archetypes } = this;

    return {
      res: <T extends ResourceName>(name: T) =>
        data(this.getResource(name), true),
      mutRes: <T extends ResourceName>(name: T) => data(this.getResource(name)),
      get query() {
        return new Query(archetypes);
      },
    };
  }

  addResource<T extends ResourceName>(
    name: T,
    resource: ResourceType<T>
  ): this {
    if (this.resources.has(name))
      throw new Error(`Resource "${name}" already exists.`);
    this.resources.set(name, resource);
    return this;
  }

  getResource<T extends ResourceName>(name: T): ResourceType<T> {
    if (!this.resources.has(name))
      throw new Error(`Resource "${name}" does not exist.`);
    return this.resources.get(name) as ResourceType<T>;
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
    name.forEach((n) => this.componentMap.register(n));
    return this;
  }

  getComponentId(name: ComponentName): number {
    return this.componentMap.get(name);
  }

  createEntity(): Entity {
    const id = this.nextEntityId++;
    this.entities.set(id, null);
    return id;
  }

  addComponent<T extends ComponentName>(
    entity: Entity,
    componentName: T,
    component: ComponentType<T>
  ): this {
    if (!this.entities.has(entity))
      throw new Error(`Entity ${entity} does not exist.`);

    const archetype = this.entities.get(entity);
    const keys: ComponentName[] = [componentName];
    let oldValues: Components | undefined;

    // If the entity already has an archetype, check if it has the component
    if (archetype != null) {
      const index = archetype.getEntityIndex(entity);

      // If the archetype already has the component, update it
      if (archetype.hasComponent(componentName)) {
        archetype.setComponentAt(componentName, index, component);
        return this;
      }

      // If the archetype does not have the component, we need to move the entity to a new archetype
      keys.push(...archetype.signature);
      oldValues = archetype.getComponentsAt(index);
      archetype.removeEntity(entity);
      if (archetype.size === 0)
        this.archetypes.delete(Array.from(archetype.signature));
    }

    // Move the entity to a new archetype with the new component
    const newArchetype = this.archetypes.getOrCreate(keys);
    newArchetype.addEntity(entity, {
      ...oldValues,
      [componentName]: component,
    } as Components);
    this.entities.set(entity, newArchetype);

    return this;
  }

  removeComponent(entity: Entity, componentName: ComponentName): this {
    if (!this.entities.has(entity))
      throw new Error(`Entity ${entity} does not exist.`);
    const archetype = this.entities.get(entity);
    if (archetype == null)
      throw new Error(`Entity ${entity} does not have an archetype.`);
    if (!archetype.hasComponent(componentName))
      throw new Error(
        `Entity ${entity} does not have component "${componentName}".`
      );
    const index = archetype.getEntityIndex(entity);

    const oldKeys = Array.from(archetype.signature);
    const keys = oldKeys.filter((n) => n !== componentName);
    const values = archetype.getComponentsAt(index);
    delete values[componentName];
    archetype.removeEntity(entity);
    if (archetype.size === 0) this.archetypes.delete(oldKeys);
    if (keys.length === 0) {
      this.entities.set(entity, null);
      return this;
    }

    const newArchetype = this.archetypes.getOrCreate(keys);
    newArchetype.addEntity(entity, values);

    return this;
  }

  getComponent<T extends ComponentName>(
    entity: Entity,
    componentName: T
  ): ComponentType<T> {
    if (!this.entities.has(entity))
      throw new Error(`Entity ${entity} does not exist.`);
    const archetype = this.entities.get(entity);
    if (archetype == null)
      throw new Error(`Entity ${entity} does not have an archetype.`);
    if (!archetype.hasComponent(componentName))
      throw new Error(
        `Entity ${entity} does not have component "${componentName}".`
      );
    const index = archetype.getEntityIndex(entity);
    return archetype.getComponentAt(componentName, index);
  }

  getComponents<N extends readonly ComponentName[]>(
    entity: Entity,
    ...names: N
  ): ComponentArray<N> {
    return names.map((name) =>
      this.getComponent(entity, name)
    ) as unknown as ComponentArray<N>;
  }
}
