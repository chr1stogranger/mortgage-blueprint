import { describe, it, expect } from "vitest";
import { parseMismo34, mergeMismoImport, parseXml, MismoImportError } from "./mismo34Import.js";

// Synthetic ULAD 3.4 export (fake people, fake accounts) shaped like a real
// LOS file: default namespace + xlink prefix, ASSET-wrapped owned property,
// ASSET → LIABILITY links for the REO's liens.
const XML = `<?xml version="1.0" encoding="UTF-8"?>
<!-- exported by an LOS -->
<MESSAGE MISMOReferenceModelIdentifier="3.4.032420160128" xmlns="http://www.mismo.org/residential/2009/schemas" xmlns:xlink="http://www.w3.org/1999/xlink">
 <DEAL_SETS><DEAL_SET><DEALS><DEAL>
  <ASSETS>
   <ASSET SequenceNumber="1" xlink:label="ASSET_1">
    <ASSET_DETAIL>
     <AssetAccountIdentifier>998877665544</AssetAccountIdentifier>
     <AssetCashOrMarketValueAmount>25000.50</AssetCashOrMarketValueAmount>
     <AssetType>CheckingAccount</AssetType>
    </ASSET_DETAIL>
    <ASSET_HOLDER><NAME><FullName>Chase Bank ****4321</FullName></NAME></ASSET_HOLDER>
   </ASSET>
   <ASSET SequenceNumber="2" xlink:label="ASSET_2">
    <ASSET_DETAIL>
     <AssetCashOrMarketValueAmount>120000</AssetCashOrMarketValueAmount>
     <AssetType>RetirementFund</AssetType>
    </ASSET_DETAIL>
    <ASSET_HOLDER><NAME><FullName>Fidelity &amp; Co</FullName></NAME></ASSET_HOLDER>
   </ASSET>
   <ASSET SequenceNumber="3" xlink:label="ASSET_3">
    <ASSET_DETAIL><AssetCashOrMarketValueAmount>0</AssetCashOrMarketValueAmount><AssetType>SavingsAccount</AssetType></ASSET_DETAIL>
   </ASSET>
   <ASSET SequenceNumber="4" xlink:label="ASSET_4">
    <OWNED_PROPERTY>
     <OWNED_PROPERTY_DETAIL>
      <OwnedPropertyDispositionStatusType>Retain</OwnedPropertyDispositionStatusType>
      <OwnedPropertyLienUPBAmount>300000</OwnedPropertyLienUPBAmount>
      <OwnedPropertyMaintenanceExpenseAmount>450</OwnedPropertyMaintenanceExpenseAmount>
      <OwnedPropertyRentalIncomeNetAmount>300</OwnedPropertyRentalIncomeNetAmount>
      <OwnedPropertySubjectIndicator>false</OwnedPropertySubjectIndicator>
     </OWNED_PROPERTY_DETAIL>
     <PROPERTY SequenceNumber="1">
      <ADDRESS><AddressLineText>12 Elm St</AddressLineText><CityName>Portland</CityName><PostalCode>97230</PostalCode><StateCode>OR</StateCode></ADDRESS>
      <PROPERTY_DETAIL><FinancedUnitCount>2</FinancedUnitCount><PropertyCurrentUsageType>Investment</PropertyCurrentUsageType><PropertyEstimatedValueAmount>650000</PropertyEstimatedValueAmount></PROPERTY_DETAIL>
     </PROPERTY>
    </OWNED_PROPERTY>
   </ASSET>
   <ASSET SequenceNumber="5" xlink:label="ASSET_5">
    <OWNED_PROPERTY>
     <OWNED_PROPERTY_DETAIL><OwnedPropertyDispositionStatusType>Sold</OwnedPropertyDispositionStatusType></OWNED_PROPERTY_DETAIL>
     <PROPERTY><ADDRESS><AddressLineText>9 Gone Ave</AddressLineText></ADDRESS></PROPERTY>
    </OWNED_PROPERTY>
   </ASSET>
   <ASSET SequenceNumber="6" xlink:label="ASSET_6">
    <OWNED_PROPERTY>
     <OWNED_PROPERTY_DETAIL>
      <OwnedPropertyDispositionStatusType>PendingSale</OwnedPropertyDispositionStatusType>
      <OwnedPropertySubjectIndicator>false</OwnedPropertySubjectIndicator>
     </OWNED_PROPERTY_DETAIL>
     <PROPERTY><ADDRESS><AddressLineText>5 Home Rd</AddressLineText><CityName>Gresham</CityName><StateCode>OR</StateCode></ADDRESS>
      <PROPERTY_DETAIL><PropertyCurrentUsageType>PrimaryResidence</PropertyCurrentUsageType><PropertyEstimatedValueAmount>500000</PropertyEstimatedValueAmount></PROPERTY_DETAIL>
     </PROPERTY>
    </OWNED_PROPERTY>
   </ASSET>
  </ASSETS>
  <LIABILITIES>
   <LIABILITY SequenceNumber="1" xlink:label="LIABILITY_1">
    <LIABILITY_DETAIL>
     <LiabilityAccountIdentifier>4111222233334444</LiabilityAccountIdentifier>
     <LiabilityMonthlyPaymentAmount>85</LiabilityMonthlyPaymentAmount>
     <LiabilityPayoffStatusIndicator>false</LiabilityPayoffStatusIndicator>
     <LiabilityType>Revolving</LiabilityType>
     <LiabilityUnpaidBalanceAmount>2400</LiabilityUnpaidBalanceAmount>
    </LIABILITY_DETAIL>
    <LIABILITY_HOLDER><NAME><FullName>CAPITAL ONE 517805</FullName></NAME></LIABILITY_HOLDER>
   </LIABILITY>
   <LIABILITY SequenceNumber="2" xlink:label="LIABILITY_2">
    <LIABILITY_DETAIL>
     <LiabilityMonthlyPaymentAmount>310</LiabilityMonthlyPaymentAmount>
     <LiabilityPayoffStatusIndicator>true</LiabilityPayoffStatusIndicator>
     <LiabilityRemainingTermMonthsCount>40</LiabilityRemainingTermMonthsCount>
     <LiabilityType>Installment</LiabilityType>
     <LiabilityUnpaidBalanceAmount>18000</LiabilityUnpaidBalanceAmount>
    </LIABILITY_DETAIL>
    <LIABILITY_HOLDER><NAME><FullName>Toyota Motor Credit</FullName></NAME></LIABILITY_HOLDER>
   </LIABILITY>
   <LIABILITY SequenceNumber="3" xlink:label="LIABILITY_3">
    <LIABILITY_DETAIL>
     <LiabilityMonthlyPaymentAmount>1800</LiabilityMonthlyPaymentAmount>
     <LiabilityPaymentIncludesTaxesInsuranceIndicator>false</LiabilityPaymentIncludesTaxesInsuranceIndicator>
     <LiabilityType>MortgageLoan</LiabilityType>
     <LiabilityUnpaidBalanceAmount>280000</LiabilityUnpaidBalanceAmount>
    </LIABILITY_DETAIL>
    <LIABILITY_HOLDER><NAME><FullName>Rocket Mortgage</FullName></NAME></LIABILITY_HOLDER>
   </LIABILITY>
   <LIABILITY SequenceNumber="4" xlink:label="LIABILITY_4">
    <LIABILITY_DETAIL>
     <LiabilityMonthlyPaymentAmount>150</LiabilityMonthlyPaymentAmount>
     <LiabilityType>HELOC</LiabilityType>
     <LiabilityUnpaidBalanceAmount>20000</LiabilityUnpaidBalanceAmount>
    </LIABILITY_DETAIL>
    <LIABILITY_HOLDER><NAME><FullName>US Bank</FullName></NAME></LIABILITY_HOLDER>
   </LIABILITY>
   <LIABILITY SequenceNumber="5" xlink:label="LIABILITY_5">
    <LIABILITY_DETAIL>
     <LiabilityExclusionIndicator>true</LiabilityExclusionIndicator>
     <LiabilityMonthlyPaymentAmount>40</LiabilityMonthlyPaymentAmount>
     <LiabilityType>Installment</LiabilityType>
     <LiabilityUnpaidBalanceAmount>900</LiabilityUnpaidBalanceAmount>
    </LIABILITY_DETAIL>
    <LIABILITY_HOLDER><NAME><FullName>Navient</FullName></NAME></LIABILITY_HOLDER>
   </LIABILITY>
   <LIABILITY SequenceNumber="6" xlink:label="LIABILITY_6">
    <LIABILITY_DETAIL><LiabilityMonthlyPaymentAmount>0</LiabilityMonthlyPaymentAmount><LiabilityType>Revolving</LiabilityType><LiabilityUnpaidBalanceAmount>0</LiabilityUnpaidBalanceAmount></LIABILITY_DETAIL>
   </LIABILITY>
  </LIABILITIES>
  <PARTIES>
   <PARTY>
    <INDIVIDUAL><NAME><FirstName>Sam</FirstName><LastName>Rivera</LastName></NAME></INDIVIDUAL>
    <TAXPAYER_IDENTIFIERS><TAXPAYER_IDENTIFIER><TaxpayerIdentifierValue>123456789</TaxpayerIdentifierValue></TAXPAYER_IDENTIFIER></TAXPAYER_IDENTIFIERS>
    <ROLES><ROLE SequenceNumber="1" xlink:label="BORROWER_2">
     <BORROWER><BORROWER_DETAIL><BorrowerBirthDate>1985-01-01</BorrowerBirthDate><BorrowerClassificationType>Secondary</BorrowerClassificationType></BORROWER_DETAIL></BORROWER>
     <ROLE_DETAIL><PartyRoleType>Borrower</PartyRoleType></ROLE_DETAIL>
    </ROLE></ROLES>
   </PARTY>
   <PARTY>
    <INDIVIDUAL><NAME><FirstName>Dana</FirstName><LastName>Rivera</LastName></NAME></INDIVIDUAL>
    <ROLES><ROLE SequenceNumber="1" xlink:label="BORROWER_1">
     <BORROWER><BORROWER_DETAIL><BorrowerClassificationType>Primary</BorrowerClassificationType></BORROWER_DETAIL></BORROWER>
     <ROLE_DETAIL><PartyRoleType>Borrower</PartyRoleType></ROLE_DETAIL>
    </ROLE></ROLES>
   </PARTY>
   <PARTY>
    <LEGAL_ENTITY><LEGAL_ENTITY_DETAIL><FullName>Title Co</FullName></LEGAL_ENTITY_DETAIL></LEGAL_ENTITY>
    <ROLES><ROLE xlink:label="TITLE_1"><ROLE_DETAIL><PartyRoleType>TitleCompany</PartyRoleType></ROLE_DETAIL></ROLE></ROLES>
   </PARTY>
  </PARTIES>
  <RELATIONSHIPS>
   <RELATIONSHIP xlink:from="ASSET_1" xlink:to="BORROWER_1" xlink:arcrole="urn:fdc:mismo.org:2009:residential/ASSET_IsAssociatedWith_ROLE"/>
   <RELATIONSHIP xlink:from="ASSET_1" xlink:to="BORROWER_2" xlink:arcrole="urn:fdc:mismo.org:2009:residential/ASSET_IsAssociatedWith_ROLE"/>
   <RELATIONSHIP xlink:from="ASSET_2" xlink:to="BORROWER_2" xlink:arcrole="urn:fdc:mismo.org:2009:residential/ASSET_IsAssociatedWith_ROLE"/>
   <RELATIONSHIP xlink:from="LIABILITY_1" xlink:to="BORROWER_1" xlink:arcrole="urn:fdc:mismo.org:2009:residential/LIABILITY_IsAssociatedWith_ROLE"/>
   <RELATIONSHIP xlink:from="LIABILITY_2" xlink:to="BORROWER_1" xlink:arcrole="urn:fdc:mismo.org:2009:residential/LIABILITY_IsAssociatedWith_ROLE"/>
   <RELATIONSHIP xlink:from="LIABILITY_2" xlink:to="BORROWER_2" xlink:arcrole="urn:fdc:mismo.org:2009:residential/LIABILITY_IsAssociatedWith_ROLE"/>
   <RELATIONSHIP xlink:from="LIABILITY_5" xlink:to="BORROWER_2" xlink:arcrole="urn:fdc:mismo.org:2009:residential/LIABILITY_IsAssociatedWith_ROLE"/>
   <RELATIONSHIP xlink:from="ASSET_4" xlink:to="LIABILITY_3" xlink:arcrole="urn:fdc:mismo.org:2009:residential/ASSET_IsAssociatedWith_LIABILITY"/>
   <RELATIONSHIP xlink:from="ASSET_4" xlink:to="LIABILITY_4" xlink:arcrole="urn:fdc:mismo.org:2009:residential/ASSET_IsAssociatedWith_LIABILITY"/>
  </RELATIONSHIPS>
 </DEAL></DEALS></DEAL_SET></DEAL_SETS>
</MESSAGE>`;

