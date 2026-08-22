import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  FileSpreadsheet,
  Link2,
  RefreshCw,
  Upload,
  Users,
  Wrench,
  X,
} from 'lucide-react';

import {
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from 'react';

import {
  Button,
} from '../ui';
import {
  scheduleImportExecutionService,
} from '../../services/scheduleImportExecutionService';
import {
  scheduleImportService,
} from '../../services/scheduleImportService';

import {
  scheduleImportIdentityService,
} from '../../services/scheduleImportIdentityService';

import type {
  ExecuteScheduleExcelImportResponse,
  ScheduleImportPreview,
  ScheduleImportResolvedName,
  ScheduleImportUser,
  ScheduleImportUsersData,
  PreviewScheduleExcelImportResponse,
  ScheduleImportStrategy,
  ScheduleImportUserType,
} from '../../types/scheduleImport';

import '../../styles/scheduleImport.css';

interface ScheduleImportPanelProps {
  disabled?: boolean;
}

type SelectedMappings =
  Record<string, string>;

type CurrentMonthImportStrategy =
  | 'missing_only'
  | 'replace'
  | 'rebuild';

const PREVIEW_ROW_LIMIT =
  20;

const hebrewMonths = [
  'ינואר',
  'פברואר',
  'מרץ',
  'אפריל',
  'מאי',
  'יוני',
  'יולי',
  'אוגוסט',
  'ספטמבר',
  'אוקטובר',
  'נובמבר',
  'דצמבר',
];
function formatImportDate(
  dateValue: string,
): string {
  const dateParts =
    dateValue.split('-');

  if (
    dateParts.length !== 3
  ) {
    return dateValue;
  }

  const [
    year,
    month,
    day,
  ] =
    dateParts;

  if (
    !year ||
    !month ||
    !day
  ) {
    return dateValue;
  }

  return `${day}/${month}/${year}`;
}
function formatShiftTime(
  startTime: string,
  endTime: string,
): string {
  return `${startTime}–${endTime}`;
}

function normalizeImportedName(
  value: string,
): string {
  return value
    .replace(
      /\u00a0/g,
      ' ',
    )
    .replace(
      /[״"'׳]/g,
      '',
    )
    .replace(
      /[ךםןףץ]/g,
      (character) => {
        const finalLetterMap:
          Record<
            string,
            string
          > = {
            ך: 'כ',
            ם: 'מ',
            ן: 'נ',
            ף: 'פ',
            ץ: 'צ',
          };

        return finalLetterMap[
          character
        ] ??
          character;
      },
    )
    .replace(
      /\s+/g,
      ' ',
    )
    .trim()
    .toLocaleLowerCase(
      'he-IL',
    );
}

function getImportStrategyLabel(
  strategy:
    ScheduleImportStrategy,
): string {
  switch (strategy) {
    case 'missing_only':
      return 'עדכון נתונים חסרים בלבד';

    case 'replace':
      return 'החלפת נתוני החודש';

    case 'rebuild':
      return 'מחיקה וייבוא מחדש';

    case 'historical_archive':
      return 'ייבוא היסטורי וארכוב';

    default:
      return strategy;
  }
}

function createResolvedNameKey(
  resolvedName:
    ScheduleImportResolvedName,
): string {
  return [
    resolvedName.userType,
    resolvedName.normalizedSourceName,
  ].join(':');
}

function getMatchSourceLabel(
  resolvedName:
    ScheduleImportResolvedName,
): string {
  switch (
    resolvedName.matchSource
  ) {
    case 'alias':
      return 'התאמה שמורה';

    case 'schedule_name':
      return 'זוהה לפי שם שיבוץ';

    case 'display_name':
      return 'זוהה לפי שם משתמש';

    case 'unmatched':
    default:
      return 'לא זוהה';
  }
}

function getUserDisplayName(
  user:
    ScheduleImportUser,
): string {
  return (
    user.scheduleName
      ?.trim() ||
    user.displayName
      .trim() ||
    user.email
  );
}

function ScheduleImportPanel({
  disabled = false,
}: ScheduleImportPanelProps) {
  const fileInputRef =
    useRef<HTMLInputElement | null>(
      null,
    );

  const [
    selectedFile,
    setSelectedFile,
  ] =
    useState<File | null>(
      null,
    );

  const [
    preview,
    setPreview,
  ] =
    useState<ScheduleImportPreview | null>(
      null,
    );

  const [
    importUsersData,
    setImportUsersData,
  ] =
    useState<ScheduleImportUsersData | null>(
      null,
    );

  const [
    resolvedDispatcherNames,
    setResolvedDispatcherNames,
  ] =
    useState<
      ScheduleImportResolvedName[]
    >([]);

  const [
    resolvedDriverNames,
    setResolvedDriverNames,
  ] =
    useState<
      ScheduleImportResolvedName[]
    >([]);
  const [
  resolvedMorningDriverNames,
  setResolvedMorningDriverNames,
] =
  useState<
    ScheduleImportResolvedName[]
  >([]);
  const [
    selectedMappings,
    setSelectedMappings,
  ] =
    useState<SelectedMappings>(
      {},
    );

  const [
    isAnalyzing,
    setIsAnalyzing,
  ] =
    useState(false);

  const [
    isLoadingUsers,
    setIsLoadingUsers,
  ] =
    useState(false);

  const [
    savingMappingKey,
    setSavingMappingKey,
  ] =
    useState<string | null>(
      null,
    );

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    );

  const [
    identityError,
    setIdentityError,
  ] =
    useState<string | null>(
      null,
    );
    const [
      currentMonthImportStrategy,
      setCurrentMonthImportStrategy,
    ] =
      useState<CurrentMonthImportStrategy>(
        'missing_only',
      );
      const [
        importSimulation,
        setImportSimulation,
      ] =
        useState<PreviewScheduleExcelImportResponse | null>(
          null,
        );

      const [
        isSimulatingImport,
        setIsSimulatingImport,
      ] =
        useState(false);

      const [
        simulationError,
        setSimulationError,
      ] =
        useState<string | null>(
          null,
        );

      const [
        isConfirmDialogOpen,
        setIsConfirmDialogOpen,
      ] =
        useState(false);

      const [
        isExecutingImport,
        setIsExecutingImport,
      ] =
        useState(false);

      const [
        executionError,
        setExecutionError,
      ] =
        useState<string | null>(
          null,
        );

      const [
        executionResult,
        setExecutionResult,
      ] =
        useState<ExecuteScheduleExcelImportResponse | null>(
          null,
        );

      const [
        showAllDispatcherShifts,
        setShowAllDispatcherShifts,
      ] =
        useState(false);

      const [
        showAllDriverDuties,
        setShowAllDriverDuties,
      ] =
        useState(false);
        const [
  showAllMorningDriverShifts,
  setShowAllMorningDriverShifts,
] =
  useState(false);
    const resetImport =
      (): void => {
        setSelectedFile(
          null,
        );

        setPreview(
          null,
        );

        setImportUsersData(
          null,
        );

        setResolvedDispatcherNames(
          [],
        );

        setResolvedDriverNames(
          [],
        );

        setResolvedMorningDriverNames(
          [],
        );

        setImportSimulation(
          null,
        );

          setIsSimulatingImport(
            false,
          );

          setSimulationError(
            null,
          );

          setIsConfirmDialogOpen(
            false,
          );

          setIsExecutingImport(
            false,
          );

          setExecutionError(
            null,
          );

          setExecutionResult(
            null,
          );

          setShowAllDispatcherShifts(
            false,
          );

          setShowAllDriverDuties(
            false,
          );

          setShowAllMorningDriverShifts(
            false,
          );

        setSelectedMappings(
          {},
        );

        setError(
          null,
        );

        setIdentityError(
          null,
        );

        setSavingMappingKey(
          null,
        );

        setCurrentMonthImportStrategy(
          'missing_only',
        );

        if (
          fileInputRef.current
        ) {
          fileInputRef.current.value =
            '';
        }
      };

  const resolvePreviewNames =
    (
      importPreview:
        ScheduleImportPreview,

      usersData:
        ScheduleImportUsersData,
    ): void => {
      const dispatcherNames =
        importPreview
          .dispatcherShifts
          .map(
            (shift) =>
              shift.dispatcherName,
          );

      const driverNames =
        importPreview
          .driverDuties
          .map(
            (duty) =>
              duty.driverName,
          );
      const morningDriverNames =
        importPreview.morningDriverShifts.map(
          shift =>
            shift.morningDriverName,
        );
        const resolvedMorningDrivers =
  scheduleImportIdentityService
    .resolveMorningDriverNames(
      morningDriverNames,
      usersData,
    );
      const resolvedDispatchers =
        scheduleImportIdentityService
          .resolveDispatcherNames(
            dispatcherNames,
            usersData,
          );

      const resolvedDrivers =
        scheduleImportIdentityService
          .resolveOnCallDriverNames(
            driverNames,
            usersData,
          );

      const initialMappings:
        SelectedMappings = {};

        [
          ...resolvedDispatchers,
          ...resolvedDrivers,
          ...resolvedMorningDrivers,
        ].forEach(
        (resolvedName) => {
          if (
            resolvedName
              .matchedUserId
          ) {
            initialMappings[
              createResolvedNameKey(
                resolvedName,
              )
            ] =
              resolvedName
                .matchedUserId;
          }
        },
      );
setResolvedMorningDriverNames(
  resolvedMorningDrivers,
);
      setResolvedDispatcherNames(
        resolvedDispatchers,
      );

      setResolvedDriverNames(
        resolvedDrivers,
      );

      setSelectedMappings(
        initialMappings,
      );
    };

  const loadIdentityData =
    async (
      importPreview:
        ScheduleImportPreview,
    ): Promise<void> => {
      setIsLoadingUsers(
        true,
      );

      setIdentityError(
        null,
      );

      try {
        const usersData =
          await scheduleImportIdentityService
            .getImportUsers();

        setImportUsersData(
          usersData,
        );

        resolvePreviewNames(
          importPreview,
          usersData,
        );
      } catch (
        identityLoadError
      ) {
        setIdentityError(
          identityLoadError instanceof
            Error
            ? identityLoadError.message
            : 'לא ניתן היה לטעון את משתמשי המערכת לצורך התאמת שמות.',
        );
      } finally {
        setIsLoadingUsers(
          false,
        );
      }
    };

  const analyzeFile =
    async (
      file: File,
    ): Promise<void> => {
      if (
        disabled ||
        isAnalyzing
      ) {
        return;
      }

      setSelectedFile(
        file,
      );

      setPreview(
        null,
      );

      setImportUsersData(
        null,
      );

      setResolvedDispatcherNames(
        [],
      );

      setResolvedDriverNames(
        [],
      );

      setResolvedMorningDriverNames(
        [],
      );

      setSelectedMappings(
        {},
      );

      setError(
        null,
      );

      setIdentityError(
        null,
      );
      setImportSimulation(
        null,
      );

      setSimulationError(
        null,
      );

      setExecutionError(
        null,
      );

      setExecutionResult(
        null,
      );

      setIsConfirmDialogOpen(
        false,
      );

      setShowAllDispatcherShifts(
        false,
      );

      setShowAllDriverDuties(
        false,
      );

      setShowAllMorningDriverShifts(
        false,
      );

      setIsAnalyzing(
        true,
      );

      try {
        const importPreview =
          await scheduleImportService
            .analyzeScheduleWorkbook(
              file,
            );

        setPreview(
          importPreview,
        );

        await loadIdentityData(
          importPreview,
        );
      } catch (
        analysisError
      ) {
        setError(
          analysisError instanceof
            Error
            ? analysisError.message
            : 'לא ניתן היה לנתח את קובץ האקסל.',
        );
      } finally {
        setIsAnalyzing(
          false,
        );
      }
    };

  const handleFileChange =
    (
      event:
        ChangeEvent<HTMLInputElement>,
    ): void => {
      const file =
        event.target.files?.[0] ??
        null;

      if (!file) {
        return;
      }

      void analyzeFile(
        file,
      );
    };

  const handleMappingChange =
    (
      resolvedName:
        ScheduleImportResolvedName,

      userId: string,
    ): void => {
      const mappingKey =
        createResolvedNameKey(
          resolvedName,
        );

      setSelectedMappings(
        (currentMappings) => ({
          ...currentMappings,

          [mappingKey]:
            userId,
        }),
      );

      setImportSimulation(
        null,
      );

      setSimulationError(
        null,
      );

      setExecutionError(
        null,
      );

      setExecutionResult(
        null,
      );

      setIsConfirmDialogOpen(
        false,
      );
    };

  const handleSaveMapping =
    async (
      resolvedName:
        ScheduleImportResolvedName,
    ): Promise<void> => {
      if (
        !importUsersData
      ) {
        return;
      }

      const mappingKey =
        createResolvedNameKey(
          resolvedName,
        );

      const selectedUserId =
        selectedMappings[
          mappingKey
        ]?.trim() ??
        '';

      if (!selectedUserId) {
        setIdentityError(
          `יש לבחור משתמש עבור "${resolvedName.sourceName}".`,
        );

        return;
      }

      setSavingMappingKey(
        mappingKey,
      );

      setIdentityError(
        null,
      );

      try {
        await scheduleImportIdentityService
          .saveNameAlias({
            sourceName:
              resolvedName.sourceName,

            userId:
              selectedUserId,

            userType:
              resolvedName.userType,
          });

        const refreshedUsersData =
          await scheduleImportIdentityService
            .getImportUsers();

        setImportUsersData(
          refreshedUsersData,
        );

        if (preview) {
          resolvePreviewNames(
            preview,
            refreshedUsersData,
          );
        }
      } catch (
        saveError
      ) {
        setIdentityError(
          saveError instanceof Error
            ? saveError.message
            : 'לא ניתן היה לשמור את התאמת השם.',
        );
      } finally {
        setSavingMappingKey(
          null,
        );
      }
    };
const buildResolvedImportData =
  () => {
    if (!preview) {
      throw new Error(
        'לא קיימים נתוני ייבוא לניתוח.',
      );
    }

    const dispatcherUserIds =
      new Map<string, string>();

    resolvedDispatcherNames.forEach(
      (resolvedName) => {
        const mappingKey =
          createResolvedNameKey(
            resolvedName,
          );

        const userId =
          selectedMappings[
            mappingKey
          ] ??
          resolvedName
            .matchedUserId;

        if (userId) {
          dispatcherUserIds.set(
            normalizeImportedName(
              resolvedName.sourceName,
            ),
            userId,
          );
        }
      },
    );

    const driverUserIds =
      new Map<string, string>();

    resolvedDriverNames.forEach(
      (resolvedName) => {
        const mappingKey =
          createResolvedNameKey(
            resolvedName,
          );

        const userId =
          selectedMappings[
            mappingKey
          ] ??
          resolvedName
            .matchedUserId;

        if (userId) {
          driverUserIds.set(
            normalizeImportedName(
              resolvedName.sourceName,
            ),
            userId,
          );
        }
      },
    );

    const morningDriverUserIds =
      new Map<string, string>();

    resolvedMorningDriverNames.forEach(
      (resolvedName) => {
        const mappingKey =
          createResolvedNameKey(
            resolvedName,
          );

        const userId =
          selectedMappings[
            mappingKey
          ] ??
          resolvedName
            .matchedUserId;

        if (userId) {
          morningDriverUserIds.set(
            normalizeImportedName(
              resolvedName.sourceName,
            ),
            userId,
          );
        }
      },
    );

    const dispatcherShifts =
      preview.dispatcherShifts.map(
        (shift) => {
          const userId =
            dispatcherUserIds.get(
              normalizeImportedName(
                shift.dispatcherName,
              ),
            );

          if (!userId) {
            throw new Error(
              `לא נמצאה התאמת משתמש עבור המוקדן "${shift.dispatcherName}".`,
            );
          }

          return {
            date:
              shift.date,

            startTime:
              shift.startTime,

            endTime:
              shift.endTime,

            userId,
          };
        },
      );

    const driverDuties =
      preview.driverDuties.map(
        (duty) => {
          const userId =
            driverUserIds.get(
              normalizeImportedName(
                duty.driverName,
              ),
            );

          if (!userId) {
            throw new Error(
              `לא נמצאה התאמת משתמש עבור הכונן "${duty.driverName}".`,
            );
          }

          return {
            date:
              duty.date,

            userId,

            note:
              duty.note,
          };
        },
      );

    const morningDriverShifts =
      preview.morningDriverShifts.map(
        (shift) => {
          const userId =
            morningDriverUserIds.get(
              normalizeImportedName(
                shift.morningDriverName,
              ),
            );

          if (!userId) {
            throw new Error(
              `לא נמצאה התאמת משתמש עבור כונן הבוקר "${shift.morningDriverName}".`,
            );
          }

          return {
            date:
              shift.date,

            startTime:
              shift.startTime,

            endTime:
              shift.endTime,

            userId,

            assignmentSlot:
              shift.assignmentSlot,

            shiftType:
              shift.shiftType,

            minimumWorkers:
              shift.minimumWorkers,

            recommendedWorkers:
              shift.recommendedWorkers,
          };
        },
      );

    const importStrategy:
      ScheduleImportStrategy =
      currentMonthImportStrategy;

    return {
      dispatcherShifts,
      driverDuties,
      morningDriverShifts,
      importStrategy,
    };
  };

const handlePreviewImport =
  async (): Promise<void> => {
    if (
      !preview ||
      isSimulatingImport ||
      isExecutingImport ||
      preview.periodType ===
        'future'
    ) {
      return;
    }

    const unresolvedCount =
      [
        ...resolvedDispatcherNames,
        ...resolvedDriverNames,
        ...resolvedMorningDriverNames,
      ].filter(
        (resolvedName) =>
          !(
            selectedMappings[
              createResolvedNameKey(
                resolvedName,
              )
            ] ||
            resolvedName
              .matchedUserId
          ),
      ).length;

    if (
      unresolvedCount >
      0
    ) {
      setSimulationError(
        'יש להתאים את כל השמות לפני בדיקת הייבוא.',
      );

      return;
    }

    setSimulationError(
      null,
    );

    setExecutionError(
      null,
    );

    setExecutionResult(
      null,
    );

    setImportSimulation(
      null,
    );

    setIsSimulatingImport(
      true,
    );

    try {
      const {
        dispatcherShifts,
        driverDuties,
        morningDriverShifts,
        importStrategy,
      } =
        buildResolvedImportData();

      const simulationResult =
        await scheduleImportExecutionService
          .previewImport({
            year:
              preview.year,

            month:
              preview.month,

            periodType:
              preview.periodType,

            importStrategy,

            dispatcherShifts,

            driverDuties,

            morningDriverShifts,
          });

      setImportSimulation(
        simulationResult,
      );
    } catch (
      previewError
    ) {
      setSimulationError(
        previewError instanceof
          Error
          ? previewError.message
          : 'לא ניתן היה לבצע את סימולציית הייבוא.',
      );
    } finally {
      setIsSimulatingImport(
        false,
      );
    }
  };

  const handleOpenConfirmation =
    (): void => {
      if (
        !importSimulation
          ?.canImport ||
        isExecutingImport
      ) {
        return;
      }

      setExecutionError(
        null,
      );

      setIsConfirmDialogOpen(
        true,
      );
    };

  const handleExecuteImport =
    async (): Promise<void> => {
      if (
        !preview ||
        !selectedFile ||
        !importSimulation
          ?.canImport ||
        isExecutingImport
      ) {
        return;
      }

      setExecutionError(
        null,
      );

      setIsExecutingImport(
        true,
      );

      try {
        const {
          dispatcherShifts,
          driverDuties,
          morningDriverShifts,
          importStrategy,
        } =
          buildResolvedImportData();

        console.info(
          'Starting schedule import execution',
          {
            fileName:
              selectedFile.name,

            year:
              preview.year,

            month:
              preview.month,

            periodType:
              preview.periodType,

            importStrategy,

            dispatcherShiftCount:
              dispatcherShifts.length,

            driverDutyCount:
              driverDuties.length,

            morningDriverShiftCount:
              morningDriverShifts.length,
          },
        );

        const result =
          await scheduleImportExecutionService
            .executeImport({
              fileName:
                selectedFile.name,

              fileSizeBytes:
                selectedFile.size,

              year:
                preview.year,

              month:
                preview.month,

              periodType:
                preview.periodType,

              importStrategy,

              dispatcherShifts,

              driverDuties,

              morningDriverShifts,

              warnings:
                preview.warnings,
            });

        console.info(
          'Schedule import completed',
          result,
        );

        setExecutionResult(
          result,
        );

        setIsConfirmDialogOpen(
          false,
        );
      } catch (
        importError
      ) {
        setExecutionError(
          importError instanceof
            Error
            ? importError.message
            : 'לא ניתן היה לבצע את הייבוא.',
        );
      } finally {
        setIsExecutingImport(
          false,
        );
      }
    };

  const renderResolvedNames =
    (
      resolvedNames:
        ScheduleImportResolvedName[],

      users:
        ScheduleImportUser[],

      userType:
        ScheduleImportUserType,
    ) => {
      if (
        resolvedNames.length ===
        0
      ) {
        return (
          <div className="schedule-import-identities-empty">
            לא נמצאו שמות מסוג זה
            בקובץ.
          </div>
        );
      }

      return (
        <div className="schedule-import-identities-list">
          {resolvedNames.map(
            (resolvedName) => {
              const mappingKey =
                createResolvedNameKey(
                  resolvedName,
                );

              const selectedUserId =
                selectedMappings[
                  mappingKey
                ] ??
                '';

              const isResolved =
                Boolean(
                  resolvedName
                    .matchedUserId,
                );

              const isSaving =
                savingMappingKey ===
                mappingKey;

              return (
                <article
                  key={
                    mappingKey
                  }
                  className={[
                    'schedule-import-identity-row',

                    isResolved
                      ? 'schedule-import-identity-row-resolved'
                      : 'schedule-import-identity-row-unresolved',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <div className="schedule-import-identity-source">
                    <strong>
                      {
                        resolvedName
                          .sourceName
                      }
                    </strong>

                    <span>
                      {userType ===
                      'dispatcher'
                        ? 'מוקדן מהאקסל'
                        : userType ===
                            'morning_driver'
                          ? 'כונן בוקר מהאקסל'
                          : 'כונן מהאקסל'}
                    </span>
                  </div>

                  <div className="schedule-import-identity-status">
                    {isResolved ? (
                      <>
                        <CheckCircle2
                          size={18}
                          aria-hidden="true"
                        />

                        <div>
                          <strong>
                            {
                              resolvedName
                                .matchedUser
                                ? getUserDisplayName(
                                    resolvedName
                                      .matchedUser,
                                  )
                                : 'משתמש זוהה'
                            }
                          </strong>

                          <span>
                            {getMatchSourceLabel(
                              resolvedName,
                            )}
                          </span>
                        </div>
                      </>
                    ) : (
                      <>
                        <AlertTriangle
                          size={18}
                          aria-hidden="true"
                        />

                        <div>
                          <strong>
                            לא נמצא במערכת
                          </strong>

                          <span>
                            יש לבחור משתמש
                            מתאים.
                          </span>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="schedule-import-identity-action">
                    <select
                      value={
                        selectedUserId
                      }
                      disabled={
                        isSaving ||
                        disabled
                      }
                      aria-label={`התאמת ${resolvedName.sourceName}`}
                      onChange={(
                        event,
                      ) => {
                        handleMappingChange(
                          resolvedName,
                          event
                            .target
                            .value,
                        );
                      }}
                    >
                      <option value="">
                        בחירת משתמש
                      </option>

                      {users.map(
                        (user) => (
                          <option
                            key={
                              user.id
                            }
                            value={
                              user.id
                            }
                          >
                            {getUserDisplayName(
                              user,
                            )}
                          </option>
                        ),
                      )}
                    </select>

                    <Button
                      type="button"
                      variant="secondary"
                      disabled={
                        !selectedUserId ||
                        isSaving ||
                        disabled
                      }
                      onClick={() => {
                        void handleSaveMapping(
                          resolvedName,
                        );
                      }}
                    >
                      {isSaving ? (
                        <RefreshCw
                          size={16}
                          className="schedule-import-loading-icon"
                          aria-hidden="true"
                        />
                      ) : (
                        <Link2
                          size={16}
                          aria-hidden="true"
                        />
                      )}

                      {isResolved
                        ? 'עדכון התאמה'
                        : 'שמירת התאמה'}
                    </Button>
                  </div>
                </article>
              );
            },
          )}
        </div>
      );
    };

  const allResolvedNames =
    useMemo(
      () => [
        ...resolvedDispatcherNames,
        ...resolvedDriverNames,
        ...resolvedMorningDriverNames,
      ],
      [
        resolvedDispatcherNames,
        resolvedDriverNames,
        resolvedMorningDriverNames,
      ],
    );

  const unresolvedNamesCount =
    allResolvedNames.filter(
      (resolvedName) =>
        !resolvedName
          .matchedUserId,
    ).length;

  const allNamesResolved =
    allResolvedNames.length >
      0 &&
    unresolvedNamesCount ===
      0;

  const detectedPeriodTitle =
    preview
      ? `${
          hebrewMonths[
            preview.month - 1
          ] ??
          preview.month
        } ${preview.year}`
      : null;
      const periodTypeLabel =
        preview?.periodType ===
          'historical'
          ? 'חודש היסטורי'
          : preview?.periodType ===
              'current'
            ? 'החודש הנוכחי'
            : preview?.periodType ===
                'future'
              ? 'חודש עתידי'
              : null;

      const periodTypeDescription =
        preview?.periodType ===
          'historical'
          ? 'הנתונים ייובאו כנתונים היסטוריים, ייכללו בסטטיסטיקות ויישמרו בארכיון.'
          : preview?.periodType ===
              'current'
            ? 'ניתן לבחור כיצד לעדכן את הנתונים הקיימים של החודש הנוכחי.'
            : preview?.periodType ===
                'future'
              ? 'ייבוא חודש עתידי עדיין אינו נתמך, כדי לא לעקוף את תהליך האילוצים ויצירת הטיוטה.'
              : null;

      const canContinueToImport =
        Boolean(
          preview &&
          allNamesResolved &&
          preview.periodType !==
            'future' &&
          !isAnalyzing &&
          !isLoadingUsers &&
          !isSimulatingImport &&
          !isExecutingImport &&
          !executionResult,
        );

      const visibleDispatcherShifts =
        preview
          ? showAllDispatcherShifts
            ? preview.dispatcherShifts
            : preview.dispatcherShifts.slice(
                0,
                PREVIEW_ROW_LIMIT,
              )
          : [];

      const visibleDriverDuties =
        preview
          ? showAllDriverDuties
            ? preview.driverDuties
            : preview.driverDuties.slice(
                0,
                PREVIEW_ROW_LIMIT,
              )
          : [];

      const visibleMorningDriverShifts =
        preview
          ? showAllMorningDriverShifts
            ? preview.morningDriverShifts
            : preview.morningDriverShifts.slice(
                0,
                PREVIEW_ROW_LIMIT,
              )
          : [];

      const confirmationStrategy =
        importSimulation
          ? getImportStrategyLabel(
              importSimulation
                .importStrategy,
            )
          : '';

  return (
    <section className="schedule-import-panel">
      <header className="schedule-import-header">
        <span className="schedule-import-header-icon">
          <FileSpreadsheet
            size={24}
            aria-hidden="true"
          />
        </span>

        <div>
          <h2>
            ייבוא לוח שיבוצים מאקסל
          </h2>

          <p>
            העלאת לוח קיים, זיהוי
            המשתמשים ובדיקת הנתונים
            לפני שמירה במערכת.
          </p>
        </div>
      </header>

      <div className="schedule-import-upload-card">
        <input
          ref={
            fileInputRef
          }
          className="schedule-import-file-input"
          type="file"
          accept=".xlsx,.xls,.xlsm"
          disabled={
            disabled ||
            isAnalyzing
          }
          onChange={
            handleFileChange
          }
        />

        {!selectedFile ? (
          <button
            type="button"
            className="schedule-import-drop-area"
            disabled={
              disabled ||
              isAnalyzing
            }
            onClick={() => {
              fileInputRef.current
                ?.click();
            }}
          >
            <Upload
              size={34}
              aria-hidden="true"
            />

            <strong>
              בחירת קובץ Excel
            </strong>

            <span>
              קובצי XLSX, XLS או XLSM
              עד 15MB
            </span>
          </button>
        ) : (
          <div className="schedule-import-selected-file">
            <FileSpreadsheet
              size={30}
              aria-hidden="true"
            />

            <div>
              <strong>
                {
                  selectedFile.name
                }
              </strong>

              <span>
                {(
                  selectedFile.size /
                  1024
                ).toFixed(1)}{' '}
                KB
              </span>
            </div>

            <Button
              type="button"
              variant="secondary"
              disabled={
                isAnalyzing ||
                isSimulatingImport ||
                isExecutingImport
              }
              aria-label="הסרת הקובץ"
              onClick={
                resetImport
              }
            >
              <X
                size={17}
                aria-hidden="true"
              />
            </Button>
          </div>
        )}

        {isAnalyzing ? (
          <div className="schedule-import-loading">
            <RefreshCw
              size={22}
              className="schedule-import-loading-icon"
              aria-hidden="true"
            />

            <span>
              מנתח את קובץ האקסל...
            </span>
          </div>
        ) : null}
      </div>

      {error ? (
        <div
          className="schedule-import-error"
          role="alert"
        >
          <AlertTriangle
            size={21}
            aria-hidden="true"
          />

          <div>
            <strong>
              ניתוח הקובץ נכשל
            </strong>

            <span>
              {error}
            </span>
          </div>
        </div>
      ) : null}

      {identityError ? (
        <div
          className="schedule-import-error"
          role="alert"
        >
          <AlertTriangle
            size={21}
            aria-hidden="true"
          />

          <div>
            <strong>
              התאמת המשתמשים נכשלה
            </strong>

            <span>
              {identityError}
            </span>
          </div>
        </div>
      ) : null}

      {executionError ? (
        <div
          className="schedule-import-error"
          role="alert"
        >
          <AlertTriangle
            size={21}
            aria-hidden="true"
          />

          <div>
            <strong>
              ביצוע הייבוא נכשל
            </strong>

            <span>
              {executionError}
            </span>
          </div>
        </div>
      ) : null}

      {executionResult ? (
        <section className="schedule-import-completed">
          <CheckCircle2
            size={32}
            aria-hidden="true"
          />

          <div className="schedule-import-completed-content">
            <h3>
              הייבוא הסתיים בהצלחה
            </h3>

            <p>
              {detectedPeriodTitle} נשמר
              במערכת.
            </p>

            <div className="schedule-import-completed-grid">
              <article>
                <strong>
                  {
                    executionResult
                      .dispatcherShifts
                      .created +
                    executionResult
                      .dispatcherShifts
                      .updated
                  }
                </strong>

                <span>
                  משמרות נוצרו או עודכנו
                </span>
              </article>

              <article>
                <strong>
                  {
                    executionResult
                      .driverDuties
                      .created +
                    executionResult
                      .driverDuties
                      .updated
                  }
                </strong>

                <span>
                  כוננויות נוצרו או עודכנו
                </span>
              </article>

              <article>
                <strong>
                  {
                    executionResult
                      .morningDriverShifts
                      .created +
                    executionResult
                      .morningDriverShifts
                      .updated
                  }
                </strong>

                <span>
                  שיבוצי כונני בוקר נוצרו או עודכנו
                </span>
              </article>

              <article>
                <strong>
                  {
                    executionResult
                      .warningCount
                  }
                </strong>

                <span>
                  אזהרות
                </span>
              </article>
            </div>

            <Button
              type="button"
              onClick={
                resetImport
              }
            >
              ייבוא קובץ נוסף
            </Button>
          </div>
        </section>
      ) : null}

      {preview &&
      !executionResult ? (
        <>
          <div
            className="schedule-import-success"
            role="status"
          >
            <CheckCircle2
              size={22}
              aria-hidden="true"
            />

            <div>
              <strong>
                הקובץ נותח בהצלחה
              </strong>

              <span>
                זוהה לוח עבור{' '}
                <b>
                  {
                    detectedPeriodTitle
                  }
                </b>
                .
              </span>
            </div>
          </div>
        <section
          className={[
            'schedule-import-period-mode',

            preview.periodType ===
              'historical'
              ? 'schedule-import-period-mode-historical'
              : preview.periodType ===
                  'current'
                ? 'schedule-import-period-mode-current'
                : 'schedule-import-period-mode-future',
          ].join(' ')}
        >
          <header>
            <CalendarDays
              size={22}
              aria-hidden="true"
            />

            <div>
              <strong>
                {periodTypeLabel}
              </strong>

              <span>
                {periodTypeDescription}
              </span>
            </div>
          </header>

          {preview.periodType ===
            'current' ||
          preview.periodType ===
            'historical' ? (
            <div className="schedule-import-strategy-options">
              <span className="schedule-import-strategy-heading">
                אופן הייבוא והעדכון
              </span>

              <label className="schedule-import-strategy-option">
                <input
                  type="radio"
                  name="schedule-import-strategy"
                  value="missing_only"
                  checked={
                    currentMonthImportStrategy ===
                    'missing_only'
                  }
                  onChange={() => {
                    setImportSimulation(
                      null,
                    );

                    setSimulationError(
                      null,
                    );
                    setCurrentMonthImportStrategy(
                      'missing_only',
                    );
                  }}
                />

                <span>
                  <strong>
                    עדכון נתונים חסרים בלבד
                  </strong>

                  <small>
                    מוסיף רק משמרות וכוננויות
                    שאינן קיימות ואינו דורס מידע
                    שכבר נשמר במערכת.
                  </small>
                </span>
              </label>

              <label className="schedule-import-strategy-option">
                <input
                  type="radio"
                  name="schedule-import-strategy"
                  value="replace"
                  checked={
                    currentMonthImportStrategy ===
                    'replace'
                  }
                  onChange={() => {
                    setImportSimulation(
                      null,
                    );

                    setSimulationError(
                      null,
                    );
                    setCurrentMonthImportStrategy(
                      'replace',
                    );
                  }}
                />

                <span>
                  <strong>
                    החלפת נתוני החודש
                  </strong>

                  <small>
                    מעדכן משמרות וכוננויות
                    קיימות לפי הנתונים בקובץ.
                  </small>
                </span>
              </label>

              <label className="schedule-import-strategy-option">
                <input
                  type="radio"
                  name="schedule-import-strategy"
                  value="rebuild"
                  checked={
                    currentMonthImportStrategy ===
                    'rebuild'
                  }
                  onChange={() => {
                    setImportSimulation(
                      null,
                    );

                    setSimulationError(
                      null,
                    );
                    setCurrentMonthImportStrategy(
                      'rebuild',
                    );
                  }}
                />

                <span>
                  <strong>
                    מחיקה וייבוא מחדש
                  </strong>

                  <small>
                    מוחק את נתוני השיבוץ של
                    החודש ובונה אותם מחדש
                    מהקובץ.
                  </small>
                </span>
              </label>
            </div>
          ) : null}

          {preview.periodType ===
          'historical' ? (
            <div className="schedule-import-historical-summary">
              <strong>
                חודש היסטורי
              </strong>

              <span>
                החודש יישאר בארכיון גם לאחר העדכון
                וימשיך להיכלל בחישובי הסטטיסטיקות.
                ניתן לבחור אם להשלים נתונים חסרים,
                להחליף את הנתונים הקיימים או לבצע
                מחיקה וייבוא מחדש.
              </span>
            </div>
          ) : null}

          {preview.periodType ===
          'future' ? (
            <div className="schedule-import-future-warning">
              <AlertTriangle
                size={18}
                aria-hidden="true"
              />

              <span>
                לא ניתן להמשיך לייבוא של חודש
                עתידי בשלב זה.
              </span>
            </div>
          ) : null}
        </section>
          <div className="schedule-import-statistics">
            <article>
              <CalendarDays
                size={21}
                aria-hidden="true"
              />

              <div>
                <strong>
                  {
                    detectedPeriodTitle
                  }
                </strong>

                <span>
                  התקופה שזוהתה
                </span>
              </div>
            </article>

            <article>
              <Users
                size={21}
                aria-hidden="true"
              />

              <div>
                <strong>
                  {
                    preview
                      .dispatcherShifts
                      .length
                  }
                </strong>

                <span>
                  משמרות מוקדנים
                </span>
              </div>
            </article>

            <article>
              <Wrench
                size={21}
                aria-hidden="true"
              />

              <div>
                <strong>
                  {
                    preview
                      .driverDuties
                      .length
                  }
                </strong>

                <span>
                  ימי כוננות
                </span>
              </div>
            </article>

            <article>
              <Users
                size={21}
                aria-hidden="true"
              />

              <div>
                <strong>
                  {
                    preview
                      .morningDriverShifts
                      .length
                  }
                </strong>

                <span>
                  שיבוצי כונני בוקר
                </span>
              </div>
            </article>

            <article>
              <AlertTriangle
                size={21}
                aria-hidden="true"
              />

              <div>
                <strong>
                  {
                    unresolvedNamesCount
                  }
                </strong>

                <span>
                  שמות שלא זוהו
                </span>
              </div>
            </article>
          </div>

          <section className="schedule-import-identities">
            <header>
              <div>
                <h3>
                  התאמת משתמשים
                </h3>

                <span>
                  יש לוודא שכל שם
                  מהאקסל משויך למשתמש
                  הנכון במערכת.
                </span>
              </div>

              {isLoadingUsers ? (
                <RefreshCw
                  size={20}
                  className="schedule-import-loading-icon"
                  aria-hidden="true"
                />
              ) : allNamesResolved ? (
                <span className="schedule-import-all-resolved">
                  <CheckCircle2
                    size={16}
                    aria-hidden="true"
                  />

                  כל השמות זוהו
                </span>
              ) : (
                <span className="schedule-import-unresolved-count">
                  {
                    unresolvedNamesCount
                  }{' '}
                  שמות דורשים התאמה
                </span>
              )}
            </header>

            <div className="schedule-import-identity-group">
              <h4>
                מוקדנים
              </h4>

              {renderResolvedNames(
                resolvedDispatcherNames,
                importUsersData
                  ?.dispatchers ??
                  [],
                'dispatcher',
              )}
            </div>

            <div className="schedule-import-identity-group">
              <h4>
                כוננים
              </h4>

              {renderResolvedNames(
                resolvedDriverNames,
                importUsersData
                  ?.onCallDrivers ??
                  [],
                'on_call',
              )}
            </div>

            <div className="schedule-import-identity-group">
              <h4>
                כונני בוקר
              </h4>

              {renderResolvedNames(
                resolvedMorningDriverNames,
                importUsersData
                  ?.morningDrivers ??
                  [],
                'morning_driver',
              )}
            </div>
          </section>

          {preview.warnings.length >
          0 ? (
            <section className="schedule-import-warnings">
              <header>
                <AlertTriangle
                  size={19}
                  aria-hidden="true"
                />

                <strong>
                  אזהרות מהקובץ
                </strong>
              </header>

              <ul>
                {preview.warnings.map(
                  (
                    warning,
                    index,
                  ) => (
                    <li
                      key={`${warning}-${index}`}
                    >
                      {warning}
                    </li>
                  ),
                )}
              </ul>
            </section>
          ) : null}

          <section className="schedule-import-preview-section">
            <header>
              <div>
                <h3>
                  משמרות מוקדנים
                </h3>

                <span>
                  עמודות A, C ו־D
                </span>
              </div>

              <strong>
                {
                  preview
                    .dispatcherShifts
                    .length
                }
              </strong>
            </header>

            <div className="schedule-import-table-wrapper">
              <table className="schedule-import-table">
                <thead>
                  <tr>
                    <th>
                      תאריך
                    </th>

                    <th>
                      שעות משמרת
                    </th>

                    <th>
                      מוקדן
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {visibleDispatcherShifts
                    .map(
                      (
                        shift,
                        index,
                      ) => (
                        <tr
                          key={[
                            shift.date,
                            shift.startTime,
                            shift.dispatcherName,
                            index,
                          ].join('-')}
                        >
                        <td dir="ltr">
                          {formatImportDate(
                            shift.date,
                          )}
                        </td>

                          <td>
                            {formatShiftTime(
                              shift.startTime,
                              shift.endTime,
                            )}
                          </td>

                          <td>
                            {
                              shift.dispatcherName
                            }
                          </td>
                        </tr>
                      ),
                    )}
                </tbody>
              </table>
            </div>

            {preview
              .dispatcherShifts
              .length >
            PREVIEW_ROW_LIMIT ? (
              <div className="schedule-import-table-toggle">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setShowAllDispatcherShifts(
                      (
                        currentValue,
                      ) =>
                        !currentValue,
                    );
                  }}
                >
                  {showAllDispatcherShifts
                    ? 'הצג פחות'
                    : `הצג את כל ${preview.dispatcherShifts.length} המשמרות`}
                </Button>
              </div>
            ) : null}
          </section>

          <section className="schedule-import-preview-section">
            <header>
              <div>
                <h3>
                  כוננויות טכניות
                </h3>

                <span>
                  עמודות A, G ו־H
                </span>
              </div>

              <strong>
                {
                  preview
                    .driverDuties
                    .length
                }
              </strong>
            </header>

            <div className="schedule-import-table-wrapper">
              <table className="schedule-import-table">
                <thead>
                  <tr>
                    <th>
                      תאריך
                    </th>

                    <th>
                      כונן
                    </th>

                    <th>
                      הערה
                    </th>
                  </tr>
                </thead>

                <tbody>
                 {visibleDriverDuties.map(
                      (
                        duty,
                        index,
                      ) => (
                        <tr
                            key={[
                        duty.date,
                        duty.driverName,
                        index,
                      ].join('-')}
                    >
                        <td dir="ltr">
                          {formatImportDate(
                            duty.date,
                          )}
                        </td>

                          <td>
                            {
                              duty.driverName
                            }
                          </td>

                          <td>
                            {duty.note ??
                              '—'}
                          </td>
                        </tr>
                      ),
                    )}
                </tbody>
              </table>
            </div>

            {preview
              .driverDuties
              .length >
            PREVIEW_ROW_LIMIT ? (
              <div className="schedule-import-table-toggle">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setShowAllDriverDuties(
                      (
                        currentValue,
                      ) =>
                        !currentValue,
                    );
                  }}
                >
                  {showAllDriverDuties
                    ? 'הצג פחות'
                    : `הצג את כל ${preview.driverDuties.length} הכוננויות`}
                </Button>
              </div>
            ) : null}
          </section>

          <section className="schedule-import-preview-section">
            <header>
              <div>
                <h3>
                  שיבוצי כונני בוקר
                </h3>

                <span>
                  עמודות A, E ו־F
                </span>
              </div>

              <strong>
                {
                  preview
                    .morningDriverShifts
                    .length
                }
              </strong>
            </header>

            <div className="schedule-import-table-wrapper">
              <table className="schedule-import-table">
                <thead>
                  <tr>
                    <th>
                      תאריך
                    </th>

                    <th>
                      שעות משמרת
                    </th>

                    <th>
                      כונן בוקר
                    </th>

                    <th>
                      מיקום
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {visibleMorningDriverShifts.map(
                    (
                      shift,
                      index,
                    ) => (
                      <tr
                        key={[
                          shift.date,
                          shift.startTime,
                          shift.morningDriverName,
                          shift.assignmentSlot,
                          index,
                        ].join('-')}
                      >
                        <td dir="ltr">
                          {formatImportDate(
                            shift.date,
                          )}
                        </td>

                        <td>
                          {formatShiftTime(
                            shift.startTime,
                            shift.endTime,
                          )}
                        </td>

                        <td>
                          {
                            shift.morningDriverName
                          }
                        </td>

                        <td>
                          {
                            shift.assignmentSlot ===
                            1
                              ? 'כונן מינימום'
                              : 'כונן מומלץ נוסף'
                          }
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>

            {preview
              .morningDriverShifts
              .length >
            PREVIEW_ROW_LIMIT ? (
              <div className="schedule-import-table-toggle">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setShowAllMorningDriverShifts(
                      (
                        currentValue,
                      ) =>
                        !currentValue,
                    );
                  }}
                >
                  {showAllMorningDriverShifts
                    ? 'הצג פחות'
                    : `הצג את כל ${preview.morningDriverShifts.length} שיבוצי כונני הבוקר`}
                </Button>
              </div>
            ) : null}
          </section>

          {simulationError ? (
  <div
    className="schedule-import-error"
    role="alert"
  >
    <AlertTriangle
      size={21}
      aria-hidden="true"
    />

    <div>
      <strong>
        בדיקת הייבוא נכשלה
      </strong>

      <span>
        {simulationError}
      </span>
    </div>
  </div>
) : null}
{importSimulation ? (
  <section className="schedule-import-simulation">
    <header>
      <div>
        <h3>
          סיכום הייבוא הצפוי
        </h3>

        <span>
          טרם בוצעו שינויים במסד
          הנתונים.
        </span>
      </div>

      <span
        className={
          importSimulation.canImport
            ? 'schedule-import-simulation-ready'
            : 'schedule-import-simulation-blocked'
        }
      >
        {importSimulation.canImport
          ? 'מוכן לייבוא'
          : 'לא ניתן לייבא'}
      </span>
    </header>

    <div className="schedule-import-simulation-grid">
      <article>
        <strong>
          משמרות מוקדנים
        </strong>

        <dl>
          <div>
            <dt>
              זוהו
            </dt>

            <dd>
              {
                importSimulation
                  .dispatcherShifts
                  .detected
              }
            </dd>
          </div>

          <div>
            <dt>
              ייווצרו
            </dt>

            <dd>
              {
                importSimulation
                  .dispatcherShifts
                  .toCreate
              }
            </dd>
          </div>

          <div>
            <dt>
              יעודכנו
            </dt>

            <dd>
              {
                importSimulation
                  .dispatcherShifts
                  .toUpdate
              }
            </dd>
          </div>

          <div>
            <dt>
              יידלגו
            </dt>

            <dd>
              {
                importSimulation
                  .dispatcherShifts
                  .toSkip
              }
            </dd>
          </div>

          <div>
            <dt>
              יימחקו
            </dt>

            <dd>
              {
                importSimulation
                  .dispatcherShifts
                  .toDelete
              }
            </dd>
          </div>
        </dl>
      </article>

      <article>
        <strong>
          כוננויות
        </strong>

        <dl>
          <div>
            <dt>
              זוהו
            </dt>

            <dd>
              {
                importSimulation
                  .driverDuties
                  .detected
              }
            </dd>
          </div>

          <div>
            <dt>
              ייווצרו
            </dt>

            <dd>
              {
                importSimulation
                  .driverDuties
                  .toCreate
              }
            </dd>
          </div>

          <div>
            <dt>
              יעודכנו
            </dt>

            <dd>
              {
                importSimulation
                  .driverDuties
                  .toUpdate
              }
            </dd>
          </div>

          <div>
            <dt>
              יידלגו
            </dt>

            <dd>
              {
                importSimulation
                  .driverDuties
                  .toSkip
              }
            </dd>
          </div>

          <div>
            <dt>
              יימחקו
            </dt>

            <dd>
              {
                importSimulation
                  .driverDuties
                  .toDelete
              }
            </dd>
          </div>
        </dl>
      </article>

      <article>
        <strong>
          כונני בוקר
        </strong>

        <dl>
          <div>
            <dt>
              זוהו
            </dt>

            <dd>
              {
                importSimulation
                  .morningDriverShifts
                  .detected
              }
            </dd>
          </div>

          <div>
            <dt>
              ייווצרו
            </dt>

            <dd>
              {
                importSimulation
                  .morningDriverShifts
                  .toCreate
              }
            </dd>
          </div>

          <div>
            <dt>
              יעודכנו
            </dt>

            <dd>
              {
                importSimulation
                  .morningDriverShifts
                  .toUpdate
              }
            </dd>
          </div>

          <div>
            <dt>
              יידלגו
            </dt>

            <dd>
              {
                importSimulation
                  .morningDriverShifts
                  .toSkip
              }
            </dd>
          </div>

          <div>
            <dt>
              יימחקו
            </dt>

            <dd>
              {
                importSimulation
                  .morningDriverShifts
                  .toDelete
              }
            </dd>
          </div>
        </dl>
      </article>
    </div>

    {importSimulation.blockers.length >
    0 ? (
      <div className="schedule-import-simulation-blockers">
        <strong>
          חסימות
        </strong>

        <ul>
          {importSimulation.blockers.map(
            (
              blocker,
              index,
            ) => (
              <li
                key={`${blocker}-${index}`}
              >
                {blocker}
              </li>
            ),
          )}
        </ul>
      </div>
    ) : null}

    {importSimulation.warnings.length >
    0 ? (
      <div className="schedule-import-simulation-warnings">
        <strong>
          אזהרות
        </strong>

        <ul>
          {importSimulation.warnings.map(
            (
              warning,
              index,
            ) => (
              <li
                key={`${warning}-${index}`}
              >
                {warning}
              </li>
            ),
          )}
        </ul>
      </div>
    ) : null}

          {importSimulation.canImport ? (
            <div className="schedule-import-final-confirmation">
              <CheckCircle2
                size={21}
                aria-hidden="true"
              />

              <div>
                <strong>
                  הסימולציה הסתיימה בהצלחה
                </strong>

                <span>
                  אפשר לבצע כעת את
                  הייבוא בפועל.
                </span>
              </div>

              <Button
                type="button"
                disabled={
                  isExecutingImport
                }
                onClick={
                  handleOpenConfirmation
                }
              >
                ביצוע הייבוא
              </Button>
            </div>
          ) : null}
        </section>
      ) : null}
                <footer className="schedule-import-actions">
            <Button
              type="button"
              variant="secondary"
              disabled={
                isAnalyzing ||
                isSimulatingImport ||
                isExecutingImport
              }
              onClick={
                resetImport
                
              }
            >
              בחירת קובץ אחר
            </Button>

          <Button
            type="button"
            disabled={
              !canContinueToImport ||
              isSimulatingImport
            }
            title={
              preview.periodType ===
                'future'
                ? 'לא ניתן לייבא חודש עתידי'
                : !allNamesResolved
                  ? 'יש להתאים את כל השמות לפני הייבוא'
                  : 'בדיקת השינויים לפני ביצוע הייבוא'
            }
            onClick={() => {
              void handlePreviewImport();
            }}
          >
            {isSimulatingImport ? (
              <>
                <RefreshCw
                  size={17}
                  className="schedule-import-loading-icon"
                  aria-hidden="true"
                />

                בודק נתונים...
              </>
            ) : preview.periodType ===
                'historical' ? (
              'בדיקת ייבוא היסטורי'
            ) : (
              'בדיקת הייבוא'
            )}
          </Button>
          </footer>
        </>
      ) : null}
      {isConfirmDialogOpen &&
      preview &&
      importSimulation ? (
        <div
          className="schedule-import-dialog-backdrop"
          role="presentation"
          onMouseDown={(
            event,
          ) => {
            if (
              event.target ===
              event.currentTarget &&
              !isExecutingImport
            ) {
              setIsConfirmDialogOpen(
                false,
              );
            }
          }}
        >
          <section
            className="schedule-import-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="schedule-import-dialog-title"
          >
            <header>
              <div>
                <h3 id="schedule-import-dialog-title">
                  אישור ייבוא
                </h3>

                <span>
                  הפעולה תשנה נתונים
                  במערכת.
                </span>
              </div>

              <button
                type="button"
                className="schedule-import-dialog-close"
                disabled={
                  isExecutingImport
                }
                aria-label="סגירת חלון האישור"
                onClick={() => {
                  setIsConfirmDialogOpen(
                    false,
                  );
                }}
              >
                <X
                  size={18}
                  aria-hidden="true"
                />
              </button>
            </header>

            <div className="schedule-import-dialog-body">
              <dl>
                <div>
                  <dt>
                    חודש
                  </dt>

                  <dd>
                    {
                      detectedPeriodTitle
                    }
                  </dd>
                </div>

                <div>
                  <dt>
                    אופן הייבוא
                  </dt>

                  <dd>
                    {
                      confirmationStrategy
                    }
                  </dd>
                </div>

                <div>
                  <dt>
                    משמרות שייווצרו או יעודכנו
                  </dt>

                  <dd>
                    {
                      importSimulation
                        .dispatcherShifts
                        .toCreate +
                      importSimulation
                        .dispatcherShifts
                        .toUpdate
                    }
                  </dd>
                </div>

                <div>
                  <dt>
                    כוננויות שייווצרו או יעודכנו
                  </dt>

                  <dd>
                    {
                      importSimulation
                        .driverDuties
                        .toCreate +
                      importSimulation
                        .driverDuties
                        .toUpdate
                    }
                  </dd>
                </div>

                <div>
                  <dt>
                    שיבוצי כונני בוקר שייווצרו או יעודכנו
                  </dt>

                  <dd>
                    {
                      importSimulation
                        .morningDriverShifts
                        .toCreate +
                      importSimulation
                        .morningDriverShifts
                        .toUpdate
                    }
                  </dd>
                </div>

                <div>
                  <dt>
                    רשומות שיימחקו
                  </dt>

                  <dd>
                    {
                      importSimulation
                        .dispatcherShifts
                        .toDelete +
                      importSimulation
                        .driverDuties
                        .toDelete +
                      importSimulation
                        .morningDriverShifts
                        .toDelete
                    }
                  </dd>
                </div>
              </dl>

              <div className="schedule-import-dialog-warning">
                <AlertTriangle
                  size={19}
                  aria-hidden="true"
                />

                <span>
                  יש לוודא שהקובץ
                  והאסטרטגיה שנבחרה
                  נכונים לפני האישור.
                </span>
              </div>

              {executionError ? (
                <div
                  className="schedule-import-error"
                  role="alert"
                  aria-live="assertive"
                >
                  <AlertTriangle
                    size={19}
                    aria-hidden="true"
                  />

                  <div>
                    <strong>
                      ביצוע הייבוא נכשל
                    </strong>

                    <span>
                      {executionError}
                    </span>
                  </div>
                </div>
              ) : null}
            </div>

            <footer>
              <Button
                type="button"
                variant="secondary"
                disabled={
                  isExecutingImport
                }
                onClick={() => {
                  setIsConfirmDialogOpen(
                    false,
                  );
                }}
              >
                ביטול
              </Button>

              <Button
                type="button"
                disabled={
                  isExecutingImport
                }
                onClick={() => {
                  void handleExecuteImport();
                }}
              >
                {isExecutingImport ? (
                  <>
                    <RefreshCw
                      size={17}
                      className="schedule-import-loading-icon"
                      aria-hidden="true"
                    />

                    מייבא נתונים...
                  </>
                ) : (
                  'אני מאשר את הייבוא'
                )}
              </Button>
            </footer>
          </section>
        </div>
      ) : null}
    </section>
  );
}

export default ScheduleImportPanel;