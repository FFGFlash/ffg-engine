// eslint-disable-next-line @typescript-eslint/no-empty-interface, @typescript-eslint/no-empty-object-type
export interface ResourceRegistry {}

export type ResourceName = keyof ResourceRegistry
export type ResourceType<T extends ResourceName = ResourceName> = ResourceRegistry[T]
