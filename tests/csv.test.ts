import { describe, expect, it } from "vitest";
import { parseCsv, toCsv } from "@/lib/csv";

describe("parseCsv", () => {
  it("parses simple rows and trims blank lines", () => {
    expect(parseCsv("a,b\n1,2\n\n3,4\n")).toEqual([["a", "b"], ["1", "2"], ["3", "4"]]);
  });
  it("handles quoted fields with commas, quotes and newlines", () => {
    const text = 'date,description\n2026-01-01,"Dinner, ""fancy""\nplace"\n';
    expect(parseCsv(text)).toEqual([["date", "description"], ["2026-01-01", 'Dinner, "fancy"\nplace']]);
  });
  it("handles CRLF and a BOM", () => {
    expect(parseCsv("﻿a,b\r\n1,2\r\n")).toEqual([["a", "b"], ["1", "2"]]);
  });
});

describe("toCsv", () => {
  it("escapes fields that need it and round-trips", () => {
    const csv = toCsv(["name", "note"], [["Plain", 'Has "quotes", commas'], ["Multi\nline", null]]);
    expect(csv).toBe('name,note\r\nPlain,"Has ""quotes"", commas"\r\n"Multi\nline",\r\n');
    expect(parseCsv(csv)).toEqual([["name", "note"], ["Plain", 'Has "quotes", commas'], ["Multi\nline", ""]]);
  });
});
