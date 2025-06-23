# @ffg-engine/core

## Understanding the Engine [WIP] <sub>[back](../../README.md)</sub>

The engine is in charge of how everything runs together, what systems run when, etc etc. It also initializes some useful resources for you to use.

For a more in-depth look at the ECS, check out [Understanding the ECS](../ecs/README.md)

```ts
import { Engine, SystemType } from '@ffg-engine/core'

const engine = new Engine()

// Eventually the engine will have passthrough methods so you don't need direct access to the world.
const world = engine.world

//... Setup everyting on your ECS, resources, systems, etc.

// The engine comes with pre-defined system types for executing at specific points in the game loop.
// `SystemType.STARTUP` - Runs once when `engine.start` is called.
// `SystemType.FIXED_UPDATE` - Runs at a fixed timestep defined by the first argument to `engine.start`.
// `SystemType.UPDATE` - Runs every frame, before `SystemType.RENDER`.
// `SystemType.RENDER` - Runs every frame.
// Ex. world.registerSystems(SystemType.STARTUP, setup)

// Start your engines. This will internally call `world.initializeSystems` and `world.runSystems`
await engine.start(1000 / 60)

// Call `engine.stop()` to stop everyting, or `engine.pause()` to freeze all delta dependant logic (`engine.resume()` to undo) or set the time scale to a custom value with `engine.setTimeScale(0.5)`

// Time is a resource added by our engine, this contains information such as total frame count, how long the engine has been running and how much time as passed in-between frames (delta).
// we can also scale said delta by a factor, the timeScale, this can be controlled via the engine with the methods `pause`, `resume` and `setTimeScale` or can be mutated via the resource.
const time = world.getResource('time')
```

### Plugins [WIP]

Plugins allow for quick and simple extendability with the engine, adding things like resources, systems or even components and hopefuly much more in the future.

For an example check out the [Input](../input/) plugin

```ts
import { Plugin } from '@ffg-engine/core'

interface MyPluginOptions {
  debug: boolean
}

export const MyPlugin = Plugin.create<MyPluginOptions>({
  name: 'my-plugin',

  addOptions() {
    return {
      debug: false,
    }
  },

  onStart({ engine }) {
    // ... Do something when the `Engine.start` method is invoked.
  },

  onStop({ engine }) {
    // ... Do something when the `Engine.stop` method is invoked.
  },

  onPause({ engine }) {
    // ... Do something when the `Engine.pause` method is invoked.
  },

  onResume({ engine }) {
    // ... Do something when the `Engine.resume` method is invoked.
  },
})
```
