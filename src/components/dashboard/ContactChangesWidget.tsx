import { useEffect,useState } from 'react';
import { ContactRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { contactsService } from '../../services/contactsService';
import type { ContactChangeSummary } from '../../types/contacts';
export default function ContactChangesWidget(){const {hasPermission}=useAuth();const [rows,setRows]=useState<ContactChangeSummary[]>([]);useEffect(()=>{if(!hasPermission('contacts.changes_view'))return;void contactsService.recentChanges().then(setRows).catch(()=>setRows([]));},[hasPermission]);if(!hasPermission('contacts.changes_view')||!rows.length)return null;return <section className="dashboard-card"><div className="dashboard-card-header"><div className="dashboard-card-title-wrap"><div className="dashboard-card-icon"><ContactRound size={19}/></div><div><h2>עדכוני אנשי קשר</h2><span>שינויים אחרונים בספר אנשי הקשר</span></div></div><Link to="/contacts">לכל אנשי הקשר</Link></div><div className="dashboard-card-body">{rows.slice(0,6).map(r=><div className="dynamic-manager-staffing-row" key={r.id}><div><strong>{r.fullName}</strong><span>{r.clientName}{r.branchName?` · ${r.branchName}`:''} · {r.roleName}</span></div><span>{r.changeType==='new'?'חדש':r.changeType==='needs_review'?'דורש בדיקה':'עודכן'}</span></div>)}</div></section>}
