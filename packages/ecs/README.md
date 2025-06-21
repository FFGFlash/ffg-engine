# @ffg-engine/ecs

## Understanding the ECS <sub>[back](../../README.md)</sub>

The ECS is in charge of managing everything, our components, our entities, our systems and our resources.

### Components

Components are simple data structures that let us break the world up into small bits of bitesize information. For example most things in a game have a position, which would be its own component

```ts
import { World } from '@ffg-engine/ecs'

// Using declaration merging we can make everything type-safe by declaring our component data structures.
declare module '@ffg-engine/ecs' {
  interface ComponentRegistry {
    position: { x: number; y: number }
  }
}

const world = new World()
  // Internally we map these component names to ids which allows the ECS system to optimize how entities and components are stored.
  .registerComponents('position')
```

### Resources

Just like components, resources are simple data structures. The only difference is that instead of being tied to an entity, resources are globally scoped.

```ts
import { World } from '@ffg-engine/ecs'

// Using declaration merging we can make everything type-safe by declaring our resource data structures.
declare module '@ffg-engine/ecs' {
  interface ResourceRegistry {
    debug: { enabled: boolean; fps: number }
  }
}

const world = new World()
  // Because resources are global we have to define their data immediately.
  .addResource('debug', { enabled: true, fps: 0 })
```

### Entities

Entities are a collection of components. For example a player might be made up of many components, while a circle drawn to the screen might only be 2 or 3.

```ts
import { World } from '@ffg-engine/ecs'

const world = new World()

const player = world.spawn({
  player: {},
  position: { x: 0, y: 0 },
  velocity: { x: 0, y: 0 },
  color: { value: 'blue' },
  circle: { radius: 20 },
})
```

### Systems

Systems implement the logic behind the world, how players move, enemies chase, etc etc

```ts
import { World, System } from '@ffg-engine/ecs'

const setup = new System()
  // First we define what information a system will have access to, in this case we expose the spawn command for spawning new entities.
  .deps(data => [data.commands.spawn])
  // Then we define the callback, where the arguments will be what were defined in `deps`
  .callback(spawn => {
    spawn({
      player: {},
      position: { x: 0, y: 0 },
      velocity: { x: 0, y: 0 },
      circle: { radius: 20 },
      color: { value: 'blue' },
    })
  })
  // Some other optional data can be set
  .name('setup') // set the name of this system
  // .before() - define systems that should run after this system (this can either be a direct reference to the system or the name of a system)
  // .after() - define systems that should run before this system (this can either be a direct reference to the system or the name of a system)
  .flag('sync', true) // set different flags for the system, such as sync.

// Worlds can define system types, otherwise it'll accept any string.
const world = new World<'startup' | 'update' | 'render'>()
  .registerComponents('player', 'position', 'velocity', 'circle', 'color')
  // We then register systems under their respective type
  .registerSystems('startup', setup)
  // Finally before we can run any systems we must initialize them, this determines system dependencies and ensures systems run in the correct order later on.
  .initializeSystems()

// Systems can also be created without the System class with the `world.createSystem()` method. They still have to be later registered.
// const setup = world.createSystem().deps(...).callback(...)

// We can then run all systems of a specific type
world.runSystems('startup')
```

### Queries

Queries are a way to quickly locate all entities that contain specific components.

```ts
import { World, System } from '@ffg-engine/ecs'

const world = new World().registerComponents('position', 'velocity')

// You can create queries directly from the world for use outside of systems.
const query = world.query.read('position')
// Then you can loop over said query to read each entity
for (const [entity, pos] of query) {
  console.log(`Entity ${entity} is located at (${pos.x}, ${pos.y})`)
}

const updatePositions = System.from({
  // We can also create queries in our deps callback.
  deps: data => [data.query.read('velocity').write('position')],
  callback: query => {
    for (const [, vel, pos] of query) {
      pos.x += vel.x
      pos.y += vel.y
    }
  },
})

world.registerSystems('update', updatePositions)
```
