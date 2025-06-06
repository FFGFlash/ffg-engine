import { World } from './World'

describe('World', () => {
  it('should create a new world instance', () => {
    const world = new World()
    expect(world).toBeInstanceOf(World)
  })

  it('should register a component and return its ID', () => {
    const world = new World().registerComponents('position')
    expect(world.getComponentId('position')).toBe(0)
  })

  it('should create an entity and return its ID', () => {
    const world = new World()
    const entity = world.createEntity()
    expect(entity).toBe(0)
    // @ts-expect-error - Entities is private, but we can check its existence
    expect(world.entities.has(entity)).toBe(true)
  })

  it('should add a component to an entity', () => {
    const world = new World().registerComponents('position')
    const entity = world.createEntity()
    world.addComponent(entity, 'position', { x: 10, y: 20 })
    // @ts-expect-error - Entities is private, but we can check its archetype
    expect(world.entities.get(entity).hasComponent('position')).toBe(true)
  })

  it('should throw an error when adding a component to a non-existent entity', () => {
    const world = new World().registerComponents('position')
    expect(() => world.addComponent(999, 'position', { x: 10, y: 20 })).toThrow(
      'Entity 999 does not exist.'
    )
  })

  it('should remove a component from an entity', () => {
    const world = new World().registerComponents('position')
    const entity = world.createEntity()
    world.addComponent(entity, 'position', { x: 10, y: 20 })
    world.removeComponent(entity, 'position')
    expect(
      // @ts-expect-error - Entities is private, but we can check its archetype
      world.entities.get(entity)?.hasComponent('position') ?? null
    ).toBeOneOf([false, null])
  })

  it('should throw an error when removing a component from a non-existent entity', () => {
    const world = new World().registerComponents('position')
    expect(() => world.removeComponent(999, 'position')).toThrow('Entity 999 does not exist.')
  })

  it('should throw an error when removing a non-existent component from an entity', () => {
    const world = new World().registerComponents('position')
    const entity = world.createEntity()
    expect(() => world.removeComponent(entity, 'velocity')).toThrow(
      'Entity 0 does not have an archetype.'
    )
  })
})
