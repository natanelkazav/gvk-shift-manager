/**
 * קובץ: src/components/users/dynamic/DynamicSchedulingShadowTester.tsx
 * מטרה: מימוש רכיב תצוגה ואינטראקציה עבור דינמי / טיוטות שיבוץ במנגנון הדינמי.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: Props, DynamicSchedulingShadowTester.
 * - קישור מאפיינים ומצב מקומי לתצוגה ולטיפול בפעולות המשתמש.
 */
import { FlaskConical, LoaderCircle, Play, RefreshCw } from 'lucide-react';
import { useMemo, useState } from 'react';
import { dynamicSchedulingService } from '../../../services/dynamicSchedulingService';
import type {
  DynamicFeasibilityAnalysis,
  DynamicJobType,
  DynamicShadowDraftResult,
  DynamicShadowDiagnostics,
  DynamicShadowValidation,
} from '../../../types/dynamicScheduling';
import { Button, Modal } from '../../ui';
import DynamicAvailabilityShadowWorkspace from './DynamicAvailabilityShadowWorkspace';

/**
 * חוזה הנתונים Props: מאפייני הרכיב.
 */
interface Props {
  // jobType — סוג תפקיד.
  jobType: DynamicJobType;
  // isOpen — האם המצב פתוח.
  isOpen: boolean;
  // onClose — פונקציית סגירת התצוגה.
  onClose: () => void;
}

// now — הנתון now בהקשר הפעולה.
const now = new Date();

/**
 * פעולה DynamicSchedulingShadowTester: דינמי / טיוטות שיבוץ במנגנון הדינמי.
 * פרמטר מפורק — שדות הקלט נגישים מקומית בשמות המוגדרים בחתימה.
 */
