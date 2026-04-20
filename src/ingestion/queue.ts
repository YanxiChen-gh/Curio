import { readFileSync, writeFileSync, existsSync } from "fs";

export class AsyncQueue<T> {
  private buffer: T[] = [];
  private resolveWait: ((value: IteratorResult<T>) => void) | null = null;
  private finished = false;

  push(item: T) {
    if (this.resolveWait) {
      const resolve = this.resolveWait;
      this.resolveWait = null;
      resolve({ value: item, done: false });
    } else {
      this.buffer.push(item);
    }
  }

  pushMany(items: T[]) {
    for (const item of items) this.push(item);
  }

  done() {
    this.finished = true;
    if (this.resolveWait) {
      const resolve = this.resolveWait;
      this.resolveWait = null;
      resolve({ value: undefined as unknown as T, done: true });
    }
  }

  get size() {
    return this.buffer.length;
  }

  checkpoint(file: string) {
    writeFileSync(file, JSON.stringify(this.buffer, null, 2));
  }

  static resume<T>(file: string): T[] {
    if (!existsSync(file)) return [];
    try {
      return JSON.parse(readFileSync(file, "utf-8"));
    } catch {
      return [];
    }
  }

  [Symbol.asyncIterator](): AsyncIterator<T> {
    return {
      next: () => {
        if (this.buffer.length > 0) {
          return Promise.resolve({ value: this.buffer.shift()!, done: false });
        }
        if (this.finished) {
          return Promise.resolve({ value: undefined as unknown as T, done: true });
        }
        return new Promise<IteratorResult<T>>((resolve) => {
          this.resolveWait = resolve;
        });
      },
    };
  }
}
