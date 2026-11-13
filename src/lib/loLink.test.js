import { describe, it, expect } from "vitest";
import { readLoCode, identityFromLoCard } from "./loLink.js";

describe("?lo= personal loan-officer link", () => {
 it("reads a valid code and ignores junk", () => {
  expect(readLoCode("?lo=Ab3_x-9Z")).toBe("Ab3_x-9Z");
  expect(readLoCode("?listing=abcdefgh")).toBeNull();
  expect(readLoCode("?lo=../../x")).toBeNull();
  expect(readLoCode("?lo=abc")).toBeNull();
 });
 it("maps the Ops card to Blueprint's LO fields", () => {
  expect(identityFromLoCard({ name: " Kim Example ", email: "kim@example.com", phone: "(555) 555-0100", nmls: "123", company: "Example Lending", applyUrl: "https://apply.example.com/kim" }))
   .toEqual({ loanOfficer: "Kim Example", loEmail: "kim@example.com", loPhone: "(555) 555-0100", loNmls: "123", companyName: "Example Lending", applyUrl: "https://apply.example.com/kim" });
 });
 it("never keeps the default portal: no or unsafe apply link hides the button", () => {
  expect(identityFromLoCard({ name: "Kim" }).applyUrl).toBe("");
  expect(identityFromLoCard({ name: "Kim", applyUrl: "javascript:alert(1)" }).applyUrl).toBe("");
 });
 it("refuses a card with no name", () => {
  expect(identityFromLoCard({ email: "x@example.com" })).toBeNull();
  expect(identityFromLoCard(null)).toBeNull();
 });
});
