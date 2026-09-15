import { ArrowLeft, ArrowLeftRight, Check, LoaderCircle, Plus, RefreshCw, Repeat2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import Button from '../components/ui/Button';
import { dynamicSchedulingService } from '../services/dynamicSchedulingService';
import type {
  DynamicShiftExchangeOptions,
  DynamicShiftExchangeRequest,
  DynamicShiftExchangeShiftOption,
  DynamicShiftExchangeStatus,
  DynamicShiftExchangeType,
} from '../types/dynamicScheduling';
import { dynamicShiftDisplayName } from '../utils/dynamicShiftDisplayName';
import '../styles/dynamicShiftExchanges.css';

const EMPTY_OPTIONS: DynamicShiftExchangeOptions = {
  hasDynamicShiftExchange: false,
  publications: [],
  myShifts: [],
  members: [],
  counterpartyShifts: [],
};

const STATUS_LABELS: Record<DynamicShiftExchangeStatus, string> = {
  pending_counterparty: 'ממתין לעובד השני',
  pending_manager: 'ממתין לאישור מנהל',
  approved: 'אושר',
  rejected_by_counterparty: 'נדחה על ידי העובד השני',
  rejected_by_manager: 'נדחה על ידי מנהל',
  cancelled: 'בוטל',
  expired: 'פג תוקף',
};

function formatDate(value: string | null): string {
  if (!value) return '—';
  const [year, month, day] = value.slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
}

function formatTime(value: string | null): string {
  return value ? value.slice(0, 5) : '—';
}

function shiftLabel(shift: DynamicShiftExchangeShiftOption): string {
  return `${formatDate(shift.shiftDate)} · ${dynamicShiftDisplayName(shift.shiftName, 'משמרת')} · ${formatTime(shift.startTime)}–${formatTime(shift.endTime)}`;
}

function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

function monthLabel(year: number, month: number): string {
  return new Intl.DateTimeFormat('he-IL', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1));
}

function requestShiftLabel(request: DynamicShiftExchangeRequest, counterparty = false): string {
  if (counterparty) {
    if (!request.counterpartyAssignmentId) return 'מקבל/ת את המשמרת';
    return `${formatDate(request.counterpartyShiftDate)} · ${request.counterpartyShiftName ?? ''} · ${formatTime(request.counterpartyStartTime)}–${formatTime(request.counterpartyEndTime)}`;
  }
  return `${formatDate(request.requesterShiftDate)} · ${request.requesterShiftName} · ${formatTime(request.requesterStartTime)}–${formatTime(request.requesterEndTime)}`;
}

