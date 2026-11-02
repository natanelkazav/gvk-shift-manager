/**
 * קובץ: src/hooks/useAutoSchedulingDraft.ts
 * מטרה: ניהול מצב ותופעות לוואי באמצעות React עבור טיוטה.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: AutoSchedulingDraftState, UseAutoSchedulingDraftResult, getErrorMessage, useAutoSchedulingDraft.
 * - ריכוז ההגדרות והלוגיקה המפורטות בהמשך הקובץ.
 */
import {
  useCallback,
  useState,
} from 'react';
import {
  autoSchedulingEngine,
} from '../services/autoSchedulingEngine';
import type {
  AssignmentCandidatesData,
} from '../types/assignmentCandidates';
import type {
  SchedulingDraft,
} from '../types/autoScheduling';

/**
 * חוזה הנתונים AutoSchedulingDraftState: טיוטה / מצב.
 */
interface AutoSchedulingDraftState {
  // draft — טיוטה.
  draft:
    SchedulingDraft | null;

  isGenerating: boolean;

  // error — שגיאה.
  error: string | null;
}

/**
 * חוזה הנתונים UseAutoSchedulingDraftResult: טיוטה / תוצאה.
 */
interface UseAutoSchedulingDraftResult {
  // state — מצב.
  state:
    AutoSchedulingDraftState;

  // generateDraft — טיוטה.
  generateDraft: (
    data:
      AssignmentCandidatesData,
  ) => void;

  reset:
    () => void;
}

// initialState — מצב.
const initialState:
  AutoSchedulingDraftState = {
    draft: null,
    isGenerating: false,
    error: null,
  };

/**
 * פעולה getErrorMessage: שליפה או חישוב של הודעת שגיאה.
 * @param error — שגיאה.
 * @returns string — הפלט בהתאם לחתימה.
 */
function getErrorMessage(
  error: unknown,
): string {
  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר error instanceof Error.
  if (error instanceof Error) {
    return error.message;
  }

  return 'אירעה שגיאה בלתי צפויה בהכנת טיוטת השיבוץ.';
}

/**
 * פעולה useAutoSchedulingDraft: חיבור מצב או הקשר עבור טיוטה.
 * @returns UseAutoSchedulingDraftResult — הפלט בהתאם לחתימה.
 */
export function useAutoSchedulingDraft():
  UseAutoSchedulingDraftResult {
  // מצב מקומי: state — מצב; setState מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    state,
    setState,
  ] =
    useState<AutoSchedulingDraftState>(
      initialState,
    );

  // generateDraft — טיוטה.
  const generateDraft =
    useCallback(
      (
        data:
          AssignmentCandidatesData,
      ): void => {
        setState({
          draft: null,
          isGenerating: true,
          error: null,
        });

        // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
        try {
          // draft — טיוטה.
          const draft =
            autoSchedulingEngine
              .buildSchedulingDraft(
                data,
              );

          setState({
            draft,
            isGenerating: false,
            error: null,
          });
        } catch (error) {
          setState({
            draft: null,
            isGenerating: false,
            error:
              getErrorMessage(error),
          });
        }
      },
      [],
    );

  const reset =
    useCallback((): void => {
      setState(initialState);
    }, []);

  return {
    state,
    generateDraft,
    reset,
  };
}