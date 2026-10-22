// ═══ CALIFORNIA CITY PROPERTY TAX RATES, BY COUNTY ═══
// Source of truth for every sourced CA city rate (CA_CITY_TAX_RATES in
// citiesData.js spreads these over its 1.25% placeholder block).
//
// Each county block records the fiscal year of ITS rates. Counties publish
// their rate books between August and November, so mid-refresh the table is
// a mix: a county stays on "2025-26" until its 2026-27 book is out, and the
// "All cities' rates" sheet labels those rows. A weekly scheduled check
// re-reads the counties still on the old year (Christo 2026-10-22).
//
// Rate = total ad-valorem rate, in PERCENT of assessed value, for the city's
// primary / most common Tax Rate Area: the 1% Prop 13 base + voter-approved
// bonds. Flat parcel taxes, Mello-Roos/CFDs and special assessments are NOT
// included. Every number comes from the county's own published document at
// `url`; never add a city without one (the 1.25% block in citiesData.js is a
// placeholder and must never show up as a sourced rate).

/** The fiscal year the table is being refreshed to. */
export const CA_TAX_CURRENT_FY = "2026-27";

/** Bay Area counties, in the order the rates sheet lists them. */
export const BAY_AREA_COUNTIES = ["Alameda", "Contra Costa", "San Mateo", "San Francisco", "Marin", "Santa Clara", "Napa", "Solano", "Sonoma"];

