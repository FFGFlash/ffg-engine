import { ArchetypeMap } from './Archetype';
import { ComponentName, ComponentType } from './Component';
import { data } from './Data';
import { Entity } from './Entity';

export class Query<Accesses extends AccessList = []> {
  private accesses = new Map<ComponentName, AccessMode>();
  private _lock = false;
  private _iterator: ReturnType<Query<Accesses>['gen']> | undefined;
  private _peeked: IteratorResult<QueryResult<Accesses>> | undefined;

  constructor(private archetypes: ArchetypeMap) {}

  with<
    N extends readonly ComponentName[],
    A extends AccessList = [...Accesses, ...MappedNamesToAccessList<N, false>]
  >(...names: N): Query<A> {
    if (this._lock) throw new Error('Query is locked and cannot be modified.');
    for (const name of names) {
      if (this.accesses.has(name))
        throw new Error(
          `Component "${name}" is already included in the query.`
        );
      this.accesses.set(name, false);
    }
    return this as unknown as Query<A>;
  }

  read<
    N extends readonly ComponentName[],
    A extends AccessList = [...Accesses, ...MappedNamesToAccessList<N, 'read'>]
  >(...names: N): Query<A> {
    if (this._lock) throw new Error('Query is locked and cannot be modified.');
    for (const name of names) {
      if (this.accesses.has(name))
        throw new Error(
          `Component "${name}" is already included in the query.`
        );
      this.accesses.set(name, 'read');
    }
    return this as unknown as Query<A>;
  }

  write<
    N extends readonly ComponentName[],
    A extends AccessList = [...Accesses, ...MappedNamesToAccessList<N, 'write'>]
  >(...names: N): Query<A> {
    if (this._lock) throw new Error('Query is locked and cannot be modified.');
    for (const name of names) {
      if (this.accesses.has(name))
        throw new Error(
          `Component "${name}" is already included in the query.`
        );
      this.accesses.set(name, 'write');
    }
    return this as unknown as Query<A>;
  }

  lock() {
    this._lock = true;
    return this;
  }

  reset() {
    this._iterator = undefined;
    this._peeked = undefined;
  }

  peek(): QueryResult<Accesses> | undefined {
    if (!this._iterator) this._iterator = this.gen();
    if (!this._peeked) this._peeked = this._iterator.next();
    if (this._peeked.done) return undefined;
    return this._peeked.value;
  }

  next(): IteratorResult<QueryResult<Accesses>> {
    if (!this._iterator) this._iterator = this.gen();
    if (this._peeked) {
      const result = this._peeked;
      this._peeked = undefined;
      return result;
    }
    return this._iterator.next();
  }

  [Symbol.iterator](): Iterator<QueryResult<Accesses>> {
    this._iterator = this.gen();
    this._peeked = undefined;
    return this._iterator;
  }

  private *gen(): IterableIterator<QueryResult<Accesses>> {
    const targets = [...this.accesses.keys()];
    const accessors = targets.filter((n) => this.accesses.get(n) !== false);

    for (const archetype of this.archetypes) {
      if (!archetype.match(targets)) continue;
      for (const [entity, ...components] of archetype.getEntitiesWith(
        accessors
      )) {
        const parsedComponents = components.map((c, i) => {
          const name = accessors[i] as ComponentName;
          const mode = this.accesses.get(name);
          if (mode === 'read') return data(c, true);
          return data(c, false);
        });
        yield [entity, ...parsedComponents] as QueryResult<Accesses>;
      }
    }
  }
}

export type AccessMode = 'read' | 'write' | false;
export type AccessList = [ComponentName, AccessMode][];
export type AccessListToComponentData<
  T extends AccessList,
  A extends unknown[] = []
> = T extends [infer Head, ...infer Tail]
  ? Head extends [
      infer Name extends ComponentName,
      infer Mode extends AccessMode
    ]
    ? Mode extends false
      ? AccessListToComponentData<Tail extends AccessList ? Tail : [], A>
      : Mode extends 'read'
      ? AccessListToComponentData<
          Tail extends AccessList ? Tail : [],
          [...A, Readonly<ComponentType<Name>>]
        >
      : AccessListToComponentData<
          Tail extends AccessList ? Tail : [],
          [...A, ComponentType<Name>]
        >
    : never
  : A;
export type QueryResult<A extends AccessList> = [
  Entity,
  ...AccessListToComponentData<A>
];
export type MappedNamesToAccessList<
  N extends readonly ComponentName[],
  M extends AccessMode
> = {
  [K in keyof N]: [N[K], M];
};