function MyDynamicShiftExchangesPage() {
  const { user, hasPermission } = useAuth();
  const [options, setOptions] = useState<DynamicShiftExchangeOptions>(EMPTY_OPTIONS);
  const [requests, setRequests] = useState<DynamicShiftExchangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [swapType, setSwapType] = useState<DynamicShiftExchangeType>('one_way');
  const [requesterAssignmentId, setRequesterAssignmentId] = useState('');
  const [counterpartyUserId, setCounterpartyUserId] = useState('');
  const [counterpartyAssignmentId, setCounterpartyAssignmentId] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const canApprove = hasPermission('shift_swaps.approve');

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextOptions, nextRequests] = await Promise.all([
        dynamicSchedulingService.getMyDynamicShiftExchangeOptions(),
        dynamicSchedulingService.getDynamicShiftExchangeRequests(),
      ]);
      setOptions(nextOptions);
      setRequests(nextRequests);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'טעינת חילופי המשמרות נכשלה.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadData(); }, []);

  const availableMonths = useMemo(() => {
    const unique = new Map<string, { key: string; year: number; month: number }>();
    options.publications.forEach((publication) => {
      const key = monthKey(publication.year, publication.month);
      if (!unique.has(key)) unique.set(key, { key, year: publication.year, month: publication.month });
    });
    return Array.from(unique.values()).sort((a, b) => a.key.localeCompare(b.key));
  }, [options.publications]);

  useEffect(() => {
    if (!availableMonths.length) {
      setSelectedMonth('');
      return;
    }
    if (!availableMonths.some((item) => item.key === selectedMonth)) {
      setSelectedMonth(availableMonths[0].key);
    }
  }, [availableMonths, selectedMonth]);

  const visibleMyShifts = useMemo(() => options.myShifts.filter((shift) => (
    !selectedMonth || monthKey(shift.year, shift.month) === selectedMonth
  )), [options.myShifts, selectedMonth]);

  const selectedRequesterShift = visibleMyShifts.find((shift) => shift.id === requesterAssignmentId) ?? null;
  const members = useMemo(() => {
    if (!selectedRequesterShift) return [];
    return options.members
      .filter((member) => member.jobTypeId === selectedRequesterShift.jobTypeId)
      .sort((a, b) => a.displayName.localeCompare(b.displayName, 'he'));
  }, [options.members, selectedRequesterShift]);

  const counterpartyShifts = useMemo(() => {
    if (!selectedRequesterShift || !counterpartyUserId) return [];
    return options.counterpartyShifts.filter((shift) =>
      shift.publicationId === selectedRequesterShift.publicationId && shift.assignedUserId === counterpartyUserId,
    );
  }, [counterpartyUserId, options.counterpartyShifts, selectedRequesterShift]);

  const myRequests = requests.filter((request) => request.requesterUserId === user?.id);
  const awaitingMe = requests.filter((request) => request.counterpartyUserId === user?.id && request.status === 'pending_counterparty');
  const awaitingManager = canApprove ? requests.filter((request) => request.status === 'pending_manager') : [];
  const completed = requests.filter((request) => !['pending_counterparty', 'pending_manager'].includes(request.status));

  const runAction = async (id: string, action: () => Promise<void>, message: string) => {
    setBusyId(id); setError(null); setSuccess(null);
    try { await action(); setSuccess(message); await loadData(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'הפעולה נכשלה.'); }
    finally { setBusyId(null); }
  };

  const createRequest = async () => {
    if (!requesterAssignmentId || !counterpartyUserId) { setError('יש לבחור משמרת ועובד מחליף.'); return; }
    if (swapType === 'two_way' && !counterpartyAssignmentId) { setError('בהחלפה דו-כיוונית יש לבחור גם משמרת נגדית.'); return; }
    setBusyId('create'); setError(null); setSuccess(null);
    try {
      await dynamicSchedulingService.createDynamicShiftExchangeRequest({
        swapType,
        requesterAssignmentId,
        counterpartyUserId,
        counterpartyAssignmentId: swapType === 'two_way' ? counterpartyAssignmentId : null,
      });
      setSuccess('בקשת החילוף נשלחה לעובד השני.');
      setCreateOpen(false); setRequesterAssignmentId(''); setCounterpartyUserId(''); setCounterpartyAssignmentId(''); setSwapType('one_way');
      await loadData();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'יצירת הבקשה נכשלה.'); }
    finally { setBusyId(null); }
  };

  const renderRequest = (request: DynamicShiftExchangeRequest, actions?: React.ReactNode) => (
    <article className="dynamic-exchange-card" key={request.id}>
      <div className="dynamic-exchange-card-head">
        <div><strong>{request.jobTypeName}</strong><span className={`dynamic-exchange-status status-${request.status}`}>{STATUS_LABELS[request.status]}</span></div>
        {request.swapType === 'two_way' ? <ArrowLeftRight size={20} /> : <ArrowLeft size={20} />}
      </div>
      <div className="dynamic-exchange-flow">
        <div><span>{request.requesterName}</span><small dir="ltr">{requestShiftLabel(request)}</small></div>
        {request.swapType === 'two_way' ? <ArrowLeftRight size={18} /> : <ArrowLeft size={18} />}
        <div><span>{request.counterpartyName}</span><small dir="ltr">{requestShiftLabel(request, true)}</small></div>
      </div>
      {request.rejectionReason ? <p className="dynamic-exchange-reason">סיבת דחייה: {request.rejectionReason}</p> : null}
      {actions ? <div className="dynamic-exchange-actions">{actions}</div> : null}
    </article>
  );

  if (loading) return <main className="dynamic-exchanges page-shell" dir="rtl"><div className="dynamic-exchange-loading"><LoaderCircle className="spin" /> טוען חילופי משמרות…</div></main>;

  return (
    <main className="dynamic-exchanges page-shell" dir="rtl">
      <header className="dynamic-exchange-header">
        <div><h1><Repeat2 size={27} /> חילופי משמרות</h1><p>בקשה → אישור העובד השני → אישור בעל הרשאה. השיבוץ מתעדכן רק לאחר האישור הסופי.</p></div>
        <div className="dynamic-exchange-header-actions">
          <Button variant="secondary" onClick={() => void loadData()}><RefreshCw size={16} /> רענן</Button>
          {options.hasDynamicShiftExchange ? <Button onClick={() => setCreateOpen(true)}><Plus size={17} /> בקשת חילוף</Button> : null}
        </div>
      </header>

      {error ? <div className="users-error" role="alert">{error}</div> : null}
      {success ? <div className="dynamic-exchange-success">{success}</div> : null}

      {!options.hasDynamicShiftExchange && !canApprove && requests.length === 0 ? (
        <section className="dynamic-exchange-empty"><Repeat2 size={34} /><h2>אין תפקיד דינמי עם חילופי משמרות פעילים</h2><p>הטאב יפעל כאשר תפקיד שאליו אתה משויך יוגדר עם „מערכת חילופי משמרות” ויפורסם לו לוח.</p></section>
      ) : null}

      {createOpen ? (
        <section className="dynamic-exchange-create">
          <div className="dynamic-exchange-create-title"><h2>בקשת חילוף חדשה</h2><button type="button" onClick={() => setCreateOpen(false)} aria-label="סגור"><X size={19} /></button></div>
          {availableMonths.length > 1 ? (
            <label className="dynamic-exchange-month-picker">
              <span>חודש החילוף</span>
              <select
                value={selectedMonth}
                onChange={(event) => {
                  setSelectedMonth(event.target.value);
                  setRequesterAssignmentId('');
                  setCounterpartyUserId('');
                  setCounterpartyAssignmentId('');
                }}
              >
                {availableMonths.map((item) => <option key={item.key} value={item.key}>{monthLabel(item.year, item.month)}</option>)}
              </select>
            </label>
          ) : availableMonths.length === 1 ? (
            <div className="dynamic-exchange-month-fixed"><span>חודש החילוף</span><strong>{monthLabel(availableMonths[0].year, availableMonths[0].month)}</strong></div>
          ) : null}
          <div className="dynamic-exchange-type-toggle">
            <button type="button" className={swapType === 'one_way' ? 'active' : ''} onClick={() => { setSwapType('one_way'); setCounterpartyAssignmentId(''); }}>חד-כיווני</button>
            <button type="button" className={swapType === 'two_way' ? 'active' : ''} onClick={() => setSwapType('two_way')}>דו-כיווני</button>
          </div>
          <div className="dynamic-exchange-form-grid">
            <label><span>המשמרת שלי</span><select value={requesterAssignmentId} onChange={(event) => { setRequesterAssignmentId(event.target.value); setCounterpartyUserId(''); setCounterpartyAssignmentId(''); }}><option value="">בחר משמרת…</option>{visibleMyShifts.map((shift) => <option key={shift.id} value={shift.id}>{shift.jobTypeName} · {shiftLabel(shift)}</option>)}</select></label>
            <label><span>עובד מחליף</span><select value={counterpartyUserId} disabled={!selectedRequesterShift} onChange={(event) => { setCounterpartyUserId(event.target.value); setCounterpartyAssignmentId(''); }}><option value="">בחר עובד…</option>{members.map((member) => <option key={member.userId} value={member.userId}>{member.displayName}</option>)}</select></label>
            {swapType === 'two_way' ? <label><span>המשמרת שלו/ה</span><select value={counterpartyAssignmentId} disabled={!counterpartyUserId} onChange={(event) => setCounterpartyAssignmentId(event.target.value)}><option value="">בחר משמרת נגדית…</option>{counterpartyShifts.map((shift) => <option key={shift.id} value={shift.id}>{shiftLabel(shift)}</option>)}</select></label> : null}
          </div>
          {selectedMonth && visibleMyShifts.length === 0 ? <p className="dynamic-exchange-no-shifts">אין לך משמרות עתידיות שניתן להחליף בחודש שנבחר.</p> : null}
          <p className="dynamic-exchange-hint">המערכת בודקת חפיפות, בעלות על המשמרות ובקשות פעילות לפני יצירת הבקשה ובכל שלב אישור.</p>
          <Button onClick={() => void createRequest()} disabled={busyId === 'create'}>{busyId === 'create' ? 'שולח…' : 'שלח בקשה'}</Button>
        </section>
      ) : null}

      {awaitingMe.length ? <section className="dynamic-exchange-section"><h2>ממתין לתגובה שלי <span>{awaitingMe.length}</span></h2>{awaitingMe.map((request) => renderRequest(request, <><Button onClick={() => void runAction(request.id, () => dynamicSchedulingService.respondToDynamicShiftExchangeRequest(request.id, true), 'הבקשה אושרה והועברה לאישור מנהל.')} disabled={busyId === request.id}><Check size={16} /> אשר</Button><Button variant="secondary" onClick={() => void runAction(request.id, () => dynamicSchedulingService.respondToDynamicShiftExchangeRequest(request.id, false), 'הבקשה נדחתה.')} disabled={busyId === request.id}><X size={16} /> דחה</Button></>))}</section> : null}

      {awaitingManager.length ? <section className="dynamic-exchange-section manager"><h2>ממתין לאישור מנהל <span>{awaitingManager.length}</span></h2>{awaitingManager.map((request) => renderRequest(request, <><Button onClick={() => void runAction(request.id, () => dynamicSchedulingService.reviewDynamicShiftExchangeRequest(request.id, true), 'החילוף אושר והשיבוץ עודכן.')} disabled={busyId === request.id}><Check size={16} /> אישור סופי</Button><Button variant="secondary" onClick={() => void runAction(request.id, () => dynamicSchedulingService.reviewDynamicShiftExchangeRequest(request.id, false), 'הבקשה נדחתה.')} disabled={busyId === request.id}><X size={16} /> דחה</Button></>))}</section> : null}

      {myRequests.length ? <section className="dynamic-exchange-section"><h2>הבקשות שלי <span>{myRequests.length}</span></h2>{myRequests.map((request) => renderRequest(request, ['pending_counterparty', 'pending_manager'].includes(request.status) ? <Button variant="secondary" onClick={() => void runAction(request.id, () => dynamicSchedulingService.cancelDynamicShiftExchangeRequest(request.id), 'הבקשה בוטלה.')} disabled={busyId === request.id}>בטל בקשה</Button> : undefined))}</section> : null}

      {completed.length ? <section className="dynamic-exchange-section"><h2>היסטוריה</h2>{completed.filter((request) => request.requesterUserId !== user?.id || !myRequests.includes(request)).map((request) => renderRequest(request))}</section> : null}
    </main>
  );
}

export default MyDynamicShiftExchangesPage;
