// eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-empty-interface
export interface ResourceRegistry {}

export type ResourceName = keyof ResourceRegistry
export type Resource<T extends ResourceName = ResourceName> = ResourceRegistry[T] & object
