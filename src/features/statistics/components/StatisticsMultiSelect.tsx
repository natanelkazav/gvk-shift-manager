/**
 * קובץ: src/features/statistics/components/StatisticsMultiSelect.tsx
 * מטרה: רכיב בחירה מרובה למסנני סטטיסטיקה, כולל תצוגת בחירת הכול ושינוי מצב הכללת הנתונים.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: StatisticsMultiSelectOption, StatisticsMultiSelectProps, StatisticsMultiSelect.
 * - קישור מאפיינים ומצב מקומי לתצוגה ולטיפול בפעולות המשתמש.
 */
import {
  ChevronDown,
} from 'lucide-react';

/**
 * חוזה הנתונים StatisticsMultiSelectOption: סטטיסטיקה.
 */
interface StatisticsMultiSelectOption {
  // value — ערך.
  value: string | number;
  // label — תווית.
  label: string;
  muted?: boolean;
}

/**
 * חוזה הנתונים StatisticsMultiSelectProps: סטטיסטיקה / מאפייני הרכיב.
 */
interface StatisticsMultiSelectProps {
  // label — תווית.
  label: string;
  // allLabel — תווית.
  allLabel: string;
  // selectedValues — הערכים שנבחרו.
  selectedValues: Array<string | number>;
  // options — אפשרויות בחירה.
  options: StatisticsMultiSelectOption[];
  // disabled — האם האפשרות מושבתת (אופציונלי).
  disabled?: boolean;
  // onChange — פונקציית דיווח על שינוי.
  onChange: (values: Array<string | number>) => void;
  // inclusionMode — מצב הכללת הנתונים (אופציונלי).
  inclusionMode?: 'active' | 'all';
  // onInclusionModeChange — מצב הכללת הנתונים (אופציונלי).
  onInclusionModeChange?: (mode: 'active' | 'all') => void;
}

/**
 * פעולה StatisticsMultiSelect: סטטיסטיקה.
 * פרמטר מפורק — שדות הקלט נגישים מקומית בשמות המוגדרים בחתימה.
 */
function StatisticsMultiSelect({
  label,
  allLabel,
  selectedValues,
  options,
  disabled = false,
  onChange,
  inclusionMode,
  onInclusionModeChange,
}: StatisticsMultiSelectProps) {
  // allSelected — האם נבחרה האפשרות הכוללת.
  const allSelected =
    selectedValues.length === 0;

  // summary — סיכום.
  const summary =
    allSelected
      ? allLabel
      : selectedValues.length === 1
        ? options.find(
            (option) =>
              option.value ===
              selectedValues[0],
          )?.label ??
          String(selectedValues[0])
        : `${selectedValues.length} נבחרו`;

  /**
   * פעולה toggleValue: החלפת בחירה עבור ערך.
   * @param value — ערך.
   * @returns void — הפלט בהתאם לחתימה.
   */
  const toggleValue = (
    value: string | number,
  ): void => {
    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר selectedValues.includes( value, ).
    if (
      selectedValues.includes(
        value,
      )
    ) {
      onChange(
        selectedValues.filter(
          (selectedValue) =>
            selectedValue !== value,
        ),
      );
      return;
    }

    // nextValues — קבוצת הערכים לאחר השינוי.
    const nextValues = [
      ...selectedValues,
      value,
    ];

    onChange(
      options
        .filter((option) =>
          nextValues.includes(
            option.value,
          ),
        )
        .map(
          (option) =>
            option.value,
        ),
    );
  };

  return (
    <div className="statistics-multi-select-field">
      <span>{label}</span>

      <details
        className="statistics-multi-select"
      >
        <summary
          aria-disabled={disabled}
          onClick={(event) => {
            if (disabled) {
              event.preventDefault();
            }
          }}
        >
          <strong>{summary}</strong>

          <ChevronDown
            size={16}
            aria-hidden="true"
          />
        </summary>

        <div className="statistics-multi-select-menu">
          {inclusionMode && onInclusionModeChange ? (
            <div className="statistics-multi-select-scope" role="group" aria-label="הצגת עובדים">
              <span>הצגה</span>
              <label>
                <input type="radio" name={`${label}-inclusion-mode`} checked={inclusionMode === 'active'} disabled={disabled} onChange={() => onInclusionModeChange('active')} />
                <span>עובדים פעילים</span>
              </label>
              <label>
                <input type="radio" name={`${label}-inclusion-mode`} checked={inclusionMode === 'all'} disabled={disabled} onChange={() => onInclusionModeChange('all')} />
                <span>פעילים ולא פעילים</span>
              </label>
            </div>
          ) : null}
          <div className="statistics-multi-select-options-title">בחירת עובדים</div>
          <label>
            <input
              type="checkbox"
              checked={allSelected}
              disabled={disabled}
              onChange={() => {
                onChange([]);
              }}
            />

            <span>{allLabel}</span>
          </label>

          {options.map((option, index) => {
            // startsInactiveGroup — קבוצה.
            const startsInactiveGroup =
              option.muted &&
              (index === 0 || !options[index - 1]?.muted);

            return (
              <div key={option.value}>
                {startsInactiveGroup ? (
                  <div className="statistics-multi-select-options-title statistics-multi-select-inactive-title">
                    עובדים לא פעילים
                  </div>
                ) : null}
                <label
                  className={option.muted ? 'statistics-multi-select-option-muted' : undefined}
                >
                  <input
                    type="checkbox"
                    checked={selectedValues.includes(option.value)}
                    disabled={disabled}
                    onChange={() => {
                      toggleValue(option.value);
                    }}
                  />

                  <span>{option.label}</span>
                </label>
              </div>
            );
          })}
        </div>
      </details>
    </div>
  );
}

export default StatisticsMultiSelect;
