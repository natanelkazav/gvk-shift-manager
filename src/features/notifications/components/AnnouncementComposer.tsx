import { useEffect, useMemo, useState } from 'react';
import { Megaphone, Send } from 'lucide-react';
import { announcementService, type AnnouncementRecipientCatalog } from '../services/announcementService';

function defaultExpiry(): string {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

export default function AnnouncementComposer() {
  const [catalog, setCatalog] = useState<AnnouncementRecipientCatalog>({ users: [], jobTypes: [] });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [priority, setPriority] = useState('normal');
  const [expiresAt, setExpiresAt] = useState(defaultExpiry);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => { void announcementService.getRecipientCatalog().then(setCatalog).catch((e: unknown) => setError(e instanceof Error ? e.message : 'טעינת הנמענים נכשלה.')); }, []);
  const allSelected = catalog.users.length > 0 && selected.size === catalog.users.length;
  const selectedNames = useMemo(() => catalog.users.filter((user) => selected.has(user.id)), [catalog.users, selected]);

  const toggleUsers = (ids: string[]) => setSelected((current) => {
    const next = new Set(current);
    const shouldAdd = ids.some((id) => !next.has(id));
    ids.forEach((id) => shouldAdd ? next.add(id) : next.delete(id));
    return next;
  });

  const submit = async () => {
    setError(null); setSuccess(null);
    if (!title.trim() || !body.trim() || selected.size === 0) { setError('יש לבחור נמענים ולהזין כותרת ותוכן.'); return; }
    if (!expiresAt || new Date(expiresAt).getTime() <= Date.now()) { setError('יש לבחור תוקף עתידי לעדכון.'); return; }
    setBusy(true);
    try {
      const count = await announcementService.send({ userIds: [...selected], title, body, priority, expiresAt: new Date(expiresAt).toISOString() });
      setSuccess(`העדכון נשלח ל־${count} משתמשים.`); setTitle(''); setBody('');
    } catch (e) { setError(e instanceof Error ? e.message : 'שליחת העדכון נכשלה.'); }
    finally { setBusy(false); }
  };

  return <section className="announcement-composer">
    <div className="announcement-composer-heading"><Megaphone size={22}/><div><h2>שליחת הודעה / עדכון</h2><p>העדכון יופיע במרכז ההתראות ויישלח גם ב־Push למכשירים הרשומים.</p></div></div>
    <div className="announcement-form-grid">
      <label>כותרת<input maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="לדוגמה: עדכון שעות פתיחה וסגירה" /></label>
      <label>חשיבות<select value={priority} onChange={(e) => setPriority(e.target.value)}><option value="normal">רגיל</option><option value="important">חשוב</option><option value="urgent">דחוף</option></select></label>
      <label className="announcement-wide">תוכן<textarea maxLength={500} rows={5} value={body} onChange={(e) => setBody(e.target.value)} placeholder="מה העובדים צריכים לדעת?" /></label>
      <label>רלוונטי עד<input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} /></label>
    </div>
    <div className="announcement-recipients"><h3>מי יקבל את העדכון?</h3>
      <div className="announcement-recipient-groups">
        <button type="button" className={allSelected ? 'active' : ''} onClick={() => setSelected(allSelected ? new Set() : new Set(catalog.users.map((u) => u.id)))}>כל המשתמשים הפעילים</button>
        {catalog.jobTypes.map((job) => <button type="button" key={job.id} onClick={() => toggleUsers(job.userIds)}>{job.name}</button>)}
      </div>
      <details><summary>בחירת עובדים ספציפיים ({selected.size})</summary><div className="announcement-user-list">{catalog.users.map((user) => <label key={user.id}><input type="checkbox" checked={selected.has(user.id)} onChange={() => toggleUsers([user.id])}/><span>{user.name}</span></label>)}</div></details>
      {selectedNames.length > 0 ? <p className="announcement-selection-summary">נבחרו {selectedNames.length} נמענים.</p> : null}
    </div>
    {error ? <div className="notifications-page-message notifications-page-error">{error}</div> : null}
    {success ? <div className="notifications-page-message notifications-page-success">{success}</div> : null}
    <button className="announcement-send-button" type="button" disabled={busy} onClick={() => void submit()}><Send size={18}/>{busy ? 'שולח...' : 'שליחת העדכון'}</button>
  </section>;
}
