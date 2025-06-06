// eslint-disable-next-line @typescript-eslint/no-empty-interface, @typescript-eslint/no-empty-object-type
export interface ComponentRegistry {}

export type ComponentName = keyof ComponentRegistry;
export type ComponentType<T extends ComponentName = ComponentName> =
  ComponentRegistry[T];
export type ComponentArray<N extends readonly ComponentName[]> = {
  [K in keyof N]: ComponentType<N[K]>;
};

export class ComponentMap extends Map<ComponentName, number> {
  constructor() {
    super();
  }

  override get(name: ComponentName): number {
    if (!super.has(name)) this.register(name);
    return super.get(name)!;
  }

  register(name: ComponentName): number {
    if (this.has(name))
      throw new Error(`Component "${name}" is already registered.`);
    const id = this.size;
    super.set(name, id);
    return id;
  }
}
