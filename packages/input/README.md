# @ffg-engine/input

## Input Handling <sub>[back](../../README.md)</sub>

The Input addon setups simple input handling.

```ts
import { Engine, System, SystemType } from '@ffg-engine/core'
import { InputPlugin } from '@ffg-engine/input'

const engine = new Engine()
  .registerComponents('player', 'position', 'velocity')
  .addPlugin(InputPlugin)
// You can also configure a specific element to attach the event listeners to, such as a canvas.
// .addPlugin(InputPlugin.configure({ element: canvas }))

const updatePlayerMovement = System.from({
  deps: data => [data.query.write('velocity').with('player'), data.res('input')],
  callback: (query, input) => {
    const xInput = input.get('ArrowRight', 'd') - input.get('ArrowRight', 'a')
    const yInput = input.get('ArrowDown', 's') - input.get('ArrowUp', 'w')
    for (const [, vel] of query) {
      vel.x = xInput * 250
      vel.y = yInput * 250
    }
  },
})

const updatePositions = System.from({
  deps: data => [data.query.write('position').read('velocity'), data.res('time')],
  callback: (query, time) => {
    for (const [, pos, vel] of query) {
      pos.x += vel.x * time.delta
      pos.y += vel.y * time.delta
    }
  },
  after: [updatePlayerMovement],
})

engine.registerSystems(SystemType.FIXED_UPDATE, updatePlayerMovement, updatePositions)

await engine.start()
```
