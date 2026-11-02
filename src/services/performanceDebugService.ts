/**
 * קובץ: src/services/performanceDebugService.ts
 * מטרה: איסוף והצגת מדדי ביצועים לצורכי אבחון.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: PerformanceDebugService.
 * - ריכוז פעולות העיבוד והחישוב בהתאם לפונקציות להלן.
 */
/**
 * איגוד פעולות שירות במחלקה PerformanceDebugService.
 */
export class PerformanceDebugService {
  /**
   * פעולה אסינכרונית measureAsync: הנתון measureAsync בהקשר הפעולה.
   * @param label — תווית.
   * @param operation — הנתון operation בהקשר הפעולה.
   * @returns Promise<T> — הפלט בהתאם לחתימה.
   */
  static async measureAsync<T>(label: string, operation: () => Promise<T>): Promise<T> {
    const startedAt = performance.now();
    try {
      return await operation();
    } finally {
      if (import.meta.env.DEV) {
        // durationMs — משך.
        const durationMs = Math.round((performance.now() - startedAt) * 10) / 10;
        console.debug(`[Performance] ${label}: ${durationMs}ms`);
      }
    }
  }
}
