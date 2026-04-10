import React from "react";

interface FilterCheckboxProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  style?: React.CSSProperties;
}

export const FilterCheckbox: React.FC<FilterCheckboxProps> = ({
  label,
  checked,
  onChange,
  style,
}) => {
  return (
    <label
      style={{
        display: "block",
        margin: "8px 0",
        fontSize: "1.2em",
        ...style,
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => {
          onChange(e.target.checked);
        }}
      />{" "}
      {label}
    </label>
  );
};
