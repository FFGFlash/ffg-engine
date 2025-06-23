/* eslint-disable @typescript-eslint/no-explicit-any */
import { Engine, EngineEventMap } from './engine.js'
import { MaybeThisParameterType, RemoveThis } from './types.js'
import { callOrReturn } from './utilities/callOrReturn.js'
import { mergeDeep } from './utilities/mergeDeep.js'

export class Plugin<Options = any> {
  parent: Plugin | null = null
  child: Plugin | null = null
  name = ''

  config = {
    name: this.name,
  } as PluginConfig<Options>

  constructor(config: Partial<PluginConfig<Options>>) {
    this.config = {
      ...this.config,
      ...config,
    }
    this.name = this.config.name
  }

  get options(): Options {
    return {
      ...(callOrReturn(
        getPluginField<PluginConfig['addOptions']>(this, 'addOptions', { name: this.name })
      ) || {}),
    }
  }

  configure(options: Partial<Options> = {}) {
    const extension = this.extend<Options>({
      ...this.config,
      addOptions: () => {
        return mergeDeep(this.options as Record<string, any>, options) as Options
      },
    })

    extension.name = this.name
    extension.parent = this.parent

    return extension
  }

  extend<ExtendedOptions = Options, ExtendedConfig = PluginConfig<ExtendedOptions>>(
    extendedConfig: Partial<ExtendedConfig> | (() => ExtendedConfig) = {}
  ) {
    const resolvedConfig = typeof extendedConfig === 'function' ? extendedConfig() : extendedConfig
    const extension = new Plugin<ExtendedOptions>({
      ...this.config,
      ...resolvedConfig,
    } as Partial<PluginConfig<ExtendedOptions>>)
    extension.parent = this
    this.child = extension
    extension.name = 'name' in extendedConfig ? extendedConfig.name : extension.parent.name
    return extension
  }

  static create<O = any>(
    config: Partial<PluginConfig<O>> | (() => PluginConfig<O>) = {}
  ): Plugin<O> {
    const resolvedConfig = typeof config === 'function' ? config() : config
    return new Plugin(resolvedConfig)
  }
}

export interface PluginConfig<
  Options = any,
  Config extends PluginConfig = PluginConfig<Options, any>
> {
  name: string
  priority?: number
  setup?: (this: { name: string; options: Options }, engine: Engine) => void
  addOptions?: (this: { name: string; parent: ParentConfig<Config>['addOptions'] }) => Options
  onStart?: (
    this: { name: string; options: Options; parent: ParentConfig<Config>['onStart'] },
    ...args: EngineEventMap['start']
  ) => void
  onStop?: (
    this: { name: string; options: Options; parent: ParentConfig<Config>['onStop'] },
    ...args: EngineEventMap['stop']
  ) => void
  onPause?: (
    this: { name: string; options: Options; parent: ParentConfig<Config>['onPause'] },
    ...args: EngineEventMap['pause']
  ) => void
  onResume?: (
    this: { name: string; options: Options; parent: ParentConfig<Config>['onResume'] },
    ...args: EngineEventMap['resume']
  ) => void
}

export type ParentConfig<T> = Partial<{
  [K in keyof T]: Required<T>[K] extends (...args: any) => any
    ? (...args: Parameters<Required<T>[K]>) => ReturnType<Required<T>[K]>
    : T[K]
}>

function getPluginField<T = any, P extends Plugin = any>(
  plugin: P,
  field: keyof PluginConfig,
  context?: Omit<MaybeThisParameterType<T>, 'parent'>
): RemoveThis<T> {
  if (plugin.config[field as keyof typeof plugin.config] === undefined && plugin.parent) {
    return getPluginField(plugin.parent, field, context)
  }

  if (typeof plugin.config[field as keyof typeof plugin.config] === 'function') {
    const value = (plugin.config[field as keyof typeof plugin.config] as any).bind({
      ...context,
      parent: plugin.parent ? getPluginField(plugin.parent, field, context) : undefined,
    })

    return value
  }

  return plugin.config[field as keyof typeof plugin.config] as RemoveThis<T>
}

export class PluginManager {
  constructor(private engine: Engine, public plugins: Plugin[] = []) {}

  add(plugin: Plugin) {
    if (this.plugins.some(p => p.name === plugin.name))
      throw new Error(`Plugin with name "${plugin.name}" already exists.`)
    this.plugins.push(plugin)
    return this
  }

  remove(plugin: Plugin | string) {
    const name = typeof plugin === 'string' ? plugin : plugin.name
    this.plugins = this.plugins.filter(p => p.name !== name)
    return this
  }

  static sort(plugins: Plugin[]): Plugin[] {
    return plugins.sort((a, b) => {
      const aPriority = getPluginField<PluginConfig['priority']>(a, 'priority') ?? 100
      const bPriority = getPluginField<PluginConfig['priority']>(b, 'priority') ?? 100
      return bPriority - aPriority
    })
  }

  setupPlugins() {
    for (const plugin of PluginManager.sort(this.plugins)) {
      const eventContext = { name: plugin.name, options: plugin.options }
      const onStart = getPluginField<PluginConfig['onStart']>(plugin, 'onStart', eventContext)
      const onStop = getPluginField<PluginConfig['onStop']>(plugin, 'onStop', eventContext)
      const onPause = getPluginField<PluginConfig['onPause']>(plugin, 'onPause', eventContext)
      const onResume = getPluginField<PluginConfig['onResume']>(plugin, 'onResume', eventContext)
      if (onStart) this.engine.on('start', onStart)
      if (onStop) this.engine.on('stop', onStop)
      if (onPause) this.engine.on('pause', onPause)
      if (onResume) this.engine.on('resume', onResume)
    }
  }
}
