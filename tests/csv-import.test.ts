import { describe, expect, it } from "vitest";
import { CSV_TEMPLATE, parseCsv, rowsFromCsv } from "@/lib/csv-import";

describe("CSV parser", () => {
  it("handles quotes, escaped quotes, CRLF and a BOM", () => {
    expect(parseCsv('\uFEFFa,b\r\n"x, y","he said ""hi"""\r\n')).toEqual([
      ["a", "b"],
      ["x, y", 'he said "hi"'],
    ]);
  });
  it("detects semicolon-separated files (European Excel)", () => {
    expect(parseCsv("name;price\nTea;2,50")).toEqual([
      ["name", "price"],
      ["Tea", "2,50"],
    ]);
  });
  it("skips blank lines and keeps newlines inside quotes", () => {
    expect(parseCsv('name,description\n\nTea,"line1\nline2"\n')).toEqual([
      ["name", "description"],
      ["Tea", "line1\nline2"],
    ]);
  });
});

describe("menu rows from CSV", () => {
  it("imports the template", () => {
    const { rows, errors } = rowsFromCsv(parseCsv(CSV_TEMPLATE), "INR");
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ category: "Breakfast", name: "Masala Dosa", priceMinor: 12000, diet: "veg", spicy: 1, bestseller: true, calories: 350 });
    expect(rows[1].variants).toEqual([
      { id: "v1", name: "Half", priceMinor: 18000 },
      { id: "v2", name: "Full", priceMinor: 30000 },
    ]);
    expect(rows[1].priceMinor).toBe(18000);
    expect(rows[2].allergens).toEqual(["dairy"]);
  });
  it("accepts header aliases and reports bad rows with line numbers", () => {
    const { rows, errors } = rowsFromCsv(parseCsv("Dish,Cost,Type\nVada Pav,₹25,veg\n,10,\nSamosa,abc,\nThali,,nonveg"), "INR");
    expect(rows.map((r) => [r.name, r.priceMinor, r.diet, r.category])).toEqual([["Vada Pav", 2500, "veg", "Menu"]]);
    expect(errors.map((e) => e.line)).toEqual([3, 4, 5]);
  });
  it("needs name and price columns", () => {
    expect(rowsFromCsv(parseCsv("foo,bar\n1,2"), "INR").errors[0].message).toMatch(/name/);
  });
  it("caps the number of rows", () => {
    const csv = "name,price\n" + Array.from({ length: 5 }, (_, i) => `Item ${i},10`).join("\n");
    const { rows, errors } = rowsFromCsv(parseCsv(csv), "USD", 3);
    expect(rows).toHaveLength(3);
    expect(errors[0].message).toMatch(/first 3/);
  });
});
