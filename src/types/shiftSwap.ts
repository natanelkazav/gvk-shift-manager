export type ShiftSwapType =
  | 'one_way'
  | 'two_way';

export type ShiftSwapStatus =
  | 'pending_counterparty'
  | 'pending_manager'
  | 'approved'
  | 'rejected_by_counterparty'
  | 'rejected_by_manager'
  | 'cancelled'
  | 'expired';

export interface ShiftSwapShiftOption {
  id: string;
  periodId: string;
  assignedUserId?: string;
  shiftDate: string;
  startsAt: string;
  endsAt: string;
  shiftCode: string;
  scheduleType: string;
  isPremium: boolean;
  holidayName: string | null;
  periodYear: number;
  periodMonth: number;
}

export interface ShiftSwapDispatcherOption {
  id: string;
  displayName: string;
  scheduleName: string | null;
}

export interface ShiftSwapCreateOptions {
  myShifts: ShiftSwapShiftOption[];
  dispatchers: ShiftSwapDispatcherOption[];
  counterpartyShifts: ShiftSwapShiftOption[];
}

export interface ShiftSwapRequest {
  id: string;
  swapType: ShiftSwapType;
  status: ShiftSwapStatus;
  requesterUserId: string;
  requesterName: string;
  counterpartyUserId: string;
  counterpartyName: string;
  requesterShiftId: string;
  requesterShiftDate: string;
  requesterStartsAt: string;
  requesterEndsAt: string;
  counterpartyShiftId: string | null;
  counterpartyShiftDate: string | null;
  counterpartyStartsAt: string | null;
  counterpartyEndsAt: string | null;
  rejectionReason: string | null;
  counterpartyRespondedAt: string | null;
  managerReviewedAt: string | null;
  managerUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateShiftSwapRequestInput {
  swapType: ShiftSwapType;
  requesterShiftId: string;
  counterpartyUserId: string;
  counterpartyShiftId?: string | null;
}

export interface ShiftSwapMutationResult {
  id: string;
  status: ShiftSwapStatus;
  swapType?: ShiftSwapType;
  requesterUserId?: string;
  counterpartyUserId?: string;
  requesterShiftId?: string;
  counterpartyShiftId?: string | null;
  managerUserId?: string;
  createdAt?: string;
  counterpartyRespondedAt?: string;
  managerReviewedAt?: string;
  cancelledAt?: string;
  notificationIds?: string[];
}