export const CA_TAX_COUNTIES = [
 {
  county: "Alameda", fy: "2026-27",
  source: "Alameda County Auditor-Controller, Tax Rate Search, Tax Year 2026-27",
  url: "https://audtaxpublic.alamedacountyca.gov/#/taxRate",
  rates: {
   "Alameda": 1.215, "Albany": 1.3465, "Ashland": 1.2654, "Berkeley": 1.2313,
   "Castro Valley": 1.18, "Cherryland": 1.2126, "Dublin": 1.2331, "Emeryville": 1.1627,
   "Fairview": 1.2126, "Fremont": 1.1746, "Hayward": 1.1966, "Livermore": 1.1384,
   "Newark": 1.1458, "Oakland": 1.2849, "Piedmont": 1.1819, "Pleasanton": 1.1691,
   "San Leandro": 1.2308, "San Lorenzo": 1.2654, "Sunol": 1.1346, "Union City": 1.2641,
  },
 },
 {
  county: "Contra Costa", fy: "2026-27",
  source: "Contra Costa Treasurer-Tax Collector, 2026-27 secured tax bills by TRA",
  url: "https://taxcolp.cccttc.us/lookup/",
  rates: {
   "Alamo": 1.0957, "Alhambra Valley": 1.1526, "Antioch": 1.0498, "Bay Point": 1.1038,
   "Bayview": 1.2746, "Blackhawk": 1.0957, "Brentwood": 1.1071, "Byron": 1.0995,
   "Camino Tassajara": 1.0957, "Castle Hill": 1.097, "Clayton": 1.1038, "Clyde": 1.1038,
   "Concord": 1.1038, "Crockett": 1.1027, "Danville": 1.0957, "Diablo": 1.0957,
   "Discovery Bay": 1.0995, "East Richmond Heights": 1.2746, "El Cerrito": 1.2746,
   "El Sobrante": 1.2746, "Hercules": 1.2746, "Kensington": 1.2746, "Knightsen": 1.0593,
   "Lafayette": 1.0833, "Martinez": 1.1691, "Montalvin Manor": 1.2746, "Moraga": 1.1132,
   "Norris Canyon": 1.0957, "North Gate": 1.1038, "North Richmond": 1.2746, "Oakley": 1.0903,
   "Orinda": 1.1415, "Pinole": 1.2746, "Pittsburg": 1.1346, "Pleasant Hill": 1.1167,
   "Port Costa": 1.1027, "Richmond": 1.4146, "Rodeo": 1.1027, "San Miguel": 1.1038,
   "San Pablo": 1.2746, "San Ramon": 1.0957, "Saranap": 1.097, "Tara Hills": 1.2746,
   "Vine Hill": 1.1526, "Walnut Creek": 1.097,
  },
 },
 {
  county: "San Mateo", fy: "2025-26",
  source: "Tax Rates and Valuation of Taxable Property of San Mateo County, fiscal year 2025-2026 (County Controller)",
  url: "https://www.smcgov.org/media/157077/download?attachment",
  rates: {
   "Atherton": 1.0913, "Belmont": 1.1247, "Brisbane": 1.156, "Broadmoor": 1.1602,
   "Burlingame": 1.1196, "Colma": 1.1602, "Daly City": 1.1602, "East Palo Alto": 1.1191,
   "El Granada": 1.1598, "Emerald Hills": 1.0941, "Foster City": 1.1456,
   "Half Moon Bay": 1.1598, "Highlands": 1.1171, "Hillsborough": 1.1185, "La Honda": 1.1146,
   "Loma Mar": 1.1146, "Menlo Park": 1.0958, "Millbrae": 1.1263, "Montara": 1.1828,
   "Moss Beach": 1.1828, "North Fair Oaks": 1.0941, "Pacifica": 1.1774, "Pescadero": 1.1146,
   "Portola Valley": 1.086, "Redwood City": 1.0941, "San Bruno": 1.0831, "San Carlos": 1.1161,
   "San Gregorio": 1.1146, "San Mateo": 1.1201, "South San Francisco": 1.0718,
   "Woodside": 1.0935,
  },
 },
 {
  county: "San Francisco", fy: "2026-27",
  source: "San Francisco Treasurer & Tax Collector, Secured Property Taxes: 'The secured property tax rate for Fiscal Year 2026-27 is 1.18162182%'",
  url: "https://sftreasurer.org/property/secured-property-taxes",
  rates: {
   "San Francisco": 1.18162182,
  },
 },
 {
  county: "Marin", fy: "2025-26",
  source: "County of Marin Department of Finance, 2025-2026 Tax Rate Book",
  url: "https://assets.marincounty.gov/marincounty-prod/public/2026-04/FY2025-26%20TaxRateBook.pdf",
  rates: {
   "Belvedere": 1.0968, "Bolinas": 1.0752, "Corte Madera": 1.1213, "Dillon Beach": 1.0653,
   "Fairfax": 1.2211, "Forest Knolls": 1.0981, "Greenbrae": 1.1321, "Inverness": 1.0653,
   "Kentfield": 1.1321, "Lagunitas": 1.0981, "Larkspur": 1.1213, "Marshall": 1.0653,
   "Mill Valley": 1.1214, "Muir Beach": 1.1214, "Nicasio": 1.0752, "Novato": 1.1184,
   "Point Reyes Station": 1.0653, "Ross": 1.1257, "San Anselmo": 1.1681,
   "San Geronimo": 1.0981, "San Rafael": 1.2056, "Sausalito": 1.1356, "Stinson Beach": 1.0752,
   "Tiburon": 1.0968, "Tomales": 1.0853, "Woodacre": 1.0981,
  },
 },
 {
  county: "Santa Clara", fy: "2025-26",
  source: "County of Santa Clara Compilation of Tax Rates & Information, Fiscal Year 2025-2026 (Controller-Treasurer)",
  url: "https://files.santaclaracounty.gov/exjcpb1531/2025-11/tax-rate-book-2025-2026.pdf?VersionId=HHMZ1VmGwFXqVvpM36xuptkIcV2V8ctE",
  rates: {
   "Campbell": 1.2169, "Cupertino": 1.1636, "Gilroy": 1.2186, "Los Altos": 1.153,
   "Los Altos Hills": 1.153, "Los Gatos": 1.1459, "Milpitas": 1.1389, "Monte Sereno": 1.1483,
   "Morgan Hill": 1.1297, "Mountain View": 1.1599, "Palo Alto": 1.20135, "San Jose": 1.2079,
   "San Martin": 1.1297, "Santa Clara": 1.1825, "Saratoga": 1.1467, "Stanford": 1.1963,
   "Sunnyvale": 1.173,
  },
 },
 {
  county: "Napa", fy: "2026-27",
  source: "County of Napa - Tax Rates and Information For Fiscal Year 2026-27 (Auditor-Controller Tracy A. Schulze, dated 9/30/26)",
  url: "https://www.napacounty.gov/Archive.aspx?ADID=1176",
  rates: {
   "American Canyon": 1.1073, "Angwin": 1.0189, "Calistoga": 1.0809, "Deer Park": 1.0501,
   "Moskowite Corner": 1.1122, "Napa": 1.1272, "Oakville": 1.0501, "Rutherford": 1.0501,
   "St. Helena": 1.0592, "Yountville": 1.0934,
  },
 },
 {
  county: "Solano", fy: "2026-27",
  source: "Tax Rates Compilation and Analysis FY 26-27 - Sheet: 2026-27 CITY TAX RATES ('General Tax Rate by City', Solano County Auditor-Controller, 10/2/2026)",
  url: "https://content.solanocounty.gov/sites/default/files/2026-10/General_Tax_Rates_by_City_2627.pdf",
  rates: {
   "Benicia": 1.134905, "Dixon": 1.107488, "Fairfield": 1.121057, "Rio Vista": 1.079695,
   "Suisun City": 1.121587, "Vacaville": 1.15319, "Vallejo": 1.119188,
  },
 },
 {
  county: "Sonoma", fy: "2026-27",
  source: "County of Sonoma ACTTC - Multi-Year Tax Rates, Tax Year 2026 (FY 2026-2027), report dated 9/15/2026",
  url: "https://sonomacounty.gov/Main%20County%20Site/Administrative%20Support%20%26%20Fiscal%20Services/ACTTC/Documents/Property%20Tax%20Accounting/Multi-Year%20Tax%20Rates/Multi%20Year%20Tax%20Rates%20FY%202026-2027.pdf",
  rates: {
   "Bodega": 1.1257, "Bodega Bay": 1.0614, "Boyes Hot Springs": 1.11396, "Cazadero": 1.072,
   "Cloverdale": 1.169, "Cotati": 1.139, "El Verano": 1.11396, "Forestville": 1.1237,
   "Fulton": 1.1285, "Geyserville": 1.0835, "Glen Ellen": 1.11396, "Graton": 1.1207,
   "Guerneville": 1.1167, "Healdsburg": 1.1255, "Jenner": 1.1032, "Kenwood": 1.1125,
   "Larkfield-Wikiup": 1.1285, "Monte Rio": 1.1032, "Occidental": 1.1257, "Penngrove": 1.1243,
   "Petaluma": 1.1243, "Rio Nido": 1.1167, "Rohnert Park": 1.139, "Santa Rosa": 1.1315,
   "Sebastopol": 1.1502, "Sonoma": 1.11396, "The Sea Ranch": 1.0625, "Valley Ford": 1.0614,
   "Windsor": 1.1235,
  },
 },
 {
  county: "Butte", fy: "2026-27",
  source: "County of Butte Multi-Year Tax Rates, Tax Year 2026 ('Multi-Rate Taxes 2026-2027', AUD70-2360-020 dated 9/8/2026)",
  url: "https://www.buttecounty.net/DocumentCenter/View/19833",
  rates: {
   "Biggs": 1.070388, "Chico": 1.150619, "Gridley": 1.079074, "Oroville": 1.060271,
   "Paradise": 1.070816,
  },
 },
 {
  county: "Calaveras", fy: "2025-26",
  source: "Calaveras County Tax Rates 2025-26 (Tax Rate Breakdown)",
  url: "https://auditor.calaverasgov.us/Portals/Auditor/Documents/Reports/Property%20Tax%20Rates/FY%202025-26%20Calaveras%20County%20Tax%20Rates.pdf",
  rates: {
   "Angels Camp": 1.07172,
  },
 },
 {
  county: "Colusa", fy: "2025-26",
  source: "Market Valuations, Tax Allocations, and Tax Rates 2025-2026 (Secured Tax Rate Table by Tax Rate Area)",
  url: "https://www.countyofcolusaca.gov/DocumentCenter/View/19775/2025-26-Market-Valuations-Tax-Allocations-and-Tax-Rates",
  rates: {
   "Colusa": 1.10081, "Williams": 1.118295,
  },
 },
 {
  county: "El Dorado", fy: "2026-27",
  source: "County of El Dorado Multi-Year Tax Rates, Tax Year 2026 (report dated 8/17/2026)",
  url: "https://www.eldoradocounty.ca.gov/files/assets/county/v/1/documents/government/auditor-controller/property-tax-division/ad-valorem-tax-rates/tax-rates-by-tax-rate-area/2026-27taxrates.pdf",
  rates: {
   "Cameron Park": 1.069349, "Camino": 1.047804, "Diamond Springs": 1.038961,
   "El Dorado Hills": 1.049167, "Georgetown": 1.081761, "Meyers": 1.092267,
   "Placerville": 1.040657, "Pollock Pines": 1.075892, "Shingle Springs": 1.04417,
   "South Lake Tahoe": 1.092267,
  },
 },
 {
  county: "Fresno", fy: "2025-26",
  source: "County of Fresno Fiscal Year 2025-26 Tax Rate Book (Tax Rates by Tax Rate Area)",
  url: "https://www.fresnocountyca.gov/files/assets/county/v/1/auditor-controller-treasurer-tax-collector/publications/tax-rate-book/2025-2026-tax-rate-book.pdf",
  rates: {
   "Clovis": 1.175384, "Coalinga": 1.236288, "Firebaugh": 1.118032, "Fowler": 1.157946,
   "Fresno": 1.291336, "Huron": 1.164288, "Kerman": 1.151986, "Kingsburg": 1.11795,
   "Mendota": 1.131336, "Orange Cove": 1.127874, "Parlier": 1.277812, "Reedley": 1.161368,
   "San Joaquin": 1.078922, "Sanger": 1.258128, "Selma": 1.171458,
  },
 },
 {
  county: "Humboldt", fy: "2025-26",
  source: "County of Humboldt Multi-Year Tax Rates 2025-26 (Tax Year 2025)",
  url: "https://humboldtgov.org/DocumentCenter/View/141439",
  rates: {
   "Arcata": 1.07, "Blue Lake": 1.045, "Eureka": 1.084, "Ferndale": 1.028, "Fortuna": 1.077,
   "Rio Dell": 1.054, "Trinidad": 1.059,
  },
 },
 {
  county: "Imperial", fy: "2025-26",
  source: "County of Imperial Multi-Year Tax Rates, Tax Year 2025 (run 8/21/2025)",
  url: "https://auditor.imperialcounty.org/wp-content/uploads/2025/08/2025-26-Multi-Year-Tax-Rates-2.pdf",
  rates: {
   "Brawley": 1.1392, "Calexico": 1.2559, "Calipatria": 1.1996, "El Centro": 1.153,
   "Holtville": 1.1087, "Imperial": 1.1063, "Westmorland": 1.145,
  },
 },
 {
  county: "Kern", fy: "2025-26",
  source: "County of Kern Tax Rates and Assessed Valuations 2025-2026 (Auditor-Controller-County Clerk)",
  url: "https://www.auditor.co.kern.ca.us/RateBook/TaxRates2526.pdf",
  rates: {
   "Arvin": 1.147888, "Bakersfield": 1.163785, "California City": 1.208364, "Delano": 1.136411,
   "Maricopa": 1.052132, "McFarland": 1.177143, "Ridgecrest": 1.156682, "Shafter": 1.099735,
   "Taft": 1.18385, "Tehachapi": 1.146271, "Wasco": 1.165475,
  },
 },
 {
  county: "Kings", fy: "2026-27",
  source: "Kings County Tax Rates 2026-2027 (Multi-Year Tax Rates report dated 9/23/2026, compiled under the Kings County Director of Finance)",
  url: "https://www.countyofkingsca.gov/home/showpublisheddocument/42250/639280906105870000",
  rates: {
   "Avenal": 1.126219, "Corcoran": 1.055765, "Hanford": 1.07601, "Lemoore": 1.082667,
  },
 },
 {
  county: "Lake", fy: "2025-26",
  source: "County of Lake 2025-2026 Tax Rates (Tax Rate Book, Auditor-Controller/County Clerk)",
  url: "https://www.lakecountyca.gov/DocumentCenter/View/15304",
  rates: {
   "Clearlake": 1.117037, "Lakeport": 1.117821,
  },
 },
 {
  county: "Lassen", fy: "2025-26",
  source: "County of Lassen Fiscal Year 2025/2026 Tax Rates by Tax Rate Area",
  url: "https://www.lassencounty.gov/DocumentCenter/View/208",
  rates: {
   "Susanville": 1.0376,
  },
 },
 {
  county: "Los Angeles", fy: "2026-27",
  source: "LA County Auditor-Controller, Tax Rate Area rates FY 2026/2027 (TRA-2026-2027.csv, file dated 2026-09-23); prior year from TRA-2025-2026.csv",
  url: "https://auditor.lacounty.gov/wp-content/uploads/2026/09/TRA-2026-2027.zip",
  rates: {
   "Agoura Hills": 1.155199, "Alhambra": 1.174474, "Arcadia": 1.126256, "Artesia": 1.138537,
   "Avalon": 1.250525, "Azusa": 1.169425, "Baldwin Park": 1.202704, "Bell": 1.445676,
   "Bell Gardens": 1.132499, "Bellflower": 1.120591, "Beverly Hills": 1.189084,
   "Bradbury": 1.248671, "Burbank": 1.106555, "Calabasas": 1.155199, "Carson": 1.173222,
   "Cerritos": 1.138537, "Claremont": 1.126038, "Commerce": 1.132499, "Compton": 1.602187,
   "Covina": 1.181752, "Cudahy": 1.173222, "Culver City": 1.111912, "Diamond Bar": 1.17381,
   "Downey": 1.188562, "Duarte": 1.248671, "El Monte": 1.359833, "El Segundo": 1.144919,
   "Gardena": 1.173222, "Glendale": 1.112785, "Glendora": 1.117116,
   "Hawaiian Gardens": 1.138537, "Hawthorne": 1.224114, "Hermosa Beach": 1.065787,
   "Hidden Hills": 1.155199, "Huntington Park": 1.383222, "Industry": 1.140947,
   "Inglewood": 1.280868, "Irwindale": 1.181752, "La Canada Flintridge": 1.099583,
   "La Habra Heights": 1.1291, "La Mirada": 1.206993, "La Puente": 1.140947,
   "La Verne": 1.13176, "Lakewood": 1.259025, "Lancaster": 1.175643, "Lawndale": 1.232834,
   "Lomita": 1.173222, "Long Beach": 1.259025, "Los Angeles": 1.185825, "Lynwood": 1.314895,
   "Malibu": 1.19711, "Manhattan Beach": 1.112987, "Maywood": 1.273222, "Monrovia": 1.284324,
   "Montebello": 1.330374, "Monterey Park": 1.265649, "Norwalk": 1.206993,
   "Palmdale": 1.396483, "Palos Verdes Estates": 1.104834, "Paramount": 1.205071,
   "Pasadena": 1.172477, "Pico Rivera": 1.228113, "Pomona": 1.250794,
   "Rancho Palos Verdes": 1.104834, "Redondo Beach": 1.125565, "Rolling Hills": 1.104834,
   "Rolling Hills Estates": 1.104834, "Rosemead": 1.158734, "San Dimas": 1.13176,
   "San Fernando": 1.353693, "San Gabriel": 1.33353, "San Marino": 1.068066,
   "Santa Clarita": 1.18592, "Santa Fe Springs": 1.1865, "Santa Monica": 1.195588,
   "Sierra Madre": 1.165677, "Signal Hill": 1.259025, "South El Monte": 1.122567,
   "South Gate": 1.173222, "South Pasadena": 1.09841, "Temple City": 1.120193,
   "Torrance": 1.101432, "Vernon": 1.173222, "Walnut": 1.17381, "West Covina": 1.147802,
   "West Hollywood": 1.173222, "Westlake Village": 1.155199, "Whittier": 1.172157,
  },
 },
 {
  county: "Madera", fy: "2025-26",
  source: "County of Madera 2025-26 Multi-Year Tax Rates (Auditor-Controller, dated 9/2/2025)",
  url: "https://www.maderacounty.com/home/showpublisheddocument/46601/639005479334030000",
  rates: {
   "Chowchilla": 1.092939, "Madera": 1.144041,
  },
 },
 {
  county: "Mariposa", fy: "2025-26",
  source: "County of Mariposa Multi-Year Tax Rates, Tax Year 2025 (run 12/10/2025) - 'Tax Rates - 2025-2026'",
  url: "https://www.mariposacounty.gov/DocumentCenter/View/101391",
  rates: {
   "Mariposa": 1.039306,
  },
 },
 {
  county: "Mendocino", fy: "2025-26",
  source: "Mendocino County Tax Rates By TAG, Tax Year 2025 (= FY 2025-26; printed 9/23/2025)",
  url: "https://www.mendocinocounty.gov/files/3928c133-141e-41a7-9c4a-b57f8f50d432/2025-Tax-Rates-by-TAG.pdf",
  rates: {
   "Fort Bragg": 1.157, "Point Arena": 1.0295, "Ukiah": 1.21, "Willits": 1.086,
  },
 },
 {
  county: "Merced", fy: "2026-27",
  source: "County of Merced Property Tax Rates, Fiscal Year Ending June 30, 2027 (Auditor-Controller AUD70-2360-020; header says 'not audited nor verified')",
  url: "https://www.countyofmerced.com/Archive.aspx?ADID=982",
  rates: {
   "Atwater": 1.0684, "Dos Palos": 1.0062, "Gustine": 1.0321, "Livingston": 1.0417,
   "Los Banos": 1.077, "Merced": 1.1105,
  },
 },
 {
  county: "Monterey", fy: "2026-27",
  source: "County of Monterey Tax Rate Book Fiscal Year 2026-27 (Auditor-Controller), Tax Rate Area (TRA) Rates section",
  url: "https://www.countyofmonterey.gov/home/showpublisheddocument/148966/639274949766300000",
  rates: {
   "Carmel Valley": 1.03495, "Carmel-by-the-Sea": 1.03495, "Castroville": 1.086492,
   "Del Rey Oaks": 1.152012, "Gonzales": 1.125218, "Greenfield": 1.219013,
   "King City": 1.231468, "Marina": 1.166196, "Monterey": 1.152012, "Pacific Grove": 1.100261,
   "Pebble Beach": 1.03495, "Prunedale": 1.086492, "Salinas": 1.17079, "Sand City": 1.152012,
   "Seaside": 1.152012, "Soledad": 1.179702,
  },
 },
 {
  county: "Nevada", fy: "2026-27",
  source: "County of Nevada Multi-Year Tax Rates, Tax Year 2026 (Multi-Year Tax Rates 26-27, run 9/14/2026)",
  url: "https://www.nevadacountyca.gov/DocumentCenter/View/71265/Multi-Year-Tax-Rates-26-27",
  rates: {
   "Grass Valley": 1.066228, "Nevada City": 1.045819, "North San Juan": 1.069949,
   "Penn Valley": 1.045819, "Rough and Ready": 1.045819, "Soda Springs": 1.050091,
   "Truckee": 1.050091, "Washington": 1.069949,
  },
 },
 {
  county: "Orange", fy: "2026-27",
  source: "County of Orange Property Tax Rates 2026-2027 (Tax Rate Book, Auditor-Controller Andrew N. Hamilton)",
  url: "https://ocauditor.gov/wp-content/uploads/2026/09/2026-27-Property-Tax-Rate-Book.pdf",
  rates: {
   "Aliso Viejo": 1.0085, "Anaheim": 1.13216, "Brea": 1.13474, "Buena Park": 1.13546,
   "Costa Mesa": 1.05129, "Cypress": 1.11632, "Dana Point": 1.0085, "Fountain Valley": 1.0755,
   "Fullerton": 1.10664, "Garden Grove": 1.20115, "Huntington Beach": 1.10101,
   "Irvine": 1.03515, "La Habra": 1.11409, "La Palma": 1.13546, "Laguna Beach": 1.01226,
   "Laguna Hills": 1.0272, "Laguna Niguel": 1.0085, "Laguna Woods": 1.0272,
   "Lake Forest": 1.0272, "Los Alamitos": 1.11374, "Mission Viejo": 1.0085,
   "Newport Beach": 1.05129, "Orange": 1.05993, "Placentia": 1.08146,
   "Rancho Santa Margarita": 1.0272, "San Clemente": 1.0085, "San Juan Capistrano": 1.02314,
   "Santa Ana": 1.14059, "Seal Beach": 1.11314, "Stanton": 1.14794, "Tustin": 1.08342,
   "Villa Park": 1.05993, "Westminster": 1.10226, "Yorba Linda": 1.08146,
  },
 },
 {
  county: "Placer", fy: "2025-26",
  source: "Placer County Property Tax Rates for 2025/26 (Resolution Nos. 2025-181 and 2025-189), Tax Rate Schedule",
  url: "https://www.placer.ca.gov/Archive.aspx?ADID=1011",
  rates: {
   "Auburn": 1.024754, "Colfax": 1.007522, "Foresthill": 1.007522, "Granite Bay": 1.021232,
   "Lincoln": 1.040201, "Loomis": 1.025591, "Meadow Vista": 1.007522, "Newcastle": 1.025591,
   "North Auburn": 1.024754, "Penryn": 1.025591, "Rocklin": 1.087306, "Roseville": 1.029901,
   "Sheridan": 1.040201,
  },
 },
 {
  county: "Plumas", fy: "2026-27",
  source: "County of Plumas Multi-Year Tax Rates, Tax Year 2026 (run 10/20/2026) - '2026-2027 Multiple-Year Tax Rates'",
  url: "https://www.plumascounty.us/Archive.aspx?ADID=19530",
  rates: {
   "Portola": 1.04047, "Quincy": 1.07321,
  },
 },
 {
  county: "Riverside", fy: "2026-27",
  source: "Riverside County Auditor-Controller - Tax Rates portal (Aumentum), Tax Year 2026 (= FY 2026-27), 'Export all data to csv'",
  url: "https://ca-riverside-aco.publicaccessnow.com/DesktopModules/TaxRates/API/Module/GetCsv?taxYear=2026",
  rates: {
   "Banning": 1.35432, "Beaumont": 1.28923, "Blythe": 1.06262, "Calimesa": 1.22066,
   "Canyon Lake": 1.0586, "Cathedral City": 1.20144, "Coachella": 1.24219, "Corona": 1.10397,
   "Desert Hot Springs": 1.14144, "Eastvale": 1.10397, "Hemet": 1.1316, "Indian Wells": 1.22,
   "Indio": 1.22, "Jurupa Valley": 1.11617, "La Quinta": 1.24219, "Lake Elsinore": 1.0586,
   "Menifee": 1.14232, "Moreno Valley": 1.13729, "Murrieta": 1.10021, "Norco": 1.10397,
   "Palm Desert": 1.22, "Palm Springs": 1.14144, "Perris": 1.12617, "Rancho Mirage": 1.20144,
   "Riverside": 1.10117, "San Jacinto": 1.1816, "Temecula": 1.02778, "Wildomar": 1.0586,
  },
 },
 {
  county: "Sacramento", fy: "2026-27",
  source: "Sacramento County 2026-2027 Compilation of Tax Rates by Code Area (Auditor-Controller)",
  url: "https://finance.saccounty.gov/content/dam/finance/docs/a-c/tax-acct/rate-book/26-27.pdf",
  rates: {
   "Arden-Arcade": 1.18831097, "Carmichael": 1.19807381, "Citrus Heights": 1.18831097,
   "Elk Grove": 1.08023087, "Fair Oaks": 1.20463268, "Folsom": 1.08311224, "Galt": 1.10300272,
   "Isleton": 1.07259495, "North Highlands": 1.18697092, "Orangevale": 1.18831097,
   "Rancho Cordova": 1.28321842, "Rio Linda": 1.18697092, "Sacramento": 1.138746,
  },
 },
 {
  county: "San Benito", fy: "2024-25",
  source: "County of San Benito Multi-Year Tax Rates, Tax Year 2024 (report dated 9/4/2024, i.e. FY 2024-25)",
  url: "https://www.sanbenitocountyca.gov/home/showpublisheddocument/13608/638744483697870000",
  rates: {
   "Hollister": 1.131668, "San Juan Bautista": 1.121448,
  },
 },
 {
  county: "San Bernardino", fy: "2025-26",
  source: "San Bernardino County Valuations - Tax Rates, Code Area Tax Rates 2025-2026 (Tax Rate Book, Auditor-Controller/Treasurer/Tax Collector Ensen Mason)",
  url: "https://downloads.ctfassets.net/wrl7z79vuuk1/3jjPtwSNSeRzsObPJySmgq/4d41f949f1bf79c030c00ad06b45fbff/FY2025-26_Tax_Rate_Book_-_Print_Proof_v2_ADS.pdf",
  rates: {
   "Adelanto": 1.1727, "Apple Valley": 1.1014, "Barstow": 1.1183, "Big Bear Lake": 1.0567,
   "Chino": 1.1094, "Chino Hills": 1.1094, "Colton": 1.2401, "Fontana": 1.1131,
   "Grand Terrace": 1.2401, "Hesperia": 1.0746, "Highland": 1.2343, "Loma Linda": 1.2343,
   "Montclair": 1.0947, "Needles": 1.0647, "Ontario": 1.0947, "Rancho Cucamonga": 1.0811,
   "Redlands": 1.2343, "Rialto": 1.2331, "San Bernardino": 1.2416, "Twentynine Palms": 1.085,
   "Upland": 1.0732, "Victorville": 1.2261, "Yucaipa": 1.1599, "Yucca Valley": 1.14,
  },
 },
 {
  county: "San Diego", fy: "2026-27",
  source: "San Diego County Auditor & Controller - Tax Rate by Tax Rate Area Search (FY 2026/2027), 'typical Tax Rate Area for each city' table",
  url: "https://trasearch.sandiegocounty.gov/",
  rates: {
   "Carlsbad": 1.08685, "Chula Vista": 1.1696, "Coronado": 1.06872, "Del Mar": 1.0632,
   "El Cajon": 1.175, "Encinitas": 1.05568, "Escondido": 1.13905, "Imperial Beach": 1.1984,
   "La Mesa": 1.17919, "Lemon Grove": 1.25571, "National City": 1.17114, "Oceanside": 1.11199,
   "Poway": 1.11935, "San Diego": 1.25295, "San Marcos": 1.10836, "Santee": 1.1683,
   "Solana Beach": 1.05951, "Vista": 1.08707,
  },
 },
 {
  county: "San Joaquin", fy: "2026-27",
  source: "County of San Joaquin Multi-Year Tax Rates, Tax Year 2026 (2026-27 Property Tax Rates, run 9/16/2026)",
  url: "https://www.sjgov.org/docs/default-source/auditor-controller-documents/property-tax/assessed-values-and-tax-rates/2026-2027/2026-27-property-tax-rates.pdf?sfvrsn=b5c326a7_1",
  rates: {
   "Escalon": 1.0513, "Lathrop": 1.0985, "Lodi": 1.0623, "Manteca": 1.0985,
   "Mountain House": 1.0553, "Ripon": 1.0529, "Stockton": 1.2255, "Tracy": 1.1254,
  },
 },
 {
  county: "San Luis Obispo", fy: "2025-26",
  source: "County of San Luis Obispo Property Tax Rates: Bonds Levied, Tax Rates by Fund & TRA 2025-2026",
  url: "https://www.slocounty.ca.gov/departments/auditor-controller-treasurer-tax-collector-public/forms-documents/property-tax-reports-and-documents/property-tax-rates/2025-26-property-tax-rates",
  rates: {
   "Arroyo Grande": 1.06821, "Atascadero": 1.14225, "Grover Beach": 1.15321,
   "Morro Bay": 1.10221, "Paso Robles": 1.10731, "Pismo Beach": 1.06821,
   "San Luis Obispo": 1.10221, "Templeton": 1.13421,
  },
 },
 {
  county: "Santa Barbara", fy: "2026-27",
  source: "Tax Rate Book - County of Santa Barbara, Tax Year 2026 (file 2026-27TaxRateBook.pdf, run 10/21/2026)",
  url: "https://www.countyofsb.org/asset/484c731b-b30b-479b-a3ef-8af8bc1a3273",
  rates: {
   "Buellton": 1.07714, "Carpinteria": 1.04597, "Goleta": 1.04512, "Guadalupe": 1.18179,
   "Isla Vista": 1.04512, "Lompoc": 1.12369, "Montecito": 1.02872, "Orcutt": 1.09668,
   "Santa Barbara": 1.05079, "Santa Maria": 1.10326, "Solvang": 1.05673,
  },
 },
 {
  county: "Santa Cruz", fy: "2026-27",
  source: "County of Santa Cruz 2026-2027 Property Tax Rates (Auditor-Controller-Treasurer-Tax Collector)",
  url: "https://www.santacruzcountyca.gov/Portals/0/County/auditor/2026-27%20Tax%20Rate%20Book.pdf",
  rates: {
   "Ben Lomond": 1.136767, "Bonny Doon": 1.097322, "Boulder Creek": 1.136767,
   "Capitola": 1.125819, "Felton": 1.136767, "Santa Cruz": 1.128718, "Scotts Valley": 1.120825,
   "Soquel": 1.125819, "Watsonville": 1.218905,
  },
 },
 {
  county: "Shasta", fy: "2026-27",
  source: "County of Shasta Multi-Year Tax Rates, Tax Year 2026 ('2026 Ad Valorem Rates by TRA', AUD70-2360-020 dated 09/14/2026)",
  url: "https://www.shastacounty.gov/media/86236",
  rates: {
   "Anderson": 1.107583, "Redding": 1.073887, "Shasta Lake": 1.142615,
  },
 },
 {
  county: "Sierra", fy: "2025-26",
  source: "Sierra County Property Tax Rates and Special Assessments 2025-26",
  url: "https://www.sierracounty.ca.gov/DocumentCenter/View/11483/tax-rates-2025-26",
  rates: {
   "Downieville": 1.0315, "Loyalton": 1,
  },
 },
 {
  county: "Stanislaus", fy: "2025-26",
  source: "County of Stanislaus Detail of Tax Rates, Fiscal Year 2025/2026 (Secured Tax Rates, Tax Year 2025-2026)",
  url: "https://www.stancounty.com/auditor/pdf/propertytaxdivision/taxrates/2025-tax-book-rate.pdf",
  rates: {
   "Ceres": 1.169174, "Denair": 1.152829, "Empire": 1.081129, "Hughson": 1.132943,
   "Keyes": 1.11656, "Modesto": 1.169445, "Newman": 1.155618, "Oakdale": 1.116225,
   "Patterson": 1.148282, "Riverbank": 1.1951, "Salida": 1.111367, "Turlock": 1.071385,
   "Waterford": 1.103165,
  },
 },
 {
  county: "Sutter", fy: "2026-27",
  source: "2026-27 County of Sutter Tax Rates (Auditor-Controller worksheet, completed 09/10/26)",
  url: "https://www.sutter.gov/home/showpublisheddocument/10011/639265266863300000",
  rates: {
   "Live Oak": 1.125634, "Yuba City": 1.098508,
  },
 },
 {
  county: "Tehama", fy: "2025-26",
  source: "County of Tehama Tax Rates - 2025-2026",
  url: "https://www.tehama.gov/wp-content/uploads/2025/09/TAX-RATES-25-26.pdf",
  rates: {
   "Corning": 1.056, "Red Bluff": 1.0368, "Tehama": 1.0139,
  },
 },
 {
  county: "Trinity", fy: "2026-27",
  source: "Trinity County Tax Rates 2026/27 (TRA Rates)",
  url: "https://www.trinitycounty.org/Archive.aspx?ADID=220",
  rates: {
   "Weaverville": 1.014622,
  },
 },
 {
  county: "Tulare", fy: "2026-27",
  source: "County of Tulare Tax Rates Fiscal Year 2026-2027 (Tax Rate Book, Auditor-Controller/Treasurer-Tax Collector; multi-year rates run dated 9/17/2026)",
  url: "https://tc-web.widen.net/s/qxwpq6j2ft/2026.27-tax-rate-booklet",
  rates: {
   "Dinuba": 1.155878, "Exeter": 1.082, "Farmersville": 1.1133, "Lindsay": 1.153,
   "Porterville": 1.070151, "Tulare": 1.098, "Visalia": 1.084518, "Woodlake": 1.04,
  },
 },
 {
  county: "Ventura", fy: "2026-27",
  source: "Ventura County Auditor-Controller, Tax Rate Book For Fiscal Year 2026-27 (per-city TRA PDFs) + '2026-27 Tax Rate Data as of September, 2026'",
  url: "https://venturacounty.gov/auditor-controllers-office/tax-rates-and-other-information-2026-2027/",
  rates: {
   "Camarillo": 1.0959, "Fillmore": 1.126, "Moorpark": 1.0703, "Oak Park": 1.158,
   "Ojai": 1.081855, "Oxnard": 1.208818, "Port Hueneme": 1.1478, "Santa Paula": 1.1002,
   "Simi Valley": 1.0983, "Thousand Oaks": 1.0487, "Ventura": 1.0761,
  },
 },
 {
  county: "Yolo", fy: "2026-27",
  source: "Yolo County 2026-27 Tax Rates by TRA (Multi-Year Tax Rates, Tax Year 2026, run 9/10/2026)",
  url: "https://www.yolocounty.gov/home/showpublisheddocument/89386/639249741063300000",
  rates: {
   "Clarksburg": 1.113079, "Davis": 1.069162, "Dunnigan": 1.056454, "El Macero": 1.069162,
   "Esparto": 1.030657, "Knights Landing": 1.047657, "West Sacramento": 1.152662,
   "Winters": 1.186709, "Woodland": 1.047657,
  },
 },
 {
  county: "Yuba", fy: "2024-25",
  source: "County of Yuba Multi-Year Tax Rates, Tax Year 2024 (run 9/23/2024)",
  url: "https://www.yuba.gov/Documents/Departments/Departments%20A%20to%20B/Auditor%20Controller/Property%20Taxes/2024-25%20Multi-Year%20Rates.pdf",
  rates: {
   "Marysville": 1.112399, "Wheatland": 1.050163,
  },
 },
];

/** city -> { county, fy, pct, source, url } for every sourced city. */
export const CA_CITY_TAX_INFO = {};
for (const c of CA_TAX_COUNTIES) {
 for (const [city, pct] of Object.entries(c.rates)) {
  CA_CITY_TAX_INFO[city] = { county: c.county, fy: c.fy, pct, source: c.source, url: c.url };
 }
}

/** city -> rate as a decimal (1.1827% -> 0.011827), the form the calculators use. */
export const CA_CITY_TAX_SOURCED = Object.fromEntries(
 Object.entries(CA_CITY_TAX_INFO).map(([city, x]) => [city, Math.round(x.pct * 1e7) / 1e9]),
);

/** Counties whose rates are still from an earlier year than CA_TAX_CURRENT_FY. */
export const CA_TAX_STALE_COUNTIES = CA_TAX_COUNTIES.filter((c) => c.fy !== CA_TAX_CURRENT_FY).map((c) => c.county);
