import { CheckCircle2, ClipboardList, LoaderCircle, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { dynamicSchedulingService } from '../services/dynamicSchedulingService';
import type {
  DynamicAvailabilityWorkspace,
  MyDynamicAvailabilityPeriod,
  SaveDynamicAvailabilityShadowSubmissionInput,
} from '../types/dynamicScheduling';
import { Button } from '../components/ui';
import '../styles/myDynamicAvailability.css';

type Status = 'available' | 'unavailable' | 'preferred' | 'avoid';
const labels: Record<Status, string> = { available: 'זמין', unavailable: 'לא זמין', preferred: 'מעדיף', avoid: 'מעדיף שלא' };
const weekdays = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
const dayOf = (date: string) => { const [y,m,d]=date.split('-').map(Number); return new Date(Date.UTC(y,m-1,d)).getUTCDay(); };
const shiftKey = (name:string,start:string,end:string) => `${name}__${start.slice(0,5)}__${end.slice(0,5)}`;
const formatDate = (date:string) => { const [y,m,d]=date.split('-'); return `${d}/${m}/${y}`; };
const statusClass = (status: Status | '') => status ? `status-${status}` : 'status-empty';

function MyDynamicAvailabilityPage() {
  const [periods,setPeriods]=useState<MyDynamicAvailabilityPeriod[]>([]);
  const [selectedKey,setSelectedKey]=useState('');
  const [workspace,setWorkspace]=useState<DynamicAvailabilityWorkspace|null>(null);
  const [statusBySlot,setStatusBySlot]=useState<Record<string,Status|''>>({});
  const [bulkStatus,setBulkStatus]=useState<Status>('available');
  const [bulkDay,setBulkDay]=useState(0);
  const [bulkKeys,setBulkKeys]=useState<string[]|null>(null);
  const [busy,setBusy]=useState(true);
  const [error,setError]=useState<string|null>(null);
  const [message,setMessage]=useState<string|null>(null);

  const selected=useMemo(()=>periods.find(p=>`${p.jobTypeId}:${p.year}:${p.month}`===selectedKey)??null,[periods,selectedKey]);
  const statuses=(workspace?.availabilityConfig?.statuses?.length ? workspace.availabilityConfig.statuses : ['available','unavailable']) as Status[];
  const member=workspace?.members?.[0]??null;

  const loadPeriods=async()=>{ setBusy(true); setError(null); try { const data=await dynamicSchedulingService.getMyDynamicAvailabilityPeriods(); setPeriods(data); setSelectedKey(k=>k&&data.some(p=>`${p.jobTypeId}:${p.year}:${p.month}`===k)?k:(data[0]?`${data[0].jobTypeId}:${data[0].year}:${data[0].month}`:'')); } catch(e){setError(e instanceof Error?e.message:'טעינת תקופות האילוצים נכשלה.');} finally{setBusy(false);} };
  useEffect(()=>{void loadPeriods();},[]);
  useEffect(()=>{ if(!selected){setWorkspace(null);return;} void (async()=>{setBusy(true);setError(null);try{const w=await dynamicSchedulingService.getMyDynamicAvailabilityWorkspace(selected.jobTypeId,selected.year,selected.month);setWorkspace(w);const entries=w.members?.[0]?.entries??{};setStatusBySlot(Object.fromEntries(w.slots.map(s=>[s.id,entries[s.id]?.status??''])));setBulkKeys(null);}catch(e){setError(e instanceof Error?e.message:'טעינת האילוצים נכשלה.');}finally{setBusy(false);}})();},[selected?.jobTypeId,selected?.year,selected?.month]);

  const options=useMemo(()=>{if(!workspace)return[];const map=new Map<string,{name:string;start:string;end:string}>();workspace.slots.filter(s=>dayOf(s.date)===bulkDay).forEach(s=>{const k=shiftKey(s.shiftName,s.startTime,s.endTime);map.set(k,{name:s.shiftName,start:s.startTime.slice(0,5),end:s.endTime.slice(0,5)})});return [...map].map(([key,value])=>({key,...value}));},[workspace,bulkDay]);
  const selectedKeys=bulkKeys===null?options.map(o=>o.key):bulkKeys.filter(k=>options.some(o=>o.key===k));
  const matching=useMemo(()=>new Set((workspace?.slots??[]).filter(s=>dayOf(s.date)===bulkDay&&selectedKeys.includes(shiftKey(s.shiftName,s.startTime,s.endTime))).map(s=>s.id)),[workspace,bulkDay,selectedKeys.join('|')]);
  const filled=Object.values(statusBySlot).filter(Boolean).length;
  const total=workspace?.slots.length??0;
  const deadlinePassed=Boolean(selected?.submissionDeadline && new Date(selected.submissionDeadline).getTime() < Date.now());
  const editable=selected?.periodStatus==='open' && !deadlinePassed;

  const applyMonth=()=>{if(!workspace)return;setStatusBySlot(Object.fromEntries(workspace.slots.map(s=>[s.id,bulkStatus])));setMessage(`כל ${workspace.slots.length} משמרות החודש סומנו כ${labels[bulkStatus]}.`)};
  const applyRule=()=>{setStatusBySlot(cur=>{const next={...cur};matching.forEach(id=>next[id]=bulkStatus);return next;});setMessage(`הכלל הוחל על ${matching.size} משמרות.`)};
  const save=async(submit:boolean)=>{if(!selected||!workspace||!member)return;if(submit&&filled<total){setError(`נשארו ${total-filled} משמרות ללא בחירה.`);return;}setBusy(true);setError(null);setMessage(null);try{const payload:SaveDynamicAvailabilityShadowSubmissionInput={submissionStatus:submit?'submitted':'draft',minimum:member.minimum,target:member.target,maximum:member.maximum,maxNights:member.maxNights,maxWeekends:member.maxWeekends,maxHolidays:member.maxHolidays,note:member.note,entries:workspace.slots.filter(s=>statusBySlot[s.id]).map(s=>({slotId:s.id,status:statusBySlot[s.id] as Status,note:member.entries[s.id]?.note??null}))};await dynamicSchedulingService.saveMyDynamicAvailabilitySubmission(selected.jobTypeId,selected.year,selected.month,payload);setMessage(submit?'האילוצים נשלחו בהצלחה. ניתן לעדכן אותם כל עוד התקופה פתוחה.':'הטיוטה נשמרה.');await loadPeriods();}catch(e){setError(e instanceof Error?e.message:'שמירת האילוצים נכשלה.');}finally{setBusy(false);}};

  if(busy&&!periods.length)return <main className="my-dynamic-availability page-shell"><div className="my-availability-loading"><LoaderCircle className="spin"/> טוען אילוצים…</div></main>;
  return <main className="my-dynamic-availability page-shell" dir="rtl">
    <header className="my-availability-header"><div><h1><ClipboardList size={26}/> האילוצים שלי</h1><p>בחר תפקיד וחודש, מלא ידנית או השתמש בחוקים רוחביים.</p></div></header>
    {error?<div className="users-error" role="alert">{error}</div>:null}{message?<div className="dynamic-shadow-success"><CheckCircle2 size={16}/>{message}</div>:null}
    {!periods.length?<section className="my-availability-empty"><h2>אין כרגע תקופת אילוצים זמינה</h2><p>כאשר מנהל יפתח תקופה לתפקיד שאליו אתה משויך, היא תופיע כאן.</p></section>:<>
      <div className="my-availability-period-tabs">{periods.map(p=>{const k=`${p.jobTypeId}:${p.year}:${p.month}`;return <button key={k} className={selectedKey===k?'is-active':''} onClick={()=>setSelectedKey(k)}><strong>{p.jobTypeName}</strong><span>{String(p.month).padStart(2,'0')}/{p.year}</span><small>{p.periodStatus==='open' ? (p.submissionStatus==='submitted'?'הוגש · ניתן לעדכן':'פתוח להגשה') : p.periodStatus==='closed'?'נסגר':'לצפייה'}</small></button>})}</div>
      {workspace&&selected?<section className="my-availability-card">
        <div className="my-availability-progress"><div><strong>{filled}/{total}</strong><span>משמרות סומנו</span></div><progress max={Math.max(total,1)} value={filled}/><span>{total?Math.round(filled/total*100):0}%</span></div>
        {!editable?<div className="my-availability-readonly">{deadlinePassed?'מועד ההגשה עבר. ההגשה מוצגת לקריאה בלבד.':'תקופת האילוצים סגורה. ההגשה מוצגת לקריאה בלבד.'}</div>:<div className="my-availability-rules">
          <div className="my-rule-title"><Sparkles size={18}/><div><strong>החלת חוק רוחבי</strong><small>החוק משנה את הטופס בלבד. אפשר לתקן משמרות ידנית לפני השליחה.</small></div></div>
          <div className="my-availability-status-legend">{statuses.map(s=><span key={s} className={`my-availability-status-chip ${statusClass(s)}`}>{labels[s]}</span>)}</div>
          <div className="my-rule-sentence"><span>סמן</span><select className={`my-availability-status-select ${statusClass(bulkStatus)}`} value={bulkStatus} onChange={e=>setBulkStatus(e.target.value as Status)}>{statuses.map(s=><option key={s} value={s}>{labels[s]}</option>)}</select><span>במשמרות ביום</span><select value={bulkDay} onChange={e=>{setBulkDay(Number(e.target.value));setBulkKeys(null)}}>{weekdays.map((d,i)=><option key={d} value={i}>{d}</option>)}</select><span>במשמרות</span></div>
          <div className="my-rule-shifts">{options.map(o=><label key={o.key}><input type="checkbox" checked={selectedKeys.includes(o.key)} onChange={()=>setBulkKeys(cur=>{const base=cur===null?options.map(x=>x.key):cur;return base.includes(o.key)?base.filter(x=>x!==o.key):[...base,o.key]})}/><span>{o.name}</span><span className="my-availability-time" dir="ltr">{o.start}–{o.end}</span></label>)}</div>
          <div className="my-rule-actions"><Button variant="secondary" disabled={!matching.size} onClick={applyRule}>החל כלל על {matching.size} משמרות</Button><Button variant="secondary" onClick={applyMonth}>החל {labels[bulkStatus]} על כל החודש</Button></div>
        </div>}
        <div className="my-availability-list">{workspace.slots.map(slot=>{const currentStatus=statusBySlot[slot.id]??'';return <div className={`my-availability-row ${statusClass(currentStatus)}`} key={slot.id}><div><strong>{slot.shiftName}</strong><div className="my-availability-slot-meta"><span className="my-availability-date" dir="ltr">{formatDate(slot.date)}</span><span aria-hidden="true">·</span><span>{weekdays[dayOf(slot.date)]}</span><span aria-hidden="true">·</span><span className="my-availability-time" dir="ltr">{slot.startTime.slice(0,5)}–{slot.endTime.slice(0,5)}</span></div>{slot.holidayName?<small>{slot.holidayName}</small>:null}</div><select className={`my-availability-status-select ${statusClass(currentStatus)}`} disabled={!editable} value={currentStatus} onChange={e=>setStatusBySlot(cur=>({...cur,[slot.id]:e.target.value as Status}))}><option value="">לא סומן</option>{statuses.map(s=><option key={s} value={s}>{labels[s]}</option>)}</select></div>})}</div>
        {editable?<div className="my-availability-footer"><span>{filled<total?`נותרו ${total-filled} משמרות לסימון.`:'כל המשמרות סומנו.'}</span><div><Button variant="secondary" disabled={busy} onClick={()=>void save(false)}>שמור טיוטה</Button><Button disabled={busy||filled<total} onClick={()=>void save(true)}>שלח אילוצים</Button></div></div>:null}
      </section>:null}
    </>}
  </main>;
}
export default MyDynamicAvailabilityPage;
