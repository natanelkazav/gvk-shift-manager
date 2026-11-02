/**
 * קובץ: src/components/settings/GvkLegacyMigrationPanel.tsx
 * מטרה: הצגת כלי ניהול לתצוגה מקדימה ולביצוע מעבר נתונים ותיקים.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: GvkLegacyMigrationPanel, MigrationArea.
 * - קישור מאפיינים ומצב מקומי לתצוגה ולטיפול בפעולות המשתמש.
 */
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight, CheckCircle2, LoaderCircle, ShieldAlert } from 'lucide-react';

import { dynamicSchedulingService } from '../../services/dynamicSchedulingService';
import { gvkLegacyMigrationService } from '../../services/gvkLegacyMigrationService';
import type { DynamicJobType } from '../../types/dynamicScheduling';
import type {
  GvkLegacyMigrationMappings,
  GvkLegacyMigrationPreview,
  GvkLegacyMigrationResult,
} from '../../types/gvkLegacyMigration';

// emptyMappings — הנתון emptyMappings בהקשר הפעולה.
const emptyMappings: GvkLegacyMigrationMappings = {
  dispatcher: '',
  on_call: '',
  morning_driver: '',
};

// sourceLabels — מקור.
const sourceLabels = {
  dispatcher: 'מערכת מוקדנים הישנה',
  on_call: 'מערכת כוננים הישנה',
  morning_driver: 'מערכת כונני בוקר הישנה',
} as const;

/**
 * פעולה GvkLegacyMigrationPanel: הנתון GvkLegacyMigrationPanel בהקשר הפעולה.
 */
