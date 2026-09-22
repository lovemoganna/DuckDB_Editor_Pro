interface PendingCaller {
  resolve: () => void;
  reject: (reason: unknown) => void;
}

export class AsyncDebouncer {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private latestTask: (() => Promise<void>) | null = null;
  private pending: PendingCaller[] = [];

  constructor(private readonly delayMs: number) {}

  run(task: () => Promise<void>): Promise<void> {
    this.latestTask = task;
    if (this.timer) clearTimeout(this.timer);

    const promise = new Promise<void>((resolve, reject) => {
      this.pending.push({ resolve, reject });
    });

    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, this.delayMs);

    return promise;
  }

  cancel(reason: unknown = new Error('Debounced task cancelled')): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.latestTask = null;
    const pending = this.pending.splice(0);
    pending.forEach(caller => caller.reject(reason));
  }

  private async flush(): Promise<void> {
    const task = this.latestTask;
    this.latestTask = null;
    const pending = this.pending.splice(0);
    if (!task) {
      pending.forEach(caller => caller.resolve());
      return;
    }

    try {
      await task();
      pending.forEach(caller => caller.resolve());
    } catch (error) {
      pending.forEach(caller => caller.reject(error));
    }
  }
}
