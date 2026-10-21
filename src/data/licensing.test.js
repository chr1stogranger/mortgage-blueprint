import { describe, it, expect } from "vitest";
import { isLicensedState, LICENSED_STATES, LICENSED_STATES_TEXT, unlicensedLine } from "./licensing.js";
import { STATE_TAX } from "../lib/finance.js";

describe("licensing", () => {
  it("covers exactly AZ, CA, CO, HI, NV, OR, TX and WA, using STATE_TAX keys", () => {
    expect(LICENSED_STATES_TEXT).toBe("AZ, CA, CO, HI, NV, OR, TX and WA");
    for (const s of LICENSED_STATES) expect(STATE_TAX[s]).toBeTruthy();
  });
  it("normalizes names and codes; anything else is unlicensed", () => {
    expect(isLicensedState("Texas")).toBe(true);
    expect(isLicensedState("tx")).toBe(true);
    expect(isLicensedState("Florida")).toBe(false);
    expect(isLicensedState("District of Columbia")).toBe(false);
    expect(isLicensedState("")).toBe(false);
    expect(isLicensedState("Calif.")).toBe(false);
  });
  it("words the unlicensed line", () => {
    expect(unlicensedLine("Florida")).toBe("Chris Granger is licensed in AZ, CA, CO, HI, NV, OR, TX and WA, and can't originate a loan for a property in Florida.");
  });
});
