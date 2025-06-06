import { Query } from './Query'
import { System } from './System'
import { World } from './World'

export async function runScheduler(world: World, systems: System[]) {
  const scheduledBatches: System[][] = []

  for (const system of systems) {
    const lastBatch = scheduledBatches.at(-1)
    if (lastBatch && !conflictsWithBatch(system, lastBatch)) {
      lastBatch.push(system)
      continue
    }

    scheduledBatches.push([system])
  }

  for (const batch of scheduledBatches) {
    await Promise.all(
      batch.map(system => {
        return new Promise<void>(resolve => {
          const args = (system._getDeps?.(world.data) || []).map(dep => {
            if (dep instanceof Query) dep.lock()
            return dep
          })

          resolve(system._fn?.(...args))
        })
      })
    )
  }
}

function conflictsWithBatch(system: System, batch: System[]): boolean {
  return batch.some(other => systemsConflict(system, other))
}

function systemsConflict(a: System, b: System): boolean {
  if (a._flags?.sync || b._flags?.sync) return true

  const aReads = a._reads || new Set()
  const aWrites = a._writes || new Set()
  const bReads = b._reads || new Set()
  const bWrites = b._writes || new Set()

  for (const r of aReads) if (bWrites.has(r)) return true
  for (const w of aWrites) if (bReads.has(w) || bWrites.has(w)) return true

  return false
}

export function topologicalSort(systems: System[]): System[] {
  const visited = new Set<System>()
  const temp = new Set<System>()
  const result: System[] = []

  const visit = (system: System) => {
    if (visited.has(system)) return
    if (temp.has(system)) throw new Error(`Circular dependency detected in system: ${system._name}`)
    temp.add(system)

    for (const name of system._after || []) {
      for (const other of systems) {
        if (other._name === name) visit(other)
      }
    }

    temp.delete(system)
    visited.add(system)
    result.push(system)

    for (const name of system._before || []) {
      for (const other of systems) {
        if (other._name === name) visit(other)
      }
    }
  }

  for (const system of systems) {
    visit(system)
  }

  return result
}
