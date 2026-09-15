import { Check, Moon, Sun } from 'lucide-react';
import { useState } from 'react';
import { themeService, type AppTheme } from '../../services/themeService';

const options: Array<{
  value: AppTheme;
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

export default function ThemeSettings() {
  const [savedTheme, setSavedTheme] = useState<AppTheme>(() => themeService.get());
  const [selectedTheme, setSelectedTheme] = useState<AppTheme>(() => themeService.get());
  const [savedMessage, setSavedMessage] = useState(false);

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
