/** One running operation and one replaceable latest request, scoped to a component instance. */
export class LatestTask {
  private running = false;
  private pending?: {run:()=>Promise<void>;resolve:()=>void;reject:(error:unknown)=>void};
  submit(run:()=>Promise<void>): Promise<void> {
    return new Promise((resolve,reject)=>{
      this.pending?.resolve();
      this.pending={run,resolve,reject};
      void this.drain();
    });
  }
  clear() { this.pending?.resolve(); this.pending=undefined; }
  private async drain() {
    if(this.running)return;
    this.running=true;
    try {
      while(this.pending) {
        const task=this.pending;this.pending=undefined;
        try {await task.run();task.resolve();} catch(error) {task.reject(error);}
      }
    } finally {this.running=false;}
  }
}
