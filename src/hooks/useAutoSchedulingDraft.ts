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

interface AutoSchedulingDraftState {
  draft:
    SchedulingDraft | null;

  isGenerating: boolean;

  error: string | null;
}

interface UseAutoSchedulingDraftResult {
  state:
    AutoSchedulingDraftState;

  generateDraft: (
    data:
      AssignmentCandidatesData,
  ) => void;

  reset:
    () => void;
}

const initialState:
  AutoSchedulingDraftState = {
    draft: null,
    isGenerating: false,
    error: null,
  };

function getErrorMessage(
  error: unknown,
): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'אירעה שגיאה בלתי צפויה בהכנת טיוטת השיבוץ.';
}

export function useAutoSchedulingDraft():
  UseAutoSchedulingDraftResult {
  const [
    state,
    setState,
  ] =
    useState<AutoSchedulingDraftState>(
      initialState,
    );

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

        try {
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