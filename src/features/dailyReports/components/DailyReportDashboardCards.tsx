import { useEffect, useMemo, useState } from 'react';
import { CircleCheck, ClipboardCheck, Paperclip, Plus, Send, Trash2, X } from 'lucide-react';
import { dailyReportService } from '../../../services/dailyReportService';
import type { DailyReportItemInput, DailyReportWorkspace } from '../../../types/dailyReports';
import { Button, Input, Modal, Textarea } from '../../../components/ui';

const emptyItem = (): DailyReportItemInput => ({
  subjectId: null,
  subjectName: '',
  customerId: null,
  customerName: null,
  details: '',
});

function DailyReportDashboardCards() {
  const [workspace, setWorkspace] = useState<DailyReportWorkspace | null>(null);
  const [selectedJobTypeId, setSelectedJobTypeId] = useState<string | null>(null);
  const [items, setItems] = useState<DailyReportItemInput[]>([emptyItem()]);
  const [newSubject, setNewSubject] = useState('');
  const [newCustomer, setNewCustomer] = useState('');
  const [busy, setBusy] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoadError(null);
      setWorkspace(await dailyReportService.getMyWorkspace());
    } catch (error) {
      setWorkspace(null);
      setLoadError(error instanceof Error ? error.message : 'טעינת אזור הדיווח נכשלה.');
    }
  };

  useEffect(() => { void load(); }, []);

  const role = useMemo(
    () => workspace?.roles.find((item) => item.jobTypeId === selectedJobTypeId) ?? null,
    [workspace, selectedJobTypeId],
  );

  if (loadError) {
    return (
      <section className="dashboard-card daily-report-card">
        <div className="dashboard-card-header">
          <div className="dashboard-card-title-wrap">
            <div className="dashboard-card-icon"><ClipboardCheck size={19} /></div>
            <div><h2>דיווח עבודה יומי</h2><span className="dynamic-dashboard-role-meta">לא ניתן לטעון את אזור הדיווח</span></div>
          </div>
        </div>
        <div className="dashboard-card-body">
          <p className="dynamic-dashboard-description">{loadError}</p>
          <Button type="button" variant="secondary" onClick={() => void load()}>נסה שוב</Button>
        </div>
      </section>
    );
  }
  if (!workspace || workspace.roles.length === 0) return null;

  const updateItem = (index: number, patch: Partial<DailyReportItemInput>) => {
    setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  };

  const addSubject = async () => {
    if (!role || !newSubject.trim()) return;
    setBusy(true);
    try {
      const created = await dailyReportService.addSubject(role.jobTypeId, newSubject.trim());
      await load();
      updateItem(0, { subjectId: created.id, subjectName: created.name });
      setNewSubject('');
    } finally { setBusy(false); }
  };

  const addCustomer = async () => {
    if (!newCustomer.trim()) return;
    setBusy(true);
    try {
      const created = await dailyReportService.addCustomer(newCustomer.trim());
      await load();
      updateItem(0, { customerId: created.id, customerName: created.name });
      setNewCustomer('');
    } finally { setBusy(false); }
  };

  const submit = async () => {
    if (!role) return;
    const clean = items
      .map((item) => ({ ...item, subjectName: item.subjectName.trim(), details: item.details.trim() }))
      .filter((item) => item.subjectName && item.details);
    if (clean.length === 0) {
      setMessage('יש להוסיף לפחות פעילות אחת עם נושא ופירוט.');
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      let preparedReportId: string | undefined;
      if (role.allowAttachments && attachments.length > 0) {
        preparedReportId = await dailyReportService.prepareUpload(role.jobTypeId);
        for (const file of attachments) {
          await dailyReportService.uploadAttachment(preparedReportId, file);
        }
      }
      await dailyReportService.submit(role.jobTypeId, clean, preparedReportId);
      setItems([emptyItem()]);
      setAttachments([]);
      setSelectedJobTypeId(null);
      setSuccessMessage('הדיווח נשלח בהצלחה.');
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'שליחת הדיווח נכשלה.');
    } finally { setBusy(false); }
  };

  return (
    <>
      {successMessage ? (
        <div className="daily-report-success-banner" role="status">
          <CircleCheck size={18} /> <span>{successMessage}</span>
          <button type="button" onClick={() => setSuccessMessage(null)} aria-label="סגור"><X size={15} /></button>
        </div>
      ) : null}
      <div className="dynamic-dashboard-role-grid">
        {workspace.roles.map((item) => (
          <section className="dashboard-card daily-report-card" key={item.jobTypeId}>
            <div className="dashboard-card-header">
              <div className="dashboard-card-title-wrap">
                <div className="dashboard-card-icon"><ClipboardCheck size={19} /></div>
                <div>
                  <h2>{item.jobTypeName}</h2>
                  <span className="dynamic-dashboard-role-meta">דיווח עבודה יומי</span>
                </div>
              </div>
              {item.todayReport?.status === 'submitted'
                ? <span className="dashboard-status-badge dashboard-status-active">נשלח היום ✓</span>
                : <span className="dashboard-status-badge">טרם נשלח</span>}
            </div>
            <div className="dashboard-card-body">
              <p className="dynamic-dashboard-description">
                {item.todayReport
                  ? `הדיווח של היום כולל ${item.todayReport.itemCount} פעילויות. ניתן לשלוח גרסה מעודכנת.`
                  : 'רכז את הפעילויות שביצעת היום ושלח אותן למנהל.'}
              </p>
            </div>
            <div className="dashboard-card-footer dynamic-dashboard-actions">
              <button type="button" onClick={() => {
                setSelectedJobTypeId(item.jobTypeId);
                setItems([emptyItem()]);
                setAttachments([]);
                setMessage(null);
              }}>
                {item.todayReport ? 'עדכן דיווח יומי' : 'צור דיווח יומי'}
              </button>
            </div>
          </section>
        ))}
      </div>

      {role ? (
        <Modal isOpen title={`דיווח יומי · ${role.jobTypeName}`} onClose={() => setSelectedJobTypeId(null)}>
          <div className="daily-report-form">
            {items.map((item, index) => (
              <section className="daily-report-item" key={index}>
                <div className="daily-report-item-heading">
                  <strong>פעילות {index + 1}</strong>
                  {items.length > 1 ? (
                    <button type="button" onClick={() => setItems((current) => current.filter((_, i) => i !== index))}>
                      <Trash2 size={16} /> הסר
                    </button>
                  ) : null}
                </div>

                <label>
                  <span>נושא</span>
                  <select value={item.subjectId ?? ''} onChange={(event) => {
                    const option = role.subjects.find((subject) => subject.id === event.target.value);
                    updateItem(index, { subjectId: option?.id ?? null, subjectName: option?.name ?? '' });
                  }}>
                    <option value="">בחר נושא</option>
                    {role.subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
                  </select>
                </label>

                <label>
                  <span>לקוח</span>
                  <select value={item.customerId ?? ''} onChange={(event) => {
                    const option = workspace.customers.find((customer) => customer.id === event.target.value);
                    updateItem(index, { customerId: option?.id ?? null, customerName: option?.name ?? null });
                  }}>
                    <option value="">ללא לקוח / בחר לקוח</option>
                    {workspace.customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
                  </select>
                </label>

                <Textarea label="מה בוצע?" value={item.details} onChange={(event) => updateItem(index, { details: event.target.value })} />
              </section>
            ))}

            <Button type="button" variant="secondary" onClick={() => setItems((current) => [...current, emptyItem()])}>
              <Plus size={16} /> הוסף פעילות
            </Button>

            {role.allowAddSubjects ? (
              <div className="daily-report-inline-create">
                <Input label="נושא חדש" value={newSubject} onChange={(event) => setNewSubject(event.target.value)} />
                <Button type="button" variant="secondary" disabled={busy || !newSubject.trim()} onClick={() => void addSubject()}>הוסף נושא</Button>
              </div>
            ) : null}

            {role.allowAddCustomers ? (
              <div className="daily-report-inline-create">
                <Input label="לקוח חדש" value={newCustomer} onChange={(event) => setNewCustomer(event.target.value)} />
                <Button type="button" variant="secondary" disabled={busy || !newCustomer.trim()} onClick={() => void addCustomer()}>הוסף לקוח</Button>
              </div>
            ) : null}

            {role.allowAttachments ? (
              <section className="daily-report-attachments">
                <div className="daily-report-attachments-title">
                  <Paperclip size={18} />
                  <div><strong>טפסים וקבצים מצורפים</strong><small>PDF, תמונות, Word או Excel · עד 10MB לקובץ</small></div>
                </div>
                <label className="daily-report-file-picker">
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx"
                    onChange={(event) => {
                      const selected = Array.from(event.target.files ?? []).filter((file) => file.size <= 10 * 1024 * 1024);
                      setAttachments((current) => [...current, ...selected].slice(0, 10));
                      event.currentTarget.value = '';
                    }}
                  />
                  <Paperclip size={16} /> צרף קבצים
                </label>
                {attachments.length > 0 ? (
                  <div className="daily-report-file-list">
                    {attachments.map((file, index) => (
                      <div key={`${file.name}-${index}`}>
                        <span>{file.name} · {(file.size / 1024 / 1024).toFixed(1)}MB</span>
                        <button type="button" onClick={() => setAttachments((current) => current.filter((_, i) => i !== index))}><X size={15} /></button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </section>
            ) : null}

            {message ? <div className="daily-report-message">{message}</div> : null}

            <div className="daily-report-submit">
              <Button type="button" disabled={busy} onClick={() => void submit()}>
                <Send size={16} /> שלח דיווח יומי
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}
    </>
  );
}

export default DailyReportDashboardCards;
