import {
  ChevronDown,
} from 'lucide-react';

interface StatisticsMultiSelectOption {
  value: string | number;
  label: string;
  muted?: boolean;
}

interface StatisticsMultiSelectProps {
  label: string;
  allLabel: string;
  selectedValues: Array<string | number>;
  options: StatisticsMultiSelectOption[];
  disabled?: boolean;
  onChange: (values: Array<string | number>) => void;
}

function StatisticsMultiSelect({
  label,
  allLabel,
  selectedValues,
  options,
  disabled = false,
  onChange,
}: StatisticsMultiSelectProps) {
  const allSelected =
    selectedValues.length === 0;

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

  const toggleValue = (
    value: string | number,
  ): void => {
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

          {options.map((option) => (
            <label
              key={option.value}
              className={option.muted ? 'statistics-multi-select-option-muted' : undefined}
            >
              <input
                type="checkbox"
                checked={
                  selectedValues.includes(
                    option.value,
                  )
                }
                disabled={disabled}
                onChange={() => {
                  toggleValue(
                    option.value,
                  );
                }}
              />

              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </details>
    </div>
  );
}

export default StatisticsMultiSelect;
