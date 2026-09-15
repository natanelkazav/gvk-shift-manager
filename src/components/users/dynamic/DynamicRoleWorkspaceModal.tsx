import {
  Archive,
  CalendarDays,
  DatabaseBackup,
  LoaderCircle,
  UsersRound,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { dynamicSchedulingService } from '../../../services/dynamicSchedulingService';
import type { DynamicJobType, DynamicRoleWorkspace } from '../../../types/dynamicScheduling';
import { Button, Modal } from '../../ui';
import DynamicPeriodWorkflowPanel from './DynamicPeriodWorkflowPanel';
import DynamicMonthlyRotationPanel from './DynamicMonthlyRotationPanel';

interface DynamicRoleWorkspaceModalProps {
  jobType: DynamicJobType;
  onClose: () => void;
}

type WorkspaceTab = 'overview' | 'workflow' | 'rotation' | 'history';

const monthLabel = (year: number, month: number): string =>
  new Intl.DateTimeFormat('he-IL', { month: 'long', year: 'numeric' }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  );

function DynamicRoleWorkspaceModal({ jobType, onClose }: DynamicRoleWorkspaceModalProps) {
  const [workspace, setWorkspace] = useState<DynamicRoleWorkspace | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<WorkspaceTab>('overview');

  const load = async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      setWorkspace(await dynamicSchedulingService.getRoleWorkspace(jobType.id));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'טעינת ניהול התפקיד נכשלה.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [jobType.id]);



  return (
    <Modal
      isOpen
      title={`ניהול תפקיד · ${jobType.name}`}
      className="dynamic-role-workspace-modal"
      onClose={onClose}
      footer={<Button variant="secondary" onClick={onClose}>סגור</Button>}
    >
      <div className="dynamic-role-workspace">
        <div className="dynamic-role-workspace-tabs" role="tablist" aria-label="ניהול תפקיד">
          <button type="button" className={tab === 'overview' ? 'is-active' : ''} onClick={() => setTab('overview')}>סקירה</button>
          <button type="button" className={tab === 'workflow' ? 'is-active' : ''} onClick={() => setTab('workflow')}>ניהול תקופה</button>
          {jobType.schedulingStrategy === 'monthly_rotation_constraints' ? (
            <button type="button" className={tab === 'rotation' ? 'is-active' : ''} onClick={() => setTab('rotation')}>סבב חודשי</button>
          ) : null}
          <button type="button" className={tab === 'history' ? 'is-active' : ''} onClick={() => setTab('history')}>היסטוריה</button>
        </div>

        {isLoading ? (
          <div className="dynamic-job-types-loading"><LoaderCircle className="spin" size={19} /> טוען ניהול תפקיד…</div>
        ) : error ? (
          <div className="users-error" role="alert">{error}<Button variant="secondary" onClick={() => void load()}>נסה שוב</Button></div>
        ) : workspace ? (
          <>
            {tab === 'overview' ? (
              <div className="dynamic-role-workspace-overview">
                <div className="dynamic-role-workspace-metrics">
                  <div><UsersRound size={18} /><strong>{workspace.memberCount}</strong><span>עובדים משויכים</span></div>
                  <div><CalendarDays size={18} /><strong>{workspace.materializationCount}</strong><span>גרסאות חודש ממומשות</span></div>
                  <div><Archive size={18} /><strong>{workspace.historicalTotals.periods}</strong><span>תקופות היסטוריות</span></div>
                  <div><DatabaseBackup size={18} /><strong>{workspace.historicalTotals.assignments}</strong><span>שיבוצים היסטוריים</span></div>
                </div>
                <div className="dynamic-role-workspace-summary-card">
                  <h4>סקירת התפקיד</h4>
                  <p>כאן ניתן לראות את העובדים המשויכים, התקופות הממומשות וההיסטוריה של התפקיד. ניהול התקופה מתבצע לפי <code>job_type_id</code> ובהתאם להגדרות התפקיד.</p>
                </div>
              </div>
            ) : null}

            {tab === 'workflow' ? (
              <DynamicPeriodWorkflowPanel jobType={jobType} />
            ) : null}

            {tab === 'rotation' && jobType.schedulingStrategy === 'monthly_rotation_constraints' ? (
              <DynamicMonthlyRotationPanel jobType={jobType} />
            ) : null}

            {tab === 'history' ? (
              <div className="dynamic-role-history-list">
                <div className="dynamic-role-history-total">
                  <strong>{workspace.historicalTotals.periods} תקופות · {workspace.historicalTotals.assignments} שיבוצים · {workspace.historicalTotals.availability} אילוצים</strong>
                  <span>הנתונים מוצגים מהטבלאות הדינמיות, לא מה־Legacy.</span>
                </div>
                {workspace.periods.length ? workspace.periods.map((period) => (
                  <article key={period.id} className="dynamic-role-history-period">
                    <div className="dynamic-role-history-period-head">
                      <div><strong>{monthLabel(period.year, period.month)}</strong><span>{period.sourceStatus ?? 'ללא סטטוס'} · מקור: {period.sourceKind}</span></div>
                      <span className="dynamic-history-imported-badge">יובא</span>
                    </div>
                    <div className="dynamic-role-history-period-stats">
                      <span>{period.assignments} שיבוצים</span>
                      <span>{period.availability} אילוצים</span>
                      <span>{period.assignedUsers.length} עובדים בשיבוצים</span>
                    </div>
                    {period.assignedUsers.length ? (
                      <div className="dynamic-role-history-users">{period.assignedUsers.map((user) => <span key={user.userId}>{user.displayName}</span>)}</div>
                    ) : null}
                  </article>
                )) : <p className="dynamic-empty-note">עדיין אין היסטוריה דינמית לתפקיד הזה.</p>}
              </div>
            ) : null}

          </>
        ) : null}
      </div>
    </Modal>
  );
}

export default DynamicRoleWorkspaceModal;
