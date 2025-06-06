import { ComponentMap, ComponentName, ComponentType } from './Component.js';
import { Entity } from './Entity.js';

export class Archetype<N extends ComponentName = ComponentName> {
  readonly signature: ReadonlySet<N>;
  private entities: Entity[] = [];
  private components: ComponentArrays<N>;

  constructor(signature: ReadonlySet<N>) {
    this.signature = signature;
    const components: ComponentArrays<N> = {} as any;
    for (const name of signature) {
      components[name] = [];
    }
    this.components = components;
  }

  addEntity(entity: Entity, components: Components<N>): this {
    if (this.entities.includes(entity))
      throw new Error(`Entity ${entity} already exists in this archetype.`);
    for (const name of this.signature) {
      if (!(name in components)) {
        throw new Error(
          `Missing component "${name}" for entity ${entity} in archetype.`
        );
      }
      this.components[name].push(components[name]);
    }
    this.entities.push(entity);
    return this;
  }

  hasEntity(entity: Entity): boolean {
    return this.entities.includes(entity);
  }

  getEntityIndex(entity: Entity): number {
    return this.entities.indexOf(entity);
  }

  removeEntity(entity: Entity): this {
    const index = this.getEntityIndex(entity);
    if (index === -1) {
      throw new Error(`Entity ${entity} does not exist in this archetype.`);
    }
    this.entities.splice(index, 1);
    for (const name of this.signature) {
      this.components[name].splice(index, 1);
    }
    return this;
  }

  hasComponent(name: N): boolean {
    return this.signature.has(name);
  }

  getComponentAt<T extends N>(name: T, index: number): ComponentType<T> {
    if (!this.hasComponent(name)) {
      throw new Error(`Component "${name}" does not exist in this archetype.`);
    }
    return this.components[name][index] as ComponentType<T>;
  }

  setComponentAt<T extends N>(
    name: T,
    index: number,
    component: ComponentType<T>
  ): this {
    if (!this.hasComponent(name)) {
      throw new Error(`Component "${name}" does not exist in this archetype.`);
    }
    this.components[name][index] = component as any;
    return this;
  }

  getComponentsAt(index: number): Components<N> {
    const components: Components<N> = {} as any;
    for (const name of this.signature) {
      components[name] = this.getComponentAt(name, index);
    }
    return components;
  }

  get size(): number {
    return this.entities.length;
  }

  match(names: readonly ComponentName[]): boolean {
    return names.every((n) => this.signature.has(n));
  }

  *getEntitiesWith<N extends readonly ComponentName[]>(
    names: N
  ): Iterable<[Entity, ...{ [K in keyof N]: ComponentType<N[K]> }]> {
    if (!this.match(names))
      throw new Error(
        `Archetype does not match components: ${names.join(', ')}`
      );
    for (let i = 0; i < this.entities.length; i++) {
      const row = Array.from(names).map((k) => this.components[k][i]);
      yield [this.entities[i], ...row] as unknown as [
        Entity,
        ...{ [K in keyof N]: ComponentType<N[K]> }
      ];
    }
  }
}

export type ComponentArrays<N extends ComponentName> = {
  [K in N]: ComponentType<K>[];
};

export type Components<N extends ComponentName = ComponentName> = {
  [K in N]: ComponentType<K>;
};

export class ArchetypeMap {
  private static readonly MAX_BITMASK_COMPONENTS = 256;
  private static readonly BITS_PER_CHUNK = 64;
  private archetypes = new Map<string, Archetype>();
  private usingBitmask = true;

  constructor(private readonly componentIds: ComponentMap) {}

  private makeBitmask(ids: number[]): bigint[] {
    const mask: bigint[] = [];

    for (const id of ids) {
      const chunk = Math.floor(id / ArchetypeMap.BITS_PER_CHUNK);
      const bit = BigInt(1) << BigInt(id % ArchetypeMap.BITS_PER_CHUNK);
      while (mask.length <= chunk) mask.push(BigInt(0));
      mask[chunk]! |= bit;
    }

    return mask;
  }

  getKey(names: ComponentName[]): string {
    const ids = names.map((name) => this.componentIds.get(name));
    if (this.componentIds.size > ArchetypeMap.MAX_BITMASK_COMPONENTS) {
      if (this.usingBitmask) {
        this.usingBitmask = false;
        this.recomputeSignatures();
      }
      return ids.sort().join('|');
    }

    if (!this.usingBitmask) {
      this.usingBitmask = true;
      this.recomputeSignatures();
    }

    return this.makeBitmask(ids)
      .map((b) => b.toString(16))
      .join('|');
  }

  private recomputeSignatures() {
    const archetypes = Array.from(this.archetypes.values());
    this.archetypes.clear();
    for (const archetype of archetypes) {
      const key = this.getKey(Array.from(archetype.signature));
      this.archetypes.set(key, archetype);
    }
  }

  /**
   * Retrieves the archetype associated with the given component names.
   * If the archetype does not exist, it will create a new one.
   *
   * @param names The names of the components that define the archetype.
   * @returns The archetype associated with the given component names, creating it if it does not exist.
   */
  getOrCreate(names: ComponentName[]): Archetype {
    const key = this.getKey(names);
    if (!this.archetypes.has(key)) {
      const signature = new Set(names);
      const archetype = new Archetype(signature);
      this.archetypes.set(key, archetype);
    }
    return this.archetypes.get(key)!;
  }

  /**
   * Deletes the archetype associated with the given component names.
   * @param names The names of the components that define the archetype to delete.
   * @returns `true` if the archetype was deleted, `false` if it did not exist.
   */
  delete(names: ComponentName[]): boolean {
    const key = this.getKey(names);
    return this.archetypes.delete(key);
  }

  *[Symbol.iterator]() {
    for (const archetype of this.archetypes.values()) {
      yield archetype;
    }
  }
}
