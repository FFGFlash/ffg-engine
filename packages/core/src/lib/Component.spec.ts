import { ComponentMap } from './Component'

describe('ComponentMap', () => {
  it('should create a ComponentMap', () => {
    const componentMap = new ComponentMap()
    expect(componentMap).toBeInstanceOf(ComponentMap)
  })

  it('should register a component and return its ID', () => {
    const componentMap = new ComponentMap()
    const id = componentMap.register('position')
    expect(id).toBe(0)
    expect(componentMap.get('position')).toBe(0)
  })

  it('should throw an error when registering a duplicate component', () => {
    const componentMap = new ComponentMap()
    componentMap.register('position')
    expect(() => componentMap.register('position')).toThrow(
      'Component "position" is already registered.'
    )
  })
})
