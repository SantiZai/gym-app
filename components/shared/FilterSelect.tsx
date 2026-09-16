"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ALL_VALUE = "__all";

interface FilterSelectProps {
  value: string;
  onChange: (value: string) => void;
  allLabel: string;
  options: string[];
  ariaLabel: string;
}

export function FilterSelect({ value, onChange, allLabel, options, ariaLabel }: FilterSelectProps) {
  return (
    <Select
      value={value === "" ? ALL_VALUE : value}
      onValueChange={(v) => onChange(v === ALL_VALUE ? "" : (v as string))}
    >
      <SelectTrigger aria-label={ariaLabel} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_VALUE}>{allLabel}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option} value={option}>
            {option}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
