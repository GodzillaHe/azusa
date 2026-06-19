import { describe, expect, it } from "vitest";
import {
  getHistoryRecordIdsToDelete,
  MAX_HISTORY_RECORDS,
  trimHistoryRecords,
  type HistoryRecord,
} from "./history-store";

function createHistoryRecord(index: number): HistoryRecord {
  return {
    id: `record-${index}`,
    prompt: `Prompt ${index}`,
    mode: index % 2 === 0 ? "generate" : "edit",
    size: "1024x1024",
    count: 1,
    quality: "high",
    style: "vivid",
    createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, index)).toISOString(),
    images: [`data:image/png;base64,${index}`],
  };
}

describe("trimHistoryRecords", () => {
  it("keeps only the newest 50 records", () => {
    const records = Array.from({ length: 60 }, (_, index) => createHistoryRecord(index));

    const trimmed = trimHistoryRecords(records);

    expect(trimmed).toHaveLength(MAX_HISTORY_RECORDS);
    expect(trimmed.map((record) => record.id)).toEqual(
      Array.from({ length: MAX_HISTORY_RECORDS }, (_, index) => `record-${59 - index}`),
    );
  });

  it("preserves newest records when input is unsorted", () => {
    const records = [
      createHistoryRecord(1),
      createHistoryRecord(59),
      createHistoryRecord(0),
      ...Array.from({ length: 50 }, (_, index) => createHistoryRecord(index + 9)),
      createHistoryRecord(8),
    ];

    const trimmed = trimHistoryRecords(records);

    expect(trimmed[0].id).toBe("record-59");
    expect(trimmed).toContainEqual(createHistoryRecord(10));
    expect(trimmed.map((record) => record.id)).not.toContain("record-0");
    expect(trimmed.map((record) => record.id)).not.toContain("record-1");
  });

  it("does not mutate the original array", () => {
    const records = [createHistoryRecord(2), createHistoryRecord(3), createHistoryRecord(1)];
    const originalOrder = records.map((record) => record.id);

    const trimmed = trimHistoryRecords(records);

    expect(records.map((record) => record.id)).toEqual(originalOrder);
    expect(trimmed).not.toBe(records);
  });

  it("returns ids for records beyond the max history limit", () => {
    const records = Array.from({ length: 53 }, (_, index) => createHistoryRecord(index));

    expect(getHistoryRecordIdsToDelete(records)).toEqual(["record-2", "record-1", "record-0"]);
  });
});
