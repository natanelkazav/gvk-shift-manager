/**
 * קובץ: src/components/settings/ThemeSettings.tsx
 * מטרה: מימוש רכיב תצוגה ואינטראקציה עבור הגדרות.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: ThemeSettings.
 * - קישור מאפיינים ומצב מקומי לתצוגה ולטיפול בפעולות המשתמש.
 */
import { Check, Moon, Sun } from 'lucide-react';
import { useState } from 'react';
import { themeService, type AppTheme } from '../../services/themeService';

// options — אפשרויות בחירה.
const options: Array<{
  // value — ערך.
  value: AppTheme;
  // title — כותרת.
  title: string;
  description: string;
  icon: typeof Sun;
}> = [
  {
    value: 'light',
    title: 'בהיר',
    description: 'ערכת הנושא הנוכחית של המערכת.',
    icon: Sun,
  },
  {
    value: 'dark',
    title: 'כהה',
    description: 'רקע כהה, כרטיסים כהים וטקסט בהיר לעבודה נוחה בלילה.',
    icon: Moon,
  },
];

/**
 * פעולה ThemeSettings: הגדרות.
 */
export default function ThemeSettings() {
  // מצב מקומי: savedTheme — הנתון savedTheme בהקשר הפעולה; setSavedTheme מעדכנת אותו ומפעילה רינדור לפי React.
  const [savedTheme, setSavedTheme] = useState<AppTheme>(() => themeService.get());
  // מצב מקומי: selectedTheme — נבחר; setSelectedTheme מעדכנת אותו ומפעילה רינדור לפי React.
  const [selectedTheme, setSelectedTheme] = useState<AppTheme>(() => themeService.get());
  // מצב מקומי: savedMessage — הודעה; setSavedMessage מעדכנת אותו ומפעילה רינדור לפי React.
  const [savedMessage, setSavedMessage] = useState(false);

  /**
   * פעולה save: שמירת הנתון save בהקשר הפעולה.
   */
  const save = () => {
    themeService.set(selectedTheme);
    setSavedTheme(selectedTheme);
    setSavedMessage(true);
    window.setTimeout(() => setSavedMessage(false), 2500);
  };

  return (
    <div className="theme-settings">
      <div className="theme-options" role="radiogroup" aria-label="ערכת נושא">
        {options.map((option) => {
          const Icon = option.icon;
          // selected — נבחר.
          const selected = selectedTheme === option.value;
          return (
            <button
              key={option.value}
              type="button"
              className={`theme-option${selected ? ' theme-option-selected' : ''}`}
              role="radio"
              aria-checked={selected}
              onClick={() => {
                setSelectedTheme(option.value);
                setSavedMessage(false);
              }}
            >
              <span className="theme-option-icon"><Icon size={21} /></span>
              <span className="theme-option-copy">
                <strong>{option.title}</strong>
                <small>{option.description}</small>
              </span>
              <span className="theme-option-radio" aria-hidden="true">
                {selected ? <Check size={15} /> : null}
              </span>
            </button>
          );
        })}
      </div>

      <div className="theme-settings-actions">
        {savedMessage ? <span className="theme-save-message">ערכת הנושא נשמרה.</span> : <span />}
        <button
          type="button"
          className="button button-primary"
          disabled={selectedTheme === savedTheme}
          onClick={save}
        >
          אישור
        </button>
      </div>
    </div>
  );
}