function DynamicSchedulingShadowTester({ jobType, isOpen, onClose }: Props) {
  // מצב מקומי: year — שנה; setYear מעדכנת אותו ומפעילה רינדור לפי React.
  const [year, setYear] = useState(now.getFullYear());
  // מצב מקומי: month — חודש; setMonth מעדכנת אותו ומפעילה רינדור לפי React.
  const [month, setMonth] = useState(now.getMonth() + 1);
  // מצב מקומי: analysis — הנתון analysis בהקשר הפעולה; setAnalysis מעדכנת אותו ומפעילה רינדור לפי React.
  const [analysis, setAnalysis] = useState<DynamicFeasibilityAnalysis | null>(null);
  // מצב מקומי: draft — טיוטה; setDraft מעדכנת אותו ומפעילה רינדור לפי React.
  const [draft, setDraft] = useState<DynamicShadowDraftResult | null>(null);
  // מצב מקומי: diagnostics — הנתון diagnostics בהקשר הפעולה; setDiagnostics מעדכנת אותו ומפעילה רינדור לפי React.
  const [diagnostics, setDiagnostics] = useState<DynamicShadowDiagnostics | null>(null);
  // מצב מקומי: validation — אימות נתונים; setValidation מעדכנת אותו ומפעילה רינדור לפי React.
  const [validation, setValidation] = useState<DynamicShadowValidation | null>(null);
  // מצב מקומי: status — סטטוס; setStatus מעדכנת אותו ומפעילה רינדור לפי React.
  const [status, setStatus] = useState<string | null>(null);
  // מצב מקומי: error — שגיאה; setError מעדכנת אותו ומפעילה רינדור לפי React.
  const [error, setError] = useState<string | null>(null);
  // מצב מקומי: busy — הנתון busy בהקשר הפעולה; setBusy מעדכנת אותו ומפעילה רינדור לפי React.
  const [busy, setBusy] = useState(false);
  // מצב מקומי: refreshKey — מפתח; setRefreshKey מעדכנת אותו ומפעילה רינדור לפי React.
  const [refreshKey, setRefreshKey] = useState(0);
  // usesMonthlyRotation — סבב כוננויות.
  const usesMonthlyRotation = jobType.schedulingStrategy === 'monthly_rotation_constraints';

  // ערך מחושב warnings — הנתון warnings בהקשר הפעולה; נשמר בין רינדורים עד שינוי התלויות.
  const warnings = useMemo(
    () => Object.values(analysis?.warnings ?? {}).filter(Boolean),
    [analysis],
  );

  /**
   * פעולה אסינכרונית materialize: הנתון materialize בהקשר הפעולה.
   * @returns Promise<void> — הפלט בהתאם לחתימה.
   */
  const materialize = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    setStatus(null);
    // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
    try {
      // result — תוצאה.
      const result = await dynamicSchedulingService.createAvailabilityShadowPeriod(
        jobType.id,
        year,
        month,
      );
      setStatus(`נוצרה תקופת Shadow עם ${result.createdSlots} משמרות.`);
      setAnalysis(null);
      setDraft(null);
      setDiagnostics(null);
      setValidation(null);
      setRefreshKey((value) => value + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'יצירת תקופת Shadow נכשלה.');
    } finally {
      setBusy(false);
    }
  };

  /**
   * פעולה אסינכרונית analyze: הנתון analyze בהקשר הפעולה.
   * @returns Promise<void> — הפלט בהתאם לחתימה.
   */
  const analyze = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    setStatus(null);
    // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
    try {
      // result — תוצאה.
      const result = await dynamicSchedulingService.analyzeSchedulingFeasibility(
        jobType.id,
        year,
        month,
      );
      setAnalysis(result);
      setDraft(null);
      setDiagnostics(null);
      setValidation(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ניתוח ההיתכנות נכשל.');
    } finally {
      setBusy(false);
    }
  };

  /**
   * פעולה אסינכרונית generate: יצירת הנתון generate בהקשר הפעולה.
   * @returns Promise<void> — הפלט בהתאם לחתימה.
   */
  const generate = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    setStatus(null);
    // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
    try {
      // result — תוצאה.
      const result = await dynamicSchedulingService.createSchedulingShadowDraft(
        jobType.id,
        year,
        month,
      );
      setDraft(result);
      setAnalysis(result.feasibility);
      const [diagnosticResult, validationResult] = await Promise.all([
        dynamicSchedulingService.getSchedulingShadowDiagnostics(result.draftId),
        dynamicSchedulingService.getSchedulingShadowValidation(result.draftId),
      ]);
      setDiagnostics(diagnosticResult);
      setValidation(validationResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'יצירת טיוטת Shadow נכשלה.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      title={`בדיקת מנוע שיבוץ · ${jobType.name}`}
      onClose={onClose}
      footer={
        <Button variant="secondary" onClick={onClose}>
          סגור
        </Button>
      }
    >
      <div className="dynamic-shadow-tester">
        <div className="dynamic-shadow-tester-warning">
          <FlaskConical size={18} />
          <div>
            <strong>Shadow Mode בלבד</strong>
            <span>הבדיקה אינה משנה לוח אמיתי ואינה מפרסמת שיבוץ.</span>
          </div>
        </div>

        <div className="dynamic-shadow-period-picker">
          <label>
            שנה
            <input
              type="number"
              min="2020"
              max="2100"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            />
          </label>
          <label>
            חודש
            <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="dynamic-shadow-actions">
          <Button variant="secondary" disabled={busy} onClick={() => void materialize()}>
            <RefreshCw size={16} /> צור/רענן תקופת Shadow
          </Button>
          <Button variant="secondary" disabled={busy || usesMonthlyRotation} onClick={() => void analyze()}>
            <FlaskConical size={16} /> נתח היתכנות
          </Button>
          <Button disabled={busy || usesMonthlyRotation} onClick={() => void generate()}>
            {busy ? <LoaderCircle className="spin" size={16} /> : <Play size={16} />} צור טיוטת
            Shadow
          </Button>
        </div>

        {usesMonthlyRotation ? (
          <div className="dynamic-shadow-tester-warning">
            <FlaskConical size={18} />
            <div>
              <strong>מנוע הסבב החודשי עדיין לא מחובר</strong>
              <span>
                Phase 8.1 שומר את אסטרטגיית הסבב ואת האילוצים. יצירת טיוטת סבב תתווסף ב־Phase 8.2,
                ולכן כרגע לא מריצים בטעות את optimizer של המוקדנים על תפקיד כזה.
              </span>
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="users-error" role="alert">
            {error}
          </div>
        ) : null}
        {status ? <div className="dynamic-shadow-success">{status}</div> : null}

        <section className="dynamic-shadow-workspace-section">
          <div className="dynamic-shadow-section-heading">
            <h4>אילוצים דינמיים</h4>
            <span>עריכת נתוני Shadow לצורך בדיקת המנוע בלבד</span>
          </div>
          <DynamicAvailabilityShadowWorkspace
            jobType={jobType}
            year={year}
            month={month}
            refreshKey={refreshKey}
          />
        </section>

        {analysis ? (
          <div className="dynamic-shadow-analysis">
            {!analysis.materialized ? (
              <p>{analysis.message}</p>
            ) : (
              <>
                <div className="dynamic-shadow-metrics">
                  <div>
                    <span>הקצאות חובה</span>
                    <strong>{analysis.requiredAssignments ?? 0}</strong>
                  </div>
                  <div>
                    <span>סכום מינימום</span>
                    <strong>{analysis.aggregateMinimum ?? 0}</strong>
                  </div>
                  <div>
                    <span>סכום יעד</span>
                    <strong>{analysis.aggregateTarget ?? 0}</strong>
                  </div>
                  <div>
                    <span>קיבולת מקסימום</span>
                    <strong>{analysis.aggregateMaximum ?? 0}</strong>
                  </div>
                  <div>
                    <span>חוסר במועמדים</span>
                    <strong>{analysis.slotsWithoutEnoughCandidates ?? 0}</strong>
                  </div>
                  <div>
                    <span>דורש "מעדיף שלא"</span>
                    <strong>{analysis.slotsRequiringAvoidCandidates ?? 0}</strong>
                  </div>
                </div>
                {warnings.length ? (
                  <div className="dynamic-shadow-warnings">
                    {warnings.map((warning) => (
                      <p key={warning}>⚠ {warning}</p>
                    ))}
                  </div>
                ) : (
                  <div className="dynamic-shadow-success">✓ לא נמצאו בעיות היתכנות בסיסיות.</div>
                )}
                <div className="dynamic-shadow-targets">
                  <h4>חלוקה פרופורציונלית מוצעת</h4>
                  {(analysis.members ?? []).map((member) => (
                    <div key={member.userId}>
                      <strong>{member.displayName}</strong>
                      <span>
                        מינ׳ {member.minimum} · יעד {member.target} · מועמד ל־
                        {member.availableSlots}
                        {member.employmentScope
                          ? ` · ${member.employmentScope === 'part_time' ? 'משרה חלקית' : 'משרה מלאה'}`
                          : ''}
                      </span>
                      <b>{member.proportionalTarget.toFixed(1)}</b>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        ) : null}

        {draft ? (
          <div className="dynamic-shadow-draft-result">
            <strong>טיוטת Shadow נוצרה</strong>
            <span>חובה: {draft.requiredAssignmentsCreated}</span>
            <span>עובדים נוספים עד היעד: {draft.optionalAssignmentsCreated}</span>
            <span>עמדות חובה שלא כוסו: {draft.unfilledRequiredPositions}</span>
            <span>שיבוצי "מעדיף שלא": {draft.avoidAssignments ?? 0}</span>
            <span>שיבוצים לאחר הגעה ליעד: {draft.aboveTargetAssignments ?? 0}</span>
            <span>
              אלגוריתם:{' '}
              {draft.algorithm === 'scarcity_first_soft_target_employment_v2_1'
                ? 'Scarcity-first v2.1'
                : draft.algorithm === 'scarcity_first_soft_target_v2'
                  ? 'Scarcity-first v2'
                  : (draft.algorithm ?? '—')}
            </span>
          </div>
        ) : null}

        {validation ? (
          <section className="dynamic-shadow-validation">
            <div className="dynamic-shadow-section-heading">
              <h4>Phase 8 · בדיקת איכות והשוואת שיבוץ</h4>
              <span>השוואה ברמת משמרת והסבר החלטות המנוע</span>
            </div>

            {validation.legacyNote ? (
              <div className="dynamic-shadow-validation-note">{validation.legacyNote}</div>
            ) : null}

            <div className="dynamic-shadow-metrics dynamic-shadow-validation-metrics">
              <div>
                <span>כיסוי משמרות חובה</span>
                <strong>{validation.metrics.coveredRequiredSlots}/{validation.metrics.totalSlots}</strong>
              </div>
              <div>
                <span>התאמה למערכת הקיימת</span>
                <strong>
                  {validation.metrics.matchPercent == null
                    ? '—'
                    : `${validation.metrics.matchPercent}%`}
                </strong>
              </div>
              <div>
                <span>משמרות שונות</span>
                <strong>{validation.metrics.differentSlots}</strong>
              </div>
              <div>
                <span>שיבוצי ״מעדיף״</span>
                <strong>{validation.metrics.preferredAssignments}</strong>
              </div>
              <div>
                <span>שיבוצי ״מעדיף שלא״</span>
                <strong>{validation.metrics.avoidAssignments}</strong>
              </div>
              <div>
                <span>מתחת למינימום</span>
                <strong>{validation.metrics.underMinimumWorkers}</strong>
              </div>
            </div>

            <div className="dynamic-shadow-validation-workers">
              <h4>מאזן עובדים</h4>
              {validation.workers.map((worker) => (
                <div key={worker.userId} className="dynamic-shadow-validation-worker">
                  <strong>{worker.displayName}</strong>
                  <span>
                    שובץ {worker.assigned} · מינ׳ {worker.minimum ?? '—'} · יעד {worker.target ?? '—'} · מקס׳ {worker.maximum ?? '—'}
                  </span>
                  <small>
                    מעדיף: {worker.preferredAssignments} · מעדיף שלא: {worker.avoidAssignments}
                    {worker.employmentScope
                      ? ` · ${worker.employmentScope === 'part_time' ? 'משרה חלקית' : 'משרה מלאה'}`
                      : ''}
                  </small>
                  {worker.underMinimum ? <b className="is-warning">מתחת למינימום</b> : null}
                  {!worker.underMinimum && worker.aboveTarget ? <b>מעל היעד — עדיין מועמד</b> : null}
                </div>
              ))}
            </div>

            <div className="dynamic-shadow-validation-slots">
              <h4>השוואה לפי משמרת</h4>
              {validation.slots.map((slot) => {
                // dynamicNames — דינמי.
                const dynamicNames = slot.dynamicAssignments.map((item) => item.displayName);
                // isDifferent — הנתון isDifferent בהקשר הפעולה.
                const isDifferent = slot.comparisonStatus !== 'match';
                return (
                  <details
                    key={slot.slotId}
                    className={`dynamic-shadow-validation-slot ${isDifferent ? 'is-different' : 'is-match'}`}
                  >
                    <summary>
                      <strong>{slot.date} · {slot.shiftName}</strong>
                      <span>{slot.comparisonStatus === 'match' ? '✓ התאמה' : slot.comparisonStatus === 'different' ? 'שונה' : 'ללא השוואה'}</span>
                    </summary>
                    <div className="dynamic-shadow-validation-compare">
                      <div>
                        <b>Dynamic Shadow</b>
                        <span>{dynamicNames.length ? dynamicNames.join(', ') : 'לא מאויש'}</span>
                      </div>
                      <div>
                        <b>מערכת קיימת</b>
                        <span>{slot.legacyAssignment?.displayName ?? (slot.legacyAssignment ? 'לא מאויש' : 'אין משמרת מקבילה')}</span>
                      </div>
                    </div>
                    {slot.dynamicAssignments.length ? (
                      <div className="dynamic-shadow-validation-reasons">
                        {slot.dynamicAssignments.map((assignment) => (
                          <div key={assignment.userId}>
                            <strong>{assignment.displayName}</strong>
                            <span>ציון: {Number(assignment.score).toFixed(1)}</span>
                            <ul>
                              {assignment.reasons.map((reason) => <li key={reason}>{reason}</li>)}
                            </ul>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p>המנוע לא הצליח לאייש את המשמרת. ראה פירוט אבחון החוסרים בהמשך.</p>
                    )}
                  </details>
                );
              })}
            </div>
          </section>
        ) : null}

        {diagnostics ? (
          <section className="dynamic-shadow-diagnostics">
            <div className="dynamic-shadow-section-heading">
              <h4>פירוט עמדות חובה שלא כוסו</h4>
              <span>
                {diagnostics.unfilledSlots.length
                  ? 'לכל משמרת מוצגת סיבת הפסילה של כל עובד'
                  : 'כל עמדות החובה כוסו'}
              </span>
            </div>
            {diagnostics.unfilledSlots.length ? (
              diagnostics.unfilledSlots.map((slot) => (
                <details className="dynamic-shadow-diagnostic-slot" key={slot.slotId}>
                  <summary>
                    <strong>
                      {slot.date} · {slot.shiftName}
                    </strong>
                    <span dir="ltr">
                      {slot.startTime.slice(0, 5)}–{slot.endTime.slice(0, 5)}
                    </span>
                    <b>{slot.unfilledPositions} חסר</b>
                  </summary>
                  {slot.assignedNames.length ? (
                    <p>כבר שובצו: {slot.assignedNames.join(', ')}</p>
                  ) : (
                    <p>לא שובץ עובד לעמדת החובה.</p>
                  )}
                  <div className="dynamic-shadow-diagnostic-candidates">
                    {slot.candidates.map((candidate) => (
                      <div
                        key={candidate.userId}
                        className={candidate.eligible ? 'is-eligible' : ''}
                      >
                        <strong>{candidate.displayName}</strong>
                        <span>{candidate.reason}</span>
                        <small>
                          {candidate.availabilityStatus === 'preferred'
                            ? 'מעדיף'
                            : candidate.availabilityStatus === 'available'
                              ? 'זמין'
                              : candidate.availabilityStatus === 'avoid'
                                ? 'מעדיף שלא'
                                : candidate.availabilityStatus === 'unavailable'
                                  ? 'לא זמין'
                                  : 'ללא סימון'}
                          {candidate.employmentScope
                            ? ` · ${candidate.employmentScope === 'part_time' ? 'חלקית' : 'מלאה'}`
                            : ''}
                          {' · '}שובץ {candidate.assigned}
                          {candidate.maximum != null ? `/${candidate.maximum}` : ''}
                        </small>
                      </div>
                    ))}
                  </div>
                </details>
              ))
            ) : (
              <div className="dynamic-shadow-success">✓ כל עמדות החובה כוסו בטיוטה.</div>
            )}
          </section>
        ) : null}
      </div>
    </Modal>
  );
}

export default DynamicSchedulingShadowTester;
