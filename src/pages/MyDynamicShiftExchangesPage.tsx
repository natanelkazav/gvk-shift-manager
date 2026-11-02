/**
 * קובץ: src/pages/MyDynamicShiftExchangesPage.tsx
 * מטרה: מימוש מסך המשתמש עבור החלפת משמרות.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: formatDate, formatTime, shiftLabel, monthKey, monthLabel, requestShiftLabel, MyDynamicShiftExchangesPage.
 * - קישור מאפיינים ומצב מקומי לתצוגה ולטיפול בפעולות המשתמש.
 */
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

// EMPTY_OPTIONS — אפשרויות בחירה.
const EMPTY_OPTIONS: DynamicShiftExchangeOptions = {
  hasDynamicShiftExchange: false,
  publications: [],
  myShifts: [],
  members: [],
  counterpartyShifts: [],
};

// STATUS_LABELS — סטטוס.
const STATUS_LABELS: Record<DynamicShiftExchangeStatus, string> = {
  pending_counterparty: 'ממתין לעובד השני',
  pending_manager: 'ממתין לאישור מנהל',
  approved: 'אושר',
  rejected_by_counterparty: 'נדחה על ידי העובד השני',
  rejected_by_manager: 'נדחה על ידי מנהל',
  cancelled: 'בוטל',
  expired: 'פג תוקף',
};

/**
 * פעולה formatDate: עיצוב ערך לתצוגה עבור תאריך.
 * @param value — ערך.
 * @returns string — הפלט בהתאם לחתימה.
 */
function formatDate(value: string | null): string {
  if (!value) return '—';
  const [year, month, day] = value.slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
}

/**
 * פעולה formatTime: עיצוב ערך לתצוגה עבור זמן.
 * @param value — ערך.
 * @returns string — הפלט בהתאם לחתימה.
 */
function formatTime(value: string | null): string {
  return value ? value.slice(0, 5) : '—';
}

/**
 * פעולה shiftLabel: משמרת / תווית.
 * @param shift — משמרת.
 * @returns string — הפלט בהתאם לחתימה.
 */
function shiftLabel(shift: DynamicShiftExchangeShiftOption): string {
  return `${formatDate(shift.shiftDate)} · ${dynamicShiftDisplayName(shift.shiftName, 'משמרת')} · ${formatTime(shift.startTime)}–${formatTime(shift.endTime)}`;
}

/**
 * פעולה monthKey: חודש / מפתח.
 * @param year — שנה.
 * @param month — חודש.
 * @returns string — הפלט בהתאם לחתימה.
 */
function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

/**
 * פעולה monthLabel: חודש / תווית.
 * @param year — שנה.
 * @param month — חודש.
 * @returns string — הפלט בהתאם לחתימה.
 */
function monthLabel(year: number, month: number): string {
  return new Intl.DateTimeFormat('he-IL', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1));
}

/**
 * פעולה requestShiftLabel: נתוני הבקשה / משמרת / תווית.
 * @param request — נתוני הבקשה.
 * @param counterparty — הנתון counterparty בהקשר הפעולה.
 * @returns string — הפלט בהתאם לחתימה.
 */
function requestShiftLabel(request: DynamicShiftExchangeRequest, counterparty = false): string {
  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר counterparty.
  if (counterparty) {
    if (!request.counterpartyAssignmentId) return 'מקבל/ת את המשמרת';
    return `${formatDate(request.counterpartyShiftDate)} · ${request.counterpartyShiftName ?? ''} · ${formatTime(request.counterpartyStartTime)}–${formatTime(request.counterpartyEndTime)}`;
  }
  return `${formatDate(request.requesterShiftDate)} · ${request.requesterShiftName} · ${formatTime(request.requesterStartTime)}–${formatTime(request.requesterEndTime)}`;
}

/**
 * פעולה MyDynamicShiftExchangesPage: החלפת משמרות.
 */
