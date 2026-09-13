import { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  CircleX,
  RefreshCw,
} from 'lucide-react';

import { dynamicPilotQaService } from '../../services/dynamicPilotQaService';
import type {
  DynamicPilotQaCheck,
  DynamicPilotQaReport,
} from '../../types/dynamicPilotQa';

const sourceLabels = {
  dispatcher: 'מוקדנים Legacy',
  on_call: 'כוננים Legacy',
  morning_driver: 'כונני בוקר Legacy',
} as const;

const statusLabels = {
  pass: 'עבר',
  warn: 'לבדיקה',
  fail: 'נכשל',
} as const;

function DynamicPilotQaPanel() {
  const [report, setReport] = useState<DynamicPilotQaReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runReport = async () => {
    setLoading(true);
    setError(null);
    try {
      setReport(await dynamicPilotQaService.getReport());
    } catch (reportError) {
      setError(reportError instanceof Error ? reportError.message : 'בדיקת הפיילוט נכשלה');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dynamic-pilot-qa" dir="rtl">
      <div className="dynamic-pilot-qa-intro">
        <div>
          <strong>בדיקה אוטומטית לפני QA ידני</strong>
          <p>
            הבדיקה אינה משנה נתונים. היא מחפשת בעיות מבניות ב-Cutover, שיוכים, אילוצים,
            לוחות מפורסמים וחילופים, ובודקת בנפרד את התאמת מיגרציית GVK.
          </p>
        </div>
        <button
          type="button"
          className="button button-primary"
          disabled={loading}
          onClick={() => void runReport()}
        >
          <RefreshCw size={17} className={loading ? 'spin' : undefined} />
          {loading ? 'מריץ בדיקות…' : 'הרץ בדיקת מערכת'}
        </button>
      </div>

      {error ? <div className="settings-error" role="alert">{error}</div> : null}

      {report ? (
        <>
          <div className={report.readyForFullQa ? 'dynamic-pilot-qa-banner ready' : 'dynamic-pilot-qa-banner blocked'}>
            {report.readyForFullQa ? <CheckCircle2 size={20} /> : <CircleX size={20} />}
            <div>
              <strong>{report.readyForFullQa ? 'מוכן ל-QA ידני מלא' : 'נמצאו Blockers לפני QA מלא'}</strong>
              <span>
                עברו {report.summary.passes} · לבדיקה {report.summary.warnings} · נכשלו {report.summary.failures}
              </span>
            </div>
          </div>

          <div className="dynamic-pilot-qa-metrics">
            <Metric label="Job Types פעילים" value={report.summary.activeJobTypes} />
            <Metric label="משתמשים דינמיים" value={report.summary.dynamicUsers} />
            <Metric label="Memberships פעילים" value={report.summary.activeMemberships} />
            <Metric label="לוחות מפורסמים" value={report.summary.publications} />
            <Metric label="שיבוצים דינמיים" value={report.summary.assignments} />
            <Metric label="חילופים ממתינים" value={report.summary.pendingExchanges} />
          </div>

          <div className="dynamic-pilot-qa-checks">
            {report.checks.map((check) => <QaCheckRow key={check.code} check={check} />)}
          </div>

          {report.gvkReconciliation.length > 0 ? (
            <div className="dynamic-pilot-qa-reconciliation">
              <div className="dynamic-pilot-qa-heading">
                <h3>התאמת מיגרציית GVK – חודשים חיים</h3>
                <p>הכיסוי הדינמי כולל שיבוצים מאוישים + משמרות שסומנו במפורש כלא מאוישות.</p>
              </div>
              <div className="dynamic-pilot-qa-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>מקור</th><th>חודש</th><th>Legacy</th><th>דינמי מאויש</th>
                      <th>לא מאויש</th><th>כיסוי</th><th>מצב</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.gvkReconciliation.map((row) => (
                      <tr key={`${row.source}-${row.year}-${row.month}`}>
                        <td>{sourceLabels[row.source]}</td>
                        <td>{String(row.month).padStart(2, '0')}/{row.year}</td>
                        <td>{row.legacyCount}</td>
                        <td>{row.dynamicAssignedCount}</td>
                        <td>{row.dynamicUnassignedCount}</td>
                        <td>{row.coveredCount}</td>
                        <td>{row.matches ? 'תואם' : 'פער'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="dynamic-pilot-qa-metric"><strong>{value}</strong><span>{label}</span></div>;
}

function QaCheckRow({ check }: { check: DynamicPilotQaCheck }) {
  const Icon = check.status === 'pass' ? CheckCircle2 : check.status === 'warn' ? AlertTriangle : CircleX;
  return (
    <div className={`dynamic-pilot-qa-check ${check.status}`}>
      <Icon size={19} aria-hidden="true" />
      <div>
        <div className="dynamic-pilot-qa-check-title">
          <strong>{check.title}</strong>
          <span>{statusLabels[check.status]}{check.count > 0 ? ` · ${check.count}` : ''}</span>
        </div>
        <p>{check.message}</p>
      </div>
    </div>
  );
}

export default DynamicPilotQaPanel;
