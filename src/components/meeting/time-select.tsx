"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getHalfHourSlots } from "@/lib/conference-booking";

const SLOTS = getHalfHourSlots();

type TimeSelectProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
};

/** ตัวเลือกเวลาทุก 30 นาที 07:00–20:00 */
export const TimeSelect = ({ id, value, onChange }: TimeSelectProps) => (
  <Select value={value} onValueChange={(next) => next && onChange(next)}>
    <SelectTrigger id={id} className="w-full">
      <SelectValue>{value} น.</SelectValue>
    </SelectTrigger>
    <SelectContent>
      {SLOTS.map((slot) => (
        <SelectItem key={slot} value={slot}>
          {slot} น.
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
);
