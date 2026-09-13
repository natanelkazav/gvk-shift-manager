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

const emptyMappings: GvkLegacyMigrationMappings = {
  dispatcher: '',
  on_call: '',
  morning_driver: '',
};

const sourceLabels = {
  dispatcher: 'מערכת מוקדנים הישנה',
  on_call: 'מערכת כוננים הישנה',
  morning_driver: 'מערכת כונני בוקר הישנה',
} as const;

function GvkLegacyMigrationPanel() {
  const [jobTypes, setJobTypes] = useState<DynamicJobType[]>([]);
  const [mappings, setMappings] = useState<GvkLegacyMigrationMappings>(emptyMappings);
  const [preview, setPreview] = useState<GvkLegacyMigrationPreview | null>(null);
  const [result, setResult] = useState<GvkLegacyMigrationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  useEffect(() => {
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

  const mappingComplete = useMemo(
    () => Object.values(mappings).every(Boolean),
    [mappings],
  );

  const updateMapping = (source: keyof GvkLegacyMigrationMappings, jobTypeId: string) => {
    setMappings((current) => ({ ...current, [source]: jobTypeId }));
    setPreview(null);
    setResult(null);
    setError(null);
  };

  const handlePreview = async () => {
    if (!mappingComplete) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      setPreview(await gvkLegacyMigrationService.preview(mappings));
    } catch (previewError) {
      setError(previewError instanceof Error ? previewError.message : 'בדיקת המיגרציה נכשלה');
    } finally {
      setRunning(false);
    }
  };

  const handleRun = async () => {
    if (!preview?.ready) return;
    const confirmed = window.confirm(
      'להעתיק את נתוני GVK הישנים לתפקידי היעד שנבחרו? הפעולה אינה מוחקת Legacy ואינה מפעילה Cutover.',
    );
    if (!confirmed) return;

    setRunning(true);
    setError(null);
    try {
      const migrationResult = await gvkLegacyMigrationService.run(mappings);
      setResult(migrationResult);
      setPreview(await gvkLegacyMigrationService.preview(mappings));
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : 'הרצת המיגרציה נכשלה');
    } finally {
      setRunning(false);
    }
  };

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

function MigrationArea({
  title,
  data,
}: {
  title: string;
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
