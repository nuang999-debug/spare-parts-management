import { describe, expect, it } from "vitest";
import { parseProvisionStatus } from "../src/services/excelImport/parseItemsRaw";

describe("parseProvisionStatus", () => {
  it("keeps the three Obsolete tiers, normalised", () => {
    expect(parseProvisionStatus("Obsolete_24")).toBe("Obsolete_24");
    expect(parseProvisionStatus("Obsolete_18")).toBe("Obsolete_18");
    expect(parseProvisionStatus("Obsolete_12")).toBe("Obsolete_12");
  });

  it("tolerates case, spacing and padding", () => {
    expect(parseProvisionStatus("  obsolete_24 ")).toBe("Obsolete_24");
    expect(parseProvisionStatus("OBSOLETE 12")).toBe("Obsolete_12");
    expect(parseProvisionStatus("Obsolete_06")).toBe("Obsolete_6");
  });

  it("drops the non-provision labels and blanks", () => {
    for (const v of ["High Runner", "Slow Mover", "New Introduced", "", "   ", null, undefined, 24]) {
      expect(parseProvisionStatus(v)).toBeNull();
    }
  });

  it("does not accept look-alikes", () => {
    expect(parseProvisionStatus("Obsolete")).toBeNull();
    expect(parseProvisionStatus("Obsolete_24x")).toBeNull();
    expect(parseProvisionStatus("Not Obsolete_24")).toBeNull();
  });
});