function MyDynamicShiftExchangesPage() {
  const { user, hasPermission } = useAuth();
  // מצב מקומי: options — אפשרויות בחירה; setOptions מעדכנת אותו ומפעילה רינדור לפי React.
  const [options, setOptions] = useState<DynamicShiftExchangeOptions>(EMPTY_OPTIONS);
  // מצב מקומי: requests — הנתון requests בהקשר הפעולה; setRequests מעדכנת אותו ומפעילה רינדור לפי React.
  const [requests, setRequests] = useState<DynamicShiftExchangeRequest[]>([]);
  // מצב מקומי: loading — טעינה; setLoading מעדכנת אותו ומפעילה רינדור לפי React.
  const [loading, setLoading] = useState(true);
  // מצב מקומי: error — שגיאה; setError מעדכנת אותו ומפעילה רינדור לפי React.
  const [error, setError] = useState<string | null>(null);
  // מצב מקומי: success — הנתון success בהקשר הפעולה; setSuccess מעדכנת אותו ומפעילה רינדור לפי React.
  const [success, setSuccess] = useState<string | null>(null);
  // מצב מקומי: createOpen — הנתון createOpen בהקשר הפעולה; setCreateOpen מעדכנת אותו ומפעילה רינדור לפי React.
  const [createOpen, setCreateOpen] = useState(false);
  // מצב מקומי: selectedMonth — נבחר / חודש; setSelectedMonth מעדכנת אותו ומפעילה רינדור לפי React.
  const [selectedMonth, setSelectedMonth] = useState('');
  // מצב מקומי: swapType — הנתון swapType בהקשר הפעולה; setSwapType מעדכנת אותו ומפעילה רינדור לפי React.
  const [swapType, setSwapType] = useState<DynamicShiftExchangeType>('one_way');
  // מצב מקומי: requesterAssignmentId — הקצאה / מזהה; setRequesterAssignmentId מעדכנת אותו ומפעילה רינדור לפי React.
  const [requesterAssignmentId, setRequesterAssignmentId] = useState('');
  // מצב מקומי: counterpartyUserId — מזהה משתמש; setCounterpartyUserId מעדכנת אותו ומפעילה רינדור לפי React.
  const [counterpartyUserId, setCounterpartyUserId] = useState('');
  // מצב מקומי: counterpartyAssignmentId — הקצאה / מזהה; setCounterpartyAssignmentId מעדכנת אותו ומפעילה רינדור לפי React.
  const [counterpartyAssignmentId, setCounterpartyAssignmentId] = useState('');
  // מצב מקומי: busyId — מזהה; setBusyId מעדכנת אותו ומפעילה רינדור לפי React.
  const [busyId, setBusyId] = useState<string | null>(null);

  // canApprove — הנתון canApprove בהקשר הפעולה.
  const canApprove = hasPermission('shift_swaps.approve');

  /**
   * פעולה אסינכרונית loadData: טעינת נתונים.
   */
  const loadData = async () => {
    setLoading(true);
    setError(null);
    // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
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

  // תופעת לוואי לאחר רינדור בהתאם לתלויות [].
  useEffect(() => { void loadData(); }, []);

  // ערך מחושב availableMonths — חודשים; נשמר בין רינדורים עד שינוי התלויות.
  const availableMonths = useMemo(() => {
    const unique = new Map<string, { key: string; year: number; month: number }>();
    options.publications.forEach((publication) => {
      // key — מפתח.
      const key = monthKey(publication.year, publication.month);
      if (!unique.has(key)) unique.set(key, { key, year: publication.year, month: publication.month });
    });
    return Array.from(unique.values()).sort((a, b) => a.key.localeCompare(b.key));
  }, [options.publications]);

  // תופעת לוואי לאחר רינדור בהתאם לתלויות [availableMonths, selectedMonth].
  useEffect(() => {
    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !availableMonths.length.
    if (!availableMonths.length) {
      setSelectedMonth('');
      return;
    }
    if (!availableMonths.some((item) => item.key === selectedMonth)) {
      setSelectedMonth(availableMonths[0].key);
    }
  }, [availableMonths, selectedMonth]);

  // ערך מחושב visibleMyShifts — משמרות; נשמר בין רינדורים עד שינוי התלויות.
  const visibleMyShifts = useMemo(() => options.myShifts.filter((shift) => (
    !selectedMonth || monthKey(shift.year, shift.month) === selectedMonth
  )), [options.myShifts, selectedMonth]);

  // selectedRequesterShift — נבחר / משמרת.
  const selectedRequesterShift = visibleMyShifts.find((shift) => shift.id === requesterAssignmentId) ?? null;
  // ערך מחושב members — חברי התפקיד; נשמר בין רינדורים עד שינוי התלויות.
  const members = useMemo(() => {
    if (!selectedRequesterShift) return [];
    return options.members
      .filter((member) => member.jobTypeId === selectedRequesterShift.jobTypeId)
      .sort((a, b) => a.displayName.localeCompare(b.displayName, 'he'));
  }, [options.members, selectedRequesterShift]);

  // ערך מחושב counterpartyShifts — משמרות; נשמר בין רינדורים עד שינוי התלויות.
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

  /**
   * פעולה אסינכרונית runAction: הנתון runAction בהקשר הפעולה.
   * @param id — מזהה.
   * @param action — הנתון action בהקשר הפעולה.
   * @param message — הודעה.
   */
  const runAction = async (id: string, action: () => Promise<void>, message: string) => {
    setBusyId(id); setError(null); setSuccess(null);
    // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
    try { await action(); setSuccess(message); await loadData(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'הפעולה נכשלה.'); }
    finally { setBusyId(null); }
  };

  /**
   * פעולה אסינכרונית respondToRequest: נתוני הבקשה.
   * @param requestId — מזהה הבקשה.
   * @param approve — הנתון approve בהקשר הפעולה.
   */
  const respondToRequest = async (requestId: string, approve: boolean) => {
    setBusyId(requestId);
    setError(null);
    setSuccess(null);
    // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
    try {
      await dynamicSchedulingService.respondToDynamicShiftExchangeRequest(requestId, approve);
      const updatedRequests = await dynamicSchedulingService.getDynamicShiftExchangeRequests();
      setRequests(updatedRequests);
      // updatedRequest — נתוני הבקשה.
      const updatedRequest = updatedRequests.find((request) => request.id === requestId);
      if (!updatedRequest) {
        setSuccess('התגובה נקלטה. לא ניתן לאמת כרגע את מצב הבקשה; ניתן לרענן את הרשימה.');
      } else if (updatedRequest.status === 'approved') {
        setSuccess('החילוף אושר והשיבוץ עודכן בהצלחה.');
        window.dispatchEvent(new Event('gvk:dynamic-schedule-changed'));
      } else if (updatedRequest.status === 'pending_manager') {
        setSuccess('הבקשה אושרה על ידך והועברה לאישור בעל ההרשאה.');
      } else if (updatedRequest.status === 'rejected_by_counterparty') {
        setSuccess('הבקשה נדחתה.');
      } else {
        setSuccess('התגובה נקלטה. מצב הבקשה: ' + (STATUS_LABELS[updatedRequest.status] ?? updatedRequest.status));
      }
      // Reload options as well: approved exchanges may change which shifts can be offered.
      // nextOptions — אפשרויות בחירה.
      const nextOptions = await dynamicSchedulingService.getMyDynamicShiftExchangeOptions();
      setOptions(nextOptions);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'לא ניתן לאמת את תוצאת הפעולה. רענן את הרשימה לפני ניסיון נוסף.');
    } finally {
      setBusyId(null);
    }
  };

  /**
   * פעולה אסינכרונית createRequest: יצירת נתוני הבקשה.
   */
  const createRequest = async () => {
    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !requesterAssignmentId || !counterpartyUserId.
    if (!requesterAssignmentId || !counterpartyUserId) { setError('יש לבחור משמרת ועובד מחליף.'); return; }
    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר swapType === 'two_way' && !counterpartyAssignmentId.
    if (swapType === 'two_way' && !counterpartyAssignmentId) { setError('בהחלפה דו-כיוונית יש לבחור גם משמרת נגדית.'); return; }
    setBusyId('create'); setError(null); setSuccess(null);
    // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
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

  /**
   * פעולה renderRequest: בניית תצוגה עבור נתוני הבקשה.
   * @param request — נתוני הבקשה.
   * @param actions — הנתון actions בהקשר הפעולה.
   */
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
        <div><h1><Repeat2 size={27} /> חילופי משמרות</h1><p>הבקשה נשלחת לעובד השני. לאחר אישורו, השיבוץ מתעדכן מיד בתפקידים ללא אישור נוסף; בתפקידים אחרים הבקשה מועברת לאישור בעל הרשאה.</p></div>
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

      {awaitingMe.length ? <section className="dynamic-exchange-section"><h2>ממתין לתגובה שלי <span>{awaitingMe.length}</span></h2>{awaitingMe.map((request) => renderRequest(request, <><Button onClick={() => void respondToRequest(request.id, true)} disabled={busyId === request.id}><Check size={16} /> אשר</Button><Button variant="secondary" onClick={() => void respondToRequest(request.id, false)} disabled={busyId === request.id}><X size={16} /> דחה</Button></>))}</section> : null}

      {awaitingManager.length ? <section className="dynamic-exchange-section manager"><h2>ממתין לאישור מנהל <span>{awaitingManager.length}</span></h2>{awaitingManager.map((request) => renderRequest(request, <><Button onClick={() => void runAction(request.id, () => dynamicSchedulingService.reviewDynamicShiftExchangeRequest(request.id, true), 'החילוף אושר והשיבוץ עודכן.')} disabled={busyId === request.id}><Check size={16} /> אישור סופי</Button><Button variant="secondary" onClick={() => void runAction(request.id, () => dynamicSchedulingService.reviewDynamicShiftExchangeRequest(request.id, false), 'הבקשה נדחתה.')} disabled={busyId === request.id}><X size={16} /> דחה</Button></>))}</section> : null}

      {myRequests.length ? <section className="dynamic-exchange-section"><h2>הבקשות שלי <span>{myRequests.length}</span></h2>{myRequests.map((request) => renderRequest(request, ['pending_counterparty', 'pending_manager'].includes(request.status) ? <Button variant="secondary" onClick={() => void runAction(request.id, () => dynamicSchedulingService.cancelDynamicShiftExchangeRequest(request.id), 'הבקשה בוטלה.')} disabled={busyId === request.id}>בטל בקשה</Button> : undefined))}</section> : null}

      {completed.length ? <section className="dynamic-exchange-section"><h2>היסטוריה</h2>{completed.filter((request) => request.requesterUserId !== user?.id || !myRequests.includes(request)).map((request) => renderRequest(request))}</section> : null}
    </main>
  );
}

export default MyDynamicShiftExchangesPage;
