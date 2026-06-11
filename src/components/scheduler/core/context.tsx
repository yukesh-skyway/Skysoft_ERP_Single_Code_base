/**
 * context.tsx — re-exports the unified scheduler context from @/components/scheduler/shadcn-shell.
 *
 * This makes packages/shadcn-scheduler a *consumer* of the shell package rather than
 * a parallel implementation. Both @/components/scheduler/shadcn-shell and @sushill/shadcn-scheduler
 * now read from / write to the SAME React Context object — so a SchedulerProvider from
 * either package works transparently with GridView or any view-* component.
 */
export {
  SchedulerContext,
  SchedulerProvider,
  useSchedulerContext,
} from '@/components/scheduler/shadcn-shell'
export type {
  SchedulerContextValue,
  SchedulerProviderProps,
} from '@/components/scheduler/shadcn-shell'

/**
 * nextUid — generates a unique block ID.
 * Uses crypto.randomUUID() when available (all modern browsers + Node 18+),
 * falling back to Math.random() for older envs.
 */
export function nextUid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `s${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`
  }
  return `s${Math.random().toString(36).slice(2, 14)}`
}
