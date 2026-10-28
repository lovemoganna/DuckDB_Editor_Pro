export interface QueryLifecycle {
  isCurrent?: () => boolean;
  onQueueStart?: (waitMs:number) => void;
  /** Completion of the real connection operation, including after a UI timeout. */
  onExecutionScheduled?: (completion:Promise<void>) => void;
}
export function requireCurrent(lifecycle?: QueryLifecycle) {
  if(lifecycle?.isCurrent && !lifecycle.isCurrent()) throw new DOMException('查询请求已失效','AbortError');
}
