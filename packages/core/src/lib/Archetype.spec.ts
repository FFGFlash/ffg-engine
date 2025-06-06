import { ComponentMap } from './Component';
import { Archetype, ArchetypeMap } from './Archetype';

declare module './Component' {
  interface ComponentRegistry {
    position: { x: number; y: number };
    velocity: { dx: number; dy: number };
  }
}

describe('Archetype', () => {
  it('should create an archetype with a signature', () => {
    const archetype = new Archetype(new Set(['position', 'velocity']));
    expect(archetype.signature).toEqual(new Set(['position', 'velocity']));
  });

  it('should add an entity with components to the archetype', () => {
    const archetype = new Archetype(new Set(['position', 'velocity']));
    const entity = 1;
    const components = {
      position: { x: 10, y: 20 },
      velocity: { dx: 1, dy: 2 },
    };

    archetype.addEntity(entity, components);

    expect(archetype.hasEntity(entity)).toBe(true);
    expect(archetype.getComponentAt('position', 0)).toEqual({ x: 10, y: 20 });
    expect(archetype.getComponentAt('velocity', 0)).toEqual({ dx: 1, dy: 2 });
  });

  it('should throw an error when adding an entity with missing components', () => {
    const archetype = new Archetype(new Set(['position', 'velocity']));
    const entity = 1;
    const components = {
      position: { x: 10, y: 20 },
      // velocity is missing
    };

    // @ts-expect-error - Intentionally missing 'velocity' component
    expect(() => archetype.addEntity(entity, components)).toThrow(
      `Missing component "velocity" for entity ${entity} in archetype.`
    );
  });
});

describe('ArchetypeMap', () => {
  it('should create an ArchetypeMap', () => {
    const archetypeMap = new ArchetypeMap(new ComponentMap());
    expect(archetypeMap).toBeInstanceOf(ArchetypeMap);
  });

  it('should get or create an archetype by signature', () => {
    const archetypeMap = new ArchetypeMap(new ComponentMap());
    const archetype = archetypeMap.getOrCreate(['position', 'velocity']);
    expect(archetype).toBeInstanceOf(Archetype);
    expect(archetype.signature).toEqual(new Set(['position', 'velocity']));
  });

  it('should create a unique key for an archetype signature', () => {
    const archetypeMap = new ArchetypeMap(new ComponentMap());
    const key = archetypeMap.getKey(['position', 'velocity']);
    expect(key).toBeOneOf(['3', '0|1']);
    const key2 = archetypeMap.getKey(['velocity', 'position']);
    expect(key2).toBe(key);
  });
});