function GvkLegacyMigrationPanel() {
  // מצב מקומי: jobTypes — סוגי תפקידים; setJobTypes מעדכנת אותו ומפעילה רינדור לפי React.
  const [jobTypes, setJobTypes] = useState<DynamicJobType[]>([]);
  // מצב מקומי: mappings — הנתון mappings בהקשר הפעולה; setMappings מעדכנת אותו ומפעילה רינדור לפי React.
  const [mappings, setMappings] = useState<GvkLegacyMigrationMappings>(emptyMappings);
  // מצב מקומי: preview — הנתון preview בהקשר הפעולה; setPreview מעדכנת אותו ומפעילה רינדור לפי React.
  const [preview, setPreview] = useState<GvkLegacyMigrationPreview | null>(null);
  // מצב מקומי: result — תוצאה; setResult מעדכנת אותו ומפעילה רינדור לפי React.
  const [result, setResult] = useState<GvkLegacyMigrationResult | null>(null);
  // מצב מקומי: error — שגיאה; setError מעדכנת אותו ומפעילה רינדור לפי React.
  const [error, setError] = useState<string | null>(null);
  // מצב מקומי: loading — טעינה; setLoading מעדכנת אותו ומפעילה רינדור לפי React.
  const [loading, setLoading] = useState(true);
  // מצב מקומי: running — הנתון running בהקשר הפעולה; setRunning מעדכנת אותו ומפעילה רינדור לפי React.
  const [running, setRunning] = useState(false);

  // תופעת לוואי לאחר רינדור בהתאם לתלויות [].
  useEffect(() => {
    // active — פעיל.
    let active = true;
    void dynamicSchedulingService.getAdminData()
      .then((data) => {
        if (!active) return;
        setJobTypes(data.jobTypes.filter((jobType) => jobType.isActive));
      })
      .catch((loadError: unknown) => {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : 'טעינת התפקידים הדינמיים נכשלה');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  // ערך מחושב mappingComplete — הנתון mappingComplete בהקשר הפעולה; נשמר בין רינדורים עד שינוי התלויות.
  const mappingComplete = useMemo(
    () => Object.values(mappings).every(Boolean),
    [mappings],
  );

  /**
   * פעולה updateMapping: עדכון הנתון updateMapping בהקשר הפעולה.
   * @param source — מקור.
   * @param jobTypeId — מזהה סוג התפקיד.
   */
  const updateMapping = (source: keyof GvkLegacyMigrationMappings, jobTypeId: string) => {
    setMappings((current) => ({ ...current, [source]: jobTypeId }));
    setPreview(null);
    setResult(null);
    setError(null);
  };

  /**
   * פעולה אסינכרונית handlePreview: טיפול באירוע עבור הנתון handlePreview בהקשר הפעולה.
   */
  const handlePreview = async () => {
    if (!mappingComplete) return;
    setRunning(true);
    setError(null);
    setResult(null);
    // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
    try {
      setPreview(await gvkLegacyMigrationService.preview(mappings));
    } catch (previewError) {
      setError(previewError instanceof Error ? previewError.message : 'בדיקת המיגרציה נכשלה');
    } finally {
      setRunning(false);
    }
  };

  /**
   * פעולה אסינכרונית handleRun: טיפול באירוע עבור הנתון handleRun בהקשר הפעולה.
   */
  const handleRun = async () => {
    if (!preview?.ready) return;
    const confirmed = window.confirm(
      'להעתיק את נתוני GVK הישנים לתפקידי היעד שנבחרו? הפעולה אינה מוחקת Legacy ואינה מפעילה Cutover.',
    );
    if (!confirmed) return;

    setRunning(true);
    setError(null);
    // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
    try {
      // migrationResult — תוצאה.
      const migrationResult = await gvkLegacyMigrationService.run(mappings);
      setResult(migrationResult);
      setPreview(await gvkLegacyMigrationService.preview(mappings));
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : 'הרצת המיגרציה נכשלה');
    } finally {
      setRunning(false);
    }
  };

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר loading.
  if (loading) {
    return <div className="gvk-migration-loading"><LoaderCircle size={18} className="spin" /> טוען תפקידים דינמיים…</div>;
  }

  return (
    <div className="gvk-migration-panel">
      <div className="gvk-migration-callout">
        <ShieldAlert size={20} aria-hidden="true" />
        <div>
          <strong>כלי מעבר חד-פעמי לפיילוט GVK</strong>
          <p>
            שמות המקור מוקדן/כונן/כונן בוקר קיימים רק ב-Adapter הזה. תפקיד היעד הוא Job Type דינמי רגיל,
            והמערכת החדשה אינה מקבלת התנהגות לפי שם התפקיד הישן.
          </p>
        </div>
      </div>

      <div className="gvk-migration-map-list">
        {(Object.keys(sourceLabels) as Array<keyof GvkLegacyMigrationMappings>).map((source) => (
          <label className="gvk-migration-map-row" key={source}>
            <span>{sourceLabels[source]}</span>
            <ArrowLeftRight size={17} aria-hidden="true" />
            <select value={mappings[source]} onChange={(event) => updateMapping(source, event.target.value)}>
              <option value="">בחר תפקיד דינמי יעד</option>
              {jobTypes.map((jobType) => (
                <option key={jobType.id} value={jobType.id}>{jobType.name} ({jobType.code})</option>
              ))}
            </select>
          </label>
        ))}
      </div>

      <div className="gvk-migration-actions">
        <button type="button" className="button button-secondary" disabled={!mappingComplete || running} onClick={() => void handlePreview()}>
          {running ? 'בודק…' : 'תצוגה מקדימה'}
        </button>
        <button type="button" className="button button-primary" disabled={!preview?.ready || running || Boolean(result)} onClick={() => void handleRun()}>
          העתק נתונים למערכת הדינמית
        </button>
      </div>

      {error ? <div className="gvk-migration-error">{error}</div> : null}

      {preview ? (
        <div className="gvk-migration-preview">
          <div className={preview.ready ? 'gvk-migration-status ready' : 'gvk-migration-status blocked'}>
            {preview.ready ? <CheckCircle2 size={18} /> : <ShieldAlert size={18} />}
            {preview.ready ? 'המיגרציה מוכנה להרצה' : 'נמצאו חסמים שיש לפתור לפני ההרצה'}
          </div>

          <div className="gvk-migration-summary-grid">
            <MigrationArea title="מוקדנים" data={preview.legacy.dispatcher} />
            <MigrationArea title="כוננים" data={preview.legacy.onCall} />
            <MigrationArea title="כונני בוקר" data={preview.legacy.morningDriver} />
          </div>

          {preview.blockers.length > 0 ? (
            <div className="gvk-migration-issues blockers">
              {preview.blockers.map((item) => <p key={item.code}>{item.message}</p>)}
            </div>
          ) : null}
          {preview.warnings.length > 0 ? (
            <div className="gvk-migration-issues warnings">
              {preview.warnings.map((item) => <p key={item.code}>{item.message}</p>)}
            </div>
          ) : null}
        </div>
      ) : null}

      {result ? (
        <div className="gvk-migration-result">
          <CheckCircle2 size={20} aria-hidden="true" />
          <div>
            <strong>ההעתקה הושלמה</strong>
            <p>{result.message}</p>
            <p>חברים שנוספו: {result.membersAdded} · תקופות פעילות: {result.livePeriodsAdded} · שיבוצים: {result.liveAssignmentsAdded}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * פעולה MigrationArea: הנתון MigrationArea בהקשר הפעולה.
 * פרמטר מפורק — שדות הקלט נגישים מקומית בשמות המוגדרים בחתימה.
 */
function MigrationArea({
  title,
  data,
}: {
  // title — כותרת.
  title: string;
  // data — נתונים.
  data: GvkLegacyMigrationPreview['legacy']['dispatcher'];
}) {
  return (
    <div className="gvk-migration-summary-card">
      <strong>{title}</strong>
      <span>{data.members} משתמשים</span>
      <span>{data.historicalPeriods} חודשים היסטוריים</span>
      <span>{data.livePeriods} חודשים נוכחיים/עתידיים</span>
      <span>{data.liveAssignments} שיבוצים חיים</span>
    </div>
  );
}

export default GvkLegacyMigrationPanel;
