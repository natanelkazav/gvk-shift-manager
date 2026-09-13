export class PerformanceDebugService {
  static async measureAsync<T>(label: string, operation: () => Promise<T>): Promise<T> {
    const startedAt = performance.now();
    try {
      return await operation();
    } finally {
      if (import.meta.env.DEV) {
        const durationMs = Math.round((performance.now() - startedAt) * 10) / 10;
        console.debug(`[Performance] ${label}: ${durationMs}ms`);
      }
    }
  }
}
