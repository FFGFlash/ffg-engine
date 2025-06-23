import { Plugin, Symbols, System, SystemType } from '@ffg-engine/core'

export interface InputPluginConfig {
  target: EventTarget
}

let InputSystem: System

export const InputPlugin = Plugin.create<InputPluginConfig>({
  name: 'input-plugin',

  addOptions() {
    return {
      target: window,
    }
  },

  onStart({ engine }) {
    const { target } = this.options
    const setup = (InputSystem ??= System.from({
      name: 'input-system',
      deps: data => [data.mutRes('input')],
      callback: input => {
        if (target instanceof HTMLElement || target instanceof SVGElement) target.tabIndex = 0
        target.addEventListener('keydown', e => input.set((e as KeyboardEvent).key, 1))
        target.addEventListener('keyup', e => input.set((e as KeyboardEvent).key, 0))
        target.addEventListener('blur', () => input.clear())
      },
    }))

    engine.world.addResource('input', new InputMap()).registerSystems(SystemType.STARTUP, setup)
  },
})

class InputMap extends Map<string, number> {
  override get(...keys: string[]): number {
    if (keys.length === 0) return 0
    if (keys.length === 1) return super.get(keys[0]) ?? 0
    const key = keys.find(key => super.get(key) ?? 0)
    if (!key) return 0
    return super.get(key) ?? 0
  }

  override set(key: string, value: number): this {
    if (value === 0) super.delete(key)
    else super.set(key, value)
    return this
  }

  override has(key: string): boolean {
    return super.has(key) && super.get(key)! > 0
  }

  [Symbols.Clone]() {
    const clone = new InputMap()
    for (const [key, value] of this) clone.set(key, value)
    return clone
  }

  override [Symbol.toStringTag] = 'InputMap'
}

declare module '@ffg-engine/core' {
  interface ResourceRegistry {
    input: InputMap
  }
}

export default InputPlugin
