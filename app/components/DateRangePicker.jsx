"use client";
import { useState } from "react";
import styles from "./DateRangePicker.module.css";

const PRESETS = [
  { label: "7 днів", days: 7 },
  { label: "28 днів", days: 28 },
  { label: "90 днів", days: 90 },
  { label: "180 днів", days: 180 },
  { label: "Кастомний", days: 0 },
];

export default function DateRangePicker({ value, onChange }) {
  // value: { days, startDate, endDate }
  const [showCustom, setShowCustom] = useState(value.days === 0);
  const [customStart, setCustomStart] = useState(value.startDate || "");
  const [customEnd, setCustomEnd] = useState(value.endDate || "");

  const handlePreset = (days) => {
    if (days === 0) {
      setShowCustom(true);
    } else {
      setShowCustom(false);
      onChange({ days, startDate: null, endDate: null });
    }
  };

  const handleCustomApply = () => {
    if (!customStart || !customEnd) return;
    if (customStart > customEnd) return;
    onChange({ days: 0, startDate: customStart, endDate: customEnd });
  };

  const activePreset = value.days || 0;

  return (
    <div className={styles.wrap}>
      <div className={styles.presets}>
        {PRESETS.map((p) => (
          <button
            key={p.days}
            className={`${styles.presetBtn} ${activePreset === p.days && !showCustom || (p.days === 0 && showCustom) ? styles.active : ""}`}
            onClick={() => handlePreset(p.days)}
          >
            {p.label}
          </button>
        ))}
      </div>
      {showCustom && (
        <div className={styles.customRow}>
          <input
            type="date"
            className={styles.dateInput}
            value={customStart}
            max={customEnd || undefined}
            onChange={(e) => setCustomStart(e.target.value)}
          />
          <span className={styles.dateSep}>—</span>
          <input
            type="date"
            className={styles.dateInput}
            value={customEnd}
            min={customStart || undefined}
            max={new Date().toISOString().split("T")[0]}
            onChange={(e) => setCustomEnd(e.target.value)}
          />
          <button
            className={styles.applyBtn}
            onClick={handleCustomApply}
            disabled={!customStart || !customEnd}
          >
            Застосувати
          </button>
        </div>
      )}
    </div>
  );
}