const parsed = parseMismo34(XML, { seed: 1000 });

describe("parseXml", () => {
  it("drops prefixes, decodes entities, keeps CDATA", () => {
    const t = parseXml(`<a:x b:y="1 &amp; 2"><z><![CDATA[<raw>]]></z><w>&#36;5</w></a:x>`);
    const x = t.children[0];
    expect(x.name).toBe("x");
    expect(x.attrs.y).toBe("1 & 2");
    expect(x.children[0].text).toBe("<raw>");
    expect(x.children[1].text).toBe("$5");
  });
});

describe("parseMismo34", () => {
  it("never carries account numbers, SSNs, or birth dates", () => {
    const blob = JSON.stringify(parsed);
    for (const secret of ["998877665544", "4321", "4111222233334444", "517805", "123456789", "1985-01-01"]) {
      expect(blob).not.toContain(secret);
    }
    expect(parsed.assets.every((a) => a.last4 === "")).toBe(true);
  });

  it("orders borrowers by classification, not file order", () => {
    expect(parsed.borrowers).toEqual(["Dana Rivera", "Sam Rivera"]);
  });

  it("maps assets, owners, and skips zero balances", () => {
    expect(parsed.assets).toEqual([
      { id: 1000, bank: "Chase Bank", last4: "", owner: "Joint", type: "Checking", value: 25000.5, forClosing: 0 },
      { id: 1001, bank: "Fidelity & Co", last4: "", owner: "Co-Borrower", type: "Retirement", value: 120000, forClosing: 0 },
    ]);
  });

  it("maps liabilities: types, owners, payoff, and empties dropped", () => {
    const byName = Object.fromEntries(parsed.debts.map((d) => [d.name, d]));
    expect(Object.keys(byName)).toEqual(["CAPITAL ONE", "Toyota Motor Credit", "Rocket Mortgage", "US Bank", "Navient"]);
    expect(byName["CAPITAL ONE"]).toMatchObject({ type: "Revolving", borrower: "Borrower 1", payoff: "No", balance: 2400, monthly: 85 });
    expect(byName["Toyota Motor Credit"]).toMatchObject({ type: "Auto Loan", borrower: "Joint", payoff: "Yes - at Escrow", months: 40 });
    expect(byName.Navient).toMatchObject({ type: "Student Loan", borrower: "Borrower 2", payoff: "Omit" });
  });

  it("builds REO, links its liens, and skips sold property", () => {
    expect(parsed.reos).toHaveLength(2);
    const [rental, departing] = parsed.reos;
    expect(rental).toMatchObject({
      address: "12 Elm St, Portland, OR 97230",
      propType: "Duplex", occupancy: "Invest.", propUse: "Investment",
      value: 650000, payment: 1950, mortgageBalance: 300000,
      includesTI: false, reoTax: 450,
    });
    // net 300 = 75% × gross − (1950 + 450) → gross 3600
    expect(rental.rentalIncome).toBe(3600);
    const liens = parsed.debts.filter((d) => d.linkedReoId === String(rental.id)).map((d) => d.type);
    expect(liens).toEqual(["Mortgage", "HELOC"]);
    expect(departing).toMatchObject({ occupancy: "Departing", propUse: "Primary", value: 500000 });
    expect(parsed.notes.join(" ")).toMatch(/Sold/);
  });

  it("treats a current home that becomes a rental as an investment", () => {
    const conv = XML.replace(
      "<PropertyCurrentUsageType>PrimaryResidence</PropertyCurrentUsageType>",
      "<PropertyCurrentUsageType>PrimaryResidence</PropertyCurrentUsageType><PropertyUsageType>Investment</PropertyUsageType>",
    ).replace("<OwnedPropertyDispositionStatusType>PendingSale</OwnedPropertyDispositionStatusType>", "<OwnedPropertyDispositionStatusType>Retain</OwnedPropertyDispositionStatusType>");
    const reo = parseMismo34(conv, { seed: 1 }).reos[1];
    expect(reo).toMatchObject({ occupancy: "Invest.", propUse: "Investment" });
  });

  it("rejects non-3.4 files with a useful message", () => {
    expect(() => parseMismo34("EH  1003 3.20 W\n00A 1234")).toThrow(/3\.2/);
    expect(() => parseMismo34("hello")).toThrow(MismoImportError);
  });
});

describe("mergeMismoImport", () => {
  it("appends new rows and is a no-op on re-import", () => {
    const first = mergeMismoImport({ assets: [], debts: [], reos: [] }, parsed);
    expect(first.added).toEqual({ assets: 2, debts: 5, reos: 2 });
    const again = mergeMismoImport(first, parseMismo34(XML, { seed: 5000 }));
    expect(again.added).toEqual({ assets: 0, debts: 0, reos: 0 });
    expect(again.debts).toHaveLength(5);
  });

  it("relinks liens to an REO the scenario already has", () => {
    const existing = { id: 42, address: "12 Elm St, Portland OR 97230" };
    const out = mergeMismoImport({ assets: [], debts: [], reos: [existing] }, parsed);
    expect(out.added.reos).toBe(1);
    expect(out.debts.filter((d) => d.linkedReoId === "42").map((d) => d.type)).toEqual(["Mortgage", "HELOC"]);
  });
});
