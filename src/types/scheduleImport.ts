export interface ImportedDispatcherShift {
  date: string;

  startTime: string;

  endTime: string;

  dispatcherName: string;
}

export interface ImportedDriverDuty {
  date: string;

  driverName: string;

  note: string | null;
}

export interface ScheduleImportPreview {
  year: number;

  month: number;

  dispatcherShifts:
    ImportedDispatcherShift[];

  driverDuties:
    ImportedDriverDuty[];

  skippedRows: number;

  warnings: string[];
}