import {
  ChevronDown,
} from 'lucide-react';

interface StatisticsMultiSelectOption {
  value: number;
  label: string;
}

interface StatisticsMultiSelectProps {
  label: string;
  allLabel: string;
  selectedValues: number[];
  options: StatisticsMultiSelectOption[];
  disabled?: boolean;
  onChange: (values: number[]) => void;
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
    value: number,
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

    onChange([
      ...selectedValues,
      value,
    ].sort(
      (firstValue, secondValue) =>
        firstValue - secondValue,
    ));
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
