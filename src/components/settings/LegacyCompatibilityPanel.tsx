import { AlertTriangle, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

import './LegacyCompatibilityPanel.css';

const legacyTools = [
  {
    path: '/legacy/availability',
    label: 'אילוצי מוקדנים Legacy',
    description: 'מסך האילוצים הישן של המוקדנים.',
  },
  {
    path: '/legacy/schedule',
    label: 'שיבוץ מוקדנים Legacy',
    description: 'לוח ושיבוץ המוקדנים הישן.',
  },
  {
    path: '/legacy/driver-schedule',
    label: 'לוח כוננים Legacy',
    description: 'מערכת הכוננים הישנה, כולל אילוצים ולוח.',
  },
  {
    path: '/legacy/morning-driver-availability',
    label: 'אילוצי כונני בוקר Legacy',
    description: 'תקופות האילוצים הישנות של כונני הבוקר.',
  },
  {
    path: '/legacy/morning-driver-schedule',
    label: 'לוח כונני בוקר Legacy',
    description: 'לוח הכוננויות הישן של כונני הבוקר.',
  },
  {
    path: '/legacy/shift-swaps',
    label: 'חילופי משמרות Legacy',
    description: 'בקשות חילוף מהמערכת הישנה לצורכי בדיקה/שחזור בלבד.',
  },
] as const;

export default function LegacyCompatibilityPanel() {
  return (
    <div className="legacy-compatibility-panel" dir="rtl">
      <div className="legacy-compatibility-warning">
        <AlertTriangle size={20} aria-hidden="true" />
        <div>
          <strong>אזור שחזור ותאימות בלבד</strong>
          <p>
            הכלים כאן עוקפים את ניווט Dynamic-first ונועדו לבדיקת נתוני Legacy,
            שחזור ו-Rollback. אין להשתמש בהם לעבודה השוטפת כאשר המערכת החדשה פעילה.
          </p>
        </div>
      </div>

      <div className="legacy-compatibility-grid">
        {legacyTools.map((tool) => (
          <Link key={tool.path} to={tool.path} className="legacy-compatibility-link">
            <div>
              <strong>{tool.label}</strong>
              <span>{tool.description}</span>
            </div>
            <ExternalLink size={17} aria-hidden="true" />
          </Link>
        ))}
      </div>
    </div>
  );
}
