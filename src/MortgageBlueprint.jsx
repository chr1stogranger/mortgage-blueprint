import React, { useState, useMemo, useRef, useEffect, useCallback, lazy, Suspense } from "react";
import { CA_CITY_TAX_RATES, CA_CITY_NAMES, STATE_CITIES, NV_CITY_TAX_RATES } from "./citiesData.js";
// THE FINANCIAL ENGINE — all money formulas live in lib/finance.js (audit M-1).
// Pure, unit-tested (src/lib/finance.test.js). Change formulas THERE, not here.
import {
 calcPI, calcBalance, balanceAfter, calcAPR, computeLTV, computeDTI,
 getPMIRate, getFHAMipRate, vaFundingFeeRate, toMonthly, progressiveTax,
 computeTaxSavings, buildAmortization, computeProp19,
 VA_FUNDING_FEES, FED_BRACKETS, FED_STD_DEDUCTION, STATE_TAX, STATE_NAMES,
} from "./lib/finance.js";
import { generateEstimateHtml } from "./lib/estimatePdf.js";
import SendWorksheetModal, { downloadWorksheetPdf, BorrowerSendModal } from "./components/SendWorksheetModal.jsx";
import { gmailSendAvailable, warmGmailToken } from "./lib/gmailAuth.js";
import { DARK, LIGHT } from "./lib/theme.js";
import { useBlueprintAuth } from "./BlueprintAuth";
import Icon from "./Icon";
import { apiUrl, WEB_ORIGIN } from "./apiBase";
// Lazy load heavy components for faster initial page load
const PricePoint = lazy(() => import("./PricePoint"));
const Markets = lazy(() => import("./Markets"));
const WorkspaceView = lazy(() => import("./WorkspaceView"));
const BlueprintPane = lazy(() => import("./BlueprintPane"));
const SellerNetPane = lazy(() => import("./SellerNetPane"));
const OverviewTab = lazy(() => import("./OverviewTab"));
const BottomSheet = lazy(() => import("./BottomSheet"));
const IncomeSheet = lazy(() => import("./IncomeSheet"));
const DebtsSheet = lazy(() => import("./DebtsSheet"));
const AssetsSheet = lazy(() => import("./AssetsSheet"));
import SetupContent from "./content/SetupContent";
import IncomeContent from "./content/IncomeContent";
import AssetsContent from "./content/AssetsContent";
import DebtsContent from "./content/DebtsContent";
import ReoContent from "./content/ReoContent";
import AmortContent from "./content/AmortContent";
import SellContent from "./content/SellContent";
import RentVsBuyContent from "./content/RentVsBuyContent";
import InvestContent from "./content/InvestContent";
import CostsContent from "./content/CostsContent";
import CalculatorContent from "./content/CalculatorContent";
import QualifyContent from "./content/QualifyContent";
import TaxContent from "./content/TaxContent";
import Prop19Content from "./content/Prop19Content";
import UnifiedHeader from "./UnifiedHeader";
import { WorkspaceProvider, useWorkspace, WORKSPACE_MODES } from "./WorkspaceContext";
import {
  fetchBorrowers, fetchBorrowerById, createBorrower, updateBorrower,
  fetchScenarios as apiFetchScenarios, createScenario as apiCreateScenario,
  updateScenario as apiUpdateScenario, deleteScenarioAPI,
  fetchBorrowerPrefill,
} from "./api";
import useBlueprintSync from "./hooks/useBlueprintSync";
import PresenceBar from "./components/PresenceBar";
import LockControls from "./components/LockControls";
import VersionTimeline from "./components/VersionTimeline";
import useVersionHistory from "./hooks/useVersionHistory";
import BorrowerPicker from "./components/BorrowerPicker";
import SidebarSwitcher from "./components/SidebarSwitcher";
import useBlueprintShelf from "./hooks/useBlueprintShelf";
import useAccount from "./hooks/useAccount";
import useSelfCloudSync from "./hooks/useSelfCloudSync";
import AccountSheet from "./components/AccountSheet";
import CloudMergeSheet from "./components/CloudMergeSheet";
// ═══ REALTOR PARTNER DIRECTORY ═══
// To add a new realtor: copy a block, change the fields, deploy. That's it.
const REALTOR_PARTNERS = {
 brandonlau: {
  name: "Brandon Lau",
  title: "Realtor",
  brokerage: "Compass",
  phone: "(415) 555-0100",
  email: "brandon@example.com",
  dre: "0XXXXXXX",
  photo: "",
  farmZip: "94122",
  bio: "San Francisco specialist — Sunset, Richmond, & Parkside",
 },
 // ── Add new realtors below ──
 // janedoe: {
 //  name: "Jane Doe",
 //  title: "Realtor",
 //  brokerage: "Keller Williams",
 //  phone: "(510) 555-0200",
 //  email: "jane@example.com",
 //  dre: "0XXXXXXX",
 //  photo: "",
 //  farmZip: "94501",
 //  bio: "East Bay expert — Oakland, Berkeley, Alameda",
 // },
};
// CA city tax rates and city names now imported from citiesData.js
// CITY_TAX_RATES alias for backward compatibility
const CITY_TAX_RATES = CA_CITY_TAX_RATES;
const CITY_NAMES = CA_CITY_NAMES;
// Average effective property tax rates by state (2024/2025 data — actual taxes paid as % of home value)
const STATE_PROPERTY_TAX_RATES = {
 "Alabama": 0.0040, "Alaska": 0.0118, "Arizona": 0.0062, "Arkansas": 0.0061,
 "California": null, "Colorado": 0.0051, "Connecticut": 0.0215, "Delaware": 0.0057,
 "District of Columbia": 0.0056, "Florida": 0.0086, "Georgia": 0.0090, "Hawaii": 0.0029,
 "Idaho": 0.0063, "Illinois": 0.0214, "Indiana": 0.0085, "Iowa": 0.0153,
 "Kansas": 0.0141, "Kentucky": 0.0086, "Louisiana": 0.0055, "Maine": 0.0136,
 "Maryland": 0.0107, "Massachusetts": 0.0123, "Michigan": 0.0154, "Minnesota": 0.0113,
 "Mississippi": 0.0065, "Missouri": 0.0097, "Montana": 0.0083, "Nebraska": 0.0173,
 "Nevada": 0.0053, "New Hampshire": 0.0218, "New Jersey": 0.0223, "New Mexico": 0.0067,
 "New York": 0.0172, "North Carolina": 0.0082, "North Dakota": 0.0098, "Ohio": 0.0157,
 "Oklahoma": 0.0087, "Oregon": 0.0097, "Pennsylvania": 0.0153, "Rhode Island": 0.0163,
 "South Carolina": 0.0057, "South Dakota": 0.0128, "Tennessee": 0.0066, "Texas": 0.0168,
 "Utah": 0.0058, "Vermont": 0.0188, "Virginia": 0.0082, "Washington": 0.0092,
 "West Virginia": 0.0058, "Wisconsin": 0.0178, "Wyoming": 0.0057,
};
const STATE_NAMES_PROP = Object.keys(STATE_PROPERTY_TAX_RATES).sort();
// Auto property-tax rate resolver: CA → city TRA rate (FY 2025-26 rate books);
// NV → city effective rate (FY 2025-26 Redbook × 35% assessment ratio);
// all other states → state-average rate.
const getAutoTaxRate = (st, ct) =>
 st === "California" ? (CITY_TAX_RATES[ct] || 0.012)
 : st === "Nevada" ? (NV_CITY_TAX_RATES[ct] || STATE_PROPERTY_TAX_RATES["Nevada"] || 0.0102)
 : (STATE_PROPERTY_TAX_RATES[st] || 0.0102);
// ZIP → "City:County" for California (Bay Area + key metros). Parsed at lookup.
const ZIP_DATA = {"94501":"Alameda:Alameda","94502":"Alameda:Alameda","94536":"Fremont:Alameda","94538":"Fremont:Alameda","94539":"Fremont:Alameda","94555":"Fremont:Alameda","94541":"Hayward:Alameda","94542":"Hayward:Alameda","94544":"Hayward:Alameda","94545":"Hayward:Alameda","94546":"Castro Valley:Alameda","94552":"Castro Valley:Alameda","94550":"Livermore:Alameda","94551":"Livermore:Alameda","94560":"Newark:Alameda","94566":"Pleasanton:Alameda","94568":"Dublin:Alameda","94588":"Pleasanton:Alameda","94577":"San Leandro:Alameda","94578":"San Leandro:Alameda","94579":"San Leandro:Alameda","94580":"San Lorenzo:Alameda","94587":"Union City:Alameda","94601":"Oakland:Alameda","94602":"Oakland:Alameda","94603":"Oakland:Alameda","94605":"Oakland:Alameda","94606":"Oakland:Alameda","94607":"Oakland:Alameda","94608":"Emeryville:Alameda","94609":"Oakland:Alameda","94610":"Piedmont:Alameda","94611":"Oakland:Alameda","94612":"Oakland:Alameda","94613":"Oakland:Alameda","94618":"Oakland:Alameda","94619":"Oakland:Alameda","94621":"Oakland:Alameda","94702":"Berkeley:Alameda","94703":"Berkeley:Alameda","94704":"Berkeley:Alameda","94705":"Berkeley:Alameda","94706":"Albany:Alameda","94707":"Berkeley:Alameda","94708":"Berkeley:Alameda","94709":"Berkeley:Alameda","94710":"Berkeley:Alameda","94505":"Discovery Bay:Contra Costa","94506":"Danville:Contra Costa","94507":"Alamo:Contra Costa","94509":"Antioch:Contra Costa","94511":"Bethel Island:Contra Costa","94513":"Brentwood:Contra Costa","94517":"Clayton:Contra Costa","94518":"Concord:Contra Costa","94519":"Concord:Contra Costa","94520":"Concord:Contra Costa","94521":"Concord:Contra Costa","94523":"Pleasant Hill:Contra Costa","94525":"Crockett:Contra Costa","94526":"Danville:Contra Costa","94530":"El Cerrito:Contra Costa","94531":"Antioch:Contra Costa","94547":"Hercules:Contra Costa","94548":"Knightsen:Contra Costa","94549":"Lafayette:Contra Costa","94553":"Martinez:Contra Costa","94556":"Moraga:Contra Costa","94561":"Oakley:Contra Costa","94563":"Orinda:Contra Costa","94564":"Pinole:Contra Costa","94565":"Pittsburg:Contra Costa","94582":"San Ramon:Contra Costa","94583":"San Ramon:Contra Costa","94595":"Walnut Creek:Contra Costa","94596":"Walnut Creek:Contra Costa","94597":"Walnut Creek:Contra Costa","94598":"Walnut Creek:Contra Costa","94801":"Richmond:Contra Costa","94803":"El Cerrito:Contra Costa","94804":"Richmond:Contra Costa","94805":"Richmond:Contra Costa","94806":"San Pablo:Contra Costa","94102":"San Francisco:San Francisco","94103":"San Francisco:San Francisco","94104":"San Francisco:San Francisco","94105":"San Francisco:San Francisco","94107":"San Francisco:San Francisco","94108":"San Francisco:San Francisco","94109":"San Francisco:San Francisco","94110":"San Francisco:San Francisco","94111":"San Francisco:San Francisco","94112":"San Francisco:San Francisco","94114":"San Francisco:San Francisco","94115":"San Francisco:San Francisco","94116":"San Francisco:San Francisco","94117":"San Francisco:San Francisco","94118":"San Francisco:San Francisco","94121":"San Francisco:San Francisco","94122":"San Francisco:San Francisco","94123":"San Francisco:San Francisco","94124":"San Francisco:San Francisco","94127":"San Francisco:San Francisco","94129":"San Francisco:San Francisco","94131":"San Francisco:San Francisco","94132":"San Francisco:San Francisco","94133":"San Francisco:San Francisco","94134":"San Francisco:San Francisco","94002":"Belmont:San Mateo","94005":"Brisbane:San Mateo","94010":"Burlingame:San Mateo","94014":"Daly City:San Mateo","94015":"Daly City:San Mateo","94019":"Half Moon Bay:San Mateo","94025":"Menlo Park:San Mateo","94027":"Atherton:San Mateo","94028":"Portola Valley:San Mateo","94030":"Millbrae:San Mateo","94044":"Pacifica:San Mateo","94061":"Redwood City:San Mateo","94062":"Woodside:San Mateo","94063":"Redwood City:San Mateo","94065":"Redwood City:San Mateo","94066":"San Bruno:San Mateo","94070":"San Carlos:San Mateo","94080":"South San Francisco:San Mateo","94303":"East Palo Alto:San Mateo","94401":"San Mateo:San Mateo","94402":"San Mateo:San Mateo","94403":"San Mateo:San Mateo","94404":"Foster City:San Mateo","94022":"Los Altos:Santa Clara","94024":"Los Altos Hills:Santa Clara","94040":"Mountain View:Santa Clara","94041":"Mountain View:Santa Clara","94043":"Mountain View:Santa Clara","94085":"Sunnyvale:Santa Clara","94086":"Sunnyvale:Santa Clara","94087":"Sunnyvale:Santa Clara","94089":"Sunnyvale:Santa Clara","94301":"Palo Alto:Santa Clara","94304":"Palo Alto:Santa Clara","94306":"Palo Alto:Santa Clara","95002":"Alviso:Santa Clara","95008":"Campbell:Santa Clara","95014":"Cupertino:Santa Clara","95020":"Gilroy:Santa Clara","95030":"Los Gatos:Santa Clara","95032":"Los Gatos:Santa Clara","95035":"Milpitas:Santa Clara","95037":"Morgan Hill:Santa Clara","95050":"Santa Clara:Santa Clara","95051":"Santa Clara:Santa Clara","95054":"Santa Clara:Santa Clara","95070":"Saratoga:Santa Clara","95110":"San Jose:Santa Clara","95111":"San Jose:Santa Clara","95112":"San Jose:Santa Clara","95113":"San Jose:Santa Clara","95116":"San Jose:Santa Clara","95117":"San Jose:Santa Clara","95118":"San Jose:Santa Clara","95119":"San Jose:Santa Clara","95120":"San Jose:Santa Clara","95121":"San Jose:Santa Clara","95122":"San Jose:Santa Clara","95123":"San Jose:Santa Clara","95124":"San Jose:Santa Clara","95125":"San Jose:Santa Clara","95126":"San Jose:Santa Clara","95127":"San Jose:Santa Clara","95128":"San Jose:Santa Clara","95129":"San Jose:Santa Clara","95130":"San Jose:Santa Clara","95131":"San Jose:Santa Clara","95132":"San Jose:Santa Clara","95133":"San Jose:Santa Clara","95134":"San Jose:Santa Clara","95135":"San Jose:Santa Clara","95136":"San Jose:Santa Clara","95138":"San Jose:Santa Clara","95139":"San Jose:Santa Clara","95148":"San Jose:Santa Clara","94901":"San Rafael:Marin","94903":"San Rafael:Marin","94904":"San Rafael:Marin","94920":"Tiburon:Marin","94924":"Bolinas:Marin","94925":"Corte Madera:Marin","94930":"Fairfax:Marin","94939":"Larkspur:Marin","94941":"Mill Valley:Marin","94945":"Novato:Marin","94947":"Novato:Marin","94949":"Novato:Marin","94946":"Nicasio:Marin","94957":"Ross:Marin","94960":"San Anselmo:Marin","94963":"Lagunitas:Marin","94965":"Sausalito:Marin","94928":"Rohnert Park:Sonoma","94931":"Cotati:Sonoma","94952":"Petaluma:Sonoma","94954":"Petaluma:Sonoma","95401":"Santa Rosa:Sonoma","95403":"Santa Rosa:Sonoma","95404":"Santa Rosa:Sonoma","95405":"Santa Rosa:Sonoma","95407":"Santa Rosa:Sonoma","95409":"Santa Rosa:Sonoma","95425":"Cloverdale:Sonoma","95448":"Healdsburg:Sonoma","95472":"Sebastopol:Sonoma","95476":"Sonoma:Sonoma","95492":"Windsor:Sonoma","94503":"American Canyon:Napa","94515":"Calistoga:Napa","94558":"Napa:Napa","94559":"Napa:Napa","94574":"St. Helena:Napa","94510":"Benicia:Solano","94533":"Fairfield:Solano","94534":"Fairfield:Solano","94585":"Suisun City:Solano","94589":"Vallejo:Solano","94590":"Vallejo:Solano","94591":"Vallejo:Solano","95620":"Dixon:Solano","95687":"Vacaville:Solano","95688":"Vacaville:Solano","95608":"Carmichael:Sacramento","95610":"Citrus Heights:Sacramento","95621":"Citrus Heights:Sacramento","95624":"Elk Grove:Sacramento","95626":"Elverta:Sacramento","95628":"Fair Oaks:Sacramento","95630":"Folsom:Sacramento","95632":"Galt:Sacramento","95655":"Mather:Sacramento","95660":"North Highlands:Sacramento","95670":"Rancho Cordova:Sacramento","95673":"Rio Linda:Sacramento","95678":"Roseville:Placer","95742":"Rancho Cordova:Sacramento","95758":"Elk Grove:Sacramento","95811":"Sacramento:Sacramento","95814":"Sacramento:Sacramento","95815":"Sacramento:Sacramento","95816":"Sacramento:Sacramento","95817":"Sacramento:Sacramento","95818":"Sacramento:Sacramento","95819":"Sacramento:Sacramento","95820":"Sacramento:Sacramento","95821":"Sacramento:Sacramento","95822":"Sacramento:Sacramento","95823":"Sacramento:Sacramento","95824":"Sacramento:Sacramento","95825":"Sacramento:Sacramento","95826":"Sacramento:Sacramento","95828":"Sacramento:Sacramento","95829":"Sacramento:Sacramento","95831":"Sacramento:Sacramento","95832":"Sacramento:Sacramento","95833":"Sacramento:Sacramento","95834":"Sacramento:Sacramento","95835":"Sacramento:Sacramento","95838":"Sacramento:Sacramento","95603":"Auburn:Placer","95648":"Lincoln:Placer","95650":"Loomis:Placer","95661":"Roseville:Placer","95677":"Rocklin:Placer","95746":"Granite Bay:Placer","95747":"Roseville:Placer","95765":"Rocklin:Placer","95614":"Cool:El Dorado","95619":"Diamond Springs:El Dorado","95623":"El Dorado:El Dorado","95633":"Georgetown:El Dorado","95667":"Placerville:El Dorado","95672":"Rescue:El Dorado","95682":"Shingle Springs:El Dorado","95762":"El Dorado Hills:El Dorado","95201":"Stockton:San Joaquin","95202":"Stockton:San Joaquin","95203":"Stockton:San Joaquin","95204":"Stockton:San Joaquin","95205":"Stockton:San Joaquin","95206":"Stockton:San Joaquin","95207":"Stockton:San Joaquin","95209":"Stockton:San Joaquin","95210":"Stockton:San Joaquin","95211":"Stockton:San Joaquin","95212":"Stockton:San Joaquin","95219":"Stockton:San Joaquin","95227":"Escalon:San Joaquin","95230":"Farmington:San Joaquin","95234":"Holt:San Joaquin","95236":"Linden:San Joaquin","95240":"Lodi:San Joaquin","95242":"Lodi:San Joaquin","95304":"Tracy:San Joaquin","95320":"Manteca:San Joaquin","95330":"Lathrop:San Joaquin","95336":"Manteca:San Joaquin","95337":"Manteca:San Joaquin","95361":"Ripon:San Joaquin","95376":"Tracy:San Joaquin","95377":"Tracy:San Joaquin","95307":"Ceres:Stanislaus","95316":"Denair:Stanislaus","95350":"Modesto:Stanislaus","95351":"Modesto:Stanislaus","95354":"Modesto:Stanislaus","95355":"Modesto:Stanislaus","95356":"Modesto:Stanislaus","95357":"Modesto:Stanislaus","95358":"Modesto:Stanislaus","95363":"Patterson:Stanislaus","95380":"Turlock:Stanislaus","95382":"Turlock:Stanislaus","90001":"Los Angeles:Los Angeles","90002":"Los Angeles:Los Angeles","90003":"Los Angeles:Los Angeles","90004":"Los Angeles:Los Angeles","90005":"Los Angeles:Los Angeles","90006":"Los Angeles:Los Angeles","90007":"Los Angeles:Los Angeles","90008":"Los Angeles:Los Angeles","90010":"Los Angeles:Los Angeles","90011":"Los Angeles:Los Angeles","90012":"Los Angeles:Los Angeles","90013":"Los Angeles:Los Angeles","90014":"Los Angeles:Los Angeles","90015":"Los Angeles:Los Angeles","90016":"Los Angeles:Los Angeles","90017":"Los Angeles:Los Angeles","90018":"Los Angeles:Los Angeles","90019":"Los Angeles:Los Angeles","90020":"Los Angeles:Los Angeles","90023":"Los Angeles:Los Angeles","90024":"Los Angeles:Los Angeles","90025":"Los Angeles:Los Angeles","90026":"Los Angeles:Los Angeles","90027":"Los Angeles:Los Angeles","90028":"Los Angeles:Los Angeles","90029":"Los Angeles:Los Angeles","90031":"Los Angeles:Los Angeles","90032":"Los Angeles:Los Angeles","90033":"Los Angeles:Los Angeles","90034":"Los Angeles:Los Angeles","90035":"Los Angeles:Los Angeles","90036":"Los Angeles:Los Angeles","90037":"Los Angeles:Los Angeles","90038":"Los Angeles:Los Angeles","90039":"Los Angeles:Los Angeles","90041":"Los Angeles:Los Angeles","90042":"Los Angeles:Los Angeles","90043":"Los Angeles:Los Angeles","90044":"Los Angeles:Los Angeles","90045":"Los Angeles:Los Angeles","90046":"Los Angeles:Los Angeles","90047":"Los Angeles:Los Angeles","90048":"Los Angeles:Los Angeles","90049":"Los Angeles:Los Angeles","90056":"Los Angeles:Los Angeles","90057":"Los Angeles:Los Angeles","90058":"Los Angeles:Los Angeles","90059":"Los Angeles:Los Angeles","90061":"Los Angeles:Los Angeles","90062":"Los Angeles:Los Angeles","90063":"Los Angeles:Los Angeles","90064":"Los Angeles:Los Angeles","90065":"Los Angeles:Los Angeles","90066":"Los Angeles:Los Angeles","90067":"Los Angeles:Los Angeles","90068":"Los Angeles:Los Angeles","90069":"Los Angeles:Los Angeles","90071":"Los Angeles:Los Angeles","90077":"Los Angeles:Los Angeles","90210":"Beverly Hills:Los Angeles","90211":"Beverly Hills:Los Angeles","90212":"Beverly Hills:Los Angeles","90230":"Culver City:Los Angeles","90232":"Culver City:Los Angeles","90245":"El Segundo:Los Angeles","90247":"Gardena:Los Angeles","90248":"Gardena:Los Angeles","90249":"Gardena:Los Angeles","90250":"Hawthorne:Los Angeles","90254":"Hermosa Beach:Los Angeles","90260":"Lawndale:Los Angeles","90266":"Manhattan Beach:Los Angeles","90270":"Maywood:Los Angeles","90274":"Palos Verdes Peninsula:Los Angeles","90275":"Rancho Palos Verdes:Los Angeles","90277":"Redondo Beach:Los Angeles","90278":"Redondo Beach:Los Angeles","90280":"South Gate:Los Angeles","90291":"Venice:Los Angeles","90292":"Marina del Rey:Los Angeles","90293":"Playa del Rey:Los Angeles","90301":"Inglewood:Los Angeles","90302":"Inglewood:Los Angeles","90401":"Santa Monica:Los Angeles","90402":"Santa Monica:Los Angeles","90403":"Santa Monica:Los Angeles","90404":"Santa Monica:Los Angeles","90405":"Santa Monica:Los Angeles","90501":"Torrance:Los Angeles","90502":"Torrance:Los Angeles","90503":"Torrance:Los Angeles","90504":"Torrance:Los Angeles","90505":"Torrance:Los Angeles","90601":"Whittier:Los Angeles","90602":"Whittier:Los Angeles","90603":"Whittier:Los Angeles","90604":"Whittier:Los Angeles","90605":"Whittier:Los Angeles","90631":"La Habra:Los Angeles","90638":"La Mirada:Los Angeles","90640":"Montebello:Los Angeles","90650":"Norwalk:Los Angeles","90660":"Pico Rivera:Los Angeles","90670":"Santa Fe Springs:Los Angeles","90701":"Cerritos:Los Angeles","90703":"Cerritos:Los Angeles","90706":"Bellflower:Los Angeles","90710":"San Pedro:Los Angeles","90712":"Lakewood:Los Angeles","90713":"Lakewood:Los Angeles","90715":"Lakewood:Los Angeles","90716":"Hawaiian Gardens:Los Angeles","90717":"Lomita:Los Angeles","90720":"Los Alamitos:Los Angeles","90731":"San Pedro:Los Angeles","90732":"San Pedro:Los Angeles","90740":"Seal Beach:Los Angeles","90744":"Wilmington:Los Angeles","90745":"Carson:Los Angeles","90746":"Carson:Los Angeles","90802":"Long Beach:Los Angeles","90803":"Long Beach:Los Angeles","90804":"Long Beach:Los Angeles","90805":"Long Beach:Los Angeles","90806":"Long Beach:Los Angeles","90807":"Long Beach:Los Angeles","90808":"Long Beach:Los Angeles","90810":"Long Beach:Los Angeles","90813":"Long Beach:Los Angeles","90814":"Long Beach:Los Angeles","90815":"Long Beach:Los Angeles","91001":"Altadena:Los Angeles","91006":"Arcadia:Los Angeles","91007":"Arcadia:Los Angeles","91010":"Duarte:Los Angeles","91011":"La Canada Flintridge:Los Angeles","91016":"Monrovia:Los Angeles","91024":"Sierra Madre:Los Angeles","91030":"South Pasadena:Los Angeles","91040":"Sunland:Los Angeles","91042":"Tujunga:Los Angeles","91101":"Pasadena:Los Angeles","91103":"Pasadena:Los Angeles","91104":"Pasadena:Los Angeles","91105":"Pasadena:Los Angeles","91106":"Pasadena:Los Angeles","91107":"Pasadena:Los Angeles","91108":"San Marino:Los Angeles","91201":"Glendale:Los Angeles","91202":"Glendale:Los Angeles","91203":"Glendale:Los Angeles","91204":"Glendale:Los Angeles","91205":"Glendale:Los Angeles","91206":"Glendale:Los Angeles","91207":"Glendale:Los Angeles","91208":"Glendale:Los Angeles","91214":"La Crescenta:Los Angeles","91301":"Agoura Hills:Los Angeles","91302":"Calabasas:Los Angeles","91303":"Canoga Park:Los Angeles","91304":"Canoga Park:Los Angeles","91306":"Winnetka:Los Angeles","91307":"West Hills:Los Angeles","91311":"Chatsworth:Los Angeles","91316":"Encino:Los Angeles","91321":"Newhall:Los Angeles","91324":"Northridge:Los Angeles","91325":"Northridge:Los Angeles","91326":"Northridge:Los Angeles","91331":"Pacoima:Los Angeles","91335":"Reseda:Los Angeles","91340":"San Fernando:Los Angeles","91342":"Sylmar:Los Angeles","91343":"North Hills:Los Angeles","91344":"Granada Hills:Los Angeles","91345":"Mission Hills:Los Angeles","91350":"Santa Clarita:Los Angeles","91351":"Canyon Country:Los Angeles","91354":"Valencia:Los Angeles","91355":"Valencia:Los Angeles","91356":"Tarzana:Los Angeles","91360":"Thousand Oaks:Ventura","91364":"Woodland Hills:Los Angeles","91367":"Woodland Hills:Los Angeles","91381":"Stevenson Ranch:Los Angeles","91384":"Castaic:Los Angeles","91401":"Van Nuys:Los Angeles","91402":"Panorama City:Los Angeles","91403":"Sherman Oaks:Los Angeles","91405":"Van Nuys:Los Angeles","91406":"Van Nuys:Los Angeles","91411":"Van Nuys:Los Angeles","91423":"Sherman Oaks:Los Angeles","91436":"Encino:Los Angeles","91501":"Burbank:Los Angeles","91502":"Burbank:Los Angeles","91504":"Burbank:Los Angeles","91505":"Burbank:Los Angeles","91506":"Burbank:Los Angeles","91601":"North Hollywood:Los Angeles","91602":"North Hollywood:Los Angeles","91604":"Studio City:Los Angeles","91605":"North Hollywood:Los Angeles","91606":"North Hollywood:Los Angeles","91607":"Valley Village:Los Angeles","91702":"Azusa:Los Angeles","91706":"Baldwin Park:Los Angeles","91710":"Chino:Los Angeles","91711":"Claremont:Los Angeles","91722":"Covina:Los Angeles","91723":"Covina:Los Angeles","91724":"Covina:Los Angeles","91730":"Rancho Cucamonga:San Bernardino","91731":"El Monte:Los Angeles","91732":"El Monte:Los Angeles","91733":"South El Monte:Los Angeles","91740":"Glendora:Los Angeles","91741":"Glendora:Los Angeles","91744":"La Puente:Los Angeles","91745":"Hacienda Heights:Los Angeles","91748":"Rowland Heights:Los Angeles","91750":"La Verne:Los Angeles","91754":"Monterey Park:Los Angeles","91755":"Monterey Park:Los Angeles","91761":"Ontario:San Bernardino","91762":"Ontario:San Bernardino","91763":"Montclair:San Bernardino","91764":"Ontario:San Bernardino","91765":"Diamond Bar:Los Angeles","91766":"Pomona:Los Angeles","91767":"Pomona:Los Angeles","91768":"Pomona:Los Angeles","91770":"Rosemead:Los Angeles","91773":"San Dimas:Los Angeles","91775":"San Gabriel:Los Angeles","91776":"San Gabriel:Los Angeles","91780":"Temple City:Los Angeles","91789":"Walnut:Los Angeles","91790":"West Covina:Los Angeles","91791":"West Covina:Los Angeles","91792":"West Covina:Los Angeles","92602":"Irvine:Orange","92603":"Irvine:Orange","92604":"Irvine:Orange","92606":"Irvine:Orange","92612":"Irvine:Orange","92614":"Irvine:Orange","92617":"Irvine:Orange","92618":"Irvine:Orange","92620":"Irvine:Orange","92624":"Capistrano Beach:Orange","92625":"Corona del Mar:Orange","92626":"Costa Mesa:Orange","92627":"Costa Mesa:Orange","92629":"Dana Point:Orange","92630":"Lake Forest:Orange","92637":"Laguna Woods:Orange","92646":"Huntington Beach:Orange","92647":"Huntington Beach:Orange","92648":"Huntington Beach:Orange","92649":"Huntington Beach:Orange","92651":"Laguna Beach:Orange","92653":"Laguna Hills:Orange","92656":"Aliso Viejo:Orange","92657":"Newport Coast:Orange","92660":"Newport Beach:Orange","92661":"Newport Beach:Orange","92662":"Newport Beach:Orange","92663":"Newport Beach:Orange","92672":"San Clemente:Orange","92673":"San Clemente:Orange","92675":"San Juan Capistrano:Orange","92677":"Laguna Niguel:Orange","92679":"Coto de Caza:Orange","92688":"Rancho Santa Margarita:Orange","92691":"Mission Viejo:Orange","92692":"Mission Viejo:Orange","92694":"Ladera Ranch:Orange","92701":"Santa Ana:Orange","92703":"Santa Ana:Orange","92704":"Santa Ana:Orange","92705":"Santa Ana:Orange","92706":"Santa Ana:Orange","92707":"Santa Ana:Orange","92708":"Fountain Valley:Orange","92780":"Tustin:Orange","92782":"Tustin:Orange","92801":"Anaheim:Orange","92802":"Anaheim:Orange","92804":"Anaheim:Orange","92805":"Anaheim:Orange","92806":"Anaheim:Orange","92807":"Anaheim:Orange","92808":"Anaheim:Orange","92821":"Brea:Orange","92823":"Brea:Orange","92831":"Fullerton:Orange","92832":"Fullerton:Orange","92833":"Fullerton:Orange","92835":"Fullerton:Orange","92840":"Garden Grove:Orange","92841":"Garden Grove:Orange","92843":"Garden Grove:Orange","92844":"Garden Grove:Orange","92845":"Garden Grove:Orange","92860":"Norco:Orange","92861":"Villa Park:Orange","92865":"Orange:Orange","92866":"Orange:Orange","92867":"Orange:Orange","92868":"Orange:Orange","92869":"Orange:Orange","92870":"Placentia:Orange","92886":"Yorba Linda:Orange","92887":"Yorba Linda:Orange","91901":"Alpine:San Diego","91902":"Bonita:San Diego","91910":"Chula Vista:San Diego","91911":"Chula Vista:San Diego","91913":"Chula Vista:San Diego","91914":"Chula Vista:San Diego","91915":"Chula Vista:San Diego","91932":"Imperial Beach:San Diego","91935":"Jamul:San Diego","91941":"La Mesa:San Diego","91942":"La Mesa:San Diego","91945":"Lemon Grove:San Diego","91950":"National City:San Diego","91977":"Spring Valley:San Diego","91978":"Spring Valley:San Diego","92007":"Cardiff:San Diego","92008":"Carlsbad:San Diego","92009":"Carlsbad:San Diego","92010":"Carlsbad:San Diego","92011":"Carlsbad:San Diego","92014":"Del Mar:San Diego","92019":"El Cajon:San Diego","92020":"El Cajon:San Diego","92021":"El Cajon:San Diego","92024":"Encinitas:San Diego","92025":"Escondido:San Diego","92026":"Escondido:San Diego","92027":"Escondido:San Diego","92028":"Fallbrook:San Diego","92029":"Escondido:San Diego","92037":"La Jolla:San Diego","92040":"Lakeside:San Diego","92054":"Oceanside:San Diego","92056":"Oceanside:San Diego","92057":"Oceanside:San Diego","92058":"Oceanside:San Diego","92064":"Poway:San Diego","92065":"Ramona:San Diego","92067":"Rancho Santa Fe:San Diego","92069":"San Marcos:San Diego","92071":"Santee:San Diego","92075":"Solana Beach:San Diego","92078":"San Marcos:San Diego","92081":"Vista:San Diego","92083":"Vista:San Diego","92084":"Vista:San Diego","92091":"Rancho Santa Fe:San Diego","92101":"San Diego:San Diego","92102":"San Diego:San Diego","92103":"San Diego:San Diego","92104":"San Diego:San Diego","92105":"San Diego:San Diego","92106":"San Diego:San Diego","92107":"San Diego:San Diego","92108":"San Diego:San Diego","92109":"San Diego:San Diego","92110":"San Diego:San Diego","92111":"San Diego:San Diego","92113":"San Diego:San Diego","92114":"San Diego:San Diego","92115":"San Diego:San Diego","92116":"San Diego:San Diego","92117":"San Diego:San Diego","92118":"Coronado:San Diego","92119":"San Diego:San Diego","92120":"San Diego:San Diego","92121":"San Diego:San Diego","92122":"San Diego:San Diego","92123":"San Diego:San Diego","92124":"San Diego:San Diego","92126":"San Diego:San Diego","92127":"San Diego:San Diego","92128":"San Diego:San Diego","92129":"San Diego:San Diego","92130":"San Diego:San Diego","92131":"San Diego:San Diego","92139":"San Diego:San Diego","92154":"San Diego:San Diego","92201":"Indio:Riverside","92203":"Indio:Riverside","92210":"Indian Wells:Riverside","92211":"Palm Desert:Riverside","92234":"Cathedral City:Riverside","92236":"Coachella:Riverside","92240":"Desert Hot Springs:Riverside","92253":"La Quinta:Riverside","92260":"Palm Desert:Riverside","92262":"Palm Springs:Riverside","92264":"Palm Springs:Riverside","92270":"Rancho Mirage:Riverside","92501":"Riverside:Riverside","92503":"Riverside:Riverside","92504":"Riverside:Riverside","92505":"Riverside:Riverside","92506":"Riverside:Riverside","92507":"Riverside:Riverside","92508":"Riverside:Riverside","92509":"Jurupa Valley:Riverside","92530":"Lake Elsinore:Riverside","92532":"Lake Elsinore:Riverside","92536":"Aguanga:Riverside","92543":"Hemet:Riverside","92544":"Hemet:Riverside","92545":"Hemet:Riverside","92548":"Homeland:Riverside","92553":"Moreno Valley:Riverside","92555":"Moreno Valley:Riverside","92557":"Moreno Valley:Riverside","92562":"Murrieta:Riverside","92563":"Murrieta:Riverside","92567":"Nuevo:Riverside","92570":"Perris:Riverside","92571":"Perris:Riverside","92582":"San Jacinto:Riverside","92583":"San Jacinto:Riverside","92584":"Menifee:Riverside","92585":"Sun City:Riverside","92586":"Menifee:Riverside","92587":"Menifee:Riverside","92590":"Temecula:Riverside","92591":"Temecula:Riverside","92592":"Temecula:Riverside","92595":"Wildomar:Riverside","92596":"Winchester:Riverside","91701":"Rancho Cucamonga:San Bernardino","91709":"Chino Hills:San Bernardino","91737":"Rancho Cucamonga:San Bernardino","91739":"Rancho Cucamonga:San Bernardino","91784":"Upland:San Bernardino","91786":"Upland:San Bernardino","92301":"Adelanto:San Bernardino","92307":"Apple Valley:San Bernardino","92308":"Apple Valley:San Bernardino","92313":"Grand Terrace:San Bernardino","92316":"Bloomington:San Bernardino","92324":"Colton:San Bernardino","92335":"Fontana:San Bernardino","92336":"Fontana:San Bernardino","92337":"Fontana:San Bernardino","92344":"Hesperia:San Bernardino","92345":"Hesperia:San Bernardino","92346":"Highland:San Bernardino","92354":"Loma Linda:San Bernardino","92357":"Loma Linda:San Bernardino","92371":"Phelan:San Bernardino","92373":"Redlands:San Bernardino","92374":"Redlands:San Bernardino","92376":"Rialto:San Bernardino","92377":"Rialto:San Bernardino","92392":"Victorville:San Bernardino","92394":"Victorville:San Bernardino","92395":"Victorville:San Bernardino","92399":"Yucaipa:San Bernardino","92401":"San Bernardino:San Bernardino","92404":"San Bernardino:San Bernardino","92405":"San Bernardino:San Bernardino","92407":"San Bernardino:San Bernardino","92410":"San Bernardino:San Bernardino","91320":"Newbury Park:Ventura","91361":"Westlake Village:Ventura","91362":"Thousand Oaks:Ventura","93001":"Ventura:Ventura","93003":"Ventura:Ventura","93004":"Ventura:Ventura","93010":"Camarillo:Ventura","93012":"Camarillo:Ventura","93015":"Fillmore:Ventura","93021":"Moorpark:Ventura","93030":"Oxnard:Ventura","93033":"Oxnard:Ventura","93035":"Oxnard:Ventura","93036":"Oxnard:Ventura","93060":"Santa Paula:Ventura","93063":"Simi Valley:Ventura","93065":"Simi Valley:Ventura","93101":"Santa Barbara:Santa Barbara","93103":"Santa Barbara:Santa Barbara","93105":"Santa Barbara:Santa Barbara","93108":"Montecito:Santa Barbara","93109":"Santa Barbara:Santa Barbara","93110":"Santa Barbara:Santa Barbara","93111":"Santa Barbara:Santa Barbara","93117":"Goleta:Santa Barbara","93436":"Lompoc:Santa Barbara","93454":"Santa Maria:Santa Barbara","93455":"Santa Maria:Santa Barbara","93401":"San Luis Obispo:San Luis Obispo","93405":"San Luis Obispo:San Luis Obispo","93420":"Arroyo Grande:San Luis Obispo","93422":"Atascadero:San Luis Obispo","93428":"Cambria:San Luis Obispo","93433":"Grover Beach:San Luis Obispo","93446":"Paso Robles:San Luis Obispo","93449":"Pismo Beach:San Luis Obispo","93901":"Salinas:Monterey","93905":"Salinas:Monterey","93906":"Salinas:Monterey","93907":"Salinas:Monterey","93908":"Salinas:Monterey","93923":"Carmel:Monterey","93940":"Monterey:Monterey","93950":"Pacific Grove:Monterey","93953":"Pebble Beach:Monterey","93955":"Seaside:Monterey","95003":"Aptos:Santa Cruz","95006":"Ben Lomond:Santa Cruz","95010":"Capitola:Santa Cruz","95060":"Santa Cruz:Santa Cruz","95062":"Santa Cruz:Santa Cruz","95065":"Santa Cruz:Santa Cruz","95066":"Scotts Valley:Santa Cruz","95073":"Soquel:Santa Cruz","95076":"Watsonville:Santa Cruz","93611":"Clovis:Fresno","93612":"Clovis:Fresno","93619":"Clovis:Fresno","93625":"Fowler:Fresno","93631":"Kingsburg:Fresno","93638":"Madera:Fresno","93650":"Fresno:Fresno","93701":"Fresno:Fresno","93702":"Fresno:Fresno","93703":"Fresno:Fresno","93704":"Fresno:Fresno","93705":"Fresno:Fresno","93706":"Fresno:Fresno","93710":"Fresno:Fresno","93711":"Fresno:Fresno","93720":"Fresno:Fresno","93721":"Fresno:Fresno","93722":"Fresno:Fresno","93723":"Fresno:Fresno","93726":"Fresno:Fresno","93727":"Fresno:Fresno","93728":"Fresno:Fresno","93730":"Fresno:Fresno","93301":"Bakersfield:Kern","93304":"Bakersfield:Kern","93305":"Bakersfield:Kern","93306":"Bakersfield:Kern","93307":"Bakersfield:Kern","93308":"Bakersfield:Kern","93309":"Bakersfield:Kern","93311":"Bakersfield:Kern","93312":"Bakersfield:Kern","93313":"Bakersfield:Kern","93314":"Bakersfield:Kern","93230":"Hanford:Tulare","93245":"Lemoore:Tulare","93274":"Tulare:Tulare","93277":"Visalia:Tulare","93291":"Visalia:Tulare","93292":"Visalia:Tulare","95616":"Davis:Yolo","95618":"Davis:Yolo","95691":"West Sacramento:Yolo","95695":"Woodland:Yolo","95776":"Woodland:Yolo","10001":"Manhattan:New York:New York","10002":"Manhattan:New York:New York","10003":"Manhattan:New York:New York","10004":"Manhattan:New York:New York","10005":"Manhattan:New York:New York","10006":"Manhattan:New York:New York","10007":"Manhattan:New York:New York","10009":"Manhattan:New York:New York","10010":"Manhattan:New York:New York","10011":"Manhattan:New York:New York","10012":"Manhattan:New York:New York","10013":"Manhattan:New York:New York","10014":"Manhattan:New York:New York","10016":"Manhattan:New York:New York","10017":"Manhattan:New York:New York","10018":"Manhattan:New York:New York","10019":"Manhattan:New York:New York","10021":"Manhattan:New York:New York","10022":"Manhattan:New York:New York","10023":"Manhattan:New York:New York","10024":"Manhattan:New York:New York","10025":"Manhattan:New York:New York","10027":"Manhattan:New York:New York","10028":"Manhattan:New York:New York","10029":"Manhattan:New York:New York","10030":"Manhattan:New York:New York","10031":"Manhattan:New York:New York","10032":"Manhattan:New York:New York","10033":"Manhattan:New York:New York","10034":"Manhattan:New York:New York","10035":"Manhattan:New York:New York","10036":"Manhattan:New York:New York","10037":"Manhattan:New York:New York","10038":"Manhattan:New York:New York","10039":"Manhattan:New York:New York","10040":"Manhattan:New York:New York","10044":"Manhattan:New York:New York","10065":"Manhattan:New York:New York","10075":"Manhattan:New York:New York","10128":"Manhattan:New York:New York","10280":"Manhattan:New York:New York","10282":"Manhattan:New York:New York","10301":"Staten Island:Richmond:New York","10302":"Staten Island:Richmond:New York","10304":"Staten Island:Richmond:New York","10305":"Staten Island:Richmond:New York","10306":"Staten Island:Richmond:New York","10312":"Staten Island:Richmond:New York","10314":"Staten Island:Richmond:New York","10451":"Bronx:Bronx:New York","10452":"Bronx:Bronx:New York","10453":"Bronx:Bronx:New York","10454":"Bronx:Bronx:New York","10456":"Bronx:Bronx:New York","10458":"Bronx:Bronx:New York","10460":"Bronx:Bronx:New York","10461":"Bronx:Bronx:New York","10462":"Bronx:Bronx:New York","10463":"Bronx:Bronx:New York","10464":"Bronx:Bronx:New York","10465":"Bronx:Bronx:New York","10466":"Bronx:Bronx:New York","10467":"Bronx:Bronx:New York","10468":"Bronx:Bronx:New York","10469":"Bronx:Bronx:New York","10470":"Bronx:Bronx:New York","10471":"Bronx:Bronx:New York","10472":"Bronx:Bronx:New York","10473":"Bronx:Bronx:New York","11201":"Brooklyn:Kings:New York","11203":"Brooklyn:Kings:New York","11204":"Brooklyn:Kings:New York","11205":"Brooklyn:Kings:New York","11206":"Brooklyn:Kings:New York","11207":"Brooklyn:Kings:New York","11208":"Brooklyn:Kings:New York","11209":"Brooklyn:Kings:New York","11210":"Brooklyn:Kings:New York","11211":"Brooklyn:Kings:New York","11212":"Brooklyn:Kings:New York","11213":"Brooklyn:Kings:New York","11214":"Brooklyn:Kings:New York","11215":"Brooklyn:Kings:New York","11216":"Brooklyn:Kings:New York","11217":"Brooklyn:Kings:New York","11218":"Brooklyn:Kings:New York","11219":"Brooklyn:Kings:New York","11220":"Brooklyn:Kings:New York","11221":"Brooklyn:Kings:New York","11222":"Brooklyn:Kings:New York","11223":"Brooklyn:Kings:New York","11224":"Brooklyn:Kings:New York","11225":"Brooklyn:Kings:New York","11226":"Brooklyn:Kings:New York","11228":"Brooklyn:Kings:New York","11229":"Brooklyn:Kings:New York","11230":"Brooklyn:Kings:New York","11231":"Brooklyn:Kings:New York","11232":"Brooklyn:Kings:New York","11233":"Brooklyn:Kings:New York","11234":"Brooklyn:Kings:New York","11235":"Brooklyn:Kings:New York","11236":"Brooklyn:Kings:New York","11237":"Brooklyn:Kings:New York","11238":"Brooklyn:Kings:New York","11239":"Brooklyn:Kings:New York","11101":"Queens:Queens:New York","11102":"Queens:Queens:New York","11103":"Queens:Queens:New York","11104":"Queens:Queens:New York","11105":"Queens:Queens:New York","11106":"Queens:Queens:New York","11354":"Queens:Queens:New York","11355":"Queens:Queens:New York","11356":"Queens:Queens:New York","11357":"Queens:Queens:New York","11358":"Queens:Queens:New York","11360":"Queens:Queens:New York","11361":"Queens:Queens:New York","11362":"Queens:Queens:New York","11363":"Queens:Queens:New York","11364":"Queens:Queens:New York","11365":"Queens:Queens:New York","11366":"Queens:Queens:New York","11367":"Queens:Queens:New York","11368":"Queens:Queens:New York","11369":"Queens:Queens:New York","11370":"Queens:Queens:New York","11372":"Queens:Queens:New York","11373":"Queens:Queens:New York","11374":"Queens:Queens:New York","11375":"Queens:Queens:New York","11377":"Queens:Queens:New York","11378":"Queens:Queens:New York","11379":"Queens:Queens:New York","60601":"Chicago:Cook:Illinois","60602":"Chicago:Cook:Illinois","60603":"Chicago:Cook:Illinois","60604":"Chicago:Cook:Illinois","60605":"Chicago:Cook:Illinois","60606":"Chicago:Cook:Illinois","60607":"Chicago:Cook:Illinois","60608":"Chicago:Cook:Illinois","60609":"Chicago:Cook:Illinois","60610":"Chicago:Cook:Illinois","60611":"Chicago:Cook:Illinois","60612":"Chicago:Cook:Illinois","60613":"Chicago:Cook:Illinois","60614":"Chicago:Cook:Illinois","60615":"Chicago:Cook:Illinois","60616":"Chicago:Cook:Illinois","60617":"Chicago:Cook:Illinois","60618":"Chicago:Cook:Illinois","60619":"Chicago:Cook:Illinois","60620":"Chicago:Cook:Illinois","60621":"Chicago:Cook:Illinois","60622":"Chicago:Cook:Illinois","60623":"Chicago:Cook:Illinois","60624":"Chicago:Cook:Illinois","60625":"Chicago:Cook:Illinois","60626":"Chicago:Cook:Illinois","60628":"Chicago:Cook:Illinois","60629":"Chicago:Cook:Illinois","60630":"Chicago:Cook:Illinois","60631":"Chicago:Cook:Illinois","60632":"Chicago:Cook:Illinois","60634":"Chicago:Cook:Illinois","60636":"Chicago:Cook:Illinois","60637":"Chicago:Cook:Illinois","60638":"Chicago:Cook:Illinois","60639":"Chicago:Cook:Illinois","60640":"Chicago:Cook:Illinois","60641":"Chicago:Cook:Illinois","60642":"Chicago:Cook:Illinois","60643":"Chicago:Cook:Illinois","60644":"Chicago:Cook:Illinois","60645":"Chicago:Cook:Illinois","60646":"Chicago:Cook:Illinois","60647":"Chicago:Cook:Illinois","60649":"Chicago:Cook:Illinois","60651":"Chicago:Cook:Illinois","60652":"Chicago:Cook:Illinois","60653":"Chicago:Cook:Illinois","60654":"Chicago:Cook:Illinois","60655":"Chicago:Cook:Illinois","60656":"Chicago:Cook:Illinois","60657":"Chicago:Cook:Illinois","60659":"Chicago:Cook:Illinois","60660":"Chicago:Cook:Illinois","60661":"Chicago:Cook:Illinois","77001":"Houston:Harris:Texas","77002":"Houston:Harris:Texas","77003":"Houston:Harris:Texas","77004":"Houston:Harris:Texas","77005":"Houston:Harris:Texas","77006":"Houston:Harris:Texas","77007":"Houston:Harris:Texas","77008":"Houston:Harris:Texas","77009":"Houston:Harris:Texas","77010":"Houston:Harris:Texas","77011":"Houston:Harris:Texas","77012":"Houston:Harris:Texas","77019":"Houston:Harris:Texas","77020":"Houston:Harris:Texas","77021":"Houston:Harris:Texas","77022":"Houston:Harris:Texas","77023":"Houston:Harris:Texas","77024":"Houston:Harris:Texas","77025":"Houston:Harris:Texas","77027":"Houston:Harris:Texas","77030":"Houston:Harris:Texas","77031":"Houston:Harris:Texas","77033":"Houston:Harris:Texas","77034":"Houston:Harris:Texas","77035":"Houston:Harris:Texas","77036":"Houston:Harris:Texas","77040":"Houston:Harris:Texas","77041":"Houston:Harris:Texas","77042":"Houston:Harris:Texas","77043":"Houston:Harris:Texas","77044":"Houston:Harris:Texas","77045":"Houston:Harris:Texas","77047":"Houston:Harris:Texas","77048":"Houston:Harris:Texas","77049":"Houston:Harris:Texas","77050":"Houston:Harris:Texas","77051":"Houston:Harris:Texas","77053":"Houston:Harris:Texas","77054":"Houston:Harris:Texas","77055":"Houston:Harris:Texas","77056":"Houston:Harris:Texas","77057":"Houston:Harris:Texas","77058":"Houston:Harris:Texas","77059":"Houston:Harris:Texas","77060":"Houston:Harris:Texas","77061":"Houston:Harris:Texas","77062":"Houston:Harris:Texas","77063":"Houston:Harris:Texas","77064":"Houston:Harris:Texas","77065":"Houston:Harris:Texas","77066":"Houston:Harris:Texas","77067":"Houston:Harris:Texas","77068":"Houston:Harris:Texas","77069":"Houston:Harris:Texas","77070":"Houston:Harris:Texas","77071":"Houston:Harris:Texas","77072":"Houston:Harris:Texas","77073":"Houston:Harris:Texas","77074":"Houston:Harris:Texas","77075":"Houston:Harris:Texas","77076":"Houston:Harris:Texas","77077":"Houston:Harris:Texas","77078":"Houston:Harris:Texas","77079":"Houston:Harris:Texas","77080":"Houston:Harris:Texas","77081":"Houston:Harris:Texas","77082":"Houston:Harris:Texas","77083":"Houston:Harris:Texas","77084":"Houston:Harris:Texas","77085":"Houston:Harris:Texas","77086":"Houston:Harris:Texas","77087":"Houston:Harris:Texas","77088":"Houston:Harris:Texas","77089":"Houston:Harris:Texas","77090":"Houston:Harris:Texas","77091":"Houston:Harris:Texas","77092":"Houston:Harris:Texas","77093":"Houston:Harris:Texas","77094":"Houston:Harris:Texas","77095":"Houston:Harris:Texas","77096":"Houston:Harris:Texas","75201":"Dallas:Dallas:Texas","75202":"Dallas:Dallas:Texas","75204":"Dallas:Dallas:Texas","75205":"Dallas:Dallas:Texas","75206":"Dallas:Dallas:Texas","75207":"Dallas:Dallas:Texas","75208":"Dallas:Dallas:Texas","75209":"Dallas:Dallas:Texas","75210":"Dallas:Dallas:Texas","75211":"Dallas:Dallas:Texas","75212":"Dallas:Dallas:Texas","75214":"Dallas:Dallas:Texas","75215":"Dallas:Dallas:Texas","75216":"Dallas:Dallas:Texas","75217":"Dallas:Dallas:Texas","75218":"Dallas:Dallas:Texas","75219":"Dallas:Dallas:Texas","75220":"Dallas:Dallas:Texas","75223":"Dallas:Dallas:Texas","75224":"Dallas:Dallas:Texas","75225":"Dallas:Dallas:Texas","75226":"Dallas:Dallas:Texas","75227":"Dallas:Dallas:Texas","75228":"Dallas:Dallas:Texas","75229":"Dallas:Dallas:Texas","75230":"Dallas:Dallas:Texas","75231":"Dallas:Dallas:Texas","75232":"Dallas:Dallas:Texas","75233":"Dallas:Dallas:Texas","75234":"Dallas:Dallas:Texas","75235":"Dallas:Dallas:Texas","75236":"Dallas:Dallas:Texas","75237":"Dallas:Dallas:Texas","75238":"Dallas:Dallas:Texas","75240":"Dallas:Dallas:Texas","75243":"Dallas:Dallas:Texas","75246":"Dallas:Dallas:Texas","75248":"Dallas:Dallas:Texas","75249":"Dallas:Dallas:Texas","75251":"Dallas:Dallas:Texas","75252":"Dallas:Dallas:Texas","75253":"Dallas:Dallas:Texas","76101":"Fort Worth:Tarrant:Texas","76102":"Fort Worth:Tarrant:Texas","76103":"Fort Worth:Tarrant:Texas","76104":"Fort Worth:Tarrant:Texas","76105":"Fort Worth:Tarrant:Texas","76106":"Fort Worth:Tarrant:Texas","76107":"Fort Worth:Tarrant:Texas","76108":"Fort Worth:Tarrant:Texas","76109":"Fort Worth:Tarrant:Texas","76110":"Fort Worth:Tarrant:Texas","76111":"Fort Worth:Tarrant:Texas","76112":"Fort Worth:Tarrant:Texas","76116":"Fort Worth:Tarrant:Texas","76117":"Fort Worth:Tarrant:Texas","76118":"Fort Worth:Tarrant:Texas","76119":"Fort Worth:Tarrant:Texas","76120":"Fort Worth:Tarrant:Texas","76123":"Fort Worth:Tarrant:Texas","76126":"Fort Worth:Tarrant:Texas","76131":"Fort Worth:Tarrant:Texas","76132":"Fort Worth:Tarrant:Texas","76133":"Fort Worth:Tarrant:Texas","76134":"Fort Worth:Tarrant:Texas","76135":"Fort Worth:Tarrant:Texas","76137":"Fort Worth:Tarrant:Texas","76140":"Fort Worth:Tarrant:Texas","76148":"Fort Worth:Tarrant:Texas","76177":"Fort Worth:Tarrant:Texas","76179":"Fort Worth:Tarrant:Texas","76244":"Fort Worth:Tarrant:Texas","85003":"Phoenix:Maricopa:Arizona","85004":"Phoenix:Maricopa:Arizona","85006":"Phoenix:Maricopa:Arizona","85007":"Phoenix:Maricopa:Arizona","85008":"Phoenix:Maricopa:Arizona","85009":"Phoenix:Maricopa:Arizona","85012":"Phoenix:Maricopa:Arizona","85013":"Phoenix:Maricopa:Arizona","85014":"Phoenix:Maricopa:Arizona","85015":"Phoenix:Maricopa:Arizona","85016":"Phoenix:Maricopa:Arizona","85017":"Phoenix:Maricopa:Arizona","85018":"Phoenix:Maricopa:Arizona","85019":"Phoenix:Maricopa:Arizona","85020":"Phoenix:Maricopa:Arizona","85021":"Phoenix:Maricopa:Arizona","85022":"Phoenix:Maricopa:Arizona","85023":"Phoenix:Maricopa:Arizona","85024":"Phoenix:Maricopa:Arizona","85027":"Phoenix:Maricopa:Arizona","85028":"Phoenix:Maricopa:Arizona","85029":"Phoenix:Maricopa:Arizona","85031":"Phoenix:Maricopa:Arizona","85032":"Phoenix:Maricopa:Arizona","85033":"Phoenix:Maricopa:Arizona","85034":"Phoenix:Maricopa:Arizona","85035":"Phoenix:Maricopa:Arizona","85037":"Phoenix:Maricopa:Arizona","85040":"Phoenix:Maricopa:Arizona","85041":"Phoenix:Maricopa:Arizona","85042":"Phoenix:Maricopa:Arizona","85043":"Phoenix:Maricopa:Arizona","85044":"Phoenix:Maricopa:Arizona","85045":"Phoenix:Maricopa:Arizona","85048":"Phoenix:Maricopa:Arizona","85050":"Phoenix:Maricopa:Arizona","85051":"Phoenix:Maricopa:Arizona","85053":"Phoenix:Maricopa:Arizona","85054":"Phoenix:Maricopa:Arizona","85083":"Phoenix:Maricopa:Arizona","85085":"Phoenix:Maricopa:Arizona","85086":"Phoenix:Maricopa:Arizona","85201":"Mesa:Maricopa:Arizona","85202":"Mesa:Maricopa:Arizona","85203":"Mesa:Maricopa:Arizona","85204":"Mesa:Maricopa:Arizona","85205":"Mesa:Maricopa:Arizona","85206":"Mesa:Maricopa:Arizona","85207":"Mesa:Maricopa:Arizona","85208":"Mesa:Maricopa:Arizona","85209":"Mesa:Maricopa:Arizona","85210":"Mesa:Maricopa:Arizona","85212":"Mesa:Maricopa:Arizona","85213":"Mesa:Maricopa:Arizona","85215":"Mesa:Maricopa:Arizona","85224":"Chandler:Maricopa:Arizona","85225":"Chandler:Maricopa:Arizona","85226":"Chandler:Maricopa:Arizona","85248":"Chandler:Maricopa:Arizona","85249":"Chandler:Maricopa:Arizona","85233":"Gilbert:Maricopa:Arizona","85234":"Gilbert:Maricopa:Arizona","85281":"Tempe:Maricopa:Arizona","85282":"Tempe:Maricopa:Arizona","85283":"Tempe:Maricopa:Arizona","85284":"Tempe:Maricopa:Arizona","85250":"Scottsdale:Maricopa:Arizona","85251":"Scottsdale:Maricopa:Arizona","85254":"Scottsdale:Maricopa:Arizona","85255":"Scottsdale:Maricopa:Arizona","85257":"Scottsdale:Maricopa:Arizona","85258":"Scottsdale:Maricopa:Arizona","85259":"Scottsdale:Maricopa:Arizona","85260":"Scottsdale:Maricopa:Arizona","85262":"Scottsdale:Maricopa:Arizona","85266":"Scottsdale:Maricopa:Arizona","85301":"Glendale:Maricopa:Arizona","85302":"Glendale:Maricopa:Arizona","85304":"Glendale:Maricopa:Arizona","85305":"Glendale:Maricopa:Arizona","85306":"Glendale:Maricopa:Arizona","85308":"Glendale:Maricopa:Arizona","85310":"Glendale:Maricopa:Arizona","85323":"Avondale:Maricopa:Arizona","85326":"Buckeye:Maricopa:Arizona","85338":"Goodyear:Maricopa:Arizona","85339":"Laveen:Maricopa:Arizona","85340":"Litchfield Park:Maricopa:Arizona","85345":"Peoria:Maricopa:Arizona","85351":"Sun City:Maricopa:Arizona","85353":"Tolleson:Maricopa:Arizona","85355":"Waddell:Maricopa:Arizona","85374":"Surprise:Maricopa:Arizona","85375":"Sun City West:Maricopa:Arizona","85379":"Surprise:Maricopa:Arizona","85381":"Peoria:Maricopa:Arizona","85382":"Peoria:Maricopa:Arizona","85383":"Peoria:Maricopa:Arizona","85387":"Surprise:Maricopa:Arizona","85388":"Surprise:Maricopa:Arizona","98101":"Seattle:King:Washington","98102":"Seattle:King:Washington","98103":"Seattle:King:Washington","98104":"Seattle:King:Washington","98105":"Seattle:King:Washington","98106":"Seattle:King:Washington","98107":"Seattle:King:Washington","98108":"Seattle:King:Washington","98109":"Seattle:King:Washington","98112":"Seattle:King:Washington","98115":"Seattle:King:Washington","98116":"Seattle:King:Washington","98117":"Seattle:King:Washington","98118":"Seattle:King:Washington","98119":"Seattle:King:Washington","98121":"Seattle:King:Washington","98122":"Seattle:King:Washington","98125":"Seattle:King:Washington","98126":"Seattle:King:Washington","98133":"Seattle:King:Washington","98134":"Seattle:King:Washington","98136":"Seattle:King:Washington","98144":"Seattle:King:Washington","98146":"Seattle:King:Washington","98154":"Seattle:King:Washington","98164":"Seattle:King:Washington","98177":"Seattle:King:Washington","98178":"Seattle:King:Washington","98188":"Seattle:King:Washington","98199":"Seattle:King:Washington","98004":"Bellevue:King:Washington","98005":"Bellevue:King:Washington","98006":"Bellevue:King:Washington","98007":"Bellevue:King:Washington","98008":"Bellevue:King:Washington","98033":"Kirkland:King:Washington","98034":"Kirkland:King:Washington","98052":"Redmond:King:Washington","98053":"Redmond:King:Washington","33101":"Miami:Miami-Dade:Florida","33109":"Miami Beach:Miami-Dade:Florida","33125":"Miami:Miami-Dade:Florida","33126":"Miami:Miami-Dade:Florida","33127":"Miami:Miami-Dade:Florida","33128":"Miami:Miami-Dade:Florida","33129":"Miami:Miami-Dade:Florida","33130":"Miami:Miami-Dade:Florida","33131":"Miami:Miami-Dade:Florida","33132":"Miami:Miami-Dade:Florida","33133":"Miami:Miami-Dade:Florida","33134":"Coral Gables:Miami-Dade:Florida","33135":"Miami:Miami-Dade:Florida","33136":"Miami:Miami-Dade:Florida","33137":"Miami:Miami-Dade:Florida","33138":"Miami:Miami-Dade:Florida","33139":"Miami Beach:Miami-Dade:Florida","33140":"Miami Beach:Miami-Dade:Florida","33141":"Miami Beach:Miami-Dade:Florida","33142":"Miami:Miami-Dade:Florida","33143":"Miami:Miami-Dade:Florida","33144":"Miami:Miami-Dade:Florida","33145":"Miami:Miami-Dade:Florida","33146":"Coral Gables:Miami-Dade:Florida","33149":"Key Biscayne:Miami-Dade:Florida","33150":"Miami:Miami-Dade:Florida","33154":"Bal Harbour:Miami-Dade:Florida","33155":"Miami:Miami-Dade:Florida","33156":"Miami:Miami-Dade:Florida","33157":"Miami:Miami-Dade:Florida","33158":"Miami:Miami-Dade:Florida","33160":"North Miami Beach:Miami-Dade:Florida","33161":"North Miami:Miami-Dade:Florida","33162":"North Miami Beach:Miami-Dade:Florida","33165":"Miami:Miami-Dade:Florida","33166":"Miami:Miami-Dade:Florida","33167":"Miami:Miami-Dade:Florida","33168":"Miami:Miami-Dade:Florida","33169":"Miami Gardens:Miami-Dade:Florida","33170":"Miami:Miami-Dade:Florida","33172":"Miami:Miami-Dade:Florida","33173":"Miami:Miami-Dade:Florida","33174":"Miami:Miami-Dade:Florida","33175":"Miami:Miami-Dade:Florida","33176":"Miami:Miami-Dade:Florida","33177":"Miami:Miami-Dade:Florida","33178":"Miami:Miami-Dade:Florida","33179":"Miami:Miami-Dade:Florida","33180":"Miami:Miami-Dade:Florida","33181":"Miami:Miami-Dade:Florida","33183":"Miami:Miami-Dade:Florida","33184":"Miami:Miami-Dade:Florida","33185":"Miami:Miami-Dade:Florida","33186":"Miami:Miami-Dade:Florida","33187":"Miami:Miami-Dade:Florida","33189":"Miami:Miami-Dade:Florida","33190":"Miami:Miami-Dade:Florida","33193":"Miami:Miami-Dade:Florida","33196":"Miami:Miami-Dade:Florida","80201":"Denver:Denver:Colorado","80202":"Denver:Denver:Colorado","80203":"Denver:Denver:Colorado","80204":"Denver:Denver:Colorado","80205":"Denver:Denver:Colorado","80206":"Denver:Denver:Colorado","80207":"Denver:Denver:Colorado","80209":"Denver:Denver:Colorado","80210":"Denver:Denver:Colorado","80211":"Denver:Denver:Colorado","80212":"Denver:Denver:Colorado","80216":"Denver:Denver:Colorado","80218":"Denver:Denver:Colorado","80219":"Denver:Denver:Colorado","80220":"Denver:Denver:Colorado","80221":"Denver:Denver:Colorado","80222":"Denver:Denver:Colorado","80223":"Denver:Denver:Colorado","80224":"Denver:Denver:Colorado","80227":"Denver:Denver:Colorado","80228":"Denver:Denver:Colorado","80229":"Denver:Denver:Colorado","80230":"Denver:Denver:Colorado","80231":"Denver:Denver:Colorado","80232":"Denver:Denver:Colorado","80234":"Denver:Denver:Colorado","80235":"Denver:Denver:Colorado","80236":"Denver:Denver:Colorado","80237":"Denver:Denver:Colorado","80238":"Denver:Denver:Colorado","80239":"Denver:Denver:Colorado","80246":"Denver:Denver:Colorado","80247":"Denver:Denver:Colorado","80249":"Denver:Denver:Colorado","73301":"Austin:Travis:Texas","78701":"Austin:Travis:Texas","78702":"Austin:Travis:Texas","78703":"Austin:Travis:Texas","78704":"Austin:Travis:Texas","78705":"Austin:Travis:Texas","78712":"Austin:Travis:Texas","78717":"Austin:Travis:Texas","78721":"Austin:Travis:Texas","78722":"Austin:Travis:Texas","78723":"Austin:Travis:Texas","78724":"Austin:Travis:Texas","78725":"Austin:Travis:Texas","78726":"Austin:Travis:Texas","78727":"Austin:Travis:Texas","78728":"Austin:Travis:Texas","78729":"Austin:Travis:Texas","78730":"Austin:Travis:Texas","78731":"Austin:Travis:Texas","78732":"Austin:Travis:Texas","78733":"Austin:Travis:Texas","78734":"Austin:Travis:Texas","78735":"Austin:Travis:Texas","78736":"Austin:Travis:Texas","78737":"Austin:Travis:Texas","78738":"Austin:Travis:Texas","78739":"Austin:Travis:Texas","78741":"Austin:Travis:Texas","78744":"Austin:Travis:Texas","78745":"Austin:Travis:Texas","78746":"Austin:Travis:Texas","78747":"Austin:Travis:Texas","78748":"Austin:Travis:Texas","78749":"Austin:Travis:Texas","78750":"Austin:Travis:Texas","78751":"Austin:Travis:Texas","78752":"Austin:Travis:Texas","78753":"Austin:Travis:Texas","78754":"Austin:Travis:Texas","78756":"Austin:Travis:Texas","78757":"Austin:Travis:Texas","78758":"Austin:Travis:Texas","78759":"Austin:Travis:Texas","20001":"Washington:District of Columbia:DC","20002":"Washington:District of Columbia:DC","20003":"Washington:District of Columbia:DC","20004":"Washington:District of Columbia:DC","20005":"Washington:District of Columbia:DC","20006":"Washington:District of Columbia:DC","20007":"Washington:District of Columbia:DC","20008":"Washington:District of Columbia:DC","20009":"Washington:District of Columbia:DC","20010":"Washington:District of Columbia:DC","20011":"Washington:District of Columbia:DC","20012":"Washington:District of Columbia:DC","20015":"Washington:District of Columbia:DC","20016":"Washington:District of Columbia:DC","20017":"Washington:District of Columbia:DC","20018":"Washington:District of Columbia:DC","20019":"Washington:District of Columbia:DC","20020":"Washington:District of Columbia:DC","20024":"Washington:District of Columbia:DC","20032":"Washington:District of Columbia:DC","20036":"Washington:District of Columbia:DC","20037":"Washington:District of Columbia:DC",
// ── NEVADA (added 2026-07-03; county names per NV Dept. of Taxation) ──
"89701":"Carson City:Carson City:Nevada","89702":"Carson City:Carson City:Nevada","89703":"Carson City:Carson City:Nevada","89704":"Carson City:Carson City:Nevada","89705":"Carson City:Carson City:Nevada","89706":"Carson City:Carson City:Nevada",
"89501":"Reno:Washoe:Nevada","89502":"Reno:Washoe:Nevada","89503":"Reno:Washoe:Nevada","89506":"Reno:Washoe:Nevada","89509":"Reno:Washoe:Nevada","89511":"Reno:Washoe:Nevada","89512":"Reno:Washoe:Nevada","89519":"Reno:Washoe:Nevada","89521":"Reno:Washoe:Nevada","89523":"Reno:Washoe:Nevada",
"89431":"Sparks:Washoe:Nevada","89434":"Sparks:Washoe:Nevada","89436":"Sparks:Washoe:Nevada","89441":"Sparks:Washoe:Nevada",
"89101":"Las Vegas:Clark:Nevada","89102":"Las Vegas:Clark:Nevada","89103":"Las Vegas:Clark:Nevada","89104":"Las Vegas:Clark:Nevada","89106":"Las Vegas:Clark:Nevada","89107":"Las Vegas:Clark:Nevada","89108":"Las Vegas:Clark:Nevada","89110":"Las Vegas:Clark:Nevada","89113":"Las Vegas:Clark:Nevada","89117":"Las Vegas:Clark:Nevada","89118":"Las Vegas:Clark:Nevada","89119":"Las Vegas:Clark:Nevada","89120":"Las Vegas:Clark:Nevada","89121":"Las Vegas:Clark:Nevada","89122":"Las Vegas:Clark:Nevada","89123":"Las Vegas:Clark:Nevada","89128":"Las Vegas:Clark:Nevada","89129":"Las Vegas:Clark:Nevada","89130":"Las Vegas:Clark:Nevada","89131":"Las Vegas:Clark:Nevada","89134":"Las Vegas:Clark:Nevada","89135":"Las Vegas:Clark:Nevada","89138":"Las Vegas:Clark:Nevada","89139":"Las Vegas:Clark:Nevada","89141":"Las Vegas:Clark:Nevada","89142":"Las Vegas:Clark:Nevada","89143":"Las Vegas:Clark:Nevada","89144":"Las Vegas:Clark:Nevada","89145":"Las Vegas:Clark:Nevada","89146":"Las Vegas:Clark:Nevada","89147":"Las Vegas:Clark:Nevada","89148":"Las Vegas:Clark:Nevada","89149":"Las Vegas:Clark:Nevada","89156":"Las Vegas:Clark:Nevada","89166":"Las Vegas:Clark:Nevada","89178":"Las Vegas:Clark:Nevada","89179":"Las Vegas:Clark:Nevada","89183":"Las Vegas:Clark:Nevada",
"89002":"Henderson:Clark:Nevada","89011":"Henderson:Clark:Nevada","89012":"Henderson:Clark:Nevada","89014":"Henderson:Clark:Nevada","89015":"Henderson:Clark:Nevada","89044":"Henderson:Clark:Nevada","89052":"Henderson:Clark:Nevada","89074":"Henderson:Clark:Nevada",
"89030":"North Las Vegas:Clark:Nevada","89031":"North Las Vegas:Clark:Nevada","89032":"North Las Vegas:Clark:Nevada","89081":"North Las Vegas:Clark:Nevada","89084":"North Las Vegas:Clark:Nevada","89085":"North Las Vegas:Clark:Nevada","89086":"North Las Vegas:Clark:Nevada",
"89005":"Boulder City:Clark:Nevada","89027":"Mesquite:Clark:Nevada",
"89406":"Fallon:Churchill:Nevada","89408":"Fernley:Lyon:Nevada","89403":"Dayton:Lyon:Nevada","89447":"Yerington:Lyon:Nevada",
"89423":"Minden:Douglas:Nevada","89410":"Gardnerville:Douglas:Nevada","89460":"Gardnerville:Douglas:Nevada",
"89801":"Elko:Elko:Nevada","89815":"Spring Creek:Elko:Nevada",
"89445":"Winnemucca:Humboldt:Nevada","89301":"Ely:White Pine:Nevada","89049":"Tonopah:Nye:Nevada",
"89048":"Pahrump:Nye:Nevada","89060":"Pahrump:Nye:Nevada","89061":"Pahrump:Nye:Nevada",
"89419":"Lovelock:Pershing:Nevada","89820":"Battle Mountain:Lander:Nevada","89316":"Eureka:Eureka:Nevada",
"89043":"Pioche:Lincoln:Nevada","89440":"Virginia City:Storey:Nevada","89415":"Hawthorne:Mineral:Nevada","89013":"Goldfield:Esmeralda:Nevada"};
const lookupZip = (zip) => { const e = ZIP_DATA[zip]; if (!e) return null; const parts = e.split(":"); const STATE_ALIAS = {"DC":"District of Columbia","New York":"New York","Illinois":"Illinois","Texas":"Texas","Arizona":"Arizona","Washington":"Washington","Florida":"Florida","Colorado":"Colorado"}; if (parts.length === 3) { const st = STATE_ALIAS[parts[2]] || parts[2]; return { city: parts[0], county: parts[1], state: st }; } return { city: parts[0], county: parts[1], state: "California" }; };
// HUD 2024 Area Median Income by county/MSA for California DPA eligibility
const COUNTY_AMI = {"Alameda":168500,"Contra Costa":168500,"Marin":168500,"San Francisco":168500,"San Mateo":168500,"Santa Clara":181300,"Napa":117400,"Solano":115300,"Sonoma":117200,"Los Angeles":98200,"Orange":98200,"Sacramento":106300,"El Dorado":106300,"Placer":106300,"Yolo":106300,"Riverside":84500,"San Bernardino":84500,"San Diego":106900,"Fresno":71800,"Kern":64400,"San Joaquin":84100,"Stanislaus":76100,"Santa Cruz":137400,"Monterey":97100,"Ventura":105300,"Santa Barbara":103000,"San Luis Obispo":103400,"Tulare":60500,"New York":114400,"Kings":114400,"Queens":114400,"Bronx":114400,"Richmond":114400,"Nassau":148600,"Suffolk":148600,"Westchester":114400,"Cook":98000,"DuPage":98000,"Lake":98000,"Will":98000,"Kane":98000,"Harris":89600,"Dallas":90000,"Tarrant":90000,"Collin":90000,"Denton":90000,"Travis":110300,"Maricopa":82800,"Pima":72000,"King":134600,"Snohomish":134600,"Pierce":96600,"Miami-Dade":68300,"Broward":68300,"Palm Beach":68300,"Hillsborough":75500,"Pinellas":75500,"Orange FL":72200,"Duval":81100,"Denver":108800,"Arapahoe":108800,"Jefferson":108800,"Adams":108800,"Douglas":108800,"Boulder":116300,"Suffolk MA":140200,"Middlesex":140200,"Norfolk MA":140200,"Essex MA":140200,"Philadelphia":89600,"Montgomery PA":89600,"Delaware PA":89600,"Bucks":89600,"Fulton":90700,"DeKalb":90700,"Gwinnett":90700,"Cobb":90700,"Wayne":73400,"Oakland MI":73400,"Macomb":73400,"Cuyahoga":70800,"Franklin OH":79200,"Hamilton OH":78800,"Fairfax":148600,"Arlington":148600,"Loudoun":148600,"Prince William":148600,"Montgomery MD":148600,"Prince Georges":148600,"Baltimore County":104300,"Howard":104300,"Mecklenburg":84700,"Wake":84700,"Durham":84700,"Hennepin":107800,"Ramsey":107800,"Dakota":107800,"Multnomah":95500,"Washington OR":95500,"Clackamas":95500,"Clark":75800,"Davidson":82900,"Shelby":67100,"Marion":73700,"Hamilton IN":73700,"St. Louis County":78200,"Jackson MO":78200,"Milwaukee":80400,"Dane":95700,"District of Columbia":148600};
const TRANSFER_TAX_CITIES = [
 { label: "Not listed", city: "Not listed", rate: 0, maxPrice: Infinity, state: "*" },
 // ── California ──
 { label: "Alameda", city: "Alameda", rate: 12, maxPrice: Infinity, state: "California" },
 { label: "Albany", city: "Albany", rate: 15, maxPrice: Infinity, state: "California" },
 { label: "Berkeley", city: "Berkeley", rate: 15, maxPrice: 1600000, state: "California" },
 { label: "Berkeley >$1.6M", city: "Berkeley", rate: 25, maxPrice: Infinity, state: "California" },
 { label: "Emeryville", city: "Emeryville", rate: 12, maxPrice: 1000000, state: "California" },
 { label: "Emeryville $1-2M", city: "Emeryville", rate: 15, maxPrice: 2000000, state: "California" },
 { label: "Emeryville >$2M", city: "Emeryville", rate: 25, maxPrice: Infinity, state: "California" },
 { label: "Hayward", city: "Hayward", rate: 8.5, maxPrice: Infinity, state: "California" },
 { label: "Oakland", city: "Oakland", rate: 10, maxPrice: 300000, state: "California" },
 { label: "Oakland $300K-$2M", city: "Oakland", rate: 15, maxPrice: 2000000, state: "California" },
 { label: "Oakland $2-5M", city: "Oakland", rate: 17.5, maxPrice: 5000000, state: "California" },
 { label: "Oakland >$5M", city: "Oakland", rate: 25, maxPrice: Infinity, state: "California" },
 { label: "Piedmont", city: "Piedmont", rate: 13, maxPrice: Infinity, state: "California" },
 { label: "San Leandro", city: "San Leandro", rate: 11, maxPrice: Infinity, state: "California" },
 { label: "El Cerrito", city: "El Cerrito", rate: 12, maxPrice: Infinity, state: "California" },
 { label: "Richmond", city: "Richmond", rate: 7, maxPrice: 1000000, state: "California" },
 { label: "Richmond $1-3M", city: "Richmond", rate: 12.5, maxPrice: 3000000, state: "California" },
 { label: "Richmond $3-10M", city: "Richmond", rate: 25, maxPrice: 10000000, state: "California" },
 { label: "Richmond >$10M", city: "Richmond", rate: 30, maxPrice: Infinity, state: "California" },
 { label: "Culver City", city: "Culver City", rate: 4.5, maxPrice: 1500000, state: "California" },
 { label: "Culver City $1.5-3M", city: "Culver City", rate: 15, maxPrice: 3000000, state: "California" },
 { label: "Culver City $3-10M", city: "Culver City", rate: 30, maxPrice: 10000000, state: "California" },
 { label: "Culver City >$10M", city: "Culver City", rate: 40, maxPrice: Infinity, state: "California" },
 { label: "Los Angeles", city: "Los Angeles", rate: 4.5, maxPrice: 5300000, state: "California" },
 { label: "Los Angeles >$5.3M", city: "Los Angeles", rate: 40, maxPrice: Infinity, state: "California" },
 { label: "Pomona", city: "Pomona", rate: 2.2, maxPrice: Infinity, state: "California" },
 { label: "Redondo Beach", city: "Redondo Beach", rate: 2.2, maxPrice: Infinity, state: "California" },
 { label: "Santa Monica", city: "Santa Monica", rate: 3, maxPrice: 5000000, state: "California" },
 { label: "Santa Monica $5-8M", city: "Santa Monica", rate: 6, maxPrice: 8000000, state: "California" },
 { label: "Santa Monica >$8M", city: "Santa Monica", rate: 56, maxPrice: Infinity, state: "California" },
 { label: "San Rafael", city: "San Rafael", rate: 2, maxPrice: Infinity, state: "California" },
 { label: "Riverside City", city: "Riverside City", rate: 1.1, maxPrice: Infinity, state: "California" },
 { label: "Sacramento", city: "Sacramento", rate: 2.75, maxPrice: Infinity, state: "California" },
 { label: "San Francisco", city: "San Francisco", rate: 5, maxPrice: 250000, sfSeller: true, state: "California" },
 { label: "San Francisco $250K-$1M", city: "San Francisco", rate: 6.8, maxPrice: 1000000, sfSeller: true, state: "California" },
 { label: "San Francisco $1-5M", city: "San Francisco", rate: 7.5, maxPrice: 5000000, sfSeller: true, state: "California" },
 { label: "San Francisco $5-10M", city: "San Francisco", rate: 22.5, maxPrice: 10000000, sfSeller: true, state: "California" },
 { label: "San Francisco $10-25M", city: "San Francisco", rate: 55, maxPrice: 25000000, sfSeller: true, state: "California" },
 { label: "San Francisco >$25M", city: "San Francisco", rate: 60, maxPrice: Infinity, sfSeller: true, state: "California" },
 { label: "San Mateo", city: "San Mateo", rate: 5, maxPrice: 10000000, state: "California" },
 { label: "San Mateo >$10M", city: "San Mateo", rate: 15, maxPrice: Infinity, state: "California" },
 { label: "Hillsborough", city: "Hillsborough", rate: 0.3, maxPrice: Infinity, state: "California" },
 { label: "Mountain View", city: "Mountain View", rate: 3.3, maxPrice: Infinity, state: "California" },
 { label: "Palo Alto", city: "Palo Alto", rate: 3.3, maxPrice: Infinity, state: "California" },
 { label: "San Jose", city: "San Jose", rate: 3.3, maxPrice: 2000000, state: "California" },
 { label: "San Jose $2-5M", city: "San Jose", rate: 7.5, maxPrice: 5000000, state: "California" },
 { label: "San Jose $5-10M", city: "San Jose", rate: 10, maxPrice: 10000000, state: "California" },
 { label: "San Jose >$10M", city: "San Jose", rate: 15, maxPrice: Infinity, state: "California" },
 { label: "Vallejo", city: "Vallejo", rate: 3.3, maxPrice: Infinity, state: "California" },
 { label: "Petaluma", city: "Petaluma", rate: 2, maxPrice: Infinity, state: "California" },
 { label: "Santa Rosa", city: "Santa Rosa", rate: 2, maxPrice: Infinity, state: "California" },
 { label: "Burlingame", city: "Burlingame", rate: 5, maxPrice: Infinity, state: "California" },
 { label: "Daly City", city: "Daly City", rate: 5, maxPrice: Infinity, state: "California" },
 { label: "South San Francisco", city: "South San Francisco", rate: 5, maxPrice: Infinity, state: "California" },
 { label: "Pacifica", city: "Pacifica", rate: 5, maxPrice: Infinity, state: "California" },
 { label: "Half Moon Bay", city: "Half Moon Bay", rate: 5, maxPrice: Infinity, state: "California" },
 { label: "Redwood City", city: "Redwood City", rate: 5, maxPrice: Infinity, state: "California" },
 { label: "San Carlos", city: "San Carlos", rate: 5, maxPrice: Infinity, state: "California" },
 { label: "Menlo Park", city: "Menlo Park", rate: 5, maxPrice: Infinity, state: "California" },
 { label: "Fremont", city: "Fremont", rate: 8.5, maxPrice: Infinity, state: "California" },
 { label: "Sunnyvale", city: "Sunnyvale", rate: 3.3, maxPrice: Infinity, state: "California" },
 { label: "Santa Clara", city: "Santa Clara", rate: 3.3, maxPrice: Infinity, state: "California" },
 { label: "Cupertino", city: "Cupertino", rate: 3.3, maxPrice: Infinity, state: "California" },
 { label: "Milpitas", city: "Milpitas", rate: 3.3, maxPrice: Infinity, state: "California" },
 { label: "Campbell", city: "Campbell", rate: 3.3, maxPrice: Infinity, state: "California" },
 { label: "Santa Cruz", city: "Santa Cruz", rate: 4.4, maxPrice: Infinity, state: "California" },
 { label: "Long Beach", city: "Long Beach", rate: 2.2, maxPrice: Infinity, state: "California" },
 { label: "Pasadena", city: "Pasadena", rate: 2.2, maxPrice: Infinity, state: "California" },
 { label: "San Diego", city: "San Diego", rate: 1.1, maxPrice: Infinity, state: "California" },
 // ── New York ──
 { label: "NY State (outside NYC)", city: "NY State", rate: 4, maxPrice: Infinity, state: "New York", note: "$2/$500 state" },
 { label: "NYC 1-3 Family <$500K", city: "NYC", rate: 10, maxPrice: 500000, state: "New York", note: "1% state+city" },
 { label: "NYC 1-3 Family $500K+", city: "NYC", rate: 14.25, maxPrice: 3000000, state: "New York", note: "Buyer mansion tax applies >$1M" },
 { label: "NYC 1-3 Family $3M+", city: "NYC", rate: 16.25, maxPrice: Infinity, state: "New York" },
 // ── Washington State (REET) ──
 { label: "WA State <$525K", city: "WA State", rate: 16, maxPrice: 525000, state: "Washington", note: "Real estate excise tax" },
 { label: "WA State $525K-$1.525M", city: "WA State", rate: 17.6, maxPrice: 1525000, state: "Washington" },
 { label: "WA State $1.525-$3.025M", city: "WA State", rate: 28, maxPrice: 3025000, state: "Washington" },
 { label: "WA State >$3.025M", city: "WA State", rate: 30, maxPrice: Infinity, state: "Washington" },
 // ── Washington DC ──
 { label: "DC <$400K", city: "Washington DC", rate: 11, maxPrice: 400000, state: "District of Columbia", note: "Recordation + transfer" },
 { label: "DC $400K+", city: "Washington DC", rate: 14.5, maxPrice: Infinity, state: "District of Columbia" },
 // ── Illinois / Chicago ──
 { label: "Chicago", city: "Chicago", rate: 10.5, maxPrice: 1000000, state: "Illinois", note: "City+county+state" },
 { label: "Chicago $1M+", city: "Chicago", rate: 13.5, maxPrice: Infinity, state: "Illinois" },
 { label: "IL (outside Chicago)", city: "IL State", rate: 3, maxPrice: Infinity, state: "Illinois", note: "State + county" },
 // ── Pennsylvania ──
 { label: "Philadelphia", city: "Philadelphia", rate: 41.28, maxPrice: Infinity, state: "Pennsylvania", note: "4.128% city+state combined" },
 { label: "Pittsburgh", city: "Pittsburgh", rate: 40, maxPrice: Infinity, state: "Pennsylvania", note: "4% combined" },
 { label: "PA (other)", city: "PA State", rate: 20, maxPrice: Infinity, state: "Pennsylvania", note: "2% state split buyer/seller" },
 // ── Florida (documentary stamp) ──
 { label: "FL (except Miami-Dade)", city: "FL State", rate: 7, maxPrice: Infinity, state: "Florida", note: "$0.70/$100 doc stamp" },
 { label: "Miami-Dade", city: "Miami-Dade", rate: 6, maxPrice: Infinity, state: "Florida", note: "$0.60/$100 single-family" },
 // ── Massachusetts ──
 { label: "Massachusetts", city: "MA State", rate: 4.56, maxPrice: Infinity, state: "Massachusetts", note: "$4.56/$1000 excise" },
 { label: "Boston", city: "Boston", rate: 4.56, maxPrice: Infinity, state: "Massachusetts", note: "Same as state rate" },
 // ── Maryland ──
 { label: "Maryland", city: "MD State", rate: 5, maxPrice: Infinity, state: "Maryland", note: "State transfer tax" },
 { label: "MD - Howard Co", city: "Howard County MD", rate: 10, maxPrice: Infinity, state: "Maryland", note: "County + state" },
 { label: "MD - Montgomery Co", city: "Montgomery County MD", rate: 10, maxPrice: Infinity, state: "Maryland" },
 // ── Colorado ──
 { label: "CO (most counties)", city: "CO State", rate: 1, maxPrice: Infinity, state: "Colorado", note: "$0.01/$100 doc fee" },
 // ── Georgia ──
 { label: "Georgia", city: "GA State", rate: 1, maxPrice: Infinity, state: "Georgia", note: "$1/$1000 state transfer" },
 // ── Virginia ──
 { label: "VA State", city: "VA State", rate: 3.5, maxPrice: Infinity, state: "Virginia", note: "Grantee + grantor combined" },
 { label: "VA - NOVA (Fairfax/Arlington)", city: "Northern Virginia", rate: 5.83, maxPrice: Infinity, state: "Virginia", note: "Regional + state" },
 // ── Oregon ──
 { label: "OR <$100K", city: "OR State", rate: 1, maxPrice: 100000, state: "Oregon" },
 { label: "OR $100K+", city: "OR State", rate: 1, maxPrice: Infinity, state: "Oregon", note: "$1/$1000 base" },
 { label: "Portland Metro", city: "Portland", rate: 6, maxPrice: Infinity, state: "Oregon", note: "Metro + state combined" },
 // ── Nevada ──
 { label: "Clark Co (Las Vegas)", city: "Las Vegas", rate: 5.1, maxPrice: Infinity, state: "Nevada", note: "Real property transfer tax" },
 // ── Hawaii ──
 { label: "HI <$600K", city: "HI State", rate: 1, maxPrice: 600000, state: "Hawaii", note: "Conveyance tax" },
 { label: "HI $600K-$1M", city: "HI State", rate: 2, maxPrice: 1000000, state: "Hawaii" },
 { label: "HI $1-2M", city: "HI State", rate: 3, maxPrice: 2000000, state: "Hawaii" },
 { label: "HI $2-4M", city: "HI State", rate: 5, maxPrice: 4000000, state: "Hawaii" },
 { label: "HI $4-6M", city: "HI State", rate: 7.5, maxPrice: 6000000, state: "Hawaii" },
 { label: "HI $6-10M", city: "HI State", rate: 10, maxPrice: 10000000, state: "Hawaii" },
 { label: "HI >$10M", city: "HI State", rate: 10, maxPrice: Infinity, state: "Hawaii" },
 // ── Connecticut ──
 { label: "CT <$800K", city: "CT State", rate: 7.5, maxPrice: 800000, state: "Connecticut", note: "Conveyance tax" },
 { label: "CT $800K-$2.5M", city: "CT State", rate: 12.5, maxPrice: 2500000, state: "Connecticut" },
 { label: "CT >$2.5M", city: "CT State", rate: 22.5, maxPrice: Infinity, state: "Connecticut" },
 // ── New Jersey ──
 { label: "NJ <$150K", city: "NJ State", rate: 2, maxPrice: 150000, state: "New Jersey", note: "Realty transfer fee" },
 { label: "NJ $150K-$200K", city: "NJ State", rate: 3.35, maxPrice: 200000, state: "New Jersey" },
 { label: "NJ $200K-$350K", city: "NJ State", rate: 4.85, maxPrice: 350000, state: "New Jersey" },
 { label: "NJ $350K-$1M", city: "NJ State", rate: 5.8, maxPrice: 1000000, state: "New Jersey" },
 { label: "NJ $1M+", city: "NJ State", rate: 8.97, maxPrice: Infinity, state: "New Jersey", note: "Includes mansion tax" },
 // ── Michigan ──
 { label: "Michigan", city: "MI State", rate: 7.5, maxPrice: Infinity, state: "Michigan", note: "State + county transfer" },
 // ── Minnesota ──
 { label: "Minnesota", city: "MN State", rate: 3.3, maxPrice: Infinity, state: "Minnesota", note: "State deed tax" },
 // ── Tennessee ──
 { label: "Tennessee", city: "TN State", rate: 3.7, maxPrice: Infinity, state: "Tennessee", note: "Transfer tax" },
 // ── Arizona ──
 { label: "Arizona", city: "AZ State", rate: 0, maxPrice: Infinity, state: "Arizona", note: "No transfer tax" },
 // ── Texas ──
 { label: "Texas", city: "TX State", rate: 0, maxPrice: Infinity, state: "Texas", note: "No transfer tax" },
];
const TT_CITY_NAMES = [...new Set(TRANSFER_TAX_CITIES.map(t => t.city))];
const getTTCitiesForState = (st) => [...new Set(TRANSFER_TAX_CITIES.filter(t => t.state === "*" || t.state === st).map(t => t.city))];
const getTTForCity = (cityName, price) => {
 const tiers = TRANSFER_TAX_CITIES.filter(t => t.city === cityName).sort((a, b) => a.maxPrice - b.maxPrice);
 if (tiers.length === 0) return TRANSFER_TAX_CITIES[0];
 return tiers.find(t => price <= t.maxPrice) || tiers[tiers.length - 1];
};
const MAX_DTI = { Conventional: 0.50, FHA: 0.57, Jumbo: 0.43, VA: 0.60, USDA: 0.50 };
const LOAN_TYPES = ["Conventional", "FHA", "VA", "Jumbo", "USDA"];
const VA_USAGE = ["First Use", "Subsequent", "Disabled"];
// VA_FUNDING_FEES moved to lib/finance.js
const PROP_TYPES = ["Single Family", "Condo", "Townhouse", "2-Unit", "3-Unit", "4-Unit"];
// 2026 FHFA conforming loan limits by unit count. High-balance = 150% of conforming.
const CONF_LIMITS = { 1: 832750, 2: 1066250, 3: 1288800, 4: 1601750 };
const UNIT_COUNT = { "Single Family": 1, "Condo": 1, "Townhouse": 1, "2-Unit": 2, "3-Unit": 3, "4-Unit": 4 };
const getConfLimit = (pt) => CONF_LIMITS[UNIT_COUNT[pt] || 1] || CONF_LIMITS[1];
const getHighBalLimit = (pt) => Math.round(getConfLimit(pt) * 1.5);
const DEBT_TYPES = ["Mortgage", "HELOC", "Auto Loan", "Auto Lease", "Student Loan", "Revolving", "Installment", "Collection", "Other"];
// Note: value "Yes - POC" is kept for backward compat with saved scenarios,
// but the label now reads "Yes - before closing" to match what the field
// actually means (paid off outside of escrow, prior to closing).
const PAYOFF_OPTIONS = ["No", "Yes - at Escrow", { value: "Yes - POC", label: "Yes - before closing" }, "Omit"];
const PAY_TYPES = ["Salary", "Hourly", "Overtime", "Bonus", "Commission", "Self-Employment", "RSU", "Rental", "Retirement", "Social Security", "Disability", "Child Support", "Alimony", "Other"];
const VARIABLE_PAY_TYPES = ["Hourly", "Overtime", "Bonus", "Commission", "Self-Employment", "RSU"];
const ASSET_TYPES = ["Checking", "Saving", "Money Market", "Mutual Fund", "Stocks", "Bonds", "Retirement", "Gift", "Gift of Equity", "Trust", "Bridge Loan", "Other"];
const RESERVE_FACTORS = { Checking: 1, Saving: 1, "Money Market": 1, "Mutual Fund": 1, Stocks: 0.7, Bonds: 0.7, Retirement: 0.6, Gift: null, "Gift of Equity": null, Trust: 1, "Bridge Loan": 1, Other: 1 };
// REO property types (matches Christo's spreadsheet dropdown).
const REO_PROPERTY_TYPES = ["Single Family", "Duplex", "Triplex", "4-plex", "Condo", "Townhouse", "PUD", "Land", "Commercial"];
// REO occupancy types (matches the spreadsheet "Occup." dropdown).
//  "(Subj)" = subject property — the one being purchased/refinanced. Departing = current primary about to leave.
const REO_OCCUPANCY_TYPES = ["Primary", "Primary (Subj)", "Departing", "Second", "Second (Subj)", "Invest.", "Invest. (Subj)"];
// Map granular occupancy → propUse (used by the existing DTI calc that applies the 75% investment netting rule).
const occupancyToPropUse = (occ) => {
 if (!occ) return "Investment";
 if (occ.startsWith("Primary") || occ === "Departing") return "Primary";
 if (occ.startsWith("Second")) return "Second Home";
 return "Investment";
};
// Loan-type-aware reserves factor:
//   Gift / Gift of Equity → always 0% (per Christo: gifts don't count toward reserves)
//   Jumbo → liquidity haircuts apply (Stocks 70%, Retirement 60%, etc. per RESERVE_FACTORS)
//   Conv / FHA / VA → all qualifying assets count at 100%
const getReserveFactor = (accountType, loanType) => {
 if (accountType === "Gift" || accountType === "Gift of Equity") return 0;
 if (loanType === "Jumbo") {
  const f = RESERVE_FACTORS[accountType];
  return (f === null || f === undefined) ? 1 : f;
 }
 return 1;
};
const FILING_STATUSES = [{value:"Single",label:"Single"},{value:"MFJ",label:"Married Filing Jointly"},{value:"MFS",label:"Married Filing Separately"},{value:"HOH",label:"Head of Household"}];
// FED_BRACKETS / FED_STD_DEDUCTION / STATE_TAX / STATE_NAMES moved to lib/finance.js
// progressiveTax moved to lib/finance.js
function fmt(v, compact) { if (PRIVACY) return "$•••••"; if (v == null || !isFinite(v) || isNaN(v)) return "$0"; if (compact && Math.abs(v) >= 1e6) return "$" + (v/1e6).toFixed(1) + "M"; if (compact && Math.abs(v) >= 1e4) return "$" + (v/1e3).toFixed(0) + "K"; return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v); }
function fmt2(v) { if (PRIVACY) return "$•••••"; return v == null || !isFinite(v) || isNaN(v) ? "$0.00" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v); }
function pct(v, d = 1) { if (PRIVACY) return "••.•%"; return ((v || 0) * 100).toFixed(d) + "%"; }
// ── DRY Helpers ──────────────────────────────────────────────────────────────
// toMonthly moved to lib/finance.js
// calcPI moved to lib/finance.js
// calcBalance moved to lib/finance.js
// calcAPR moved to lib/finance.js
// getPMIRate moved to lib/finance.js
// getFHAMipRate moved to lib/finance.js
let PRIVACY = false;
function priv(str) { if (!PRIVACY) return str; if (typeof str !== "string") str = String(str); return str.replace(/\$[\d,]+\.?\d*/g, "$•••••").replace(/(?<!\w)\d{4,}(?!\w)/g, m => "•".repeat(m.length)); }
// DARK/LIGHT theme tokens moved to lib/theme.js (audit L-4)
let T = DARK;
const FONT = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
const MONO = "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace";
function InfoTip({ text }) {
 const [open, setOpen] = useState(false);
 return (<span style={{ position: "relative", display: "inline-flex", marginLeft: 5, verticalAlign: "middle" }}
  onClick={e => { e.preventDefault(); e.stopPropagation(); }}>
  <span onClick={e => { e.preventDefault(); e.stopPropagation(); setOpen(o => !o); }} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 18, height: 18, borderRadius: "50%", background: open ? T.blue : `${T.blue}20`, color: open ? "#fff" : T.blue, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: FONT, lineHeight: 1, transition: "all 0.2s", userSelect: "none" }}>i</span>
  {open && (
   <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 99999, display: "flex", alignItems: "center", justifyContent: "center" }}>
    <div onClick={e => { e.preventDefault(); e.stopPropagation(); setOpen(false); }} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.35)" }} />
    <div style={{ position: "relative", zIndex: 1, background: T.card, border: `1px solid ${T.separator}`, borderRadius: 14, padding: "18px 20px", fontSize: 13, lineHeight: 1.6, color: T.textSecondary, width: "min(280px, 85vw)", boxShadow: "0 8px 30px rgba(0,0,0,0.25)" }}>
     <div style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-line" }}>{text}</div>
     <button onClick={e => { e.preventDefault(); e.stopPropagation(); setOpen(false); }} style={{ marginTop: 12, width: "100%", padding: "10px 0", background: T.blue, border: "none", borderRadius: 10, fontSize: 13, fontWeight: 600, color: "#fff", cursor: "pointer", fontFamily: FONT }}>Got it</button>
    </div>
   </div>
  )}
 </span>);
}
function FieldLabel({ label, tip, req, filled }) {
 if (!label) return null;
 return (<div style={{ display: "flex", alignItems: "center", fontSize: 13, fontWeight: 500, color: T.textSecondary, marginBottom: 6, fontFamily: FONT }}>{label}{req && !filled && <span style={{ color: T.red, marginLeft: 3, fontSize: 13, fontWeight: 700, lineHeight: 1 }}>*</span>}{tip && <InfoTip text={tip} />}</div>);
}
function Inp({ label, value, onChange, prefix = "$", suffix, step = 1, min = 0, max, sm, type, tip, req, placeholder, readOnly, rightSlot }) {
 const [focused, setFocused] = useState(false);
 const [editStr, setEditStr] = useState(null);
 const inputRef = useRef(null);
 const cursorRef = useRef(null);
 const debounceRef = useRef(null);
 const isText = type === "text";
 // Defensive: coerce undefined/null/NaN numeric values to 0 so the input
 // never renders the string "undefined" if state hasn't been hydrated yet.
 const safeValue = isText ? (value ?? "") : (value == null || (typeof value === "number" && isNaN(value)) ? 0 : value);
 const filled = isText ? (safeValue !== "") : (safeValue !== 0 && safeValue !== "");
 const clamp = (n) => { if (isNaN(n)) return 0; if (min !== undefined && n < min) return min; if (max !== undefined && n > max) return max; return n; };
 const fmtComma = (n) => { if (n === "" || n == null) return ""; if (n === 0) return "0"; const parts = String(n).split("."); parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ","); return parts.join("."); };
 const display = isText ? safeValue : (editStr !== null ? editStr : (safeValue === 0 && focused ? "" : fmtComma(safeValue)));
 const wasFocused = useRef(false);
 useEffect(() => { if (cursorRef.current !== null && inputRef.current) { if (wasFocused.current) inputRef.current.focus(); inputRef.current.setSelectionRange(cursorRef.current, cursorRef.current); cursorRef.current = null; } });
 useEffect(() => { if (!focused && wasFocused.current && inputRef.current && document.activeElement !== inputRef.current) { inputRef.current.focus(); } }, [value]);
 useEffect(() => { return () => { if (debounceRef.current) clearTimeout(debounceRef.current); }; }, []);
 return (<div style={{ marginBottom: sm ? 6 : 14 }}>
  <FieldLabel label={label} tip={tip} req={req} filled={filled} />
  <div style={{ display: "flex", alignItems: "center", background: T.inputBg, borderRadius: 12, padding: sm ? "10px 12px" : "12px 14px", border: focused ? `2px solid ${T.blue}` : `1px solid ${T.inputBorder}`, transition: "border 0.2s" }}>
   {prefix && !isText && <span style={{ color: T.textSecondary, fontSize: sm ? 14 : 17, fontWeight: 600, marginRight: 4, fontFamily: FONT }}>{prefix}</span>}
   <input ref={inputRef} type="text" inputMode={isText ? "text" : "decimal"} readOnly={readOnly} value={display} onFocus={() => { if (readOnly) return; setFocused(true); wasFocused.current = true; setEditStr(null); }} onBlur={() => { setFocused(false); wasFocused.current = false; if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null; } if (editStr !== null) { const n = clamp(parseFloat(editStr.replace(/,/g, ""))); onChange(isNaN(n) ? 0 : n); setEditStr(null); } else if (!isText) { onChange(clamp(value)); } }} onChange={e => { if (isText) return onChange(e.target.value); const raw = e.target.value.replace(/,/g, ""); if (raw === "" || raw === "-") { setEditStr(""); if (debounceRef.current) clearTimeout(debounceRef.current); debounceRef.current = setTimeout(() => onChange(0), 300); return; } if (/^-?\d*\.?\d*$/.test(raw)) { const dotIdx = raw.indexOf("."); const intPart = dotIdx >= 0 ? raw.slice(0, dotIdx) : raw; const decPart = dotIdx >= 0 ? raw.slice(dotIdx) : ""; const fmtInt = intPart.replace(/^(-?)0+(\d)/, "$1$2").replace(/\B(?=(\d{3})+(?!\d))/g, ","); const formatted = fmtInt + decPart; const cursorPos = e.target.selectionStart; const commasBefore = (e.target.value.slice(0, cursorPos).match(/,/g) || []).length; const digitsBeforeCursor = cursorPos - commasBefore; let newCursor = 0, digitsSeen = 0; for (let i = 0; i < formatted.length; i++) { if (formatted[i] !== ",") digitsSeen++; if (digitsSeen >= digitsBeforeCursor) { newCursor = i + 1; break; } } if (digitsBeforeCursor === 0) newCursor = 0; cursorRef.current = newCursor; setEditStr(formatted); const n = parseFloat(raw); if (!isNaN(n)) { if (debounceRef.current) clearTimeout(debounceRef.current); debounceRef.current = setTimeout(() => onChange(n), 150); } } }} min={isText ? undefined : min} step={isText ? undefined : step}
    placeholder={placeholder || ""}
    style={{ background: "transparent", border: "none", outline: "none", color: T.text, fontSize: sm ? 15 : 17, fontWeight: isText ? 500 : 600, fontFamily: FONT, width: "100%", letterSpacing: "-0.02em" }} />
   {suffix && <span style={{ color: T.textTertiary, fontSize: 13, marginLeft: 6, fontFamily: FONT }}>{suffix}</span>}
   {rightSlot && <div style={{ marginLeft: 8, flexShrink: 0 }}>{rightSlot}</div>}
  </div>
 </div>);
}
function Sel({ label, value, onChange, options, sm, tip, req }) {
 return (<div style={{ marginBottom: sm ? 6 : 14 }}>
  <FieldLabel label={label} tip={tip} req={req} filled={value !== ""} />
  <select value={value} onChange={e => onChange(e.target.value)}
   style={{ width: "100%", background: T.inputBg, borderRadius: 12, border: `1px solid ${T.inputBorder}`, padding: sm ? "10px 12px" : "12px 14px", color: T.text, fontSize: sm ? 13 : 15, fontWeight: 500, outline: "none", cursor: "pointer", fontFamily: FONT, WebkitAppearance: "none" }}>
   {options.map(o => <option key={typeof o === "string" ? o : o.value} value={typeof o === "string" ? o : o.value}>{typeof o === "string" ? o : o.label}</option>)}
  </select>
 </div>);
}
function TextInp({ label, value, onChange, placeholder, sm, tip, req, inputMode, pattern }) {
 return (<div style={{ marginBottom: sm ? 6 : 14 }}>
  <FieldLabel label={label} tip={tip} req={req} filled={value !== ""} />
  <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
   inputMode={inputMode} pattern={pattern}
   style={{ width: "100%", boxSizing: "border-box", background: T.inputBg, borderRadius: 12, border: `1px solid ${T.inputBorder}`, padding: sm ? "10px 12px" : "12px 14px", color: T.text, fontSize: sm ? 13 : 15, outline: "none", fontFamily: FONT }} />
 </div>);
}
// ═══ ADDRESS AUTOCOMPLETE (Google Places) ═══
// Provides address typeahead. When user selects a suggestion, fires onSelect
// with { address, city, state, zip, county }. Falls back to plain text input
// if the Google Maps script hasn't loaded yet.
function AddressAutocomplete({ onSelect, value, onChange, placeholder }) {
 const inputRef = useRef(null);
 const autocompleteRef = useRef(null);
 const [ready, setReady] = useState(false);

 // Wait for Google Maps script, then attach Autocomplete
 useEffect(() => {
  let attempts = 0;
  const maxAttempts = 40; // 40 × 500ms = 20s
  function tryInit() {
   if (window.google && window.google.maps && window.google.maps.places) {
    if (inputRef.current && !autocompleteRef.current) {
     const ac = new window.google.maps.places.Autocomplete(inputRef.current, {
      types: ["address"],
      componentRestrictions: { country: "us" },
      fields: ["address_components", "formatted_address"],
     });
     ac.addListener("place_changed", () => {
      const place = ac.getPlace();
      if (!place || !place.address_components) return;
      const get = (type) => {
       const comp = place.address_components.find(c => c.types.includes(type));
       return comp ? comp.long_name : "";
      };
      const getShort = (type) => {
       const comp = place.address_components.find(c => c.types.includes(type));
       return comp ? comp.short_name : "";
      };
      // Build full street address from components
      const streetNum = get("street_number");
      const route = get("route");
      const street = [streetNum, route].filter(Boolean).join(" ");
      const result = {
       address: street || place.formatted_address || "",
       city: get("locality") || get("sublocality_level_1") || get("administrative_area_level_3") || "",
       state: get("administrative_area_level_1") || "",
       zip: get("postal_code") || "",
       county: (get("administrative_area_level_2") || "").replace(/ County$/i, ""),
      };
      // Convert state abbreviation to full name if needed
      const STATE_MAP = {"AL":"Alabama","AK":"Alaska","AZ":"Arizona","AR":"Arkansas","CA":"California","CO":"Colorado","CT":"Connecticut","DE":"Delaware","DC":"District of Columbia","FL":"Florida","GA":"Georgia","HI":"Hawaii","ID":"Idaho","IL":"Illinois","IN":"Indiana","IA":"Iowa","KS":"Kansas","KY":"Kentucky","LA":"Louisiana","ME":"Maine","MD":"Maryland","MA":"Massachusetts","MI":"Michigan","MN":"Minnesota","MS":"Mississippi","MO":"Missouri","MT":"Montana","NE":"Nebraska","NV":"Nevada","NH":"New Hampshire","NJ":"New Jersey","NM":"New Mexico","NY":"New York","NC":"North Carolina","ND":"North Dakota","OH":"Ohio","OK":"Oklahoma","OR":"Oregon","PA":"Pennsylvania","RI":"Rhode Island","SC":"South Carolina","SD":"South Dakota","TN":"Tennessee","TX":"Texas","UT":"Utah","VT":"Vermont","VA":"Virginia","WA":"Washington","WV":"West Virginia","WI":"Wisconsin","WY":"Wyoming"};
      if (result.state.length === 2) result.state = STATE_MAP[result.state] || result.state;
      onSelect(result);
     });
     autocompleteRef.current = ac;
     setReady(true);
    }
    return;
   }
   attempts++;
   if (attempts < maxAttempts) setTimeout(tryInit, 500);
  }
  tryInit();
  return () => {
   if (autocompleteRef.current) {
    window.google.maps.event.clearInstanceListeners(autocompleteRef.current);
    autocompleteRef.current = null;
   }
  };
 }, []);

 return (
  <div style={{ marginBottom: 14 }}>
   <FieldLabel label="Property Address" req filled={value !== ""} />
   <div style={{ position: "relative" }}>
    <input
     ref={inputRef}
     type="text"
     value={typeof value === "string" ? value : ""}
     onChange={e => onChange(e.target.value)}
     placeholder={placeholder || "Start typing an address..."}
     autoComplete="off"
     style={{ width: "100%", boxSizing: "border-box", background: T.inputBg, borderRadius: 12, border: `1px solid ${T.inputBorder}`, padding: "12px 14px", paddingRight: 36, color: T.text, fontSize: 15, outline: "none", fontFamily: FONT, WebkitAppearance: "none" }}
    />
    <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 16, opacity: 0.35, pointerEvents: "none" }}>
     {ready ? "map-pin" : "search"}
    </span>
   </div>
   {!ready && window.__GOOGLE_PLACES_KEY__ && (
    <div style={{ fontSize: 10, color: T.textTertiary, marginTop: 4 }}>Loading address suggestions...</div>
   )}
  </div>
 );
}
function SearchSelect({ label, value, onChange, options, tip, req }) {
 const [open, setOpen] = useState(false);
 const [search, setSearch] = useState("");
 const ref = useRef(null);
 const filtered = options.filter(o => o.toLowerCase().includes(search.toLowerCase()));
 useEffect(() => { const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }; document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h); }, []);
 return (<div style={{ marginBottom: 14, position: "relative" }} ref={ref}>
  <FieldLabel label={label} tip={tip} req={req} filled={value !== ""} />
  <div onClick={() => setOpen(!open)} style={{ background: T.inputBg, borderRadius: 12, border: `1px solid ${open ? T.blue : T.inputBorder}`, padding: "12px 14px", color: T.text, fontSize: 15, cursor: "pointer", fontFamily: FONT, fontWeight: 500 }}>{value || "Select..."}</div>
  {open && (<div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 100, background: T.card, boxShadow: "0 8px 32px rgba(0,0,0,0.3)", borderRadius: 14, marginTop: 4, maxHeight: 220, overflow: "auto" }}>
   <input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} autoFocus style={{ width: "calc(100% - 28px)", margin: "10px 14px", background: T.inputBg, border: `1px solid ${T.inputBorder}`, borderRadius: 10, padding: "10px 12px", color: T.text, fontSize: 14, outline: "none", fontFamily: FONT }} />
   {filtered.map(o => (<div key={o} onClick={() => { onChange(o); setOpen(false); setSearch(""); }} style={{ padding: "10px 14px", cursor: "pointer", color: o === value ? T.blue : T.text, fontSize: 14, fontWeight: o === value ? 600 : 400, fontFamily: FONT, borderBottom: `1px solid ${T.separator}` }}>{o}</div>))}
  </div>)}
 </div>);
}
function Hero({ value, label, color, sub, small, light }) {
 // Two render modes:
 //  - default (light=false): full-width SOLID indigo banner with white text
 //    used as section-level header (Quick Start, Cash to Close, etc.)
 //  - light=true: SOFT light-indigo gradient + colored text + 1px border
 //    used as a sub-section card (Total Interest, etc.) so it sits under
 //    a darker section banner without competing visually
 const accent = color || T.blue;
 if (light) {
  return (<div style={{
    background: `linear-gradient(135deg, ${accent}18, ${accent}0c)`,
    border: `1px solid ${accent}38`,
    padding: small ? "14px 18px" : "18px 22px",
    borderRadius: 14,
    marginBottom: 12,
  }}>
   <div style={{ fontSize: small ? 22 : 28, fontWeight: 700, fontFamily: FONT, color: accent, letterSpacing: "-0.02em", lineHeight: 1.15 }}>{value}</div>
   {(label || sub) && (
     <div style={{ fontSize: 13, fontWeight: 500, color: T.textSecondary, marginTop: 4, fontFamily: FONT }}>
       {label}{sub && <span style={{ color: T.textTertiary }}> · {sub}</span>}
     </div>
   )}
  </div>);
 }
 // Slim banner profile per Christo (2026-05-02) — shorter padding + smaller
 // title so section banners don't dominate the vertical scroll.
 return (<div style={{
   background: accent,
   padding: small ? "8px 16px" : "10px 18px",
   borderRadius: 12,
   marginBottom: 10,
   marginLeft: -2,
   marginRight: -2,
 }}>
  <div style={{ fontSize: small ? 16 : 20, fontWeight: 700, fontFamily: FONT, color: "#fff", letterSpacing: "-0.02em", lineHeight: 1.2 }}>{value}</div>
  {(label || sub) && (
    <div style={{ fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.85)", marginTop: 2, fontFamily: FONT }}>
      {label}{sub && <span style={{ color: "rgba(255,255,255,0.65)" }}> · {sub}</span>}
    </div>
  )}
 </div>);
}
function Card({ children, style: s, onClick, pad }) {
 return (<div onClick={onClick} style={{ background: T.card, borderRadius: 16, padding: pad || 18, boxShadow: T.cardShadow, marginBottom: 12, cursor: onClick ? "pointer" : "default", ...s }}>{children}</div>);
}
function Sec({ title, color, children, action, onAction }) {
 return (<>
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 28, marginBottom: 12, paddingLeft: 4 }}>
   <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, fontFamily: FONT, color: color || T.text, letterSpacing: "-0.02em" }}>{title}</h2>
   {action && <button onClick={onAction} style={{ background: "none", border: "none", color: T.blue, fontSize: 15, fontWeight: 500, cursor: "pointer", fontFamily: FONT }}>{action}</button>}
  </div>
  {children}
 </>);
}
function MRow({ label, value, sub, color, bold, indent, tip }) {
 return (<div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: indent ? "8px 0 8px 16px" : "10px 0", borderBottom: `1px solid ${T.separator}` }}>
  <span style={{ fontSize: bold ? 15 : 14, fontWeight: bold ? 600 : 400, color: bold ? T.text : T.textSecondary, fontFamily: FONT }}>
   {label}{tip && <InfoTip text={tip} />}{sub && <span style={{ color: T.textTertiary, fontSize: 12, marginLeft: 6 }}>{sub}</span>}
  </span>
  <span style={{ fontSize: bold ? 16 : 15, fontWeight: 600, fontFamily: FONT, color: color || T.text, letterSpacing: "-0.02em" }}>{value}</span>
 </div>);
}
function StopLight({ checks, onPillarClick, hideBanner }) {
 const allGreen = checks.every(c => c.ok === true);
 const anyGreen = checks.some(c => c.ok === true);
 const [expanded, setExpanded] = React.useState(null);
 return (<div style={{ display: "flex", flexDirection: "column", alignItems: "center", margin: "8px 0 20px" }}>
  {/* Main status badge — hidden when hideBanner is set (e.g. in the Monthly Payment section) */}
  {!hideBanner && (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: allGreen ? "16px 24px 20px" : "12px 24px", borderRadius: 16, background: allGreen ? `${T.green}18` : anyGreen ? `${T.orange}18` : `${T.red}18`, marginBottom: 20, width: "100%" }}>
   <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
    <span style={{ display: "flex", alignItems: "center", color: allGreen ? T.green : anyGreen ? T.orange : T.red }}><Icon name={allGreen ? "trophy" : anyGreen ? "unlock" : "lock"} size={28} /></span>
    <div>
     <div style={{ fontSize: 18, fontWeight: 800, fontFamily: FONT, color: allGreen ? T.green : anyGreen ? T.orange : T.red, letterSpacing: "-0.03em" }}>{allGreen ? "PRE-QUALIFIED" : anyGreen ? "ALMOST THERE" : "NOT YET"}</div>
     <div style={{ fontSize: 12, color: T.textTertiary }}>{allGreen ? `All ${checks.length} pillars cleared!` : `${checks.filter(c => c.ok).length} of ${checks.length} pillars cleared`}</div>
     {allGreen && <div style={{ fontSize: 10, color: T.textTertiary, marginTop: 2, fontStyle: "italic" }}>Based on the information you provided.</div>}
    </div>
   </div>
   {allGreen && (
    <button onClick={() => window.open("https://2179191.my1003app.com/952015/register", "_blank")} style={{ marginTop: 4, width: "100%", maxWidth: 340, padding: "12px 20px", background: "linear-gradient(135deg, #4a90d9, #3a7dc4)", border: "none", borderRadius: 14, cursor: "pointer", boxShadow: "0 4px 16px rgba(74,144,217,0.35)" }}>
     <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", fontFamily: FONT }}>Get Pre-Approved →</div>
     <div style={{ fontSize: 10, color: "rgba(255,255,255,0.7)", marginTop: 2 }}>Complete my application to lock in your approval</div>
    </button>
   )}
  </div>
  )}
  {/* Traffic light row */}
  <div style={{ display: "grid", gridTemplateColumns: `repeat(${checks.length}, 1fr)`, gap: checks.length > 4 ? 8 : 12, width: "100%" }}>
   {checks.map((c, i) => {
    const color = c.ok === true ? T.green : c.ok === null ? T.textTertiary : T.red;
    const glow = c.ok === true ? `0 0 12px ${T.green}60` : "none";
    const isExp = expanded === i;
    const bg = isExp ? `${T.blue}18` : c.ok === true ? `${T.green}15` : c.ok === null ? T.pillBg : `${T.red}12`;
    return (<div key={i} onClick={() => { setExpanded(isExp ? null : i); Haptics.light(); }} style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "16px 8px 12px", background: bg, borderRadius: 16, transition: "all 0.4s", cursor: "pointer", border: isExp ? `1px solid ${T.blue}40` : "1px solid transparent" }}>
     {/* The light */}
     <div style={{ position: "relative", width: 44, height: 44, marginBottom: 10 }}>
      <div style={{ width: 44, height: 44, borderRadius: "50%", background: c.ok === true ? T.green : c.ok === null ? T.ringTrack : T.red, boxShadow: glow, transition: "all 0.5s", display: "flex", alignItems: "center", justifyContent: "center" }}>
       <span style={{ fontSize: 20, filter: "brightness(1.5)" }}>{c.ok === true ? "✓" : c.ok === null ? "?" : "✗"}</span>
      </div>
      {c.ok === true && <div style={{ position: "absolute", top: -2, right: -2, width: 16, height: 16, borderRadius: "50%", background: T.green, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#fff", fontWeight: 800, border: `2px solid ${T.bg}` }}>✓</div>}
     </div>
     <div style={{ fontSize: 12, fontWeight: 700, color, fontFamily: FONT, textAlign: "center" }}>{c.label}</div>
     <div style={{ fontSize: 10, color: T.textTertiary, marginTop: 2, textAlign: "center", lineHeight: 1.3 }}>{c.sub}</div>
    </div>);
   })}
  </div>
  {/* Expanded detail panel — shows below the circles */}
  {expanded !== null && checks[expanded] && (() => {
   const c = checks[expanded];
   const color = c.ok === true ? T.green : c.ok === null ? T.textTertiary : T.red;
   const statusText = c.ok === true ? "Good!" : c.ok === null ? "Needs Data" : "Needs Work";
   return (
    <div style={{ width: "100%", marginTop: 12, background: T.card, borderRadius: 16, border: `1px solid ${T.cardBorder}`, padding: "14px 16px", animation: "fadeSlide 0.2s ease-out" }}>
     <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ width: 36, height: 36, borderRadius: "50%", background: c.ok === true ? T.green : c.ok === null ? T.ringTrack : T.red, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
       <span style={{ fontSize: 16, color: "#fff", fontWeight: 800 }}>{c.ok === true ? "✓" : c.ok === null ? "?" : "✗"}</span>
      </div>
      <div style={{ flex: 1 }}>
       <div style={{ fontSize: 14, fontWeight: 700, color, display: "flex", alignItems: "center", gap: 6 }}>{c.icon && <Icon name={c.icon} size={16} />} {c.fullLabel || c.label} — {statusText}</div>
       <div style={{ fontSize: 12, color: T.textTertiary, marginTop: 2 }}>{c.detail}</div>
      </div>
     </div>
     {c.action && <div onClick={(e) => { e.stopPropagation(); if (onPillarClick) onPillarClick(c.label); }} style={{ marginTop: 10, fontSize: 12, fontWeight: 600, color: T.blue, cursor: "pointer" }}>{c.action} ›</div>}
    </div>
   );
  })()}
 </div>);
}
function RefiTestLight({ passed, label, detail }) {
 const color = passed === true ? T.green : passed === false ? T.red : T.textTertiary;
 return (<div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 0", borderBottom: `1px solid ${T.separator}` }}>
  <div style={{ width: 36, height: 36, borderRadius: "50%", background: passed === true ? T.green : passed === false ? T.red : T.ringTrack, boxShadow: passed === true ? `0 0 10px ${T.green}50` : passed === false ? `0 0 10px ${T.red}30` : "none", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.4s" }}>
   <span style={{ fontSize: 16, color: "#fff", fontWeight: 800 }}>{passed === true ? "✓" : passed === false ? "✗" : "?"}</span>
  </div>
  <div style={{ flex: 1 }}>
   <div style={{ fontSize: 14, fontWeight: 700, color, fontFamily: FONT }}>{label}</div>
   <div style={{ fontSize: 12, color: T.textTertiary, marginTop: 2 }}>{detail}</div>
  </div>
 </div>);
}
function PayRing({ segments, total, size, hideLegend }) {
 const sz = size || 200, sw = size ? Math.max(18, Math.round(size / 10)) : 22, r = (sz - sw) / 2, c = 2 * Math.PI * r;
 let cum = 0;
 return (<div style={{ display: "flex", flexDirection: "column", alignItems: "center", margin: hideLegend ? "8px 0 4px" : "8px 0 20px" }}>
  <svg width={sz} height={sz} viewBox={`0 0 ${sz} ${sz}`}>
   <circle cx={sz/2} cy={sz/2} r={r} fill="none" stroke={T.ringTrack} strokeWidth={sw} />
   {segments.filter(s => s.v > 0).map((s, i) => { const p = total > 0 ? s.v / total : 0; const dash = p * c, gap = c - dash, off = -cum * c + c * 0.25; cum += p; return <circle key={i} cx={sz/2} cy={sz/2} r={r} fill="none" stroke={s.c} strokeWidth={sw} strokeLinecap="round" strokeDasharray={`${dash} ${gap}`} strokeDashoffset={off} style={{ transition: "all 0.6s ease" }} />; })}
   <text x={sz/2} y={sz/2 - sz*0.06} textAnchor="middle" fill={T.textTertiary} fontSize={Math.round(sz*0.06)} fontWeight="600" fontFamily={FONT} letterSpacing="1.2" textTransform="uppercase">MONTHLY</text>
   <text x={sz/2} y={sz/2 + sz*0.07} textAnchor="middle" fill={T.text} fontSize={Math.round(sz*0.14)} fontWeight="700" fontFamily={FONT} letterSpacing="-0.03em">{fmt(total)}</text>
  </svg>
  {!hideLegend && <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 14, marginTop: 14 }}>
   {segments.filter(s => s.v > 0).map((s, i) => (<div key={i} style={{ display: "flex", alignItems: "center", gap: 5 }}>
    <div style={{ width: 8, height: 8, borderRadius: "50%", background: s.c }} />
    <span style={{ fontSize: 12, color: T.textSecondary, fontFamily: FONT }}>{s.l}</span>
    <span style={{ fontSize: 12, color: T.text, fontFamily: FONT, fontWeight: 600 }}>{fmt(s.v)}</span>
    {s.tip && <InfoTip text={s.tip} />}
   </div>))}
  </div>}
 </div>);
}
function Tab({ label, active, onClick, locked, completed, tabId }) {
 return (<button data-tab={tabId} onClick={locked ? undefined : onClick} style={{ background: active ? T.tabActiveBg : "transparent", backdropFilter: active ? "blur(8px)" : "none", border: "none", borderRadius: 20, padding: "8px 14px", color: locked ? `${T.textTertiary}60` : active ? T.tabActiveText : T.textTertiary, fontSize: 13, fontWeight: 600, cursor: locked ? "not-allowed" : "pointer", whiteSpace: "nowrap", transition: "all 0.2s", fontFamily: FONT, opacity: locked ? 0.5 : 1, position: "relative" }}>
  {locked && <span style={{ marginRight: 3, fontSize: 10 }}></span>}{label}
 </button>);
}
function Progress({ value, max, color, height }) {
 const pctV = max > 0 ? Math.min(1, value / max) : 0;
 return (<div style={{ height: height || 8, background: T.ringTrack, borderRadius: 99, overflow: "hidden", margin: "6px 0" }}>
  <div style={{ height: "100%", width: `${pctV * 100}%`, background: color || T.green, borderRadius: 99, transition: "width 0.5s ease" }} />
 </div>);
}
function Spark({ data, color, w, h }) {
 if (!data || data.length < 2) return null;
 const width = w || 60, height = h || 24;
 const max = Math.max(...data), min = Math.min(...data);
 const range = max - min || 1;
 const pts = data.map((v, i) => `${(i / (data.length - 1)) * width},${height - ((v - min) / range) * height}`).join(" ");
 return <svg width={width} height={height} style={{ display: "block" }}><polyline points={pts} fill="none" stroke={color || T.blue} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function Note({ children, color }) {
 return <div style={{ background: `${color || T.blue}15`, borderRadius: 12, padding: "10px 14px", marginTop: 8 }}><span style={{ fontSize: 13, color: T.textSecondary, lineHeight: 1.5, fontFamily: FONT }}>{children}</span></div>;
}
function StatusPill({ ok, label }) {
 return <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: ok ? T.successBg : ok === null ? T.pillBg : T.errorBg, borderRadius: 99, padding: "3px 10px", fontSize: 12, fontWeight: 600, fontFamily: FONT, color: ok ? T.green : ok === null ? T.textTertiary : T.red }}>{ok ? "✓" : ok === null ? "—" : "✗"} {label}</span>;
}
function LearnSec({ cat, items }) {
 const [openItems, setOpenItems] = React.useState({});
 const toggle = (ii) => setOpenItems(p => ({...p, [ii]: !p[ii]}));
 return (
  <Sec title={cat}>
   <Card>
    {items.map((item, ii) => (
     <div key={ii} style={{ borderBottom: ii < items.length - 1 ? `1px solid ${T.separator}` : "none" }}>
      <div onClick={() => toggle(ii)} style={{ display: "flex", gap: 12, padding: "14px 0", cursor: "pointer" }}>
       <div style={{ width: 40, height: 40, borderRadius: 12, background: `${T.blue}15`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: T.blue }}>{item.icon ? <Icon name={item.icon} size={20} /> : null}</div>
       <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{item.title}</div>
        <div style={{ fontSize: 12, color: T.textTertiary, marginTop: 2, lineHeight: 1.4 }}>{item.desc}</div>
       </div>
       <div style={{ display: "flex", alignItems: "center", color: T.textTertiary, fontSize: 14, transition: "transform 0.2s", transform: openItems[ii] ? "rotate(90deg)" : "none" }}>›</div>
      </div>
      {openItems[ii] && (
       <div style={{ padding: "0 0 16px 52px" }}>
        {item.body.split("\n\n").map((para, pi) => (
         <div key={pi} style={{ fontSize: 13, color: T.textSecondary, lineHeight: 1.65, marginBottom: pi < item.body.split("\n\n").length - 1 ? 12 : 0 }}>
          {para.split("\n").map((line, li) => (
           <span key={li}>{li > 0 && <br/>}{line.startsWith("•") ? <span style={{color: T.text}}>{line}</span> : line}</span>
          ))}
         </div>
        ))}
       </div>
      )}
     </div>
    ))}
   </Card>
  </Sec>
 );
}
// ═══ GAMIFIED COURSE DATA ═══
const COURSE_CHAPTERS = [
 // ── PHASE 1: THE FOUNDATION ──
 { id: 1, phase: 1, phaseLabel: "The Foundation", title: "Your Monthly Payment", icon: "home", housePart: "foundation",
  tabLink: "calc", tabLabel: "Calculator",
  lesson: "Every mortgage payment has 4 parts — we call it PITI:\n\n**Principal** — the chunk that actually pays down your loan balance. This is the equity-building part.\n\n**Interest** — the cost of borrowing money. This is the lender's profit. Early in the loan, most of your payment goes here.\n\n**Taxes** — your annual property tax divided by 12. In California, it's roughly 1.1–1.25% of your home's value.\n\n**Insurance** — homeowners insurance protects your home against fire, theft, and disasters. Lenders require it.\n\nOn a $800K home with 20% down at 6.5%, your P&I alone is about $4,043/mo. Add taxes (~$833) and insurance (~$125), and your total PITI is roughly $5,000/mo.\n\nThe key insight: **your rate matters more than your price.** A 0.5% rate difference on a $640K loan = $200/month — that's $72,000 over 30 years.",
  quiz: [
   { q: "What does PITI stand for?", opts: ["Price, Interest, Tax, Insurance", "Principal, Interest, Taxes, Insurance", "Payment, Income, Tax, Investment", "Principal, Income, Taxes, Insurance"], a: 1 },
   { q: "Early in your loan, most of your payment goes toward:", opts: ["Principal (equity building)", "Interest (lender's profit)", "Property taxes", "Insurance"], a: 1 },
   { q: "A 0.5% rate drop on a $640K loan saves roughly:", opts: ["$50/month", "$100/month", "$200/month", "$500/month"], a: 2 },
  ]},
 { id: 2, phase: 1, phaseLabel: "The Foundation", title: "Down Payment Decoded", icon: "dollar", housePart: "walls_lower",
  tabLink: "calc", tabLabel: "Calculator",
  lesson: "Your down payment is the cash you bring to the table. It determines your loan amount, your monthly payment, and whether you'll pay mortgage insurance.\n\n**Minimum down payments by loan type:**\n• Conventional: 5% (or 3% for first-time buyers)\n• FHA: 3.5% with 580+ credit\n• VA: 0% — the only true zero-down option\n• Jumbo: 20% typically required\n\n**The 20% myth:** You do NOT need 20% down to buy a home. Most first-time buyers put down 3.5–10%. The trade-off? You'll pay mortgage insurance (PMI or MIP) until you reach 20% equity.\n\n**PMI costs:** Conventional PMI runs about 0.5% of your loan annually. On a $640K loan, that's ~$267/month. FHA MIP is 0.55% annually but lasts the life of the loan — meaning you'd need to refinance to remove it.\n\n**The real question:** How much should you put down? More down = lower payment, but you also want cash reserves. Don't drain your savings just to avoid PMI — having 3–6 months of reserves after closing is more important.",
  quiz: [
   { q: "What is the minimum down payment for a VA loan?", opts: ["3.5%", "5%", "0%", "10%"], a: 2 },
   { q: "FHA mortgage insurance (MIP) lasts:", opts: ["Until you reach 20% equity", "5 years", "The life of the loan", "Until you refinance automatically"], a: 2 },
   { q: "What's generally more important than maximizing your down payment?", opts: ["Getting the lowest rate possible", "Keeping cash reserves after closing", "Paying zero closing costs", "Choosing a 15-year term"], a: 1 },
  ]},
 { id: 3, phase: 1, phaseLabel: "The Foundation", title: "Closing Costs Explained", icon: "clipboard", housePart: "foundation_done",
  tabLink: "costs", tabLabel: "Costs",
  lesson: "Closing costs are the fees you pay to finalize your mortgage — typically 2–3% of the loan amount. They cover everything from the appraisal to title insurance.\n\n**Common closing costs:**\n• Origination fee (lender fee): 0–1% of loan\n• Appraisal: $500–800\n• Title insurance: ~$1,500–3,000\n• Escrow fee: ~$2,000–3,500\n• Recording fees: ~$100–200\n• Transfer tax: varies wildly by city (Oakland charges 1.5%!)\n\n**Prepaids (not fees, but due at closing):**\n• Prepaid interest: daily interest from closing to month-end\n• Escrow setup: 2–8 months of taxes & insurance held by servicer\n• Homeowners insurance: first year premium upfront\n\n**Ways to reduce closing costs:**\n• Negotiate seller credits (seller pays part of your costs)\n• Lender credits (slightly higher rate = lender covers costs)\n• Shop title & escrow — these are negotiable!\n\n**Cash to close = Down payment + Closing costs + Prepaids – Credits – EMD**\n\nThis is the real number that matters — not just the down payment.",
  quiz: [
   { q: "Typical closing costs run approximately:", opts: ["0.5–1% of loan amount", "2–3% of loan amount", "5–7% of loan amount", "10% of purchase price"], a: 1 },
   { q: "A seller credit means:", opts: ["The seller lowers the price", "The seller pays some of your closing costs", "You get a tax deduction", "The seller pays your down payment"], a: 1 },
   { q: "Cash to close equals:", opts: ["Down payment only", "Down payment + closing costs", "Down payment + costs + prepaids – credits – EMD", "Purchase price minus loan amount"], a: 2 },
  ]},
 // ── PHASE 2: THE FRAME ──
 { id: 4, phase: 2, phaseLabel: "The Frame", title: "Credit: Your Financial GPA", icon: "bar-chart", housePart: "frame_floor",
  tabLink: "qualify", tabLabel: "Qualify",
  lesson: "Your credit score is the single most influential factor in your mortgage rate. Think of it as your financial GPA — it tells lenders how reliable you are with borrowed money.\n\n**Credit score tiers:**\n• 740+ → Best rates (\"top tier\" pricing)\n• 700–739 → Great rates, small adjustments\n• 660–699 → Good rates, moderate adjustments\n• 620–659 → Conventional minimum, higher rates\n• 580–619 → FHA territory only\n• Below 580 → Very limited options\n\n**What makes up your score:**\n• 35% — Payment history (never miss a payment!)\n• 30% — Credit utilization (keep cards under 30%)\n• 15% — Length of credit history\n• 10% — Credit mix (cards + installment loans)\n• 10% — New credit inquiries\n\n**Quick wins before applying:**\n• Pay down credit card balances below 10% of limits\n• Don't open new accounts in the 6 months before applying\n• Don't close old cards — history length matters\n• Dispute any errors on your report (free at annualcreditreport.com)\n\nA 40-point FICO improvement can save you 0.25–0.50% on your rate — that's tens of thousands over the life of the loan.",
  quiz: [
   { q: "What FICO score unlocks the best mortgage rates?", opts: ["620+", "680+", "740+", "800+"], a: 2 },
   { q: "The largest factor in your credit score is:", opts: ["Credit utilization (30%)", "Payment history (35%)", "Length of history (15%)", "Credit mix (10%)"], a: 1 },
   { q: "Before applying for a mortgage, you should:", opts: ["Close old credit cards", "Open several new cards for more credit", "Pay down card balances below 10% of limits", "Take out a personal loan for down payment"], a: 2 },
  ]},
 { id: 5, phase: 2, phaseLabel: "The Frame", title: "Income & DTI", icon: "banknote", housePart: "frame_walls",
  tabLink: "income", tabLabel: "Income",
  lesson: "Debt-to-Income ratio (DTI) is how lenders measure whether you can handle the monthly payment. It's your total monthly debts divided by your gross monthly income.\n\n**Two types of DTI:**\n• Front-end (housing) DTI = just your housing payment ÷ income\n• Back-end (total) DTI = ALL debts + housing ÷ income ← this is what matters most\n\n**Max DTI by loan type:**\n• Conventional: up to 50%\n• FHA: up to 56.99%\n• VA: up to 60% (most flexible)\n• Jumbo: 43% max (strictest)\n\n**How lenders calculate income:**\nSalaried W-2: Use your gross monthly pay (before taxes).\nSelf-employed: Average your last 2 years of tax returns.\nCommission/bonus: 2-year average, must be consistent.\nPart-time/side gig: Must have 2-year history.\n\n**What counts as a debt:**\n• Car payments, student loans, credit card minimums\n• Any installment loan with 10+ months remaining\n• Child support, alimony\n• Other property payments (if applicable)\n\n**Pro tip:** Paying off a debt with <10 months remaining can dramatically improve your DTI. A $400/mo car payment going away = $400 more in qualifying capacity.",
  quiz: [
   { q: "DTI is calculated as:", opts: ["Monthly debts ÷ net (take-home) income", "Monthly debts ÷ gross (pre-tax) income", "Annual debts ÷ annual income", "Debt balance ÷ annual income"], a: 1 },
   { q: "Which loan program allows the highest DTI?", opts: ["Conventional (50%)", "FHA (56.99%)", "VA (60%)", "Jumbo (43%)"], a: 2 },
   { q: "A debt with fewer than ___ months remaining can often be excluded:", opts: ["6 months", "10 months", "12 months", "24 months"], a: 1 },
  ]},
 { id: 6, phase: 2, phaseLabel: "The Frame", title: "Assets & Reserves", icon: "landmark", housePart: "frame_roof",
  tabLink: "assets", tabLabel: "Assets",
  lesson: "Assets and reserves are the cash and savings you have — both to close the deal and as a safety net after closing.\n\n**Cash to close** = your down payment + closing costs + prepaids – credits. This comes from your liquid assets.\n\n**Reserves** = the savings you keep AFTER closing. Lenders want to see you won't be broke on day one of homeownership.\n\n**Reserve requirements:**\n• Conventional: 2–3 months of PITI\n• FHA: 2–3 months of PITI\n• VA: 2–3 months of PITI\n• Jumbo: 12+ months of PITI\n\n**What counts as reserves:**\n• Checking & savings accounts (100%)\n• 401(k), IRA, retirement (60% of vested balance)\n• Stocks & investments (70% of value)\n• Gift funds for down payment (with proper documentation)\n\n**What does NOT count:**\n• Cash in a safe (can't document it)\n• Borrowed money (unless gift documented properly)\n• Crypto (most lenders still won't accept it)\n\n**The 3-month rule:** Large deposits in the last 2–3 months will need to be \"sourced\" — you'll need to show where the money came from. This is anti-money-laundering compliance, not personal judgment.",
  quiz: [
   { q: "Jumbo loans typically require how many months of reserves?", opts: ["2–3 months", "6 months", "12+ months", "No reserves needed"], a: 2 },
   { q: "A $100K 401(k) counts as ___ in reserves:", opts: ["$100,000", "$70,000", "$60,000", "$50,000"], a: 2 },
   { q: "Large recent deposits need to be:", opts: ["Hidden from the lender", "Sourced and documented", "Moved to cash", "Spent before closing"], a: 1 },
  ]},
 { id: 7, phase: 2, phaseLabel: "The Frame", title: "Loan Programs", icon: "file", housePart: "windows_doors",
  tabLink: "qualify", tabLabel: "Qualify",
  lesson: "Choosing the right loan program is like choosing the right tool for the job. Each has different rules, rates, and benefits.\n\n**Conventional** — The workhorse. Best rates for 740+ FICO and 20%+ down. Conforming limit: $832,750 (higher in expensive areas). PMI drops off at 80% LTV.\n\n**FHA** — The starter. 3.5% down, 580 FICO minimum. Government-backed with mortgage insurance for life. Great for lower credit scores or limited savings. FHA duplex is a powerful house-hacking move.\n\n**VA** — The best loan in America. 0% down, no PMI, lower rates, up to 60% DTI. For veterans and active-duty only. VA funding fee (1.25–3.3%) can be rolled in. Disabled vets are exempt.\n\n**Jumbo** — For loan amounts above conforming limits. Higher rates, 700+ FICO, 20% down, max 43–50% DTI. Stricter on reserves (12+ months).\n\n**USDA** — Zero down for rural and suburban areas. Income limits apply. Not just farms — many suburban towns qualify.\n\n**The real play:** Don't just pick the program with the lowest down payment. Compare total cost over the first 5 years: payment + MI + fees. Sometimes 5% down conventional beats 3.5% FHA because of the MIP difference.",
  quiz: [
   { q: "Which loan program has no mortgage insurance and 0% down?", opts: ["FHA", "Conventional", "VA", "USDA"], a: 2 },
   { q: "FHA mortgage insurance lasts:", opts: ["Until 80% LTV", "5 years", "The life of the loan", "Until the first refinance"], a: 2 },
   { q: "The best way to compare loan programs is:", opts: ["Lowest down payment", "Lowest rate", "Total cost over first 5 years", "Which has the coolest name"], a: 2 },
  ]},
 // ── PHASE 3: THE FINISH ──
 { id: 8, phase: 3, phaseLabel: "The Finish", title: "Tax Savings & Deductions", icon: "file", housePart: "siding",
  tabLink: "tax", tabLabel: "Tax Savings",
  lesson: "Homeownership comes with real tax benefits that renters don't get. Understanding them changes the true \"cost\" of owning.\n\n**Mortgage Interest Deduction:** You can deduct interest paid on up to $750K of mortgage debt ($375K if married filing separately). On a $640K loan at 6.5%, that's ~$41K in year-one interest — a significant deduction.\n\n**Property Tax Deduction:** Deductible up to the SALT cap of $40,400 (as of 2026, phases down for MAGI above $505K). Combined with state income tax, this cap matters in high-tax states like California.\n\n**How it actually saves you money:**\nYour tax savings = (mortgage interest + property tax deduction) × your marginal tax rate.\n\nIf you're in the 24% federal bracket + 9.3% CA state bracket, your effective rate is ~33%. A $41K interest deduction saves you about $13,500 in taxes in year one.\n\n**The net cost of homeownership:** Monthly payment $5,000 minus ~$1,125/mo in tax savings = effective cost of $3,875/mo. Compare THAT number to your rent, not the full payment.\n\n**Standard deduction note:** You only benefit if your itemized deductions exceed the standard deduction ($32,200 MFJ in 2026). Most homeowners in expensive markets will itemize.",
  quiz: [
   { q: "The mortgage interest deduction limit for MFJ is:", opts: ["$500,000", "$750,000", "$1,000,000", "Unlimited"], a: 1 },
   { q: "To benefit from mortgage interest deduction, you must:", opts: ["Own for at least 5 years", "Put 20% down", "Itemize deductions exceeding the standard deduction", "Have an FHA loan"], a: 2 },
   { q: "If you're in a 33% combined tax bracket and pay $40K in mortgage interest, you save roughly:", opts: ["$4,000/year", "$8,000/year", "$13,200/year", "$40,000/year"], a: 2 },
  ]},
 { id: 9, phase: 3, phaseLabel: "The Finish", title: "Amortization & Equity", icon: "trending-up", housePart: "roof_shingles",
  tabLink: "amort", tabLabel: "Amortization",
  lesson: "Amortization is how your loan balance decreases over time. Understanding it reveals the hidden wealth-building engine inside every mortgage.\n\n**How it works:** Early payments are mostly interest. Over time, more goes to principal. On a $640K loan at 6.5%:\n• Year 1: ~$10K to principal, ~$41K to interest\n• Year 15: ~$22K to principal, ~$22K to interest (the crossover!)\n• Year 30: ~$47K to principal, ~$3K to interest\n\n**Equity = what you own.** It grows two ways:\n1. Principal paydown (forced savings — happens automatically)\n2. Appreciation (market value increases — historically 3–5%/year)\n\nOn a $1M home with 20% down: after 7 years at 3% appreciation, your home is worth ~$1.23M. Your loan balance dropped to ~$550K. Your equity: ~$680K from a $200K investment. That's leverage.\n\n**Extra payments are powerful:** Adding just $200/month to a $640K loan at 6.5% saves ~$115K in interest and pays off 4+ years early. The Amortization tab in your calculator shows this side-by-side.\n\n**The refinance ladder:** Every time rates drop 0.5%+, refinance and keep the same payment. You'll shave years off your loan while locking in savings.",
  quiz: [
   { q: "In a 30-year mortgage, the 'crossover point' where more goes to principal than interest is around:", opts: ["Year 5", "Year 10", "Year 15", "Year 25"], a: 2 },
   { q: "Home equity grows through:", opts: ["Principal paydown only", "Appreciation only", "Both principal paydown and appreciation", "Tax deductions"], a: 2 },
   { q: "Adding $200/month extra to a $640K loan at 6.5% saves roughly:", opts: ["$25,000 in interest", "$55,000 in interest", "$115,000 in interest", "$200,000 in interest"], a: 2 },
  ]},
 { id: 10, phase: 3, phaseLabel: "The Finish", title: "The Big Picture", icon: "home", housePart: "complete",
  tabLink: "qualify", tabLabel: "Qualify",
  lesson: "You've learned the pieces. Now let's put it all together — because buying a home isn't just a transaction, it's a wealth-building strategy.\n\n**The true cost of homeownership (monthly):**\nPITI + HOA + maintenance (~1%/year) – tax savings – principal paydown = actual cost.\n\nWhen you subtract tax savings and principal paydown, the effective cost of owning is often LESS than renting the same home — especially after 3–5 years.\n\n**Affordability is personal.** The lender's max DTI isn't YOUR comfort zone. Use the Afford tab to find the purchase price that fits your real budget, not just what you qualify for.\n\n**The wealth equation over 7 years on a $1M home:**\n• Down payment: $200K\n• Appreciation (3%/yr): +$230K\n• Principal paydown: +$90K\n• Tax savings: +$60K\n• Total return: ~$380K on $200K invested = 90% total return\n\n**The homeownership advantage:**\n• Leverage (control $1M asset with $200K)\n• Forced savings (principal paydown happens automatically)\n• Tax benefits (interest + property tax deductions)\n• Inflation hedge (your payment is fixed, rent rises)\n• Generational wealth (your biggest asset grows tax-advantaged)\n\nYou didn't just learn about mortgages — you learned how to build wealth. Now go use the tools. You're ready. ",
  quiz: [
   { q: "The true monthly cost of homeownership should factor in:", opts: ["Just PITI", "PITI + maintenance", "PITI + maintenance – tax savings – principal paydown", "Just the mortgage payment"], a: 2 },
   { q: "A fixed mortgage payment protects you from:", opts: ["Property tax increases", "Rising insurance costs", "Rising rent (inflation hedge)", "HOA increases"], a: 2 },
   { q: "The biggest advantage of homeownership is:", opts: ["Never paying rent again", "Getting a tax write-off", "Leverage — controlling a large asset with a smaller investment", "Having a garage"], a: 2 },
  ]},
];
const PHASE_INFO = [
 { num: 1, title: "The Foundation", sub: "Understanding Your Numbers", color: "#FF9500", chapters: [1,2,3] },
 { num: 2, title: "The Frame", sub: "Qualifying for a Loan", color: "#0A84FF", chapters: [4,5,6,7] },
 { num: 3, title: "The Finish", sub: "The Big Picture", color: "#30D158", chapters: [8,9,10] },
];

// ── localStorage adapter (drop-in replacement for window.storage) ──
// Storage abstraction — swap to @capacitor/preferences for native app
const Storage = {
 async get(key) { try { const v = localStorage.getItem(key); if (v === null) throw new Error("Key not found: " + key); return { key, value: v }; } catch(e) { throw e; } },
 async set(key, value) { try { localStorage.setItem(key, value); return { key, value }; } catch(e) { return null; } },
 async delete(key) { try { localStorage.removeItem(key); return { key, deleted: true }; } catch(e) { return null; } },
 async list(prefix) {
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
   const k = localStorage.key(i);
   if (!prefix || k.startsWith(prefix)) keys.push(k);
  }
  return { keys };
 },
};
const LS = Storage; // Alias for backward compat

// Share abstraction — swap to @capacitor/share for native
const ShareUtil = {
 async share(data) {
  // Current: mailto link / Future: native share sheet
  window.location.href = `mailto:?subject=${encodeURIComponent(data.subject || "")}&body=${encodeURIComponent(data.body || "")}`;
 }
};

// Haptics abstraction — swap to @capacitor/haptics for native
const Haptics = {
 async light() { /* no-op on web */ },
 async medium() { /* no-op on web */ },
 async heavy() { /* no-op on web */ },
};

// ── Tab Progression System ──
const TAB_PROGRESSION = ["overview","setup","income","debts","assets","qualify","tax","amort","learn","compare","summary"];
const SKILL_PRESETS = {
 guided: { label: "Guided", sub: "First-Time Homebuyer", icon: "home", desc: "Step-by-step walkthrough. I'll highlight what to fill in next and unlock sections as you go.", unlockedThrough: 1, startsOn: "setup" },
 standard: { label: "Standard", sub: "I Know the Basics", icon: "key", desc: "Full access to everything. Jump to any section.", unlockedThrough: 11, startsOn: "overview" },
};
const TOGGLE_DESCRIPTIONS = {
 firstTimeBuyer: { on: "Enables 3% down conventional (income limits apply). Also unlocks Rent vs Buy analysis.", off: "Standard down payment minimums (5% conv, 3.5% FHA, 0% VA)." },
 ownsProperties: { on: "Opens the REO (Real Estate Owned) tab to track existing properties, rental income, and reserve requirements.", off: "No existing properties to report." },
 hasSellProperty: { on: "Opens the Seller Net tab — calculates your net proceeds, capital gains tax, and how sale funds apply to your new purchase.", off: "Not selling a property as part of this transaction." },
 showInvestor: { on: "Opens the Investor tab with NOI, Cap Rate, Cash-on-Cash, DSCR, and IRR analysis for rental properties.", off: "Standard primary/second home analysis only." },
 showProp19: { on: "Opens the Prop 19 tab — estimate your transferred property-tax base if you're 55+, disabled, or a disaster victim buying a replacement home in California.", off: "Standard full-reassessment property tax only." },
};

// ═══ WORKSPACE HOST ═══
// Bridge component: lives inside WorkspaceProvider, uses useWorkspace() to
// wire BlueprintPane and SellerNetPane callbacks to the shared context.
function WorkspaceHost({ T, isDesktop, sidebarW, incomes, debts, otherIncome, reos, scenarioList, currentScenario, filingStatus }) {
 const { updatePaneCalc, updatePaneState, updateLinkedValue, linkedValues, workspaceMode } = useWorkspace();
 const isSellBuy = workspaceMode === "sell-buy";
 return (
  <Suspense fallback={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: T.textSecondary, fontSize: 13 }}>Loading Workspace...</div>}>
  <div style={{ position: "fixed", inset: 0, left: sidebarW, zIndex: 100, background: T.bg }}>
   <WorkspaceView
    T={T}
    isDesktop={isDesktop}
    scenarioList={scenarioList}
    currentScenario={currentScenario}
    renderBlueprintPane={(paneId, paneConfig, liveRates, loadedScenario) => {
     return (
     <BlueprintPane
      theme={T}
      paneId={paneId}
      paneConfig={paneConfig}
      isRefiMode={paneConfig.type === "blueprint-refi"}
      linkedValues={paneConfig.type === "blueprint-refi" ? linkedValues : undefined}
      liveRates={liveRates}
      loadedScenario={loadedScenario}
      sharedIncomes={incomes}
      sharedDebts={debts}
      sharedOtherIncome={otherIncome}
      sharedReos={reos}
      linkedDownPayment={(paneConfig.type === "blueprint-purchase" && isSellBuy) ? linkedValues.finalDownPayment : undefined}
      onCalcUpdate={(id, calcObj) => {
       updatePaneCalc(id, calcObj);
       // If this is the purchase pane, push loan details + closing costs to linked values
       if (paneConfig.type === "blueprint-purchase" || paneConfig.type === "blueprint") {
        updateLinkedValue("purchaseLoanAmount", calcObj.loan);
        updateLinkedValue("purchasePropertyValue", calcObj.dp + calcObj.loan);
        updateLinkedValue("purchaseClosingCosts", calcObj.totalClosingCosts + calcObj.prepaidInt + (calcObj.ins * 12) + (calcObj.monthlyTax + calcObj.ins) * 3);
       }
      }}
      onStateUpdate={(id, stateObj) => {
       updatePaneState(id, stateObj);
       if (paneConfig.type === "blueprint-purchase" || paneConfig.type === "blueprint") {
        updateLinkedValue("purchaseRate", stateObj.rate);
        updateLinkedValue("purchaseSalesPrice", stateObj.salesPrice);
        updateLinkedValue("purchaseInsurance", stateObj.annualIns);
        updateLinkedValue("purchaseHoa", stateObj.hoa);
        updateLinkedValue("purchaseCity", stateObj.city || "Alameda");
        updateLinkedValue("purchasePropType", stateObj.propType || "Single Family");
       }
      }}
     />
    );
    }}
    renderSellerNetPane={(paneId, paneConfig) => (
     <SellerNetPane
      theme={T}
      paneId={paneId}
      sharedFilingStatus={filingStatus}
      onNetProceedsUpdate={(vals) => {
       updateLinkedValue("sellNetProceeds", vals.sellNetProceeds);
       updateLinkedValue("sellNetAfterTax", vals.sellNetAfterTax);
      }}
     />
    )}
   />
  </div>
  </Suspense>
 );
}
export default function MortgageBlueprint({ initialState, borrowerMode }) {
 // ── Borrower mode detection ──
 const isBorrower = !!borrowerMode?.enabled;

 // ── Auth context (from BlueprintAuth wrapper — unused in borrower mode) ──
 const rawAuth = useBlueprintAuth(); // Always called (React hook rules)
 const auth = isBorrower ? null : rawAuth;
 const isCloud = isBorrower ? true : (auth?.isAuthenticated && !auth?.localMode);
 // Auto-connect Gmail send for the signed-in LO (silent — one-time consent
 // popup only ever appears on the first send in a fresh browser). Borrowers
 // never get this: their Google accounts aren't in the Ops send allowlist.
 React.useEffect(() => {
  if (!isBorrower && isCloud && auth?.user?.email) warmGmailToken(auth.user.email);
 }, [isBorrower, isCloud, auth?.user?.email]);

 // ── Borrower state (Supabase-synced when authenticated) ──
 const [activeBorrower, setActiveBorrower] = useState(
  isBorrower ? (borrowerMode.borrower || {}) : null
 );
 const [borrowerList, setBorrowerList] = useState([]);           // [ { id, name, email, status }, ... ]
 const [borrowerLoading, setBorrowerLoading] = useState(false);
 const [activeScenarioId, setActiveScenarioId] = useState(
  isBorrower ? (borrowerMode.scenarioId || null) : null
 );
 const [cloudSyncStatus, setCloudSyncStatus] = useState('');     // '', 'saving', 'saved', 'error'
 const [borrowerScenarios, setBorrowerScenarios] = useState([]); // Scenarios for selected borrower (step 2)
 const [borrowerScenariosLoading, setBorrowerScenariosLoading] = useState(false);
 const supabaseSaveTimer = useRef(null);
 // ── Blueprint switcher shelf (left panel): pinned + recent blueprints ──
 const {
  pinned: pinnedBlueprints,
  recents: recentBlueprints,
  isPinned: isBlueprintPinned,
  recordRecent: recordRecentBlueprint,
  togglePin: toggleBlueprintPin,
 } = useBlueprintShelf();
 // Format a client's name as "Last, First" for the switcher rows.
 const formatLastFirst = (borrower) => {
  if (!borrower) return 'Client';
  const last = borrower.last_name || borrower.lastName;
  const first = borrower.first_name || borrower.firstName;
  if (last || first) return [last, first].filter(Boolean).join(', ');
  const name = (borrower.name || '').trim();
  if (!name) return 'Client';
  const parts = name.split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[parts.length - 1]}, ${parts.slice(0, -1).join(' ')}`;
 };
 const makeClientEntry = (borrower) => ({
  borrowerId: borrower?.id,
  borrowerName: formatLastFirst(borrower),
  status: borrower?.status || 'active',
  ts: Date.now(),
 });

 // ── Real-Time Sync (Phase 1-6) ──
 // getState/loadState are defined below — sync hook uses refs so this is safe
 const getStateRef = useRef(null);
 const loadStateRef = useRef(null);
 const sync = useBlueprintSync({
  scenarioId: activeScenarioId,
  getState: () => getStateRef.current ? getStateRef.current() : {},
  loadState: (s) => loadStateRef.current && loadStateRef.current(s),
  userInfo: isBorrower ? {
   email: borrowerMode.account?.email || '',
   name: borrowerMode.account?.name || '',
   avatarUrl: borrowerMode.account?.picture || '',
  } : {
   email: auth?.user?.email || '',
   name: auth?.user?.name || '',
   avatarUrl: auth?.user?.picture || '',
  },
  userType: isBorrower ? 'borrower' : 'lo',
  shareToken: isBorrower ? borrowerMode.shareToken : null,
  enabled: isBorrower
   ? !!activeScenarioId
   : (isCloud && !!activeBorrower && !!activeScenarioId),
 });

 // ── Version History (Phase 3) ──
 const versionHistoryHook = useVersionHistory({
  scenarioId: activeScenarioId,
  userType: isBorrower ? 'borrower' : 'lo',
  enabled: isCloud && !!activeScenarioId,
  onRevert: (fields) => {
   if (loadStateRef.current) loadStateRef.current(fields);
   sync.scheduleSync();
  },
 });
 const versionHistory = versionHistoryHook.history;
 const versionBookmarks = versionHistoryHook.bookmarks;
 const handleVersionUndo = versionHistoryHook.undo;
 const handleVersionRevert = versionHistoryHook.revertTo;
 const handleCreateBookmark = (label) => {
  const state = getStateRef.current ? getStateRef.current() : null;
  versionHistoryHook.createBookmark(label, state);
 };

 // ── Desktop Detection ──
 const [isDesktop, setIsDesktop] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 900);
 useEffect(() => {
  const handleResize = () => setIsDesktop(window.innerWidth >= 900);
  window.addEventListener('resize', handleResize);
  return () => window.removeEventListener('resize', handleResize);
 }, []);
 // ── Theme: light or dark only. The 'auto' (time-of-day) mode was
 //    removed (2026-05-03) per Christo — confused users and pretty much
 //    nobody used it. Any legacy 'auto' value falls back to 'light'.
 const [themeMode, setThemeMode] = useState(() => {
  try { const p = new URLSearchParams(window.location.search); const t = p.get('theme'); if (t === 'dark' || t === 'light') return t; } catch {}
  try { const saved = localStorage.getItem('bp_theme_mode'); if (saved === 'dark' || saved === 'light') return saved; } catch {}
  return 'light';
 });
 const [darkMode, setDarkMode] = useState(() => {
  try { const saved = localStorage.getItem('bp_theme_mode'); if (saved === 'dark') return true; } catch {}
  return false;
 });
 useEffect(() => {
  setDarkMode(themeMode === 'dark');
 }, [themeMode]);
 const cycleTheme = () => {
  const next = themeMode === 'dark' ? 'light' : 'dark';
  setThemeMode(next);
  try { localStorage.setItem('bp_theme_mode', next); } catch {}
 };
 T = darkMode ? DARK : LIGHT; // DARK/LIGHT are constant objects — reference is stable per mode
 // ── Desktop sidebar collapsed state ──
 const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
 // Mobile RealStack shell drawer — slides in from the left on mobile when
 // the hamburger button in UnifiedHeader is tapped. Replaces the killed
 // Blueprint|PricePoint segmented pill row (2026-05-03).
 const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
 // ── iOS Safe Area: ensure viewport-fit=cover ──
 useEffect(() => {
  const meta = document.querySelector('meta[name="viewport"]');
  if (meta && !meta.content.includes("viewport-fit=cover")) {
   meta.content = meta.content + ", viewport-fit=cover";
  }
 }, []);
 // ── Security State ──
 const [privacyMode, setPrivacyMode] = useState(false);
 // ── Realtor Partner (co-branding via /r/slug URL) ──
 const [realtorPartnerSlug, setRealtorPartnerSlug] = useState(() => {
  try {
   const path = window.location.pathname;
   const match = path.match(/^\/r\/([a-zA-Z0-9_-]+)/);
   if (match && REALTOR_PARTNERS[match[1]]) return match[1];
   const params = new URLSearchParams(window.location.search);
   const ref = params.get("ref") || params.get("r");
   if (ref && REALTOR_PARTNERS[ref]) return ref;
  } catch(e) {}
  return null;
 });
 const realtorPartner = realtorPartnerSlug ? REALTOR_PARTNERS[realtorPartnerSlug] : null;
 const [isLocked, setIsLocked] = useState(false);
 const [pinCode, setPinCode] = useState("");
 const [pinSet, setPinSet] = useState(false);
 const [pinInput, setPinInput] = useState("");
 const [pinError, setPinError] = useState("");
 const [pinSetup, setPinSetup] = useState(false);
 const [pinConfirm, setPinConfirm] = useState("");
 const [autoLockMin, setAutoLockMin] = useState(5);
 const [consentGiven, setConsentGiven] = useState(false);
 const [showClearConfirm, setShowClearConfirm] = useState(false);
 const [showWelcome, setShowWelcome] = useState(() => { try { return !localStorage.getItem("mb_welcomed"); } catch { return true; } });
 const [welcomeStep, setWelcomeStep] = useState(0);
 const [clearStep, setClearStep] = useState(0);
 const [showFredKey, setShowFredKey] = useState(false);
 const [isOffline, setIsOffline] = useState(!navigator.onLine);
 useEffect(() => {
  const goOffline = () => setIsOffline(true);
  const goOnline = () => setIsOffline(false);
  window.addEventListener('offline', goOffline);
  window.addEventListener('online', goOnline);
  return () => {
    window.removeEventListener('offline', goOffline);
    window.removeEventListener('online', goOnline);
  };
 }, []);
 const lastActivity = useRef(Date.now());
 const lockTimer = useRef(null);
 const [tab, setTab] = useState("overview");
 // ── App Mode: Blueprint is the default landing app. ?mode=pricepoint|markets|blueprint overrides. ──
 const [appMode, setAppMode] = useState(() => {
  try { const p = new URLSearchParams(window.location.search); const m = p.get('mode'); if (m === 'pricepoint') return 'pricepoint'; if (m === 'markets') return 'markets'; if (m === 'blueprint') return 'blueprint'; } catch {}
  return 'blueprint';
 });
 // ── PricePoint sidebar tab sync ──
 const [ppSidebarTab, setPpSidebarTab] = useState(null); // triggers PricePoint tab navigation
 const [ppSidebarTabCounter, setPpSidebarTabCounter] = useState(0); // force re-trigger same tab
 const [ppCurrentTab, setPpCurrentTab] = useState("daily"); // PricePoint reports its active tab
 const triggerPPTab = (tab) => { setPpSidebarTab(tab); setPpSidebarTabCounter(c => c + 1); };

 // ── Split-Screen Mode (desktop only) ──
 const [splitMode, setSplitMode] = useState(false); // is split active?
 const [splitApp, setSplitApp] = useState(null); // which mode is in the right pane
 const [splitRatio, setSplitRatio] = useState(50); // left pane width percentage
 const splitDragging = useRef(false);
 const splitContainerRef = useRef(null);
 // Open split view with a specific mode in the right pane
 const openSplit = useCallback((mode) => {
  if (!isDesktop) return;
  if (mode === appMode) return; // can't split same mode
  setSplitMode(true);
  setSplitApp(mode);
  setSplitRatio(50);
 }, [isDesktop, appMode]);
 // Close split view
 const closeSplit = useCallback(() => {
  setSplitMode(false);
  setSplitApp(null);
  setSplitRatio(50);
 }, []);
 // Handle split divider drag — uses viewport width for positioning
 const onSplitDragStart = useCallback((e) => {
  e.preventDefault();
  splitDragging.current = true;
  const onMove = (ev) => {
   if (!splitDragging.current) return;
   const x = ev.clientX || ev.touches?.[0]?.clientX || 0;
   const pct = Math.max(30, Math.min(70, (x / window.innerWidth) * 100));
   setSplitRatio(pct);
  };
  const onUp = () => { splitDragging.current = false; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); window.removeEventListener('touchmove', onMove); window.removeEventListener('touchend', onUp); };
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
  window.addEventListener('touchmove', onMove);
  window.addEventListener('touchend', onUp);
 }, []);
 // PricePoint is now its own component — see PricePoint.jsx
 const [salesPrice, setSalesPrice] = useState(0);
 const [downPct, setDownPct] = useState(0);
 const [downMode, setDownMode] = useState("pct"); // "pct" or "dollar"
 const [rate, setRate] = useState(6.5);
 const [term, setTerm] = useState(30);
 const [loanType, setLoanType] = useState("Conventional");
 const [autoJumboSwitch, setAutoJumboSwitch] = useState(false);
 const userLoanTypeRef = useRef("Conventional");
 const [vaUsage, setVaUsage] = useState("First Use");
 const [propType, setPropType] = useState("Single Family");
 const [loanPurpose, setLoanPurpose] = useState("Purchase Primary");
 const [city, setCity] = useState("Alameda");
 const [propertyState, setPropertyState] = useState("California");
 const [propertyAddress, setPropertyAddress] = useState("");
 const [propertyTBD, setPropertyTBD] = useState(true);
 const [propertyZip, setPropertyZip] = useState("");
 const [addressMode, setAddressMode] = useState("address"); // "address" or "zip"
 const [addressInput, setAddressInput] = useState(""); // display value for autocomplete
 const [propertyCounty, setPropertyCounty] = useState("");
 const [hoa, setHoa] = useState(0);
 const [annualIns, setAnnualIns] = useState(1500);
 const [propTaxMode, setPropTaxMode] = useState("auto"); // "auto" or "custom"
 const [taxBaseRateOverride, setTaxBaseRateOverride] = useState(0); // e.g. 1.2127 (percent, not decimal)
 const [fixedAssessments, setFixedAssessments] = useState(1500); // annual Mello-Roos / bonds / special assessments
 const [propTaxExpanded, setPropTaxExpanded] = useState(false); // UI expand/collapse (separate from mode)
 const [taxExemptionOverride, setTaxExemptionOverride] = useState(7000); // primary res exemption (CA default $7K)
 const [taxRateLocked, setTaxRateLocked] = useState(true); // locked = auto-sync with city/state
 const [taxExemptionLocked, setTaxExemptionLocked] = useState(true); // locked = auto-sync with loanPurpose
 const [propTaxCustomize, setPropTaxCustomize] = useState(false); // Layer 3 customize panel visibility
 const [includeEscrow, setIncludeEscrow] = useState(true);
 const [subjectRentalIncome, setSubjectRentalIncome] = useState(0);
 const [transferTaxCity, setTransferTaxCity] = useState("Not listed");
 // Buyer's share of CITY transfer tax: "buyer" (100%) | "split50" (50%) | "seller" (0%). Default 50/50.
 const [transferTaxSplit, setTransferTaxSplit] = useState("split50");
 // Buyer's share of COUNTY transfer tax — independent of city per Christo (different deals split these differently).
 const [transferTaxCountySplit, setTransferTaxCountySplit] = useState("split50");
 const [discountPts, setDiscountPts] = useState(0);
 const [originatorComp, setOriginatorComp] = useState(0);
 // Section A — lender/origination fees (defaults match Christo's fee worksheet)
 const [adminFee, setAdminFee] = useState(795);
 const [lenderWireFee, setLenderWireFee] = useState(295);
 const [underwritingFee, setUnderwritingFee] = useState(1250);
 // Processing Fee lives in Section B (Services You Cannot Shop For) per the fee worksheet
 const [processingFee, setProcessingFee] = useState(695);
 const [appraisalFee, setAppraisalFee] = useState(850);
 const [creditReportFee, setCreditReportFee] = useState(134);
 const [floodCertFee, setFloodCertFee] = useState(8);
 const [mersFee, setMersFee] = useState(25);
 const [taxServiceFee, setTaxServiceFee] = useState(85);
 const [titleInsurance, setTitleInsurance] = useState(2000);
 const [titleSearch, setTitleSearch] = useState(0);   // retired fee (2026-07-05) — kept for old scenario loads
 const [settlementFee, setSettlementFee] = useState(0); // retired fee (2026-07-05) — kept for old scenario loads
 const [escrowFee, setEscrowFee] = useState(2400);
 // Section C — additional title/escrow line items (from the fee worksheet)
 const [courierFee, setCourierFee] = useState(150);
 const [loanTieInFee, setLoanTieInFee] = useState(150);
 const [notaryFee, setNotaryFee] = useState(175);
 const [envProtectionLien, setEnvProtectionLien] = useState(100);
 const [recordingFee, setRecordingFee] = useState(200);
 // LO-managed fee customization (Christo 2026-07-05): extra fees added per
 // section + built-in fees the LO deleted (their values are zeroed too).
 const [customFees, setCustomFees] = useState([]);   // [{ id, section: 'A'|'B'|'C'|'E'|'H', label, amount }]
 const [hiddenFees, setHiddenFees] = useState([]);   // built-in fee keys removed by the LO
 const [lenderCredit, setLenderCredit] = useState(0);
 const [sellerCredit, setSellerCredit] = useState(0);
 const [realtorCredit, setRealtorCredit] = useState(0);
 const [emd, setEmd] = useState(0); // legacy $ EMD (kept for back-compat with saved scenarios)
 // EMD entered as a % of price (3% is standard in CA). Only credited if actually paid to escrow.
 const [emdPct, setEmdPct] = useState(3);
 const [emdPaid, setEmdPaid] = useState(false);
 const [emdLocked, setEmdLocked] = useState(true); // locked = % of price; unlocked = flat $ (emdFlat)
 const [emdFlat, setEmdFlat] = useState(0);
 // Section H: Other Costs
 const [ownersTitleIns, setOwnersTitleIns] = useState(3000);
 const [homeWarranty, setHomeWarranty] = useState(500);
 const [hoaTransferFee, setHoaTransferFee] = useState(0); // auto-set to 1 month HOA
 const [buyerPaysComm, setBuyerPaysComm] = useState(false);
 const [buyerCommPct, setBuyerCommPct] = useState(2.5);
 const [sellerTaxBasis, setSellerTaxBasis] = useState(5000);
 const [prepaidDays, setPrepaidDays] = useState(15);
 const [coeDays, setCoeDays] = useState(30);
 const [debts, setDebts] = useState([]);
 const [debtFree, setDebtFree] = useState(false);
 const [married, setMarried] = useState("Single");
 const [taxState, setTaxState] = useState("California");
 const [appreciationRate, setAppreciationRate] = useState(3);
 const [sellPrice, setSellPrice] = useState(1000000);
 const [sellMortgagePayoff, setSellMortgagePayoff] = useState(0);
 const [sellCommission, setSellCommission] = useState(5);
 const [sellTransferTaxCity, setSellTransferTaxCity] = useState("Oakland");
 const [sellEscrow, setSellEscrow] = useState(3500);
 const [sellTitle, setSellTitle] = useState(2500);
 const [sellOther, setSellOther] = useState(0);
 const [sellSellerCredit, setSellSellerCredit] = useState(0);
 const [sellProration, setSellProration] = useState(0);
 const [sellCostBasis, setSellCostBasis] = useState(0);
 const [sellImprovements, setSellImprovements] = useState(0);
 const [sellPrimaryRes, setSellPrimaryRes] = useState(true);
 const [sellYearsOwned, setSellYearsOwned] = useState(5);
 const [sellLinkedReoId, setSellLinkedReoId] = useState("");
 const [incomes, setIncomes] = useState([]);
 const [otherIncome, setOtherIncome] = useState(0);
 const [otherIncome2, setOtherIncome2] = useState(0);
 // Borrower roster — supports 1..N borrowers per loan (joint apps with
 // 3+ borrowers exist for guarantor scenarios). numBorrowers controls
 // how many borrower cards render in IncomeContent / Debts / etc.
 // borrowerNames maps borrower-number → display name shown on the card
 // header. Default 2 (the most common case: primary + co-borrower).
 const [numBorrowers, setNumBorrowers] = useState(1); // Default to 1; "+ Add Borrower" bumps as needed. Empty trailing borrowers auto-compact in IncomeContent. (Christo 2026-05-12.)
 const [borrowerNames, setBorrowerNames] = useState({});
 // Other Monthly Income per borrower beyond #2 (kept as a map so
 // 3rd / 4th borrower additions don't require new top-level state).
 const [otherIncomeByBorrower, setOtherIncomeByBorrower] = useState({});
 const [assets, setAssets] = useState([]);
 const [creditScore, setCreditScore] = useState(0);
 const [pmiRateLocked, setPmiRateLocked] = useState(true);
 const [pmiRateOverride, setPmiRateOverride] = useState(0);
 // LO-edited PMI chart: { [ltvBucket 97|95|90|85]: annual % }. Overrides the
 // Radian matrix for that LTV bucket (Christo 2026-07-05, PMI advanced chart).
 const [pmiChartOverrides, setPmiChartOverrides] = useState({});
 const [vaFundingFeeLocked, setVaFundingFeeLocked] = useState(true);
 const [vaFundingFeeOverride, setVaFundingFeeOverride] = useState(0);
 const [extraPayment, setExtraPayment] = useState(0);
 const [payExtra, setPayExtra] = useState(false);
 const [amortView, setAmortView] = useState("monthly");
 const [scenarioName, setScenarioName] = useState("Scenario 1");
 const [scenarioList, setScenarioList] = useState([]);
 const [hasSellProperty, setHasSellProperty] = useState(false);
 const [ownsProperties, setOwnsProperties] = useState(false);
 const [isRefi, setIsRefi] = useState(null);
 const [firstTimeBuyer, setFirstTimeBuyer] = useState(null);
 // LO identity — device-level, seeded from bp_lo_info (survives scenario
 // switches and sync; "Set once — applies to all scenarios" for real now).
 const loInfoSaved = (() => { try { return JSON.parse(localStorage.getItem("bp_lo_info") || "{}"); } catch { return {}; } })();
 const [loanOfficer, setLoanOfficer] = useState(loInfoSaved.loanOfficer ?? "Chris Granger");
 const [loEmail, setLoEmail] = useState(loInfoSaved.loEmail ?? "cgranger@xperthomelending.com");
 const [loPhone, setLoPhone] = useState(loInfoSaved.loPhone ?? "(415) 987-8489");
 const [loNmls, setLoNmls] = useState(loInfoSaved.loNmls ?? "952015");
 // Email signature (Christo 2026-07-05) — used at the bottom of worksheet
 // emails; device-persisted like Ops' signature (bp_email_signature).
 const [loSignature, setLoSignature] = useState(() => {
  try { return localStorage.getItem("bp_email_signature") || ""; } catch { return ""; }
 });
 useEffect(() => {
  try { localStorage.setItem("bp_email_signature", loSignature); } catch { /* private mode */ }
 }, [loSignature]);
 const [companyName, setCompanyName] = useState(loInfoSaved.companyName ?? "Chris Granger Mortgage");
 const [companyNmls, setCompanyNmls] = useState(loInfoSaved.companyNmls ?? "2179191");
 // (Effect must sit BELOW every const it references — TDZ in deps array
 //  crashed the 2026-07-05 deploy when it lived above companyName.)
 useEffect(() => {
  try { localStorage.setItem("bp_lo_info", JSON.stringify({ loanOfficer, loEmail, loPhone, loNmls, companyName, companyNmls })); } catch { /* private mode */ }
 }, [loanOfficer, loEmail, loPhone, loNmls, companyName, companyNmls]);
 const [borrowerName, setBorrowerName] = useState("");
 // FRED API key: Set via Settings UI, localStorage, or window.__FRED_API_KEY__ (set in main.jsx from Vite env var)
 const [fredApiKey, setFredApiKey] = useState("");
 const [borrowerEmail, setBorrowerEmail] = useState("");
 const [showEmailModal, setShowEmailModal] = useState(false);
 const [showWorksheetModal, setShowWorksheetModal] = useState(false); // Fees Worksheet preview → Gmail send (LO)
 const [showBorrowerSend, setShowBorrowerSend] = useState(false); // "Email me this worksheet" (borrower/local via Resend)
 // ── Share modal: live-link send state (ephemeral, modal-local) ──
 // liveLinkSending disables both new buttons during the create-borrower →
 // save-scenario chain (~500ms–1.5s). liveLinkError surfaces server / cloud
 // failures inline. liveLinkToast shows a transient success banner. None of
 // these are persisted via getState/loadState — they're modal-local only.
 const [liveLinkSending, setLiveLinkSending] = useState(false);
 const [liveLinkError, setLiveLinkError] = useState(null);
 const [liveLinkToast, setLiveLinkToast] = useState(null);
 // Reset the live-link banners whenever the share modal closes, so the next
 // open is a clean slate (don't surface a stale "Link copied" or stale error).
 useEffect(() => {
  if (!showEmailModal) {
   setLiveLinkError(null);
   setLiveLinkToast(null);
  }
 }, [showEmailModal]);
 const [realtorName, setRealtorName] = useState("");
 const [reos, setReos] = useState([]);
 const [showInvestor, setShowInvestor] = useState(false);
 // ── Prop 19 Transfer state (CA only) ──
 const [showProp19, setShowProp19] = useState(false);
 const [prop19Eligibility, setProp19Eligibility] = useState("age55"); // "age55" | "disabled" | "disaster"
 const [prop19OldTaxableValue, setProp19OldTaxableValue] = useState(0);
 const [prop19OldSalePrice, setProp19OldSalePrice] = useState(0);
 const [prop19TransfersUsed, setProp19TransfersUsed] = useState(0);
 const [prop19SaleDate, setProp19SaleDate] = useState("");
 const [prop19PurchaseDate, setProp19PurchaseDate] = useState("");
 const [prop19RateOverride, setProp19RateOverride] = useState(0);
 const [showRentVsBuy, setShowRentVsBuy] = useState(false);
 const [invMonthlyRent, setInvMonthlyRent] = useState(4500);
 const [invVacancy, setInvVacancy] = useState(5);
 const [invMgmt, setInvMgmt] = useState(8);
 const [invMaintPct, setInvMaintPct] = useState(1);
 const [invCapEx, setInvCapEx] = useState(1);
 const [invRentGrowth, setInvRentGrowth] = useState(3);
 const [invHoldYears, setInvHoldYears] = useState(7);
 const [invSellerComm, setInvSellerComm] = useState(5);
 const [invSellClosing, setInvSellClosing] = useState(1);
 const [rbCurrentRent, setRbCurrentRent] = useState(3000);
 const [rbRentGrowth, setRbRentGrowth] = useState(3);
 const [rbInvestReturn, setRbInvestReturn] = useState(7);
 const addReo = () => setReos(prev => [...prev, { id: Date.now(), address: "", propType: "Single Family", occupancy: "Invest.", value: 0, mortgageBalance: 0, payment: 0, includesTI: true, reoTax: 0, reoIns: 0, reoHoa: 0, rentalIncome: 0, propUse: "Investment", linkedDebtIdx: -1 }]);
 const updateReo = (id, k, v) => setReos(prev => prev.map(r => {
  if (r.id !== id) return r;
  const next = { ...r, [k]: v };
  // Auto-sync propUse when occupancy changes — keeps the existing 75% investment netting calc working.
  if (k === "occupancy") next.propUse = occupancyToPropUse(v);
  return next;
 }));
 // Sync-aware: update REO payment and push to single linked debt (or pull from debts)
 const syncReoPayment = (reoId, newPayment) => {
  setReos(prev => prev.map(r => r.id === reoId ? { ...r, payment: newPayment } : r));
  const linked = debts.filter(d => d.linkedReoId === String(reoId) && (d.type === "Mortgage" || d.type === "HELOC"));
  if (linked.length === 1) {
   setDebts(prev => prev.map(d => d.id === linked[0].id ? { ...d, monthly: newPayment } : d));
  }
 };
 const syncReoBalance = (reoId, newBalance) => {
  setReos(prev => prev.map(r => r.id === reoId ? { ...r, mortgageBalance: newBalance } : r));
  const linked = debts.filter(d => d.linkedReoId === String(reoId) && (d.type === "Mortgage" || d.type === "HELOC"));
  if (linked.length === 1) {
   setDebts(prev => prev.map(d => d.id === linked[0].id ? { ...d, balance: newBalance } : d));
  }
 };
 // Sync-aware: update debt payment and push sum to linked REO
 const syncDebtPayment = (debtId, newPayment) => {
  const debt = debts.find(d => d.id === debtId);
  setDebts(prev => prev.map(d => d.id === debtId ? { ...d, monthly: newPayment } : d));
  if (debt && debt.linkedReoId) {
   const reoId = Number(debt.linkedReoId);
   const otherLinked = debts.filter(d => d.linkedReoId === debt.linkedReoId && d.id !== debtId);
   const total = otherLinked.reduce((s, d) => s + (Number(d.monthly) || 0), 0) + newPayment;
   setReos(prev => prev.map(r => r.id === reoId ? { ...r, payment: total } : r));
  }
 };
 const syncDebtBalance = (debtId, newBalance) => {
  const debt = debts.find(d => d.id === debtId);
  setDebts(prev => prev.map(d => d.id === debtId ? { ...d, balance: newBalance } : d));
  if (debt && debt.linkedReoId) {
   const reoId = Number(debt.linkedReoId);
   const otherLinked = debts.filter(d => d.linkedReoId === debt.linkedReoId && d.id !== debtId);
   const total = otherLinked.reduce((s, d) => s + (Number(d.balance) || 0), 0) + newBalance;
   setReos(prev => prev.map(r => r.id === reoId ? { ...r, mortgageBalance: total } : r));
  }
 };
 const removeReo = (id) => {
  setReos(prev => prev.filter(r => r.id !== id));
  setDebts(prev => prev.map(d => d.linkedReoId === String(id) ? { ...d, linkedReoId: "" } : d));
  if (sellLinkedReoId === String(id)) setSellLinkedReoId("");
 };
 const [refiCurrentRate, setRefiCurrentRate] = useState(7);
 const [refiCurrentBalance, setRefiCurrentBalance] = useState(0);
 const [refiCurrentPayment, setRefiCurrentPayment] = useState(0);
 const [refiRemainingMonths, setRefiRemainingMonths] = useState(360);
 const [refiCashOut, setRefiCashOut] = useState(0);
 const [refiCurrentEscrow, setRefiCurrentEscrow] = useState(0);
 const [refiCurrentMI, setRefiCurrentMI] = useState(0);
 const [refiCurrentLoanType, setRefiCurrentLoanType] = useState("Conventional");
 const [refiHomeValue, setRefiHomeValue] = useState(0);
 const [refiOriginalAmount, setRefiOriginalAmount] = useState(0);
 const [refiOriginalTerm, setRefiOriginalTerm] = useState(30);
 const [refiPurpose, setRefiPurpose] = useState("Rate/Term");
 const [refiNewLoanAmtOverride, setRefiNewLoanAmtOverride] = useState(0);
 const [refiClosedDate, setRefiClosedDate] = useState("");
 const [refiExtraPaid, setRefiExtraPaid] = useState(0);
 const [refiAnnualTax, setRefiAnnualTax] = useState(0);
 const [refiAnnualIns, setRefiAnnualIns] = useState(0);
 const [refiHasEscrow, setRefiHasEscrow] = useState(true);
 const [refiEscrowBalance, setRefiEscrowBalance] = useState(0);
 const [refiSkipMonths, setRefiSkipMonths] = useState(2);
 const [showFedBrackets, setShowFedBrackets] = useState(true);
 const [showStateBrackets, setShowStateBrackets] = useState(true);
 const [showPrivacy, setShowPrivacy] = useState(false);
 const [loaded, setLoaded] = useState(false);
 const [saving, setSaving] = useState(false);
 // ── Borrower account (self-serve cloud sync on the public calculator) ──
 // Entirely optional: anonymous users never touch this. LO mode (isCloud)
 // and share-link borrower mode are unaffected. LO allowlist emails keep
 // using LO auth — the account button is hidden for them (isCloud check).
 const account = useAccount();
 const selfMode = !isBorrower && !isCloud && account.isSignedIn;
 const [showAccountSheet, setShowAccountSheet] = useState(false);
 const selfSync = useSelfCloudSync({
  enabled: selfMode && account.syncEnabled,
  account: account.account,
  scenarioName,
  setScenarioList,
  getStateRef,
  loadStateRef,
  loaded,
 });
 // First sign-in from this device: record Terms/Privacy consent and turn
 // cloud sync on (signing in to save is the whole point of the flow).
 useEffect(() => {
  if (!account.isSignedIn) return;
  let pending = false;
  try { pending = localStorage.getItem('bp_pending_consent') === '1'; } catch {}
  if (pending) {
   try { localStorage.removeItem('bp_pending_consent'); } catch {}
   account.recordConsent();
   account.setSyncEnabled(true);
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [account.isSignedIn]);
 const [newScenarioName, setNewScenarioName] = useState("");
 const [feeDefaultsSavedAt, setFeeDefaultsSavedAt] = useState(() => {
  try { return JSON.parse(localStorage.getItem("bp_lo_default_fees") || "null")?.savedAt || null; } catch { return null; }
 });
 const [compareData, setCompareData] = useState([]);
 const [compareLoading, setCompareLoading] = useState(false);
 const [showCompareHint, setShowCompareHint] = useState(false);
 const [affordIncome, setAffordIncome] = useState(0);
 const [affordDebts, setAffordDebts] = useState(0);
 const [affordDown, setAffordDown] = useState(0);
 const [affordRate, setAffordRate] = useState(6.5);
 const [affordTerm, setAffordTerm] = useState(30);
 const [affordTargetDTI, setAffordTargetDTI] = useState(45);
 const [affordLoanType, setAffordLoanType] = useState("Conventional");
 const [confirmAffordApply, setConfirmAffordApply] = useState(false);
 // Closing date defaults to a 30-day close from today (Christo 2026-07-05).
 // Stored as month/day/year so the calc's prepaid-interest and escrow logic
 // keeps its existing month/day inputs; the year makes Dec→Jan closes correct.
 const defaultClose = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
 const [closingMonth, setClosingMonth] = useState(defaultClose.getMonth() + 1);
 const [closingDay, setClosingDay] = useState(defaultClose.getDate());
 const [closingYear, setClosingYear] = useState(defaultClose.getFullYear());
 // F. Prepaids — split Property Taxes into Installment + Sellers Prorated Reimbursement
 // Both default to $0 and stay hidden in the UI until the user unlocks Section F.
 // sellersProratedTaxCredit is stored as a POSITIVE dollar amount, applied as a negative
 // credit against the prepaid total at calc time (mirrors the spreadsheet's display).
 const [propertyTaxesInstallment, setPropertyTaxesInstallment] = useState(0);
 const [sellersProratedTaxCredit, setSellersProratedTaxCredit] = useState(0);
 // ── Course State ──
 const [courseProgress, setCourseProgress] = useState({});
 const [courseChapter, setCourseChapter] = useState(null);
 const [courseQuizAnswers, setCourseQuizAnswers] = useState({});
 const [courseView, setCourseView] = useState("library"); // "course" | "library"
 const [courseQuizSubmitted, setCourseQuizSubmitted] = useState(false);
 const [showCourseComplete, setShowCourseComplete] = useState(false);
 // ── Skill Level & Tab Progression ──
 const [skillLevel, setSkillLevel] = useState(null);
 const [sheetContent, setSheetContent] = useState(null); // null | "income" | "debts" | "assets"
 const [completedTabs, setCompletedTabs] = useState({});
 const [scrolledPast80, setScrolledPast80] = useState(false);
 const scrolledPast80Ref = useRef(false);
 const floatBarShownRef = useRef(false);
 const [unlockAll, setUnlockAll] = useState(false);
 const [gameMode, setGameMode] = useState(false);
 const [gameModeEverToggled, setGameModeEverToggled] = useState(false);
 const [toggleHint, setToggleHint] = useState(null);
 const [setupAdvancedOpen, setSetupAdvancedOpen] = useState(false);
 const [buildStep, setBuildStep] = useState(0); // 0=Quick Start, 1=Property & Borrower (refi only), 3=done
 const [setupTeamOpen, setSetupTeamOpen] = useState(false);
 const [highlightField, setHighlightField] = useState(null);
 const touchStartRef = useRef(null);
 const touchStartYRef = useRef(null);
 const tabBarRef = useRef(null);
 const scrollSentinelRef = useRef(null);
 const getState = () => ({
  salesPrice, downPct, rate, term, loanType, vaUsage, propType, loanPurpose, city, propertyState, hoa, annualIns, includeEscrow, subjectRentalIncome,
  propTaxMode, taxBaseRateOverride, fixedAssessments, taxExemptionOverride, taxRateLocked, taxExemptionLocked,
  transferTaxCity, discountPts, adminFee, lenderWireFee, underwritingFee, processingFee, appraisalFee, creditReportFee, floodCertFee, mersFee, taxServiceFee, titleInsurance, titleSearch, settlementFee, escrowFee, courierFee, loanTieInFee, notaryFee, envProtectionLien, recordingFee, lenderCredit, sellerCredit, realtorCredit, emd, emdPct, emdPaid, emdLocked, emdFlat,
  ownersTitleIns, homeWarranty, hoaTransferFee, buyerPaysComm, buyerCommPct, sellerTaxBasis,
  prepaidDays, coeDays, closingMonth, closingDay, closingYear, propertyTaxesInstallment, sellersProratedTaxCredit, debts, married, taxState, appreciationRate,
  sellPrice, sellMortgagePayoff, sellCommission, sellTransferTaxCity,
  sellEscrow, sellTitle, sellOther, sellSellerCredit, sellProration,
  sellCostBasis, sellImprovements, sellPrimaryRes, sellYearsOwned, sellLinkedReoId,
  incomes, otherIncome, otherIncome2, assets, creditScore, pmiRateLocked, pmiRateOverride, pmiChartOverrides, vaFundingFeeLocked, vaFundingFeeOverride, extraPayment, payExtra, debtFree, autoJumboSwitch,
  hasSellProperty, ownsProperties, isRefi, firstTimeBuyer, loanOfficer, loEmail, loPhone, loNmls, companyName, companyNmls, borrowerName, realtorName, reos,
  propertyAddress, propertyTBD, propertyZip, propertyCounty, addressMode, addressInput,
  refiCurrentRate, refiCurrentBalance, refiCurrentPayment, refiRemainingMonths, refiCashOut,
  refiCurrentEscrow, refiCurrentMI, refiCurrentLoanType, refiHomeValue, refiOriginalAmount, refiOriginalTerm, refiPurpose,
  refiClosedDate, refiExtraPaid, refiAnnualTax, refiAnnualIns, refiHasEscrow, refiEscrowBalance, refiSkipMonths, refiNewLoanAmtOverride, borrowerEmail,
  showInvestor, showRentVsBuy, invMonthlyRent, invVacancy, invMgmt, invMaintPct, invCapEx, invRentGrowth, invHoldYears, invSellerComm, invSellClosing,
  rbCurrentRent, rbRentGrowth, rbInvestReturn,
  showProp19, prop19Eligibility, prop19OldTaxableValue, prop19OldSalePrice, prop19TransfersUsed, prop19SaleDate, prop19PurchaseDate, prop19RateOverride,
  darkMode, themeMode,
 });
 const loadState = (s) => {
  if (!s) return;
  if (s.salesPrice !== undefined) setSalesPrice(s.salesPrice);
  if (s.downPct !== undefined) setDownPct(s.downPct);
  if (s.rate !== undefined) setRate(s.rate);
  if (s.term !== undefined) setTerm(s.term);
  if (s.loanType) setLoanType(s.loanType.startsWith("VA") ? "VA" : s.loanType);
  if (s.vaUsage) setVaUsage(s.vaUsage);
  if (s.loanType === "VA - First Use") { setLoanType("VA"); setVaUsage("First Use"); }
  if (s.loanType === "VA - Subsequent") { setLoanType("VA"); setVaUsage("Subsequent"); }
  if (s.loanType === "VA - Disabled") { setLoanType("VA"); setVaUsage("Disabled"); }
  if (s.autoJumboSwitch !== undefined) { setAutoJumboSwitch(s.autoJumboSwitch); userLoanTypeRef.current = s.autoJumboSwitch ? "Conventional" : (s.loanType || "Conventional"); }
  else { userLoanTypeRef.current = s.loanType || "Conventional"; }
  if (s.propType) setPropType(s.propType);
  if (s.loanPurpose) setLoanPurpose(s.loanPurpose);
  if (s.city) setCity(s.city);
  if (s.propertyState) setPropertyState(s.propertyState);
  if (s.hoa !== undefined) setHoa(s.hoa);
  if (s.annualIns !== undefined) setAnnualIns(s.annualIns);
  if (s.propTaxMode) setPropTaxMode(s.propTaxMode);
  if (s.taxBaseRateOverride !== undefined) setTaxBaseRateOverride(s.taxBaseRateOverride);
  setFixedAssessments(s.fixedAssessments || 1500); // default $1,500 for older scenarios that saved 0
  if (s.taxExemptionOverride !== undefined) setTaxExemptionOverride(s.taxExemptionOverride);
  if (s.taxRateLocked !== undefined) setTaxRateLocked(s.taxRateLocked);
  if (s.taxExemptionLocked !== undefined) setTaxExemptionLocked(s.taxExemptionLocked);
  if (s.subjectRentalIncome !== undefined) setSubjectRentalIncome(s.subjectRentalIncome);
  if (s.includeEscrow !== undefined) setIncludeEscrow(s.includeEscrow);
  if (s.transferTaxCity) {
   const match = TRANSFER_TAX_CITIES.find(t => t.label === s.transferTaxCity);
   setTransferTaxCity(match ? match.city : (TT_CITY_NAMES.includes(s.transferTaxCity) ? s.transferTaxCity : "Not listed"));
  }
  if (s.discountPts !== undefined) setDiscountPts(s.discountPts);
  if (s.adminFee !== undefined) setAdminFee(s.adminFee);
  if (s.lenderWireFee !== undefined) setLenderWireFee(s.lenderWireFee);
  if (s.underwritingFee !== undefined) setUnderwritingFee(s.underwritingFee);
  if (s.processingFee !== undefined) setProcessingFee(s.processingFee);
  if (s.appraisalFee !== undefined) setAppraisalFee(s.appraisalFee);
  if (s.creditReportFee !== undefined) setCreditReportFee(s.creditReportFee);
  if (s.floodCertFee !== undefined) setFloodCertFee(s.floodCertFee);
  if (s.mersFee !== undefined) setMersFee(s.mersFee);
  if (s.taxServiceFee !== undefined) setTaxServiceFee(s.taxServiceFee);
  if (s.titleInsurance !== undefined) setTitleInsurance(s.titleInsurance);
  if (s.titleSearch !== undefined) setTitleSearch(s.titleSearch);
  if (s.settlementFee !== undefined) setSettlementFee(s.settlementFee);
  if (s.escrowFee !== undefined) setEscrowFee(s.escrowFee);
  if (s.courierFee !== undefined) setCourierFee(s.courierFee);
  if (s.loanTieInFee !== undefined) setLoanTieInFee(s.loanTieInFee);
  if (s.notaryFee !== undefined) setNotaryFee(s.notaryFee);
  if (s.envProtectionLien !== undefined) setEnvProtectionLien(s.envProtectionLien);
  if (s.recordingFee !== undefined) setRecordingFee(s.recordingFee);
  if (s.customFees !== undefined) setCustomFees(Array.isArray(s.customFees) ? s.customFees : []);
  if (s.hiddenFees !== undefined) setHiddenFees(Array.isArray(s.hiddenFees) ? s.hiddenFees : []);
  if (s.lenderCredit !== undefined) setLenderCredit(s.lenderCredit);
  if (s.sellerCredit !== undefined) setSellerCredit(s.sellerCredit);
  if (s.realtorCredit !== undefined) setRealtorCredit(s.realtorCredit);
  if (s.emd !== undefined) setEmd(s.emd);
  if (s.emdPct !== undefined) setEmdPct(s.emdPct);
  // Back-compat: older scenarios stored a $ EMD with no paid flag — treat a positive EMD as paid.
  if (s.emdPaid !== undefined) setEmdPaid(s.emdPaid);
  if (s.emdLocked !== undefined) setEmdLocked(s.emdLocked);
  if (s.emdFlat !== undefined) setEmdFlat(s.emdFlat);
  else if (s.emd > 0) setEmdPaid(true);
  if (s.ownersTitleIns !== undefined) setOwnersTitleIns(s.ownersTitleIns);
  if (s.homeWarranty !== undefined) setHomeWarranty(s.homeWarranty);
  if (s.hoaTransferFee !== undefined) setHoaTransferFee(s.hoaTransferFee);
  if (s.buyerPaysComm !== undefined) setBuyerPaysComm(s.buyerPaysComm);
  if (s.buyerCommPct !== undefined) setBuyerCommPct(s.buyerCommPct);
  if (s.sellerTaxBasis !== undefined) setSellerTaxBasis(s.sellerTaxBasis);
  if (s.prepaidDays !== undefined) setPrepaidDays(s.prepaidDays);
  if (s.coeDays !== undefined) setCoeDays(s.coeDays);
  if (s.closingMonth !== undefined) setClosingMonth(s.closingMonth);
  if (s.closingDay !== undefined) setClosingDay(s.closingDay);
  if (s.closingYear !== undefined) setClosingYear(s.closingYear);
  if (s.propertyTaxesInstallment !== undefined) setPropertyTaxesInstallment(s.propertyTaxesInstallment);
  if (s.sellersProratedTaxCredit !== undefined) setSellersProratedTaxCredit(s.sellersProratedTaxCredit);
  if (s.debts) setDebts(s.debts);
  if (s.married) setMarried(s.married === "Yes" ? "MFJ" : s.married === "No" ? "Single" : s.married);
  if (s.taxState) setTaxState(s.taxState);
  if (s.appreciationRate !== undefined) setAppreciationRate(s.appreciationRate);
  if (s.sellPrice !== undefined) setSellPrice(s.sellPrice);
  if (s.sellMortgagePayoff !== undefined) setSellMortgagePayoff(s.sellMortgagePayoff);
  if (s.sellCommission !== undefined) setSellCommission(s.sellCommission);
  if (s.sellTransferTaxCity) {
   const match = TRANSFER_TAX_CITIES.find(t => t.label === s.sellTransferTaxCity);
   setSellTransferTaxCity(match ? match.city : (TT_CITY_NAMES.includes(s.sellTransferTaxCity) ? s.sellTransferTaxCity : "Not listed"));
  }
  if (s.sellEscrow !== undefined) setSellEscrow(s.sellEscrow);
  if (s.sellTitle !== undefined) setSellTitle(s.sellTitle);
  if (s.sellOther !== undefined) setSellOther(s.sellOther);
  if (s.sellSellerCredit !== undefined) setSellSellerCredit(s.sellSellerCredit);
  if (s.sellProration !== undefined) setSellProration(s.sellProration);
  if (s.sellCostBasis !== undefined) setSellCostBasis(s.sellCostBasis);
  if (s.sellImprovements !== undefined) setSellImprovements(s.sellImprovements);
  if (s.sellPrimaryRes !== undefined) setSellPrimaryRes(s.sellPrimaryRes);
  if (s.sellYearsOwned !== undefined) setSellYearsOwned(s.sellYearsOwned);
  if (s.sellLinkedReoId !== undefined) setSellLinkedReoId(s.sellLinkedReoId);
  if (s.incomes) setIncomes(s.incomes);
  if (s.otherIncome !== undefined) setOtherIncome(s.otherIncome);
  if (s.otherIncome2 !== undefined) setOtherIncome2(s.otherIncome2);
  if (s.assets) setAssets(s.assets);
  if (s.creditScore !== undefined) setCreditScore(s.creditScore);
  if (s.pmiRateLocked !== undefined) setPmiRateLocked(s.pmiRateLocked);
  if (s.pmiRateOverride !== undefined) setPmiRateOverride(s.pmiRateOverride);
  if (s.pmiChartOverrides !== undefined) setPmiChartOverrides(s.pmiChartOverrides || {});
  if (s.vaFundingFeeLocked !== undefined) setVaFundingFeeLocked(s.vaFundingFeeLocked);
  if (s.vaFundingFeeOverride !== undefined) setVaFundingFeeOverride(s.vaFundingFeeOverride);
  if (s.extraPayment !== undefined) setExtraPayment(s.extraPayment);
  if (s.payExtra !== undefined) setPayExtra(s.payExtra);
  if (s.debtFree !== undefined) setDebtFree(s.debtFree);
  if (s.hasSellProperty !== undefined) setHasSellProperty(s.hasSellProperty);
  if (s.ownsProperties !== undefined) setOwnsProperties(s.ownsProperties);
  if (s.isRefi !== undefined) setIsRefi(s.isRefi);
  if (s.firstTimeBuyer !== undefined) setFirstTimeBuyer(s.firstTimeBuyer);
  // LO identity (loanOfficer/loEmail/loPhone/loNmls/company*) is DEVICE-level
  // (bp_lo_info) since 2026-07-05 — scenario loads and cloud-sync pulls must
  // NOT overwrite it. (Bug: typing a new Company name kept reverting because
  // the sync pull re-applied the scenario's stale copy mid-keystroke.)
  if (s.borrowerName !== undefined) setBorrowerName(s.borrowerName);
  if (s.realtorName !== undefined) setRealtorName(s.realtorName);
  if (s.propertyAddress !== undefined) setPropertyAddress(s.propertyAddress);
  if (s.propertyTBD !== undefined) setPropertyTBD(s.propertyTBD);
  if (s.propertyZip !== undefined) setPropertyZip(s.propertyZip);
  if (s.propertyCounty !== undefined) setPropertyCounty(s.propertyCounty);
  if (s.addressMode !== undefined) setAddressMode(s.addressMode);
  else if (s.propertyZip && !s.addressInput) setAddressMode("zip"); // legacy scenario: had zip, no address — stay in zip mode
  if (s.addressInput !== undefined) setAddressInput(s.addressInput);
  if (s.borrowerEmail !== undefined) setBorrowerEmail(s.borrowerEmail);
  if (s.reos) setReos(s.reos.map(r => {
   // Migrate old taxIns field to separate reoTax/reoIns/reoHoa
   if (r.taxIns && !r.reoTax && !r.reoIns) return { ...r, reoTax: r.taxIns, reoIns: 0, reoHoa: 0 };
   return { ...r, reoTax: r.reoTax || 0, reoIns: r.reoIns || 0, reoHoa: r.reoHoa || 0 };
  }));
  if (s.refiCurrentRate !== undefined) setRefiCurrentRate(s.refiCurrentRate);
  if (s.refiCurrentBalance !== undefined) setRefiCurrentBalance(s.refiCurrentBalance);
  if (s.refiCurrentPayment !== undefined) setRefiCurrentPayment(s.refiCurrentPayment);
  if (s.refiRemainingMonths !== undefined) setRefiRemainingMonths(s.refiRemainingMonths);
  if (s.refiCashOut !== undefined) setRefiCashOut(s.refiCashOut);
  if (s.refiCurrentEscrow !== undefined) setRefiCurrentEscrow(s.refiCurrentEscrow);
  if (s.refiCurrentMI !== undefined) setRefiCurrentMI(s.refiCurrentMI);
  if (s.refiCurrentLoanType) setRefiCurrentLoanType(s.refiCurrentLoanType);
  if (s.refiHomeValue !== undefined) setRefiHomeValue(s.refiHomeValue);
  if (s.refiOriginalAmount !== undefined) setRefiOriginalAmount(s.refiOriginalAmount);
  if (s.refiOriginalTerm !== undefined) setRefiOriginalTerm(s.refiOriginalTerm);
  if (s.refiPurpose) setRefiPurpose(s.refiPurpose);
  if (s.refiClosedDate) setRefiClosedDate(s.refiClosedDate);
  if (s.refiExtraPaid !== undefined) setRefiExtraPaid(s.refiExtraPaid);
  if (s.refiAnnualTax !== undefined) setRefiAnnualTax(s.refiAnnualTax);
  if (s.refiAnnualIns !== undefined) setRefiAnnualIns(s.refiAnnualIns);
  if (s.refiHasEscrow !== undefined) setRefiHasEscrow(s.refiHasEscrow);
  if (s.refiEscrowBalance !== undefined) setRefiEscrowBalance(s.refiEscrowBalance);
  if (s.refiSkipMonths !== undefined) setRefiSkipMonths(s.refiSkipMonths);
  if (s.refiNewLoanAmtOverride !== undefined) setRefiNewLoanAmtOverride(s.refiNewLoanAmtOverride);
  // Theme (dark/light) is a device-level preference, NOT per-scenario. Do not apply
  // a saved scenario's theme on load — that would flip the UI when switching clients.
  // Theme persists via localStorage 'bp_theme_mode' and the ?theme= URL param instead.
  if (s.showInvestor !== undefined) setShowInvestor(s.showInvestor);
  if (s.showRentVsBuy !== undefined) setShowRentVsBuy(s.showRentVsBuy);
  if (s.invMonthlyRent !== undefined) setInvMonthlyRent(s.invMonthlyRent);
  if (s.invVacancy !== undefined) setInvVacancy(s.invVacancy);
  if (s.invMgmt !== undefined) setInvMgmt(s.invMgmt);
  if (s.invMaintPct !== undefined) setInvMaintPct(s.invMaintPct);
  if (s.invCapEx !== undefined) setInvCapEx(s.invCapEx);
  if (s.invRentGrowth !== undefined) setInvRentGrowth(s.invRentGrowth);
  if (s.invHoldYears !== undefined) setInvHoldYears(s.invHoldYears);
  if (s.invSellerComm !== undefined) setInvSellerComm(s.invSellerComm);
  if (s.invSellClosing !== undefined) setInvSellClosing(s.invSellClosing);
  if (s.rbCurrentRent !== undefined) setRbCurrentRent(s.rbCurrentRent);
  if (s.rbRentGrowth !== undefined) setRbRentGrowth(s.rbRentGrowth);
  if (s.rbInvestReturn !== undefined) setRbInvestReturn(s.rbInvestReturn);
  // Prop 19
  if (s.showProp19 !== undefined) setShowProp19(s.showProp19);
  if (s.prop19Eligibility) setProp19Eligibility(s.prop19Eligibility);
  if (s.prop19OldTaxableValue !== undefined) setProp19OldTaxableValue(s.prop19OldTaxableValue);
  if (s.prop19OldSalePrice !== undefined) setProp19OldSalePrice(s.prop19OldSalePrice);
  if (s.prop19TransfersUsed !== undefined) setProp19TransfersUsed(s.prop19TransfersUsed);
  if (s.prop19SaleDate !== undefined) setProp19SaleDate(s.prop19SaleDate);
  if (s.prop19PurchaseDate !== undefined) setProp19PurchaseDate(s.prop19PurchaseDate);
  if (s.prop19RateOverride !== undefined) setProp19RateOverride(s.prop19RateOverride);
 };
 // Wire getState/loadState into the sync hook refs
 getStateRef.current = getState;
 loadStateRef.current = loadState;
 useEffect(() => {
  (async () => {
   // ── Borrower mode: load initialState directly, skip localStorage ──
   if (isBorrower && initialState) {
    loadState(initialState);
    setScenarioList([borrowerMode.scenarios?.[0]?.name || "My Blueprint"]);
    setScenarioName(borrowerMode.scenarios?.[0]?.name || "My Blueprint");
    // Initialize sync baseline
    if (activeScenarioId) {
     sync.initSync(initialState, null);
    }
    setLoaded(true);
    try { if (window.__FRED_API_KEY__) { setFredApiKey(window.__FRED_API_KEY__); } } catch(e) {}
    return;
   }

   try {
    const listResult = await LS.list("scenario:");
    let names = listResult?.keys?.map(k => k.replace("scenario:", "")) || [];
    let activeName = "Scenario 1";
    try {
     const active = await LS.get("active-scenario");
     if (active?.value) activeName = active.value;
    } catch(e) {}
    // Purge resurrection artifacts: a tombstoned (deleted) name whose
    // "scenario:" key still exists is junk left by an interrupted delete —
    // remove it so it can't rejoin the list. EXCEPTION: the active scenario
    // is live by definition — un-tombstone it instead (heals devices where
    // the old bug tombstoned the scenario the user is actually working in).
    try {
     const tombs = new Set(JSON.parse(localStorage.getItem("bp_deleted_names") || "[]"));
     if (tombs.has(activeName)) {
      tombs.delete(activeName);
      localStorage.setItem("bp_deleted_names", JSON.stringify([...tombs]));
     }
     const junk = names.filter(n => tombs.has(n));
     for (const n of junk) { try { await LS.delete("scenario:" + n); } catch(e) {} }
     names = names.filter(n => !tombs.has(n));
    } catch(e) {}
    setScenarioList(names);
    setScenarioName(activeName);
    try {
     const saved = await LS.get("scenario:" + activeName);
     if (saved?.value) loadState(JSON.parse(saved.value));
    } catch(e) {}
    if (names.length === 0) {
     setScenarioList(["Scenario 1"]);
    }
   } catch(e) {
    setScenarioList(["Scenario 1"]);
   }
   setLoaded(true);
   // Load FRED API key from env variable only (set in main.jsx from Vite VITE_FRED_API_KEY)
   try { if (window.__FRED_API_KEY__) { setFredApiKey(window.__FRED_API_KEY__); } } catch(e) {}
  })();
 }, []);

 // ── Load borrower list from Supabase when authenticated ──
 useEffect(() => {
  if (!isCloud) return;
  let cancelled = false;
  (async () => {
   setBorrowerLoading(true);
   try {
    const list = await fetchBorrowers({ status: 'active' });
    if (!cancelled) setBorrowerList(Array.isArray(list) ? list : []);
   } catch (e) {
    console.warn('[Blueprint] Failed to load borrowers:', e.message);
   } finally {
    if (!cancelled) setBorrowerLoading(false);
   }
  })();
  return () => { cancelled = true; };
 }, [isCloud]);

 // ── Build calc_summary from current computed values (called on save) ──
 const buildCalcSummary = useCallback(() => {
  // Access the computed `calc` object which is a useMemo below
  // We'll build a lightweight summary with the key metrics Pipeline needs
  try {
   const dp = salesPrice * downPct / 100;
   const baseLoan = salesPrice - dp;
   const ltv = salesPrice > 0 ? baseLoan / salesPrice : 0;
   const totalIncomeCalc = incomes.reduce((s, i) => {
    if (i.selection === "YTD") return s + (i.ytdCalc || 0);
    if (i.selection === "1Y") return s + (i.oneYCalc || 0);
    if (i.selection === "2Y") return s + (i.twoYCalc || 0);
    return s + toMonthly(i.amount, i.frequency);
   }, 0);
   const monthlyInc = totalIncomeCalc + otherIncome + otherIncome2;
   const monthlyDebts = debts.filter(d => d.payoff !== "Yes - at Escrow" && d.payoff !== "Yes - POC" && d.payoff !== "Omit").reduce((s, d) => s + (d.monthly || 0), 0);
   const fhaUp = loanType === "FHA" ? baseLoan * 0.0175 : 0;
   const loan = baseLoan + fhaUp;
   const pi = calcPI(loan, rate, term);
   return {
    salesPrice,
    downPayment: dp,
    downPct,
    loanAmount: loan,
    rate,
    term,
    loanType,
    ltv: Math.round(ltv * 10000) / 100,
    monthlyPI: Math.round(pi),
    monthlyIncome: Math.round(monthlyInc),
    monthlyDebts: Math.round(monthlyDebts),
    creditScore,
    loanPurpose,
    city,
    propertyState,
    borrowerName,
   };
  } catch (e) {
   return { salesPrice, rate, term, loanType, borrowerName };
  }
 }, [salesPrice, downPct, rate, term, loanType, incomes, otherIncome, otherIncome2, debts, creditScore, loanPurpose, city, propertyState, borrowerName]);

 // ── Supabase write-through: save scenario to cloud ──
 const saveToCloud = useCallback(async (stateData, scenarioId) => {
  if (!isCloud || !activeBorrower) return;
  setCloudSyncStatus('saving');
  try {
   const summary = buildCalcSummary();
   if (scenarioId) {
    // Update existing
    await apiUpdateScenario({ id: scenarioId, state_data: stateData, calc_summary: summary, name: scenarioName });
   } else {
    // Create new
    const result = await apiCreateScenario({
     borrower_id: activeBorrower.id,
     name: scenarioName,
     type: isRefi ? 'refi' : 'purchase',
     status: 'draft',
     created_by: 'lo',
     state_data: stateData,
     calc_summary: summary,
    });
    if (result?.[0]?.id) setActiveScenarioId(result[0].id);
   }
   setCloudSyncStatus('saved');
   setTimeout(() => setCloudSyncStatus(''), 2000);
  } catch (e) {
   console.warn('[Blueprint] Cloud save failed:', e.message);
   setCloudSyncStatus('error');
   setTimeout(() => setCloudSyncStatus(''), 3000);
  }
 }, [isCloud, activeBorrower, buildCalcSummary, scenarioName, isRefi]);

 const saveTimer = useRef(null);
 // Set status bar / theme-color meta tag to match theme
 useEffect(() => {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', darkMode ? '#000000' : '#FFFFFF');
  else {
   const newMeta = document.createElement('meta');
   newMeta.name = 'theme-color';
   newMeta.content = darkMode ? '#000000' : '#FFFFFF';
   document.head.appendChild(newMeta);
  }
 }, [darkMode]);
 // Enforce viewport to prevent iOS zoom
 useEffect(() => {
  let vp = document.querySelector('meta[name="viewport"]');
  const content = "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover";
  if (vp) vp.setAttribute('content', content);
  else { vp = document.createElement('meta'); vp.name = 'viewport'; vp.content = content; document.head.appendChild(vp); }
 }, []);
 useEffect(() => {
  if (!loaded) return;
  if (saveTimer.current) clearTimeout(saveTimer.current);
  saveTimer.current = setTimeout(async () => {
   setSaving(true);
   const stateData = getState();
   // ── Borrower mode: skip localStorage, only sync via Realtime ──
   if (!isBorrower) {
    try {
     await LS.set("scenario:" + scenarioName, JSON.stringify(stateData));
     await LS.set("active-scenario", scenarioName);
    } catch(e) {}
    // ── Write-through to Supabase when authenticated + borrower selected ──
    if (isCloud && activeBorrower) {
     if (supabaseSaveTimer.current) clearTimeout(supabaseSaveTimer.current);
     supabaseSaveTimer.current = setTimeout(() => saveToCloud(stateData, activeScenarioId), 500);
    }
    // ── Track this client as recently edited (left-panel switcher) ──
    if (isCloud && activeBorrower) {
     recordRecentBlueprint(makeClientEntry(activeBorrower));
    }
    // ── Self-owned cloud sync (signed-in homebuyer, opt-in) ──
    // No-op unless the user signed in AND turned sync on.
    selfSync.schedulePush();
   }
   // ── Real-time sync (pushes changes to other connected users) ──
   sync.scheduleSync();
   setTimeout(() => setSaving(false), 600);
  }, 1500);
  return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
 }, [salesPrice, downPct, rate, term, loanType, vaUsage, propType, loanPurpose, city, propertyState, hoa, annualIns, includeEscrow, subjectRentalIncome,
  propTaxMode, taxBaseRateOverride, fixedAssessments, taxExemptionOverride, taxRateLocked, taxExemptionLocked,
  transferTaxCity, discountPts, adminFee, lenderWireFee, underwritingFee, processingFee, appraisalFee, creditReportFee, floodCertFee, mersFee, taxServiceFee, titleInsurance, titleSearch, settlementFee, escrowFee, courierFee, loanTieInFee, notaryFee, envProtectionLien, recordingFee, lenderCredit, sellerCredit, realtorCredit, emd, emdPct, emdPaid, emdLocked, emdFlat,
  ownersTitleIns, homeWarranty, hoaTransferFee, buyerPaysComm, buyerCommPct, sellerTaxBasis,
  prepaidDays, coeDays, debts, married, taxState, appreciationRate, sellPrice, sellMortgagePayoff,
  sellCommission, sellTransferTaxCity, sellEscrow, sellTitle, sellOther, sellSellerCredit,
  sellProration, sellCostBasis, sellImprovements, sellPrimaryRes, sellYearsOwned,
  incomes, otherIncome, otherIncome2, assets, creditScore, extraPayment, payExtra,
  hasSellProperty, ownsProperties, isRefi, firstTimeBuyer, loanOfficer, loEmail, loPhone, loNmls, companyName, companyNmls, borrowerName, realtorName, reos,
  propertyAddress, propertyTBD, propertyZip, propertyCounty, addressMode, addressInput,
  refiCurrentRate, refiCurrentBalance, refiCurrentPayment, refiRemainingMonths, refiCashOut,
  refiCurrentEscrow, refiCurrentMI, refiCurrentLoanType, refiHomeValue, refiOriginalAmount, refiOriginalTerm, refiPurpose,
  refiClosedDate, refiExtraPaid, refiAnnualTax, refiAnnualIns, refiHasEscrow, refiEscrowBalance, refiSkipMonths, refiNewLoanAmtOverride, borrowerEmail,
  darkMode, loaded, scenarioName]);
 // ── Blueprint switcher (left panel): client callbacks + open helper ──
 const borrowerPickerCallbacks = {
  onSelect: async (b) => {
   if (!b) { setActiveBorrower(null); setActiveScenarioId(null); setBorrowerScenarios([]); return; }
   setActiveBorrower(b); setActiveScenarioId(null); setBorrowerScenariosLoading(true);
   try { const scens = await apiFetchScenarios(b.id); setBorrowerScenarios(scens || []); }
   catch (err) { console.warn('[Blueprint] Failed to load scenarios:', err.message); setBorrowerScenarios([]); }
   setBorrowerScenariosLoading(false);
  },
  onSelectScenario: (scenario) => {
   if (scenario.state_data) loadState(scenario.state_data);
   setActiveScenarioId(scenario.id);
   setScenarioName(scenario.name || 'Scenario 1');
   sync.initSync(scenario.state_data, scenario.locked_fields);
   if (activeBorrower) recordRecentBlueprint(makeClientEntry(activeBorrower));
  },
  onAutoCreateScenario: async (borrower) => {
   try {
    let prefillState = {};
    try { const r = await fetchBorrowerPrefill(borrower.id); if (r?.prefill) prefillState = r.prefill; } catch {}
    const newScenario = await apiCreateScenario({ borrower_id: borrower.id, name: 'Scenario 1', type: 'purchase', state_data: prefillState, calc_summary: {} });
    const s = Array.isArray(newScenario) ? newScenario[0] : newScenario;
    if (s?.id) { if (Object.keys(prefillState).length > 0) loadState(prefillState); setActiveScenarioId(s.id); setScenarioName(s.name || 'Scenario 1'); sync.initSync(prefillState, null); setBorrowerScenarios([s]); recordRecentBlueprint(makeClientEntry(borrower)); }
   } catch (err) { console.warn('[Blueprint] Failed to auto-create scenario:', err.message); }
  },
  onCreateNew: async (prefillName) => {
   const name = prefillName || prompt("New client name:"); if (!name) return;
   try { const result = await createBorrower({ name, status: 'active' }); const newB = result?.[0] || result;
    if (newB?.id) { setBorrowerList(prev => [...prev, newB]); setActiveBorrower(newB); setActiveScenarioId(null); setBorrowerScenarios([]); }
   } catch (err) { alert('Failed to create client: ' + err.message); }
  },
 };

 // Open a client from the sidebar switcher → load their FIRST blueprint (auto-create if none).
 const openClient = async (entry) => {
  if (!entry || entry.borrowerId == null) return;
  const b = borrowerList.find(x => x.id === entry.borrowerId) || { id: entry.borrowerId, name: entry.borrowerName, status: entry.status };
  setActiveBorrower(b);
  setActiveScenarioId(null);
  setBorrowerScenariosLoading(true);
  try {
   const scens = await apiFetchScenarios(entry.borrowerId);
   setBorrowerScenarios(scens || []);
   if (scens && scens.length > 0) {
    const s = scens[0];
    if (s.state_data) loadState(s.state_data);
    setActiveScenarioId(s.id);
    setScenarioName(s.name || 'Scenario 1');
    sync.initSync(s.state_data, s.locked_fields);
    recordRecentBlueprint(makeClientEntry(b));
   } else {
    await borrowerPickerCallbacks.onAutoCreateScenario(b);
   }
  } catch (err) { console.warn('[Blueprint] openClient failed:', err.message); }
  setBorrowerScenariosLoading(false);
 };

 const switchScenario = async (name, opts = {}) => {
  // skipSave: set when the outgoing scenario was just DELETED — the old
  // unconditional save re-wrote the deleted "scenario:<name>" key, which
  // resurrected it in the list on the next refresh (the "Scenario 1 zombie").
  if (!opts.skipSave) {
   try { await LS.set("scenario:" + scenarioName, JSON.stringify(getState())); } catch(e) {}
  }
  // A scenario you're switching to exists by definition — never leave it
  // tombstoned (a stale tombstone silently blocks its cloud sync).
  try { selfSync.clearTombstone?.(name); } catch(e) {}
  setScenarioName(name);
  try {
   const saved = await LS.get("scenario:" + name);
   if (saved?.value) loadState(JSON.parse(saved.value));
  } catch(e) {}
  try { await LS.set("active-scenario", name); } catch(e) {}
 };
 // ── LO default fees (Christo 2026-07-05): the LO snapshots their preferred
 //    fee sheet in Settings; every NEW scenario starts from it. Stored per
 //    device in localStorage (cloud sync is a future enhancement).
 const collectFeeDefaults = () => ({
  savedAt: new Date().toISOString(),
  fees: {
   underwritingFee, adminFee, lenderWireFee, originatorComp, processingFee,
   appraisalFee, creditReportFee, floodCertFee, mersFee, taxServiceFee,
   titleInsurance, escrowFee, courierFee, loanTieInFee, notaryFee,
   envProtectionLien, recordingFee, ownersTitleIns, homeWarranty,
  },
  customFees, hiddenFees,
 });
 const FEE_SETTERS = {
  underwritingFee: setUnderwritingFee, adminFee: setAdminFee, lenderWireFee: setLenderWireFee,
  originatorComp: setOriginatorComp, processingFee: setProcessingFee, appraisalFee: setAppraisalFee,
  creditReportFee: setCreditReportFee, floodCertFee: setFloodCertFee, mersFee: setMersFee,
  taxServiceFee: setTaxServiceFee, titleInsurance: setTitleInsurance, escrowFee: setEscrowFee,
  courierFee: setCourierFee, loanTieInFee: setLoanTieInFee, notaryFee: setNotaryFee,
  envProtectionLien: setEnvProtectionLien, recordingFee: setRecordingFee,
  ownersTitleIns: setOwnersTitleIns, homeWarranty: setHomeWarranty,
 };
 const saveMyFeeDefaults = () => {
  try { localStorage.setItem("bp_lo_default_fees", JSON.stringify(collectFeeDefaults())); setFeeDefaultsSavedAt(new Date().toISOString()); } catch (e) { console.error(e); }
 };
 const clearMyFeeDefaults = () => {
  try { localStorage.removeItem("bp_lo_default_fees"); setFeeDefaultsSavedAt(null); } catch (e) { console.error(e); }
 };
 const applyMyFeeDefaults = () => {
  try {
   const raw = localStorage.getItem("bp_lo_default_fees");
   if (!raw) return;
   const d = JSON.parse(raw);
   Object.entries(d.fees || {}).forEach(([k, v]) => { if (FEE_SETTERS[k] && typeof v === "number") FEE_SETTERS[k](v); });
   if (Array.isArray(d.customFees)) setCustomFees(d.customFees);
   if (Array.isArray(d.hiddenFees)) setHiddenFees(d.hiddenFees);
  } catch (e) { console.error("apply fee defaults failed:", e); }
 };
 const createScenario = async (name) => {
  if (!name || scenarioList.includes(name)) return;
  try { selfSync.clearTombstone?.(name); } catch(e) {}
  try { await LS.set("scenario:" + scenarioName, JSON.stringify(getState())); } catch(e) {}
  const newList = [...scenarioList, name];
  setScenarioList(newList);
  setScenarioName(name);
  setSalesPrice(1000000); setDownPct(20); setRate(6.5); setTerm(30);
  setLoanType("Conventional"); userLoanTypeRef.current = "Conventional"; setAutoJumboSwitch(false); setPropType("Single Family"); setLoanPurpose("Purchase Primary");
  setCity("Alameda"); setPropertyState("California"); setHoa(0); setAnnualIns(1500); setDiscountPts(0);
  setSellerCredit(0); setRealtorCredit(0); setEmd(0); setEmdPct(3); setEmdPaid(false); setDebts([]); setIncomes([]);
  setOtherIncome(0); setOtherIncome2(0); setAssets([]); setCreditScore(0); setExtraPayment(0); setPayExtra(false);
  setHasSellProperty(false); setOwnsProperties(false); setIsRefi(null); setShowInvestor(false);
  // Reset Prop 19
  setShowProp19(false); setProp19Eligibility("age55"); setProp19OldTaxableValue(0); setProp19OldSalePrice(0);
  setProp19TransfersUsed(0); setProp19SaleDate(""); setProp19PurchaseDate(""); setProp19RateOverride(0);
  // New scenarios reset the fee-management state, then apply the LO's saved
  // default fee sheet (if any) on top.
  setCustomFees([]); setHiddenFees([]);
  applyMyFeeDefaults();
  // Reset completed tabs so new scenario starts fresh (fixes checkbox bug)
  saveCompletedTabs({});
  // Save the new scenario defaults immediately so Compare can read them
  const defaults = { salesPrice: 1000000, downPct: 20, rate: 6.5, term: 30, loanType: "Conventional",
   propType: "Single Family", loanPurpose: "Purchase Primary", city: "Alameda", propertyState: "California", hoa: 0, annualIns: 1500,
   includeEscrow: true, discountPts: 0, sellerCredit: 0, realtorCredit: 0, emd: 0, debts: [], incomes: [],
   otherIncome: 0, otherIncome2: 0, assets: [], creditScore: 0, extraPayment: 0, payExtra: false,
   hasSellProperty: false, ownsProperties: false, isRefi: null, showInvestor: false, showProp19: false, darkMode, themeMode };
  try { await LS.set("scenario:" + name, JSON.stringify(defaults)); } catch(e) {}
  try { await LS.set("active-scenario", name); } catch(e) {}
  setNewScenarioName("");
  setShowCompareHint(true);
 };
 const deleteScenario = async (name) => {
  if (scenarioList.length <= 1) return;
  const newList = scenarioList.filter(n => n !== name);
  setScenarioList(newList);
  // deleteByName FIRST: it tombstones AND removes the local key in the same
  // synchronous tick (no gap for an in-flight pull to resurrect it), then
  // deletes the cloud row. LS.delete after is belt-and-braces for the
  // signed-out case. Switch away LAST, with skipSave — the old order let
  // switchScenario's "save current" re-write the deleted key (the zombie).
  try { await selfSync.deleteByName?.(name); } catch(e) {}
  try { await LS.delete("scenario:" + name); } catch(e) {}
  if (name === scenarioName) await switchScenario(newList[0], { skipSave: true });
 };
 const duplicateScenario = async () => {
  let newName = scenarioName + " Copy";
  let i = 2;
  while (scenarioList.includes(newName)) { newName = scenarioName + " Copy " + i; i++; }
  try { selfSync.clearTombstone?.(newName); } catch(e) {}
  const newList = [...scenarioList, newName];
  setScenarioList(newList);
  try { await LS.set("scenario:" + newName, JSON.stringify(getState())); } catch(e) {}
  setScenarioName(newName);
  try { await LS.set("active-scenario", newName); } catch(e) {}
  setShowCompareHint(true);
 };
 const renameScenario = async (oldName, newName) => {
  if (!newName || newName === oldName || scenarioList.includes(newName)) return;
  try {
   const old = await LS.get("scenario:" + oldName);
   if (old) await LS.set("scenario:" + newName, old.value);
   await LS.delete("scenario:" + oldName);
  } catch(e) {}
  // Rename the cloud copy in place so the old name doesn't resync as a dupe.
  try { await selfSync.renameByName?.(oldName, newName); } catch(e) {}
  const newList = scenarioList.map(n => n === oldName ? newName : n);
  setScenarioList(newList);
  try { await LS.set("scenario-list", JSON.stringify(newList)); } catch(e) {}
  if (scenarioName === oldName) {
   setScenarioName(newName);
   try { await LS.set("active-scenario", newName); } catch(e) {}
  }
 };
 const [editingScenarioName, setEditingScenarioName] = useState(null);
 const [editScenarioValue, setEditScenarioValue] = useState("");
 // Quick metrics calculator for compare view
 const calcQuickMetrics = (s) => {
  if (!s) return null;
  const sp = s.salesPrice || 1000000;
  const dp = sp * (s.downPct || 20) / 100;
  const baseLoan = sp - dp;
  const ltv = sp > 0 ? baseLoan / sp : 0;
  const fhaUp = s.loanType === "FHA" ? baseLoan * 0.0175 : 0;
  const vaFF = s.loanType === "VA" ? baseLoan * 0.023 : 0;
  const loan = baseLoan + fhaUp + vaFF;
  const n = (s.term || 30) * 12;
  const pi = calcPI(loan, s.rate || 6.5, s.term || 30); // shared engine (re-audit L-1, was inline dup)
  const qAutoRate = getAutoTaxRate(s.propertyState || propertyState, s.city || city);
  const qTaxRate = taxBaseRateOverride > 0 ? taxBaseRateOverride / 100 : qAutoRate;
  const qLP = s.loanPurpose || loanPurpose;
  const qIsPrimary = qLP === "Purchase Primary" || qLP === "Refi Rate/Term" || qLP === "Refi Cash-Out";
  const qExempt = taxExemptionLocked ? (qIsPrimary ? 7000 : 0) : (taxExemptionOverride || 0);
  const yearlyTax = Math.max(0, sp - qExempt) * qTaxRate + (fixedAssessments || 0);
  const monthlyTax = yearlyTax / 12;
  const ins = (s.annualIns || 1500) / 12;
  let mi = 0;
  if (s.loanType === "FHA") mi = loan * 0.0055 / 12;
  else if (s.loanType !== "VA" && ltv > 0.8) mi = loan * 0.005 / 12;
  const hoaM = s.hoa || 0;
  const monthlyPayment = pi + monthlyTax + ins + mi + hoaM;
  const totalInt = pi * n - loan;
  // simplified cash to close
  const closingCosts = loan * 0.025;
  const prepaids = yearlyTax * 0.4 + (s.annualIns || 1500) + (loan * (s.rate || 6.5) / 100 / 365 * 15);
  const cashToClose = dp + closingCosts + prepaids - (s.sellerCredit || 0) - (s.realtorCredit || 0);
  // simplified DTI (including REO with linked debts)
  const incArr = s.incomes || [];
  const monthlyInc = incArr.reduce((sum, inc) => sum + (inc.monthly || 0), 0) + (s.otherIncome || 0) + (s.otherIncome2 || 0);
  const debtArr = s.debts || [];
  const reoArr = s.reos || [];
  // Identify linked debts — only exclude those linked to INVESTMENT REOs
  const investReoIds = new Set(reoArr.filter(r => r.propUse === "Investment").map(r => String(r.id)));
  const linkedIds = new Set(debtArr.filter(d => d.linkedReoId && investReoIds.has(d.linkedReoId) && (d.type === "Mortgage" || d.type === "HELOC")).map(d => d.id));
  const monthlyDebts = debtArr.filter(d => !linkedIds.has(d.id)).reduce((sum, d) => sum + (d.payment || d.monthly || 0), 0);
  // Investment properties: 75% netting
  let reoInvNet = 0;
  reoArr.filter(r => r.propUse === "Investment").forEach(r => {
   const linked = debtArr.filter(d => d.linkedReoId === String(r.id));
   const linkedPmt = linked.reduce((sum, d) => sum + (Number(d.monthly || d.payment) || 0), 0);
   const pitia = linked.length > 0 ? linkedPmt + (r.includesTI ? 0 : ((Number(r.reoTax)||0)+(Number(r.reoIns)||0)+(Number(r.reoHoa)||0))) : (Number(r.payment) || 0) + (r.includesTI ? 0 : ((Number(r.reoTax)||0)+(Number(r.reoIns)||0)+(Number(r.reoHoa)||0)));
   reoInvNet += ((Number(r.rentalIncome) || 0) * 0.75) - pitia;
  });
  // Primary/Second Home: full PITIA as debt
  let reoPrimDebt = 0;
  reoArr.filter(r => r.propUse !== "Investment").forEach(r => {
   const linked = debtArr.filter(d => d.linkedReoId === String(r.id));
   const extraTI = r.includesTI ? 0 : ((Number(r.reoTax)||0)+(Number(r.reoIns)||0)+(Number(r.reoHoa)||0));
   if (linked.length > 0) { reoPrimDebt += extraTI; }
   else { reoPrimDebt += (Number(r.payment) || 0) + extraTI; }
  });
  const reoIncAdd = reoInvNet > 0 ? reoInvNet : 0;
  const reoDebtAdd = (reoInvNet < 0 ? Math.abs(reoInvNet) : 0) + reoPrimDebt;
  const qualInc = monthlyInc + reoIncAdd;
  const dti = qualInc > 0 ? (monthlyPayment + monthlyDebts + reoDebtAdd) / qualInc : 0;
  return { salesPrice: sp, downPct: s.downPct || 20, rate: s.rate || 6.5, term: s.term || 30, loanType: s.loanType || "Conventional", loan, pi, monthlyPayment, cashToClose, dti, totalInt, monthlyInc: qualInc, monthlyTax, ins, mi, hoaM, ltv };
 };
 // Load all scenarios for compare view
 const loadCompareData = async () => {
  setCompareLoading(true);
  try {
   // Force-save current scenario so storage is up-to-date
   try { await LS.set("scenario:" + scenarioName, JSON.stringify(getState())); } catch(e) {}
   const results = [];
   const liveMetrics = { salesPrice, downPct, rate, term, loanType, loan: calc.loan, pi: calc.pi, monthlyPayment: calc.displayPayment, cashToClose: calc.cashToClose, dti: calc.yourDTI, totalInt: calc.totalIntStandard, monthlyInc: calc.qualifyingIncome, monthlyTax: calc.monthlyTax, ins: calc.ins, mi: calc.monthlyMI, hoaM: hoa, ltv: calc.ltv };
   // Build STRICTLY from the current scenario list so a just-deleted scenario
   // can't ghost into the cards. The active scenario (scenarioName) uses live
   // calc values; the rest load from storage. If scenarioName isn't in the list
   // yet (mid-switch after a delete), it simply isn't shown until things settle.
   for (const name of scenarioList) {
    if (name === scenarioName) {
     results.push({ name, metrics: liveMetrics, isCurrent: true });
    } else {
     try {
      const res = await LS.get("scenario:" + name);
      if (res && res.value) {
       const s = JSON.parse(res.value);
       const m = calcQuickMetrics(s);
       if (m) results.push({ name, metrics: m, isCurrent: false });
      }
     } catch(e) { /* skip broken scenarios */ }
    }
   }
   setCompareData(results);
  } catch(e) { console.error("Compare load error", e); }
  setCompareLoading(false);
 };
 // Auto-load compare data when switching to compare tab, AND whenever the
 // scenario list or active scenario changes (so deleting/renaming/switching a
 // scenario refreshes the side-by-side cards instead of showing stale data).
 // eslint-disable-next-line react-hooks/exhaustive-deps
 React.useEffect(() => { if (tab === "compare") loadCompareData(); }, [tab, scenarioName, scenarioList]);
 React.useEffect(() => { window.scrollTo({ top: 0, behavior: "instant" }); const mc = document.querySelector('.bp-main-content'); if (mc) mc.scrollTop = 0; }, [tab]);
 React.useEffect(() => { if (loanType === "FHA" || loanType === "VA") setIncludeEscrow(true); }, [loanType]);
 // Sync escrow toggles between purchase flow (includeEscrow) and refi flow (refiHasEscrow)
 React.useEffect(() => { setRefiHasEscrow(includeEscrow); }, [includeEscrow]);
 React.useEffect(() => { if (isRefi) setIncludeEscrow(refiHasEscrow); }, [refiHasEscrow]);
 // Auto-disable Prop 19 tab when leaving California (Prop 19 is CA-specific)
 React.useEffect(() => { if (propertyState !== "California" && showProp19) setShowProp19(false); }, [propertyState]);
 // Auto-disable Prop 19 tab when switching to refinance (Prop 19 applies to purchases)
 React.useEffect(() => { if (isRefi && showProp19) setShowProp19(false); }, [isRefi]);
 React.useEffect(() => {
  // Sync affordability inputs when user lands on Qualify OR Overview (Overview embeds Qualify).
  // Don't reference `calc.X` in the dep array — `calc` is declared later in this component (TDZ).
  if (tab === "qualify" || tab === "overview") {
   setConfirmAffordApply(false);
   if (calc.qualifyingIncome > 0) setAffordIncome(Math.round(calc.qualifyingIncome));
   if ((calc.totalMonthlyDebts + calc.reoNegativeDebt) > 0) setAffordDebts(Math.round(calc.totalMonthlyDebts + calc.reoNegativeDebt));
   if (calc.totalForClosing > 0) setAffordDown(calc.totalForClosing);
   if (rate > 0) setAffordRate(rate);
   if (term > 0) setAffordTerm(term);
   if (loanType) { setAffordLoanType(loanType); setAffordTargetDTI(loanType === "FHA" ? 56.99 : loanType === "VA" ? 60 : loanType === "Jumbo" ? 43 : 50); }
  }
 }, [tab]);
 const generateSummaryText = () => {
  const c = calc;
  const lines = [];
  const ln = (t, v) => lines.push(`${t}: ${v || ""}`);
  const sep = () => lines.push("─".repeat(40));
  lines.push(isRefi ? "REFINANCE ESTIMATE" : "PURCHASE ESTIMATE");
  lines.push("FOR ILLUSTRATIVE PURPOSES ONLY — NOT AN OFFICIAL QUOTE");
  lines.push(`Scenario: ${scenarioName}`);
  if (borrowerName) lines.push(`Prepared for: ${borrowerName}`);
  lines.push(`Prepared by: ${loanOfficer || "Loan Officer"}${loNmls ? " · NMLS #" + loNmls : ""}`);
  if (companyName) lines.push(`${companyName}${companyNmls ? " · NMLS #" + companyNmls : ""}`);
  if (loPhone) lines.push(`Phone: ${loPhone}`);
  if (loEmail) lines.push(`Email: ${loEmail}`);
  if (realtorPartner) { lines.push(`Realtor: ${realtorPartner.name}${realtorPartner.brokerage ? " · " + realtorPartner.brokerage : ""}${realtorPartner.dre ? " · DRE #" + realtorPartner.dre : ""}`); if (realtorPartner.phone) lines.push(`Realtor Phone: ${realtorPartner.phone}`); }
  lines.push(`Date: ${new Date().toLocaleDateString()}`);
  sep();
  if (isRefi) {
   lines.push("CURRENT LOAN");
   ln("  Balance", fmt(c.refiEffBalance));
   ln("  Rate", refiCurrentRate + "%");
   ln("  P&I Payment", fmt(c.refiEffPI));
   ln("  Remaining", c.refiEffRemaining + " months");
   ln("  Total Payment (PITI)", fmt(c.refiCurTotalPmt));
   sep();
   lines.push("PROPOSED NEW LOAN");
   ln("  Loan Amount", fmt(c.refiNewLoanAmt));
   ln("  Rate", rate + "%");
   ln("  Term", term + " years");
   ln("  Type", loanType);
   ln("  P&I Payment", fmt(c.refiNewPi));
   if (refiPurpose === "Cash-Out") ln("  Cash Out", fmt(refiCashOut));
   sep();
   lines.push("SAVINGS");
   ln("  Monthly P&I Savings", fmt(c.refiMonthlySavings));
   ln("  Monthly Total Savings", fmt(c.refiMonthlyTotalSavings));
   ln("  Closing Costs", fmt(c.totalClosingCosts));
   ln("  Breakeven", c.refiBreakevenMonths + " months");
   ln("  Lifetime Interest Savings", fmt(c.refiIntSavings));
   sep();
   lines.push("NET CASH OUT");
   ln("  New Loan Amount", fmt(c.refiNetNewLoan));
   ln("  Closing Costs", "-" + fmt(c.refiNetClosingCosts));
   ln("  Prepaids & Escrow", "-" + fmt(c.refiNetPrepaids));
   ln("  Current Loan Payoff", "-" + fmt(c.refiNetPayoff));
   ln("  Estimated Cash Out", fmt(c.refiEstCashOut));
   if (c.refiSkipPmtAmt > 0) ln("  Skip " + refiSkipMonths + " Payment(s)", "+" + fmt(c.refiSkipPmtAmt));
   if (c.refiEscrowRefund > 0) ln("  Escrow Balance Refund", "+" + fmt(c.refiEscrowRefund));
   ln("  NET CASH IN HAND", fmt(c.refiNetCashInHand));
   sep();
   lines.push("3-POINT REFI TEST");
   ln("  1. Rate Drop ≥ 0.50%", `${c.refiRateDrop.toFixed(2)}% → ${c.refiTest1Pass ? "✓ PASS" : "✗ FAIL"}`);
   ln("  2. Breakeven < 2 Years", `${c.refiBreakevenMonths} mos → ${c.refiTest2Pass ? "✓ PASS" : "✗ FAIL"}`);
   ln("  3. Payoff 1yr+ Faster", `${c.refiAccelPayoff.yearsFaster.toFixed(1)} yrs → ${c.refiTest3Pass ? "✓ PASS" : "✗ FAIL"}`);
   ln("  Score", `${c.refiTestScore}/3`);
  } else {
   lines.push("PROPERTY");
   if (propertyTBD) ln("  Address", "TBD");
   else if (propertyAddress) ln("  Address", propertyAddress);
   ln("  Location", `${city}, ${propertyState}${propertyZip ? " " + propertyZip : ""}${propertyCounty ? " (" + propertyCounty + " Co.)" : ""}`);
   ln("  Purchase Price", fmt(salesPrice));
   ln("  Down Payment", `${fmt(c.dp)} (${downPct}%)`);
   ln("  Loan Amount", fmt(c.loan));
   if (c.fhaUp > 0) ln("  FHA UFMIP (financed)", fmt(c.fhaUp));
   if (c.vaFundingFee > 0) ln("  VA Funding Fee (financed)", fmt(c.vaFundingFee));
   ln("  Loan Type", `${loanType} · ${term}yr`);
   ln("  Interest Rate", rate + "%");
   ln("  Category", c.loanCategory);
   sep();
   lines.push("MONTHLY PAYMENT");
   ln("  Principal & Interest", fmt(c.pi));
   ln("  Property Tax", fmt(c.monthlyTax));
   ln("  Insurance", fmt(c.ins));
   if (c.monthlyMI > 0) ln("  Mortgage Insurance", fmt(c.monthlyMI));
   if (hoa > 0) ln("  HOA", fmt(hoa));
   ln("  TOTAL", fmt(c.housingPayment));
   sep();
   lines.push("CLOSING");
   ln("  Closing Costs", fmt(c.totalClosingCosts));
   ln("  Prepaids & Escrow", fmt(c.totalPrepaidExp));
   ln("  Cash to Close", fmt(c.cashToClose));
  }
  sep();
  lines.push("");
  lines.push("DISCLAIMER: This is a hypothetical estimate for illustrative purposes only.");
  lines.push("It is NOT a loan offer, pre-approval, or commitment to lend.");
  lines.push("Contact a licensed loan officer for an official quote.");
  return lines.join("\n");
 };
 // PDF strategy (Christo 2026-07-05): PURCHASE PDFs = the Fees Worksheet
 // (FeesWorksheetPdf.jsx) — the legacy purchase estimate is retired. REFI
 // PDFs = the legacy refi estimate below (savings analysis, net cash out,
 // 3-point test) — totally different document, keep it.
 const generatePdfHtml = () => generateEstimateHtml({
  calc, fmt, fmt2, scenarioName, loanOfficer, companyName, companyNmls,
  borrowerName, propertyTBD, propertyAddress, city, propertyState, propertyZip,
  loNmls, loPhone, loEmail, realtorPartner, isRefi, refiSkipMonths,
  salesPrice, downPct, loanType, term, rate, hoa,
 });
 const handlePrintPdf = () => {
  const html = generatePdfHtml();
  const w = window.open("", "_blank", "width=700,height=900");
  if (w) {
   w.document.write(html);
   w.document.close();
   setTimeout(() => w.print(), 500);
  }
 };
 // One entry point for every "save the PDF" button: worksheet for purchases,
 // legacy refi estimate for refis.
 const handleSaveScenarioPdf = () => {
  if (isRefi) handlePrintPdf();
  else handleDownloadWorksheet();
 };
 const handleEmailSummary = () => {
  const subject = encodeURIComponent(`${isRefi ? "Refinance" : "Purchase"} Estimate — ${scenarioName}`);
  const body = encodeURIComponent(generateSummaryText());
  const to = encodeURIComponent(borrowerEmail || "");
  const bccParam = loEmail ? `&bcc=${encodeURIComponent(loEmail)}` : "";
  window.open(`mailto:${to}?subject=${subject}&body=${body}${bccParam}`, "_self");
 };
 // ── Fees Worksheet (PDF) — build props + one-click Gmail send ──
 // Explicit-input contract: every value the PDF needs is listed here.
 // If you add a fee to the calc, add it here too.
 const buildWorksheetProps = () => ({
  calc, scenarioName, loanOfficer, companyName, companyNmls, borrowerName,
  propertyTBD, propertyAddress, city, propertyState, propertyZip,
  loNmls, loPhone, loEmail, isRefi, refiSkipMonths, refiPurpose, refiHomeValue, refiCashOut,
  salesPrice, downPct, loanType, term, rate, hoa, creditScore, includeEscrow,
  closingMonth, closingDay, closingYear,
  discountPts, originatorComp, underwritingFee, adminFee, lenderWireFee,
  appraisalFee, creditReportFee, processingFee, floodCertFee, mersFee, taxServiceFee,
  titleInsurance, escrowFee, courierFee, loanTieInFee,
  notaryFee, envProtectionLien, ownersTitleIns, homeWarranty, recordingFee,
  propertyTaxesInstallment, sellersProratedTaxCredit,
  sellerCredit, lenderCredit, realtorCredit, customFees,
 });
 // Short note in Christo's voice + headline figures; the PDF carries the detail.
 const buildWorksheetEmailBody = () => {
  const firstName = (borrowerName || "").trim().split(/\s+/)[0];
  const lines = [
   firstName ? `Hi ${firstName},` : "Hi there,",
   "",
   "Attached is your personalized fees worksheet — the full picture of this scenario on one page.",
   "",
   "The headlines:",
   `• Total monthly payment: ${fmt(isRefi ? calc.refiNewTotalPmt : calc.housingPayment)}`,
   isRefi
    ? `• Monthly savings: ${fmt(calc.refiMonthlyTotalSavings)}`
    : `• Estimated cash to close: ${fmt(calc.cashToClose)}`,
   `• Rate: ${rate}% (${loanType}, ${term}-year)`,
   "",
   "Look it over and reply with any questions — happy to walk through it together.",
   "",
   ...(loSignature.trim()
    ? loSignature.trim().split("\n")
    : [
       loanOfficer || "Your Loan Officer",
       [companyName, loNmls ? `NMLS #${loNmls}` : ""].filter(Boolean).join(" · "),
       loPhone || "",
      ]),
  ].filter((l) => l !== null && l !== undefined);
  return lines.join("\n");
 };
 // Primary email action, by audience:
 // - Signed-in LO on web → Gmail preview→send modal (their own Gmail).
 // - Borrower (live link) or local-mode/App Store user → "Email me this
 //   worksheet" via the Ops Resend endpoint (LO auto-BCC'd = lead signal).
 // - Anything else (no client ID at all) → legacy mailto.
 const isSignedInLO = !isBorrower && isCloud && gmailSendAvailable();
 const handleEmailWorksheet = () => {
  if (isSignedInLO) setShowWorksheetModal(true);
  else if (isBorrower || !isCloud) setShowBorrowerSend(true);
  else handleEmailSummary();
 };
 const handleDownloadWorksheet = () => {
  downloadWorksheetPdf(buildWorksheetProps(), scenarioName, borrowerName).catch((e) => {
   console.error("Worksheet download failed:", e);
   alert("Could not generate the PDF — please try again.");
  });
 };
 // ── Live-link mailto builder ──
 // Short body — this is a link email, not a summary. The borrower clicks the
 // URL, gets a magic-link sign-in, then lands inside Blueprint with every
 // input already filled in. Subject mirrors the existing handleEmailSummary
 // shape so brokers' inboxes thread cleanly.
 const buildLiveLinkMailto = ({ to, name, url, lo, isRefiFlag, scenario }) => {
  const subject = encodeURIComponent(`Your ${isRefiFlag ? "Refinance" : "Purchase"} Blueprint — ${scenario}`);
  const greeting = name ? `Hi ${name},` : "Hi there,";
  const signerLine = `— ${loanOfficer || "Your loan officer"}${companyName ? ` · ${companyName}` : ""}`;
  const nmlsLine = companyNmls ? `NMLS #${companyNmls}` : "";
  const phoneLine = loPhone || "";
  const emailLine = lo || "";
  const body = encodeURIComponent(
   [
    greeting,
    "",
    "I built out a live mortgage scenario for you. Click the link below to view it — you'll get a quick sign-in code by email, then everything will be pre-filled and ready to explore. You can adjust numbers and I'll see your changes on my end.",
    "",
    url,
    "",
    "If anything looks off, reply to this email and we'll dig in together.",
    "",
    signerLine,
    nmlsLine,
    emailLine,
    phoneLine,
   ].filter(Boolean).join("\n")
  );
  const toParam = encodeURIComponent(to || "");
  const bccParam = lo ? `&bcc=${encodeURIComponent(lo)}` : "";
  return `mailto:${toParam}?subject=${subject}&body=${body}${bccParam}`;
 };
 // ── Send Live Link handler ──
 // Single async chain that resolves a borrower row, saves the current
 // calculator state as a scenario tied to that borrower, then either copies
 // the share URL or opens a pre-filled mailto. The borrower's `share_token`
 // is server-minted (DB default) — we never compose tokens client-side.
 // Action: 'copy' | 'email'.
 const handleSendLiveLink = async (action) => {
  setLiveLinkError(null);
  setLiveLinkToast(null);
  // Local-mode bail (Christo: disable + inline error rather than hide).
  if (!isCloud) {
   setLiveLinkError("Sign in to send a live link. The Email Summary, Save PDF, and Copy to Clipboard options below still work.");
   return;
  }
  if (!borrowerEmail || !borrowerEmail.trim()) {
   setLiveLinkError("Add a borrower email before sending a live link.");
   return;
  }
  setLiveLinkSending(true);
  try {
   // ── Step 1: Resolve borrower row ──────────────────────────────────────
   // (a) reuse activeBorrower iff the modal email matches it (case-insensitive)
   // (b) otherwise create — the Ops endpoint dedupes on email server-side
   //     and returns the existing row with `_deduplicated: true`
   let borrower = null;
   const modalEmail = borrowerEmail.trim().toLowerCase();
   if (activeBorrower?.email && activeBorrower.email.trim().toLowerCase() === modalEmail) {
    borrower = activeBorrower;
   } else {
    const result = await createBorrower({
     name: borrowerName?.trim() || borrowerEmail.split("@")[0],
     email: borrowerEmail.trim(),
     status: "active",
    });
    borrower = result?.[0] || result;
   }
   if (!borrower?.id) {
    throw new Error("Couldn't resolve a borrower row");
   }
   // ── Step 2: Defensive re-fetch to guarantee share_token visibility ─────
   // The dedup endpoint spreads `existing[0]` so it should already include
   // share_token, but a legacy row predating the token rollout could come
   // back null. A 50ms re-read sidesteps that whole class of bugs.
   if (!borrower.share_token) {
    const fresh = await fetchBorrowerById(borrower.id);
    if (fresh) borrower = fresh;
   }
   if (!borrower.share_token) {
    setLiveLinkError("Couldn't generate a share link — contact support so we can backfill this borrower's token.");
    setLiveLinkSending(false);
    return;
   }
   // ── Step 3: Save the current calculator state as a scenario row ────────
   const summary = buildCalcSummary();
   const stateData = getState();
   const scResult = await apiCreateScenario({
    borrower_id: borrower.id,
    name: scenarioName || (isRefi ? "Refi Estimate" : "Purchase Estimate"),
    type: isRefi ? "refi" : "purchase",
    status: "draft",
    created_by: "lo",
    state_data: stateData,
    calc_summary: summary,
   });
   const newScenarioId = Array.isArray(scResult) ? scResult[0]?.id : scResult?.id;
   // ── Step 4: Build URL and dispatch action ──────────────────────────────
   const shareUrl = `${WEB_ORIGIN}?share=${borrower.share_token}`;
   if (action === "copy") {
    try {
     await navigator.clipboard.writeText(shareUrl);
     setLiveLinkToast("Link copied");
    } catch {
     // Safari / sandboxed webview fallback — same shape as the existing
     // Copy Link button in the summary tab (see line ~4940).
     prompt("Copy this share link:", shareUrl);
     setLiveLinkToast("Link ready (copied via prompt)");
    }
   } else if (action === "email") {
    const mailto = buildLiveLinkMailto({
     to: borrowerEmail.trim(),
     name: borrowerName?.trim() || "",
     url: shareUrl,
     lo: loEmail,
     isRefiFlag: isRefi,
     scenario: scenarioName || (isRefi ? "Refi Estimate" : "Purchase Estimate"),
    });
    window.open(mailto, "_self");
    setLiveLinkToast("Email opened in your mail app");
   }
   // ── Step 5: Lift the resolved borrower into session state so the rest
   // of the UI (BorrowerPicker, in-pane Copy Link button) reflects it ─────
   setActiveBorrower(borrower);
   setBorrowerList(prev => prev.some(b => b.id === borrower.id)
    ? prev.map(b => b.id === borrower.id ? borrower : b)
    : [...prev, borrower]);
   if (newScenarioId) setActiveScenarioId(newScenarioId);
   // Auto-clear the toast and close the modal on success.
   setTimeout(() => setLiveLinkToast(null), 2500);
   setShowEmailModal(false);
  } catch (err) {
   console.warn("[Blueprint] handleSendLiveLink failed:", err);
   setLiveLinkError(err?.message || "Couldn't generate a share link — please check your connection and try again.");
  } finally {
   setLiveLinkSending(false);
  }
 };
 const [liveRates, setLiveRates] = useState(null);
 const [ratesLoading, setRatesLoading] = useState(false);
 const [ratesError, setRatesError] = useState(null);
 const fetchRates = async () => {
  setRatesLoading(true);
  setRatesError(null);
  const applyRates = (parsed) => {
   parsed.date = parsed.date || new Date().toISOString().split("T")[0];
   setLiveRates(parsed);
   const rateMap = { "Conventional": term === 15 ? parsed["15yr_fixed"] : parsed["30yr_fixed"],
    "FHA": parsed["30yr_fha"], "VA": parsed["30yr_va"], "Jumbo": parsed["30yr_jumbo"], "USDA": parsed["30yr_fixed"] };
   const matched = rateMap[loanType];
   if (matched && !isNaN(matched)) setRate(matched);
  };
  // Normalize the RealStack Ops market-rates payload → Blueprint's flat shape.
  // Ops returns { provider, asOf, rates: { "30yr_fixed": { rate, change, ... }, ... } }
  // with products keyed 30yr_fixed / 15yr_fixed / 30yr_fha / 30yr_va / 30yr_jumbo / arm_7_6.
  const mapOpsRates = (payload) => {
   const r = (payload && payload.rates) || {};
   const num = (k) => { const v = r[k] && r[k].rate; return (typeof v === "number" && !isNaN(v)) ? v : null; };
   const out = {
    date: (payload && payload.asOf) || new Date().toISOString().split("T")[0],
    "30yr_fixed": num("30yr_fixed"),
    "15yr_fixed": num("15yr_fixed"),
    "30yr_fha": num("30yr_fha"),
    "30yr_va": num("30yr_va"),
    "30yr_jumbo": num("30yr_jumbo"),
    "5yr_arm": num("arm_7_6"),
    source: payload && payload.provider === "fred" ? "FRED / Freddie Mac PMMS" : "Mortgage News Daily",
   };
   // Fill any gaps off the 30yr so the rate table never shows blanks.
   const base = out["30yr_fixed"];
   if (base) {
    if (out["15yr_fixed"] == null) out["15yr_fixed"] = +(base - 0.6).toFixed(2);
    if (out["30yr_fha"] == null) out["30yr_fha"] = +(base - 0.25).toFixed(2);
    if (out["30yr_va"] == null) out["30yr_va"] = +(base - 0.35).toFixed(2);
    if (out["30yr_jumbo"] == null) out["30yr_jumbo"] = +(base + 0.25).toFixed(2);
    if (out["5yr_arm"] == null) out["5yr_arm"] = +(base - 0.3).toFixed(2);
   }
   return out;
  };
  // Attempt 1: RealStack Ops market-rates — Mortgage News Daily (updated daily,
  // more current than FRED's weekly survey); Ops falls back to FRED server-side
  // on its end. Absolute URL: Ops is a different origin and CORS-allows this read.
  try {
   const res = await fetch("https://ops.realstack.app/api/market-rates");
   if (res.ok) {
    const parsed = mapOpsRates(await res.json());
    if (parsed["30yr_fixed"] > 2 && parsed["30yr_fixed"] < 15) {
     applyRates(parsed);
     setRatesLoading(false);
     return;
    }
   }
  } catch (e) { console.log("Ops market-rates fetch failed:", e.message); }
  // Attempt 2: Blueprint's own serverless proxy (legacy FRED; key stays server-side).
  try {
   const res = await fetch(apiUrl("/api/rates"));
   if (res.ok) {
    const data = await res.json();
    if (data["30yr_fixed"] > 2 && data["30yr_fixed"] < 15) {
     applyRates(data);
     setRatesLoading(false);
     return;
    }
   }
  } catch(e) { console.log("Proxy fetch failed:", e.message); }
  // Both sources failed.
  setRatesError("Could not fetch rates — try again in a moment");
  setRatesLoading(false);
 };

 useEffect(() => {
  if (!liveRates) return;
  const rateMap = {
   "Conventional": term === 15 ? liveRates["15yr_fixed"] : liveRates["30yr_fixed"],
   "FHA": liveRates["30yr_fha"],
   "VA": liveRates["30yr_va"],
   "Jumbo": liveRates["30yr_jumbo"],
   "USDA": liveRates["30yr_fixed"],
  };
  const matched = rateMap[loanType];
  if (matched && !isNaN(matched)) setRate(matched);
 }, [loanType, liveRates, term]);
 // addIncome accepts an optional `source` so the "+ Add component"
 // button inside an employer group can pre-fill the employer name. New
 // entries default to Salary / "Amount"; the user types the actual
 // component (Bonus, RSU, etc.) inside the expanded employer.
 // py1Year / py2Year default to last 2 calendar years. Broker can
 // override per-row in the variable averaging panel to skip a
 // distorted year or pick a different historical window.
 const addIncome = (borrower, source = "") => { const cy = new Date().getFullYear(); return setIncomes([...incomes, { id: Date.now(), borrower, source, start: "", end: "", payType: "Salary", amount: 0, frequency: "Annual", ytd: 0, py1: 0, py2: 0, py1Year: cy - 1, py2Year: cy - 2, selection: "Amount", verifiedBy: "", monthlyIncome: 0 }]); };
 const updateIncome = (id, f, v) => setIncomes(incomes.map(i => i.id === id ? { ...i, [f]: v } : i));
 const removeIncome = (id) => setIncomes(incomes.filter(i => i.id !== id));
 // Delete borrower N — drops their incomes and compacts everyone above
 // them down by one. Christo (2026-05-05): "we should be able to delete
 // borrower #2 too." Works for any borrower, not just the last.
 // Uses functional state setters so multiple setStates in the same
 // event handler can't strand a stale closure.
 const removeBorrower = (n) => {
  const shift = (b) => (b > n ? b - 1 : b);
  setIncomes(prev => prev.filter(i => i.borrower !== n).map(i => ({ ...i, borrower: shift(i.borrower) })));
  setBorrowerNames(prev => {
   const next = {};
   Object.keys(prev).forEach(k => {
    const num = Number(k);
    if (num === n) return;
    next[shift(num)] = prev[k];
   });
   return next;
  });
  setOtherIncomeByBorrower(prev => {
   const next = {};
   Object.keys(prev).forEach(k => {
    const num = Number(k);
    if (num === n) return;
    next[shift(num)] = prev[k];
   });
   return next;
  });
  // Promote shifted other-income up. Read the legacy values from
  // closure (one-shot at click time — they're fine) but feed them
  // through functional setters.
  if (n === 1) {
   const promote2to1 = otherIncome2 || 0;
   const promote3to2 = otherIncomeByBorrower[3] || 0;
   setOtherIncome(() => promote2to1);
   setOtherIncome2(() => promote3to2);
  } else if (n === 2) {
   const promote3to2 = otherIncomeByBorrower[3] || 0;
   setOtherIncome2(() => promote3to2);
  }
  setNumBorrowers(prev => Math.max(1, prev - 1));
 };
 const addAsset = () => setAssets([...assets, { id: Date.now(), bank: "", last4: "", owner: "", type: "Checking", value: 0, forClosing: 0 }]);
 const updateAsset = (id, f, v) => setAssets(assets.map(a => a.id === id ? { ...a, [f]: v } : a));
 const removeAsset = (id) => setAssets(assets.filter(a => a.id !== id));
 // ── Security: Privacy mode sync ──
 PRIVACY = privacyMode;
 // ── Security: Load consent + PIN from storage ──
 useEffect(() => {
  (async () => {
   try { const c = await LS.get("sec:consent"); if (c?.value === "true") setConsentGiven(true); } catch(e) {}
   try { const p = await LS.get("sec:pin"); if (p?.value) { setPinCode(p.value); setPinSet(true); setIsLocked(true); } } catch(e) {}
   try { const a = await LS.get("sec:autolock"); if (a?.value) setAutoLockMin(parseInt(a.value)||5); } catch(e) {}
  })();
 }, []);
 // ── Course: Load progress from storage ──
 useEffect(() => {
  (async () => {
   try { const cp = await LS.get("course:progress"); if (cp?.value) setCourseProgress(JSON.parse(cp.value)); } catch(e) {}
  })();
 }, []);
 const saveCourseProgress = async (newProgress) => {
  setCourseProgress(newProgress);
  try { await LS.set("course:progress", JSON.stringify(newProgress)); } catch(e) {}
 };
 const completedCount = Object.keys(courseProgress).filter(k => courseProgress[k]).length;
 const courseComplete = completedCount === COURSE_CHAPTERS.length;
 // ── Skill Level & Tab Progression: Load from storage ──
 useEffect(() => {
  (async () => {
   try {
    const sl = await LS.get("app:skillLevel");
    if (sl?.value) {
     let level = sl.value;
     // Migrate old 3-tier values to new 2-tier
     if (level === "beginner") level = "guided";
     if (level === "experienced" || level === "expert") level = "standard";
     if (level !== sl.value) {
      try { LS.set("app:skillLevel", level); } catch(e) {}
     }
     setSkillLevel(level);
     // If no saved tab, route based on tier
     const preset = SKILL_PRESETS[level];
     if (preset?.startsOn) {
      // Only set tab if user hasn't navigated yet (still on default "overview")
      setTab(prev => prev === "overview" ? preset.startsOn : prev);
     }
    }
   } catch(e) {}
   try { const ct = await LS.get("app:completedTabs"); if (ct?.value) setCompletedTabs(JSON.parse(ct.value)); } catch(e) {}
   try { const ua = await LS.get("app:unlockAll"); if (ua?.value === "true") setUnlockAll(true); } catch(e) {}
   try { const gm = await LS.get("app:gameMode"); if (gm?.value === "true") setGameMode(true); } catch(e) {}
   try { const bs = await LS.get("app:buildStepV2"); if (bs?.value) setBuildStep(parseInt(bs.value) || 0); else {
    // Existing users who already completed setup should skip the guided flow
    const ct = await LS.get("app:completedTabs"); if (ct?.value) { const parsed = JSON.parse(ct.value); if (parsed.setup) setBuildStep(3); }
   } } catch(e) {}
  })();
 }, []);
 const saveCompletedTabs = (newTabs) => {
  setCompletedTabs(newTabs);
  try { LS.set("app:completedTabs", JSON.stringify(newTabs)); } catch(e) {}
 };
 const saveSkillLevel = (level) => {
  setSkillLevel(level);
  try { LS.set("app:skillLevel", level); } catch(e) {}
  if (level === "guided") {
   // Restart the guided flow at step 1 (Transaction Type). Wipe the
   // transaction-type toggle and the pulse-touched set so the pulse walks
   // the sequence from the top — but keep the user's real data (FICO,
   // ZIP, price, down, assets, income) intact; they probably don't want
   // to re-enter all of that just to flip into guided mode.
   setIsRefi(null);
   setFirstTimeBuyer(null);
   setOwnsProperties(false);
   setHasSellProperty(false);
   setShowInvestor(false);
   setShowProp19(false);
   setGuideTouched(new Set());
   setTab("overview");
   setGameMode(true);
   // Re-lock progression in case unlockAll was true from a prior
   // standard-mode session.
   setUnlockAll(false);
   try { LS.set("app:gameMode", "true"); } catch(e) {}
   try { LS.set("app:unlockAll", "false"); } catch(e) {}
   // Scroll to the top so the first step (Transaction Type in the Quick
   // Start banner) is visible.
   setTimeout(() => { try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch(e) {} }, 100);
  } else if (level === "standard") {
   // Standard mode: unlock every tab and drop the guided pulse machinery.
   setFirstTimeBuyer(false);
   setOwnsProperties(false);
   setHasSellProperty(false);
   setShowInvestor(false);
   setShowProp19(false);
   setTab("overview");
   setGameMode(false);
   setUnlockAll(true);
   try { LS.set("app:gameMode", "false"); } catch(e) {}
   try { LS.set("app:unlockAll", "true"); } catch(e) {}
  }
 };
 const saveUnlockAll = (val) => {
  setUnlockAll(val);
  try { LS.set("app:unlockAll", val ? "true" : "false"); } catch(e) {}
 };
 const saveGameMode = (val) => {
  setGameMode(val);
  setGameModeEverToggled(true);
  try { LS.set("app:gameMode", val ? "true" : "false"); } catch(e) {}
 };
 const saveBuildStep = (step) => {
  setBuildStep(step);
  try { LS.set("app:buildStepV2", String(step)); } catch(e) {}
 };

 // Build Mode: Tab display names for floating bar
 const TAB_DISPLAY_NAMES = { setup:"Setup", calc:"Calculator", costs:"Costs", qualify:"Qualify", debts:"Debts", income:"Income", assets:"Assets", tax:"Tax Savings", amort:"Amortization", learn:"Learn", compare:"Compare", summary:"Share", reo:"REO", refi:"Refi Summary", refi3:"3-Point Test", sell:"Seller Net", invest:"Investor", rentvbuy:"Rent vs Buy" };
 // ═══ FLOATING "NEXT STEP" BAR ═══
 // Sticky bottom bar that guides user to the next section.
 // Turns active (blue) ONLY when: (1) all required fields on this tab are filled AND (2) user scrolled 90%+ down.
 // isTabFieldsComplete checks actual field values, NOT the scroll-based completedTabs flag.
 const isTabFieldsComplete = (t) => {
  if (t === "setup") {
   const hasLocation = propertyZip.length >= 5 || (city && propertyState);
   const baseComplete = isRefi !== null && hasLocation && creditScore > 0 && salesPrice > 0;
   if (!baseComplete) return false;
   if (isRefi) return refiOriginalAmount > 0 && refiCurrentRate > 0;
   return true;
  }
  // calc and costs tabs folded into Overview — no longer standalone
  if (t === "calc" || t === "costs") return true;
  if (t === "income") return incomes.length > 0 && incomes.some(i => i.amount > 0 || i.py1 > 0);
  if (t === "assets") return assets.length > 0 && assets.some(a => a.value > 0 && a.forClosing > 0);
  if (t === "debts") return (debtFree || debts.length > 0) && guideTouched.has("owns-properties-toggle");
  if (t === "qualify") return creditScore > 0 && incomes.length > 0 && incomes.some(i => i.amount > 0 || i.py1 > 0);
  if (t === "tax") return incomes.length > 0 && incomes.some(i => i.amount > 0 || i.py1 > 0);
  if (t === "amort") return true; // display-only, always complete
  if (t === "reo") return true; // optional tab
  if (t === "learn") return true; // display-only
  if (t === "refi") return refiCurrentRate > 0 && refiCurrentBalance > 0;
  return true;
 };
 const getTabProgressPct = (tabId) => {
  if (tabId === "setup") {
   const fields = [isRefi !== null, propertyZip && propertyZip.length >= 5, creditScore > 0, guideTouched.has("filing-status"), !isRefi ? salesPrice > 0 : true, !isRefi ? (downPct > 0 || guideTouched.has("down-payment")) : true, !isRefi ? guideTouched.has("fthb") : true, guideTouched.has("modules-done")];
   return Math.round((fields.filter(Boolean).length / fields.length) * 100);
  }
  if (tabId === "calc") {
   const fields = [rate > 0, term > 0, loanType];
   return Math.round((fields.filter(Boolean).length / fields.length) * 100);
  }
  // For other tabs, return 0 (no fine-grained progress) or 100 if complete
  return isTabFieldsComplete(tabId) ? 100 : 0;
 };
 const TabProgressUnderline = ({ tabId }) => {
  // Only show progress for guided users on non-overview tabs
  if (skillLevel !== "guided" || tabId === "overview" || tabId === "settings") return null;
  const fieldsComplete = isTabFieldsComplete(tabId);
  const progressPct = fieldsComplete ? 100 : getTabProgressPct(tabId);
  if (progressPct === 0) return null;
  return (
   <div style={{
    position: "absolute",
    bottom: 0,
    left: "10%",
    width: "80%",
    height: 2,
    borderRadius: 1,
    background: T.separator,
    overflow: "hidden"
   }}>
    <div style={{
     height: "100%",
     width: `${progressPct}%`,
     background: fieldsComplete ? T.green : T.blue,
     borderRadius: 1,
     transition: "width 0.4s ease, background 0.3s ease"
    }} />
   </div>
  );
 };
 // ── Guided Next Button ──
 const GuidedNextButton = () => {
  if (skillLevel !== "guided") return null;
  const excludedTabs = ["overview", "settings", "learn", "summary", "compare", "workspace"];
  if (excludedTabs.includes(tab)) return null;
  if (!isTabFieldsComplete(tab)) return null;
  const curIdx = visibleTabs.indexOf(tab);
  const isLastTab = curIdx === -1 || curIdx >= visibleTabs.length - 1;
  let nextTab = null;
  for (let i = curIdx + 1; i < visibleTabs.length; i++) {
   if (!excludedTabs.includes(visibleTabs[i])) { nextTab = visibleTabs[i]; break; }
  }
  const isFinale = !nextTab || isLastTab;
  const buttonLabel = isFinale ? "View Results" : "Next";
  const targetTab = isFinale ? "overview" : nextTab;
  const nextTabName = isFinale ? "Overview" : (TABS.find(([k]) => k === targetTab)?.[1] || targetTab);
  return (
   <div style={{ marginTop: 24, marginBottom: 16, padding: "0 4px", animation: "fadeSlideUp 0.4s ease both" }}>
    <button
     onClick={() => { setTab(targetTab); window.scrollTo({ top: 0, behavior: "smooth" }); }}
     style={{
      width: "100%", padding: "16px 24px",
      background: "linear-gradient(135deg, #6366F1, #3B82F6)",
      border: "none", borderRadius: 9999, color: "#fff",
      fontSize: 16, fontWeight: 700, fontFamily: FONT, cursor: "pointer",
      boxShadow: "0 0 20px rgba(99,102,241,0.3)",
      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
      transition: "transform 0.15s ease, box-shadow 0.15s ease",
      letterSpacing: "-0.01em",
     }}
     onMouseDown={e => e.currentTarget.style.transform = "scale(0.98)"}
     onMouseUp={e => e.currentTarget.style.transform = "scale(1)"}
     onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
    >
     <span>{buttonLabel}</span>
     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
     </svg>
    </button>
    {!isFinale && (
     <div style={{ textAlign: "center", marginTop: 8, fontSize: 11, color: T.textTertiary, fontFamily: FONT, letterSpacing: "0.03em" }}>
      NEXT: {nextTabName.toUpperCase()}
     </div>
    )}
   </div>
  );
 };
 // ClusterContinue — explicit "advance" control for batch steps (Modules,
 // loan-structure pills). Renders ONLY for guided users and ONLY while its
 // cluster is the active pulsing step. Tapping individual controls in the
 // cluster no longer advances the guide; this button does, by setting the
 // "<stepId>-done" key that the matching guideField step waits on.
 const ClusterContinue = ({ stepId, label }) => {
  if (skillLevel !== "guided") return null;
  if (guideField !== stepId) return null;
  return (
   <div style={{ marginTop: 12, animation: "fadeSlideUp 0.35s ease both" }}>
    <button
     type="button"
     onClick={() => { markTouched(stepId + "-done"); }}
     style={{
      width: "100%", padding: "11px 0",
      background: `${T.blue}14`, border: `1px solid ${T.blue}40`,
      borderRadius: 9999, color: T.blue,
      fontSize: 13, fontWeight: 600, fontFamily: FONT, cursor: "pointer",
      display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
      transition: "background 0.2s ease",
     }}
    >
     <span>{label || "Looks good — continue"}</span>
     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14" /><path d="m19 12-7 7-7-7" /></svg>
    </button>
   </div>
  );
 };
 // Pillar click navigation — when on Overview, skip the setTab and just scroll-to.
 // When on a per-tab view, switch tabs first then scroll. Adds a 3s blue glow via .pulse-next.
 const handlePillarClick = (label) => {
  // Field targets (data-field attributes exist on both per-tab and Overview-embedded views).
  const targetMap = {
   "FICO": { tab: "qualify", field: "fico-input" },
   "Down": { tab: "calc", field: "calc-down" },
   "DTI": { tab: (incomes.length === 0 && debts.length > 0) ? "income" : "debts", field: (incomes.length === 0 && debts.length > 0) ? "income-section" : "debts-section" },
   "Cash": { tab: "assets", field: "assets-section" },
   "Reserves": { tab: "assets", field: "assets-section" },
  };
  const target = targetMap[label];
  if (!target) return;

  const isOnOverview = tab === "overview";
  // Per-tab path needs the target tab unlocked. Overview path is always allowed since the section is already on screen.
  if (!isOnOverview && !isTabUnlocked(target.tab)) {
   Haptics.light();
   return;
  }

  // Only switch tabs when we're NOT already on Overview.
  if (!isOnOverview) setTab(target.tab);
  setHighlightField(target.field);

  // Wait a tick longer when switching tabs so the per-tab DOM is mounted; on Overview the element already exists.
  setTimeout(() => {
   const el = document.querySelector(`[data-field="${target.field}"]`);
   if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("pulse-next");
    setTimeout(() => {
     el.classList.remove("pulse-next");
     setHighlightField(null);
    }, 3000);
   }
  }, isOnOverview ? 100 : 400);
 };
 // Determine which tabs are unlocked
 const getUnlockedIndex = () => {
  if (!gameMode || unlockAll || skillLevel === "standard") return TAB_PROGRESSION.length - 1;
  const preset = SKILL_PRESETS[skillLevel];
  let maxUnlocked = preset ? preset.unlockedThrough : 0;
  // Extend by completed tabs
  for (let i = maxUnlocked + 1; i < TAB_PROGRESSION.length; i++) {
   if (completedTabs[TAB_PROGRESSION[i - 1]]) maxUnlocked = i;
   else break;
  }
  return maxUnlocked;
 };
 const unlockedIndex = getUnlockedIndex();
 // All tabs are always unlocked, in every flow (guided/standard).
 // Christo 2026-06-02: no tab should ever be grayed out or gated by flow or
 // input-completion. The sidebar/swipe nav rely on this returning true.
 const isTabUnlocked = (tabId) => true;
 const markTabComplete = (tabId) => {
  if (!completedTabs[tabId]) {
   const newTabs = { ...completedTabs, [tabId]: true };
   saveCompletedTabs(newTabs);
  }
 };
 // Count completed stages for house graphic

 // ═══ ONE-SCREEN: Folded tabs render inside Overview in guided mode ═══
 // setup/calc/costs/income/debts/assets/qualify/tax/amort/compare are embedded
 // in the Overview page and have no standalone sidebar entry, so guided users
 // landing on one (via deep link) get bounced to Overview. Standalone tabs
 // (learn, workspace, reo, sell, invest, rentvbuy, prop19, refi*, summary,
 // settings) are fully navigable in guided mode — Christo 2026-06-02.
 React.useEffect(() => {
  const FOLDED_TABS = ["setup","calc","costs","income","debts","assets","qualify","tax","amort","compare"];
  if (skillLevel === "guided" && FOLDED_TABS.includes(tab)) {
   setTab("overview");
  }
 }, [skillLevel, tab]);

 // ═══ SEQUENTIAL PULSE GUIDE ═══
 // Tracks which fields with defaults have been explicitly interacted with.
 const [guideTouched, setGuideTouched] = useState(new Set());
 const markTouched = (field) => setGuideTouched(prev => {
  if (prev.has(field)) return prev;
  const next = new Set(prev);
  next.add(field);
  return next;
 });
 // Computes which single field should pulse on the current tab.
 // Returns a string matching a data-field attribute, or null if all fields are filled.
 // CRITICAL PATH ONLY — highlights the single most important next field
 const guideField = (() => {
  // Only show guide highlights for "guided" tier
  if (skillLevel !== "guided") return null;
  // Highlights run on the Setup tab AND the Overview tab — guided users
  // live on Overview, where every section is embedded on one scrolling page.
  if (tab !== "setup" && tab !== "overview") return null;

  // GUIDED SEQUENCE — highlights one field at a time, in the order Christo
  // wants a first-time buyer walked through the Overview tab. Each returned
  // string MUST match a data-field attribute that exists in the rendered DOM.
  // Text-input steps advance on a "looks complete" signal (valid FICO range,
  // full ZIP length, debounced price/down value) so the pulse doesn't jump
  // away mid-keystroke. Toggle/select/button steps advance on guideTouched.
  //  1) Transaction type     — SetupContent
  //  2) FICO score           — SetupContent
  //  3) ZIP code             — SetupContent
  //  4) Modules              — SetupContent
  //  5) Purchase price       — CalculatorContent (purchase only)
  //  6) Down payment         — CalculatorContent (purchase only)
  //  7) Get Today's Rates    — CalculatorContent
  //  8) Loan-structure pills — CalculatorContent (occupancy/type/loan/term)
  //  9) Costs / Cash to Close — CostsContent (review-only, auto-calculated)
  // 10) Assets               — AssetsContent
  // 11) Debts                — DebtsContent
  // 12) REO                  — ReoContent (only if they own other property)
  // 13) Income               — IncomeContent
  // 14) Pre-Qualified        — QualifyContent
  // 15) Tax Savings          — TaxContent
  // 16) Equity               — AmortContent

  // 1. Transaction type — Purchase or Refinance
  if (isRefi === null || !guideTouched.has("transaction-type-done")) return "transaction-type";

  // 2. FICO score — wait for a full, valid score (300+, the real FICO floor)
  //    before advancing, so typing the first digit doesn't yank the cursor.
  if (creditScore < 300 || !guideTouched.has("fico-input-done")) return "fico-input";

  // 3. ZIP code — advances once all 5 digits are in
  if (!propertyZip || propertyZip.length < 5 || !guideTouched.has("zip-code-done")) return "zip-code";

  // 4. Modules — pulse stays on the card until the user clicks "Continue"
  //    (sets "modules-done"). Tapping individual modules no longer advances.
  if (!guideTouched.has("modules-done")) return "modules";

  // 5. Purchase price (purchase only) — hold the pulse until a full
  //    6-digit price ($100k+) is entered. The input is debounced, but a
  //    short value (2-3 digits) would still advance prematurely, yanking
  //    the cursor to Down. Real homes here are 6+ digits.
  if (!isRefi && (salesPrice < 100000 || !guideTouched.has("calc-price-done"))) return "calc-price";

  // 6. Down payment (purchase only) — a down-payment % has no predictable
  //    digit count, so advance on blur (markTouched fires when the user
  //    clicks/tabs away) rather than per-keystroke.
  if (!isRefi && !guideTouched.has("calc-down-done")) return "calc-down";

  // 7. Get Today's Rates — pulse the live-rates button until it's clicked
  if (!guideTouched.has("get-rates")) return "get-rates";

  // 8. Loan-structure pills — Occupancy / Property Type / Loan Type / Term.
  //    Cluster step: pulse stays until the user clicks "Continue" (sets
  //    "calc-pills-done"). Changing a single pill no longer advances.
  if (!guideTouched.has("calc-pills-done")) return "calc-pills";

  // 9. Payment Breakdown — comprehension stop. The Continue chip only appears
  //    after the Tax/PMI carets are expanded (gate lives in CalculatorContent);
  //    chip sets "payment-breakdown-done".
  if (!guideTouched.has("payment-breakdown-done")) return "payment-breakdown";

  // 9. Costs / Cash to Close — comprehension step. Costs auto-calculate, so
  //    there is nothing to type; pulse the costs section, let the buyer review
  //    where their cash-to-close goes, then advance on Continue ("costs-done").
  //    Anchor: data-field="costs". Not in inputFields → scroll, no focus steal.
  if (!guideTouched.has("closing-costs-done")) return "closing-costs";
  if (!guideTouched.has("prepaids-done")) return "prepaids";
  if (!guideTouched.has("credits-done")) return "credits";

  // 10. Assets — add an account, then fill its value and cash-for-closing.
  //    Current Value advances on blur (markTouched) — it has no predictable
  //    digit count. Funds-for-Closing advances once a 4-digit amount
  //    ($1,000+) is entered, which then moves the pulse to the Debts section.
  if (!assets || assets.length === 0) return "add-asset";
  if (!guideTouched.has("assets-section-done")) return "assets-section";

  // 11. Debts — answer the "do you own other property?" question
  if (!guideTouched.has("owns-properties-toggle")) return "owns-properties-toggle";
  if (!guideTouched.has("debts-section-done")) return "debts-section";

  // 12. REO — only when the borrower owns other property
  if (ownsProperties && !guideTouched.has("reo-section")) return "reo-section";

  // 13. Income — at least one borrower needs income entered
  if (!incomes.some(i => i.amount > 0 || i.py1 > 0) || !guideTouched.has("income-section-done")) return "income-section";

  // 14. Pre-Qualified — review the qualification result
  if (!guideTouched.has("qualify-section")) return "qualify-section";

  // 15. Tax Savings
  if (!guideTouched.has("tax-filing")) return "tax-filing";

  // 16. Equity (amortization)
  if (!guideTouched.has("amort-section")) return "amort-section";

  // All guided steps complete — no more highlights
  return null;
 })();
 const isPulse = (fieldId) => guideField === fieldId ? "pulse-next" : "";
 // guidedStep — "Step X of N" descriptor for the guided progress strip.
 // Mirrors the guideField ladder; conditional steps are filtered per scenario.
 const guidedStep = (() => {
  if (skillLevel !== "guided") return null;
  const ladder = [
   { id: "transaction-type", label: "Transaction", on: true },
   { id: "fico-input", label: "Credit score", on: true },
   { id: "zip-code", label: "Location", on: true },
   { id: "modules", label: "Modules", on: true },
   { id: "calc-price", label: "Price", on: !isRefi },
   { id: "calc-down", label: "Down payment", on: !isRefi },
   { id: "get-rates", label: "Rate", on: true },
   { id: "calc-pills", label: "Loan structure", on: true },
   { id: "payment-breakdown", label: "Payment breakdown", on: true },
   { id: "closing-costs", label: "Closing costs", on: true },
   { id: "prepaids", label: "Prepaid expenses", on: true },
   { id: "credits", label: "Credits to buyer", on: true },
   { id: "assets", label: "Assets", on: true },
   { id: "debts", label: "Debts", on: true },
   { id: "reo", label: "Other property", on: ownsProperties },
   { id: "income", label: "Income", on: true },
   { id: "qualify", label: "Pre-qualified", on: true },
   { id: "tax", label: "Tax savings", on: true },
   { id: "equity", label: "Equity", on: true },
  ].filter(s => s.on);
  const groupOf = (f) => {
   if (f === "add-asset" || f === "assets-section") return "assets";
   if (f === "owns-properties-toggle" || f === "debts-section") return "debts";
   if (f === "reo-section") return "reo";
   if (f === "income-section") return "income";
   if (f === "qualify-section") return "qualify";
   if (f === "tax-filing") return "tax";
   if (f === "amort-section") return "equity";
   return f;
  };
  const total = ladder.length;
  if (!guideField) return { current: total, total, label: "All steps", done: true };
  const idx = ladder.findIndex(s => s.id === groupOf(guideField));
  if (idx === -1) return null;
  return { current: idx + 1, total, label: ladder[idx].label, done: false };
 })();
 // ── Real-time update highlighting ──
 const [changedFields, setChangedFields] = useState(new Set());
 const prevValsRef = useRef({});
 useEffect(() => {
  const vals = { salesPrice, downPct, rate, term, loanType, creditScore, hoa, annualIns };
  const changed = new Set();
  for (const [k, v] of Object.entries(vals)) {
   if (prevValsRef.current[k] !== undefined && prevValsRef.current[k] !== v) changed.add(k);
  }
  prevValsRef.current = vals;
  if (changed.size > 0) {
   setChangedFields(changed);
   const t = setTimeout(() => setChangedFields(new Set()), 1500);
   return () => clearTimeout(t);
  }
 }, [salesPrice, downPct, rate, term, loanType, creditScore, hoa, annualIns]);
 // Auto-advance: when a required field is completed, scroll to next field and focus its input
 const prevGuideRef = useRef(guideField);
 useEffect(() => {
  if (!guideField || guideField === prevGuideRef.current) { prevGuideRef.current = guideField; return; }
  const prev = prevGuideRef.current;
  prevGuideRef.current = guideField;
  // Only auto-advance if the previous field was on the same tab (user just completed something)
  if (!prev) return;
  // Steps whose anchor contains a text input the user should be dropped into.
  // Non-input steps (modules, get-rates, calc-pills, section banners) just
  // scroll into view — no focus steal.
  const inputFields = ["fico-input","zip-code","calc-price","calc-down","refi-current-rate","refi-current-balance","qualify-fico"];
  const timer = setTimeout(() => {
   const el = document.querySelector(`[data-field="${guideField}"]`);
   if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    if (inputFields.includes(guideField)) {
     setTimeout(() => {
      const inp = el.querySelector("input");
      if (inp) inp.focus();
     }, 300);
    }
   }
  }, 200);
  return () => clearTimeout(timer);
 }, [guideField]);
 // Scroll-to-bottom detection — marks current tab as complete + tracks 80% scroll for floating bar
 useEffect(() => {
  setScrolledPast80(false);
  scrolledPast80Ref.current = false;
  floatBarShownRef.current = false;
  const handleScroll = () => {
   if (scrolledPast80Ref.current) return; // Already past threshold, stop checking
   const el = document.documentElement;
   const scrollable = el.scrollHeight - el.clientHeight;
   if (scrollable < 100) { scrolledPast80Ref.current = true; setScrolledPast80(true); return; }
   const scrollPct = scrollable > 0 ? el.scrollTop / scrollable : 1;
   const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
   if (scrollPct >= 0.9 || atBottom) {
    scrolledPast80Ref.current = true;
    setScrolledPast80(true);
   }
   if (atBottom && tab !== "settings") markTabComplete(tab);
  };
  setTimeout(handleScroll, 200);
  window.addEventListener("scroll", handleScroll, { passive: true });
  return () => window.removeEventListener("scroll", handleScroll);
 }, [tab]); // Only reset on tab change, NOT on completedTabs change
 // ── Security: Auto-lock on inactivity ──
 useEffect(() => {
  if (!pinSet) return;
  const handleActivity = () => { lastActivity.current = Date.now(); };
  const events = ["mousedown","touchstart","keydown","scroll"];
  events.forEach(e => window.addEventListener(e, handleActivity, {passive:true}));
  lockTimer.current = setInterval(() => {
   if (Date.now() - lastActivity.current > autoLockMin * 60 * 1000 && !isLocked) setIsLocked(true);
  }, 10000);
  return () => { events.forEach(e => window.removeEventListener(e, handleActivity)); if (lockTimer.current) clearInterval(lockTimer.current); };
 }, [pinSet, autoLockMin, isLocked]);
 // Auth abstraction — swap to @capgo/capacitor-native-biometric for native
  const Auth = useRef({
  type: 'pin', // Future: 'biometric' | 'pin' | 'none'
  async verify(pin, storedPin) { return pin === storedPin; },
  async isAvailable() { return true; }
 });
 const handleUnlock = () => {
  if (pinInput === pinCode) { setIsLocked(false); setPinInput(""); setPinError(""); lastActivity.current = Date.now(); }
  else { setPinError("Incorrect PIN"); setPinInput(""); }
 };
 const handleSetPin = async () => {
  if (pinSetup && pinConfirm.length >= 4) {
   if (pinSetup === pinConfirm) {
    setPinCode(pinSetup); setPinSet(true); setPinSetup(false); setPinConfirm("");
    try { await LS.set("sec:pin", pinSetup); } catch(e) {}
   } else { setPinError("PINs don't match"); setPinConfirm(""); }
  }
 };
 const handleRemovePin = async () => {
  setPinCode(""); setPinSet(false); setIsLocked(false);
  try { await LS.delete("sec:pin"); } catch(e) {}
 };
 const handleConsent = async () => {
  setConsentGiven(true);
  try { await LS.set("sec:consent", "true"); } catch(e) {}
 };
 const handleClearAll = async () => {
  try {
   const keys = await LS.list("scenario:");
   if (keys?.keys) for (const k of keys.keys) { try { await LS.delete(k); } catch(e) {} }
   await LS.delete("scenario-list");
   await LS.delete("sec:pin");
   await LS.delete("sec:consent");
   await LS.delete("sec:autolock");
   await LS.delete("app:skillLevel");
   await LS.delete("app:completedTabs");
   await LS.delete("app:unlockAll");
   await LS.delete("app:gameMode");
   await LS.delete("course:progress");
   await LS.delete("has-seen-welcome");
   try { localStorage.removeItem("mb_welcomed"); } catch(e) {}
  } catch(e) {}
  setPinCode(""); setPinSet(false); setConsentGiven(false); setShowClearConfirm(false); setClearStep(0);
  window.location.reload();
 };
 // Auto-sync transfer tax city when property city or state changes
 useEffect(() => {
  const stateCities = getTTCitiesForState(propertyState);
  // If the property's city has its own city transfer tax, use it. Otherwise reset to
  // "Not listed" (rate 0) — most cities (e.g. Danville, CA) have NO city transfer tax,
  // so we must NOT leave a stale default city like "Alameda" applying a phantom rate.
  if (stateCities.includes(city)) setTransferTaxCity(city);
  else setTransferTaxCity("Not listed");
 }, [city, propertyState]);
 // Auto-fill city, state, county when zip code changes (transfer tax auto-synced by city/state effect above)
 useEffect(() => {
  if (propertyZip.length !== 5) return;
  const match = lookupZip(propertyZip);
  if (match) {
   setCity(match.city);
   setPropertyState(match.state);
   setPropertyCounty(match.county);
  }
 }, [propertyZip]);
 // Auto-sync locked tax rate when city/state changes
 useEffect(() => {
  if (!taxRateLocked) return;
  const autoRate = getAutoTaxRate(propertyState, city);
  setTaxBaseRateOverride(parseFloat((autoRate * 100).toFixed(4)));
 }, [city, propertyState, taxRateLocked]);
 // Auto-sync locked exemption when loanPurpose changes
 useEffect(() => {
  if (!taxExemptionLocked) return;
  const isPrimary = loanPurpose === "Purchase Primary" || loanPurpose === "Refi Rate/Term" || loanPurpose === "Refi Cash-Out";
  setTaxExemptionOverride(isPrimary ? 7000 : 0);
 }, [loanPurpose, taxExemptionLocked]);
 // Auto-switch to Jumbo when loan amount exceeds high-balance limit for unit count
 // Auto-sync refiHomeValue from salesPrice when in refi mode
 useEffect(() => { if (isRefi) setRefiHomeValue(salesPrice); }, [isRefi, salesPrice]);
 // Auto-inject current mortgage into Debts when switching to refi mode
 useEffect(() => {
  if (!isRefi) return;
  // Only add if no mortgage debt already exists
  const hasMortgage = debts.some(d => d.type === "Mortgage");
  if (!hasMortgage && (refiCurrentBalance > 0 || refiCurrentPayment > 0)) {
   setDebts(prev => [...prev, {
    id: Date.now(),
    name: "Current Mortgage",
    type: "Mortgage",
    balance: refiCurrentBalance || 0,
    monthly: refiCurrentPayment || 0,
    rate: refiCurrentRate || 0,
    months: refiRemainingMonths || 0,
    payoff: "Yes - at Escrow",
    linkedReoId: ""
   }]);
  }
 }, [isRefi]);
 // Auto-fill refi tax and insurance from setup values
 useEffect(() => {
  if (!isRefi) return;
  const autoRate = getAutoTaxRate(propertyState, city);
  const effRate = taxBaseRateOverride > 0 ? taxBaseRateOverride / 100 : autoRate;
  const rIsPrimary = loanPurpose === "Purchase Primary" || loanPurpose === "Refi Rate/Term" || loanPurpose === "Refi Cash-Out";
  const exempt = taxExemptionLocked ? (rIsPrimary ? 7000 : 0) : (taxExemptionOverride || 0);
  const yearlyTax = Math.max(0, salesPrice - exempt) * effRate + (fixedAssessments || 0);
  if (refiAnnualTax === 0 && yearlyTax > 0) setRefiAnnualTax(Math.round(yearlyTax));
  if (refiAnnualIns === 0 && annualIns > 0) setRefiAnnualIns(annualIns);
 }, [isRefi, salesPrice, city, propertyState, annualIns]);
 // Sync refi insurance to annualIns so Calculator and Costs tabs pick it up
 useEffect(() => {
  if (isRefi && refiAnnualIns > 0) setAnnualIns(refiAnnualIns);
 }, [isRefi, refiAnnualIns]);
 // Auto-set skip months based on closing day: ≤15th = skip 2, >15th = skip 1
 useEffect(() => {
  if (!isRefi) return;
  setRefiSkipMonths(closingDay <= 15 ? 2 : 1);
 }, [isRefi, closingDay]);
 // Auto-set closing date to today + 30 days for refi
 useEffect(() => {
  if (!isRefi) return;
  const d = new Date();
  d.setDate(d.getDate() + 30);
  setClosingMonth(d.getMonth() + 1);
  setClosingDay(d.getDate());
  setClosingYear(d.getFullYear());
 }, [isRefi]);
 // Auto-set Section C defaults for refi: flat escrow fee, zero title/search/settlement
 useEffect(() => {
  if (isRefi) {
   setTitleInsurance(0);
   setTitleSearch(0);
   setSettlementFee(0);
   setEscrowFee(1995);
   setAppraisalFee(595);
   // Refi uses a flat title/escrow fee — zero the itemized purchase-only lines
   setCourierFee(0);
   setLoanTieInFee(0);
   setNotaryFee(0);
   setEnvProtectionLien(0);
  } else {
   setTitleInsurance(2000);
   setTitleSearch(0);   // retired fee (2026-07-05)
   setSettlementFee(0); // retired fee (2026-07-05)
   setEscrowFee(2400);
   setAppraisalFee(850);
   setCourierFee(150);
   setLoanTieInFee(150);
   setNotaryFee(175);
   setEnvProtectionLien(100);
  }
 }, [isRefi]);
 useEffect(() => {
  const baseLoan = salesPrice * (1 - downPct / 100);
  const hbl = getHighBalLimit(propType);
  const userType = userLoanTypeRef.current;
  if ((userType === "Conventional") && baseLoan > hbl && loanType !== "Jumbo") {
   setLoanType("Jumbo");
   setAutoJumboSwitch(true);
  } else if (autoJumboSwitch && baseLoan <= hbl && loanType === "Jumbo") {
   setLoanType(userLoanTypeRef.current);
   setAutoJumboSwitch(false);
  }
 }, [salesPrice, downPct, propType]);
 const calc = useMemo(() => {
  const dp = salesPrice * downPct / 100;
  const baseLoan = salesPrice - dp;
  const ltv = computeLTV(baseLoan, salesPrice);
  const fhaUp = loanType === "FHA" ? baseLoan * 0.0175 : 0;
  const vaFFRate = vaFundingFeeRate(vaUsage, downPct);
  const autoVAFF = loanType === "VA" ? baseLoan * vaFFRate : 0;
  const vaFundingFee = (!vaFundingFeeLocked && vaFundingFeeOverride > 0) ? vaFundingFeeOverride : autoVAFF;
  const usdaFee = loanType === "USDA" ? baseLoan * 0.01 : 0;
  const loan = baseLoan + fhaUp + vaFundingFee + usdaFee;
  const mr = rate / 100 / 12, np = term * 12;
  const pi = calcPI(loan, rate, term);
  // ── Property Tax Calculator ──
  const autoTaxRate = getAutoTaxRate(propertyState, city);
  const taxRate = taxBaseRateOverride > 0 ? taxBaseRateOverride / 100 : autoTaxRate;
  const isPrimary = loanPurpose === "Purchase Primary" || loanPurpose === "Refi Rate/Term" || loanPurpose === "Refi Cash-Out";
  const exemption = taxExemptionLocked ? (isPrimary ? 7000 : 0) : (taxExemptionOverride || 0);
  const taxableValue = Math.max(0, salesPrice - exemption);
  const baseTax = taxableValue * taxRate;
  const yearlyFixedAssess = fixedAssessments || 0;
  const yearlyTax = baseTax + yearlyFixedAssess;
  const effectiveTaxRate = salesPrice > 0 ? yearlyTax / salesPrice : 0;
  const monthlyTax = yearlyTax / 12;
  const ins = annualIns / 12;
  // PMI chart overrides (LO-edited Radian matrix) take precedence over the
  // built-in matrix for the current LTV bucket; the per-scenario rate
  // override (pmiRateOverride) still wins over everything when unlocked.
  const pmiLtvPct = ltv * 100;
  const pmiBucket = pmiLtvPct > 95 ? 97 : pmiLtvPct > 90 ? 95 : pmiLtvPct > 85 ? 90 : 85;
  const pmiChartRate = pmiChartOverrides && pmiChartOverrides[pmiBucket] > 0 ? pmiChartOverrides[pmiBucket] / 100 : 0;
  const autoPmiRate = ltv > 0.80 ? (pmiChartRate || getPMIRate(ltv, creditScore)) : 0;
  const pmiRate = (!pmiRateLocked && pmiRateOverride > 0) ? pmiRateOverride / 100 : autoPmiRate;
  const monthlyPMI = loanType === "Conventional" ? (baseLoan * pmiRate) / 12 : 0;
  // FHA MIP: own HUD schedule (not the Radian PMI matrix). Rate by base
  // loan amount + LTV; charged on the base loan amount (consistent with
  // how conventional PMI and USDA MI are computed just above/below).
  const fhaMipRate = loanType === "FHA" ? getFHAMipRate(baseLoan, ltv) : 0;
  const monthlyMIP = loanType === "FHA" ? (baseLoan * fhaMipRate) / 12 : 0;
  const usdaMI = loanType === "USDA" ? (baseLoan * 0.0035) / 12 : 0;
  const monthlyMI = monthlyPMI + monthlyMIP + usdaMI;
  const escrowAmount = monthlyTax + ins;
  const housingPayment = pi + monthlyTax + ins + monthlyMI + hoa;
  const displayPayment = includeEscrow ? housingPayment : (pi + monthlyMI + hoa);
  // Income calc — honors user-picked Selection for variable pay (Bonus/Commission/RSU/etc.)
  // Selection values:
  //   "Amount"  — Amount × Frequency (fixed pay; salary)
  //   "YTD"     — legacy annualized-YTD only (kept for back-compat with
  //               older scenarios; not exposed in the new UI)
  //   "1Y+"    — 1-year average (last full year only)
  //   "2Y+"    — 2-year average ((py1 + py2) / 2)
  //   "1Y_YTD" — 1-year + YTD annualized blend ((py1 + ytdAnn) / 2)
  //   "2Y_YTD" — 2-year + YTD annualized blend ((py1+py2+ytdAnn) / 3)
  //   default for variable is "2Y+", for fixed is "Amount".
  const monthsElapsed = Math.max(1, new Date().getMonth() + 1);
  // Previous employers do NOT count toward qualifying income — that's
  // mortgage-broker convention. The Income tab still shows historical $/mo
  // next to the employer card for context, but the aggregation excludes them.
  // Christo (2026-05-12).
  //
  // Detection has to be at the EMPLOYER level, not the component level: a
  // group is "Previous" when ANY of its components has an `end` date stamped
  // (same rule the UI uses, IncomeContent.jsx line 711). Per-component
  // filtering would leak previous-employer salary when only one component
  // (e.g. an RSU vest schedule) had the end date.
  const previousEmployerKeys = new Set();
  incomes.forEach(i => {
   if (i.end && i.end !== "") previousEmployerKeys.add(`${i.borrower}::${i.source || ""}`);
  });
  const totalIncomeFromEntries = incomes.reduce((s, i) => {
   if (previousEmployerKeys.has(`${i.borrower}::${i.source || ""}`)) return s;
   const isVariable = VARIABLE_PAY_TYPES.includes(i.payType);
   const ytd = Number(i.ytd) || 0;
   const yr1 = Number(i.py1) || 0;
   const yr2 = Number(i.py2) || 0;
   const fromAmount = toMonthly(Number(i.amount) || 0, i.frequency);
   const sel = i.selection || (isVariable ? "2Y+" : "Amount");
   const ytdAnn = ytd > 0 ? (ytd * 12) / monthsElapsed : 0;

   if (sel === "Amount") return s + fromAmount;
   if (sel === "YTD") return s + (ytd > 0 ? (ytd * 12 / monthsElapsed) / 12 : 0);
   if (sel === "1Y+") return s + (yr1 > 0 ? yr1 / 12 : 0);
   if (sel === "2Y+") {
    const months = (yr1 > 0 ? 12 : 0) + (yr2 > 0 ? 12 : 0);
    if (months === 0) return s;
    return s + (yr1 + yr2) / months;
   }
   if (sel === "1Y_YTD") {
    // Average of last full year + annualized YTD, then /12 for monthly.
    return s + ((yr1 + ytdAnn) / 2) / 12;
   }
   if (sel === "2Y_YTD") {
    return s + ((yr1 + yr2 + ytdAnn) / 3) / 12;
   }
   // Legacy fallback: conservative auto-pick for variable pay (lower of yr1 vs 2yr-avg)
   if (isVariable) {
    if (yr1 > 0 && yr2 > 0) {
     const avg2 = (yr1 + yr2) / 2;
     return s + Math.min(yr1, avg2) / 12;
    }
    if (yr1 > 0) return s + yr1 / 12;
    if (yr2 > 0) return s + yr2 / 12;
    if (ytd > 0) return s + ytd / 12;
   }
   return s + fromAmount;
  }, 0);
  const monthlyIncome = totalIncomeFromEntries + otherIncome + otherIncome2;
  // REO DTI: Investment properties use 75% rental netting; Primary/Second Home full PITIA counted as debt
  // Only debts linked to INVESTMENT REOs are excluded from normal debt count
  const investmentReoIds = new Set(reos.filter(r => r.propUse === "Investment").map(r => String(r.id)));
  const reoLinkedDebtIds = new Set(debts.filter(d => d.linkedReoId && investmentReoIds.has(d.linkedReoId) && (d.type === "Mortgage" || d.type === "HELOC") && d.payoff !== "Yes - at Escrow" && d.payoff !== "Yes - POC" && d.payoff !== "Omit").map(d => d.id));
  // Investment properties: 75% of gross rent minus PITIA, netted together
  const reoInvestmentNet = reos.filter(r => r.propUse === "Investment").reduce((s, r) => {
   const grossRent75 = (Number(r.rentalIncome) || 0) * 0.75;
   const linkedDebts = debts.filter(d => d.linkedReoId === String(r.id) && d.payoff !== "Yes - at Escrow" && d.payoff !== "Yes - POC" && d.payoff !== "Omit");
   const linkedPayments = linkedDebts.reduce((sum, d) => sum + (Number(d.monthly) || 0), 0);
   const pitia = linkedDebts.length > 0 ? linkedPayments + (r.includesTI ? 0 : ((Number(r.reoTax)||0)+(Number(r.reoIns)||0)+(Number(r.reoHoa)||0))) : (Number(r.payment) || 0) + (r.includesTI ? 0 : ((Number(r.reoTax)||0)+(Number(r.reoIns)||0)+(Number(r.reoHoa)||0)));
   return s + (grossRent75 - pitia);
  }, 0);
  // Primary / Second Home: full PITIA as debt obligation (no rental offset)
  // Linked debts for these stay in qualifyingDebts; we only add supplemental T&I if not included
  const reoPrimaryDebt = reos.filter(r => r.propUse !== "Investment").reduce((s, r) => {
   const linkedDebts = debts.filter(d => d.linkedReoId === String(r.id) && d.payoff !== "Yes - at Escrow" && d.payoff !== "Yes - POC" && d.payoff !== "Omit");
   const extraTI = r.includesTI ? 0 : ((Number(r.reoTax)||0)+(Number(r.reoIns)||0)+(Number(r.reoHoa)||0));
   if (linkedDebts.length > 0) {
    // Linked debts already in qualifyingDebts — just add T&I supplement
    return s + extraTI;
   } else {
    // No linked debts — full payment + T&I
    return s + (Number(r.payment) || 0) + extraTI;
   }
  }, 0);
  const reoPositiveIncome = reoInvestmentNet > 0 ? reoInvestmentNet : 0;
  const reoNegativeDebt = (reoInvestmentNet < 0 ? Math.abs(reoInvestmentNet) : 0) + reoPrimaryDebt;
  // ── Subject Property Rental Income ──
  // Investment: 75% of rent offsets PITIA of subject property
  // Multi-unit Primary: 75% of non-occupying unit rents added as income
  const units = UNIT_COUNT[propType] || 1;
  const isInvestment = loanPurpose === "Purchase Investment";
  const isMultiUnitPrimary = loanPurpose === "Purchase Primary" && units > 1;
  const subjectRent75 = (subjectRentalIncome || 0) * 0.75;
  // Investment: net = 75% rent - PITIA. Positive = income, negative = debt (already captured in housingPayment)
  const investRentalOffset = isInvestment ? subjectRent75 : 0;
  // Multi-unit primary: 75% of non-occupying rents added as qualifying income
  const multiUnitRentalIncome = isMultiUnitPrimary ? subjectRent75 : 0;
  const qualifyingIncome = monthlyIncome + reoPositiveIncome + multiUnitRentalIncome + (investRentalOffset > 0 ? investRentalOffset : 0);
  const annualIncome = qualifyingIncome * 12;
  const totalAssetValue = assets.reduce((s, a) => s + (a.value || 0), 0);
  const totalForClosing = assets.reduce((s, a) => s + (a.forClosing || 0), 0);
  const totalReserves = assets.reduce((s, a) => {
   const rf = getReserveFactor(a.type, loanType);
   const remainingValue = Math.max(0, (a.value || 0) - (a.forClosing || 0));
   return s + (remainingValue * rf);
  }, 0);
  const addDebt = (type) => setDebts(prev => [...prev, { id: Date.now(), name: "", type, borrower: "Joint", balance: 0, monthly: 0, rate: 0, months: 0, payoff: "No", payoffAmount: 0, linkedReoId: "" }]);
  const updateDebt = (id, f, v) => setDebts(prev => prev.map(d => d.id === id ? { ...d, [f]: v } : d));
  const removeDebt = (id) => setDebts(prev => prev.filter(d => d.id !== id));
  const qualifyingDebts = debtFree ? [] : debts.filter(d => d.payoff !== "Yes - at Escrow" && d.payoff !== "Yes - POC" && d.payoff !== "Omit" && !reoLinkedDebtIds.has(d.id));
  const totalMonthlyDebts = qualifyingDebts.reduce((s, d) => s + (d.monthly || 0), 0);
  const payoffAtClosing = debtFree ? 0 : debts.filter(d => d.payoff === "Yes - at Escrow").reduce((s, d) => s + (d.balance || 0), 0);
  // For investment properties, 75% rent offsets housing payment in DTI
  const effectiveHousingForDTI = isInvestment ? Math.max(0, housingPayment - subjectRent75) : housingPayment;
  const totalPayment = effectiveHousingForDTI + totalMonthlyDebts + reoNegativeDebt;
  const confLimit = getConfLimit(propType), highBalLimit = getHighBalLimit(propType);
  const loanCategory = baseLoan <= confLimit ? "Conforming" : baseLoan <= highBalLimit ? "High Balance" : "Jumbo";
  const maxDTI = MAX_DTI[loanType] || 0.50;
  const yourDTI = computeDTI(totalPayment, qualifyingIncome); // fraction (0.43 = 43%) or null
  // ── Refi current-loan math — moved ABOVE the fee section (2026-07-05) so
  //    refiNewLoanAmt exists when points + prepaid interest are computed.
  //    Previously those used the purchase `loan` even in refi mode. ──
  const refiOrigNp = refiOriginalTerm * 12;
  const refiOrigMr = (refiCurrentRate / 100) / 12;
  const refiCalcPI = calcPI(refiOriginalAmount, refiCurrentRate, refiOriginalTerm);
  const refiMonthsElapsed = (() => {
   if (!refiClosedDate) return 0;
   const cd = new Date(refiClosedDate + "T00:00:00");
   if (isNaN(cd)) return 0;
   const now = new Date();
   return Math.max(0, (now.getFullYear() - cd.getFullYear()) * 12 + (now.getMonth() - cd.getMonth()));
  })();
  const refiCalcRemainingMonths = Math.max(0, refiOrigNp - refiMonthsElapsed);
  const refiCalcBalance = (() => {
   if (refiOriginalAmount <= 0 || refiCalcPI <= 0) return 0;
   let bal = refiOriginalAmount;
   const pmtWithExtra = refiCalcPI + (refiExtraPaid || 0);
   for (let m = 0; m < refiMonthsElapsed && bal > 0; m++) {
    const intPmt = bal * refiOrigMr;
    bal -= (pmtWithExtra - intPmt);
   }
   return Math.max(0, bal);
  })();
  const refiMinBalance = (() => {
   if (refiOriginalAmount <= 0 || refiCalcPI <= 0) return 0;
   let bal = refiOriginalAmount;
   for (let m = 0; m < refiMonthsElapsed && bal > 0; m++) {
    const intPmt = bal * refiOrigMr;
    bal -= (refiCalcPI - intPmt);
   }
   return Math.max(0, bal);
  })();
  const refiEffPI = refiOriginalAmount > 0 ? refiCalcPI : refiCurrentPayment;
  const refiEffBalance = refiOriginalAmount > 0 && refiClosedDate ? refiCalcBalance : refiCurrentBalance;
  const refiEffRemaining = refiClosedDate ? refiCalcRemainingMonths : refiRemainingMonths;
  const refiCurMr = (refiCurrentRate / 100) / 12;
  const refiCurEscrowEffective = (refiAnnualTax > 0 || refiAnnualIns > 0) ? (refiAnnualTax + refiAnnualIns) / 12 : refiCurrentEscrow;
  const refiCurMonthlyTax = refiAnnualTax > 0 ? refiAnnualTax / 12 : (refiCurEscrowEffective > 0 ? refiCurEscrowEffective * 0.6 : 0);
  const refiCurMonthlyIns = refiAnnualIns > 0 ? refiAnnualIns / 12 : (refiCurEscrowEffective > 0 ? refiCurEscrowEffective * 0.4 : 0);
  const refiCurTotalPmt = refiEffPI + (refiHasEscrow ? refiCurEscrowEffective : 0) + refiCurrentMI;
  const refiCurIntThisMonth = refiEffBalance * refiCurMr;
  const refiCurPrinThisMonth = refiEffPI - refiCurIntThisMonth;
  const refiCurRemainingInt = (() => { if (!isRefi || refiEffPI <= 0) return 0; let bal = refiEffBalance, total = 0; for (let m = 0; m < refiEffRemaining && bal > 0; m++) { const intPmt = bal * refiCurMr; total += intPmt; bal -= (refiEffPI - intPmt); } return total; })();
  const refiCurTotalRemaining = refiCurRemainingInt + refiEffBalance;
  const refiCurTotalCostRemaining = refiEffPI * refiEffRemaining;
  const refiCurLTV = refiHomeValue > 0 ? refiEffBalance / refiHomeValue : 0;
  const refiAutoLoanAmt = refiPurpose === "Cash-Out" ? (refiEffBalance + refiCashOut) : refiEffBalance;
  const refiNewLoanAmt = refiNewLoanAmtOverride > 0 ? refiNewLoanAmtOverride : refiAutoLoanAmt;
  // Loan basis for $-fees that scale with the loan: refi uses the NEW refi
  // loan amount; purchase uses the purchase loan.
  const feeLoanBasis = isRefi ? (refiNewLoanAmt || loan) : loan;
  const ttEntry = getTTForCity(transferTaxCity, salesPrice);
  const isSF = ttEntry.sfSeller === true;
  // Two independent splits — buyer's share of city vs county.
  const cityBuyerShare = transferTaxSplit === "buyer" ? 1.0 : transferTaxSplit === "seller" ? 0.0 : 0.5;
  const countyBuyerShare = transferTaxCountySplit === "buyer" ? 1.0 : transferTaxCountySplit === "seller" ? 0.0 : 0.5;
  // CA Documentary Transfer Tax: $1.10 per $1,000 of sale price, statewide. Other states currently 0 (CA-focused for now).
  const countyTTRate = propertyState === "California" ? 1.10 : 0;
  const buyerCityTT = isRefi ? 0 : (salesPrice / 1000 * ttEntry.rate) * cityBuyerShare;
  const buyerCountyTT = isRefi ? 0 : (salesPrice / 1000 * countyTTRate) * countyBuyerShare;
  // Custom LO fees roll into their section subtotals.
  const customFeeSum = (sec) => (customFees || []).reduce((t, f) => t + (f.section === sec ? (f.amount || 0) : 0), 0);
  const pointsCost = feeLoanBasis * (discountPts / 100);
  const origCharges = underwritingFee + adminFee + lenderWireFee + pointsCost + originatorComp + customFeeSum('A');
  const hoaCert = (!isRefi && (propType === "Condo" || propType === "Townhouse")) ? 500 : 0;
  const cannotShop = appraisalFee + creditReportFee + floodCertFee + mersFee + processingFee + taxServiceFee + customFeeSum('B');
  // Title Search + Settlement Agent Fee removed from defaults (Christo
  // 2026-07-05) — state vars remain for old saved scenarios but no longer
  // count toward totals or render anywhere.
  const titleEscrowTotal = titleInsurance + escrowFee + courierFee + loanTieInFee + notaryFee + envProtectionLien;
  const canShop = titleEscrowTotal + hoaCert + customFeeSum('C');
  const govCharges = buyerCityTT + buyerCountyTT + recordingFee + customFeeSum('E');
  const buyerCommAmt = buyerPaysComm ? salesPrice * (buyerCommPct / 100) : 0;
  const hoaTransferActual = hoa > 0 ? (hoaTransferFee > 0 ? hoaTransferFee : hoa) : 0;
  const sectionH = (isRefi ? 0 : ownersTitleIns) + (isRefi ? 0 : homeWarranty) + (isRefi ? 0 : hoaTransferActual) + buyerCommAmt + customFeeSum('H');
  const totalClosingCosts = origCharges + cannotShop + canShop + govCharges + sectionH;
  const closeYear = closingYear || new Date().getFullYear();
  const closeDate = new Date(closeYear, closingMonth - 1, closingDay);
  const daysInCloseMonth = new Date(closeYear, closingMonth, 0).getDate();
  const daysToMonthEnd = daysInCloseMonth - closingDay;
  const autoPrepaidDays = daysToMonthEnd + 1;
  const dailyInt = (feeLoanBasis * rate / 100) / 365;
  const prepaidInt = dailyInt * autoPrepaidDays;
  const prepaidIns = annualIns;
  const daysToYearEnd = Math.ceil((new Date(closeDate.getFullYear(), 11, 31) - closeDate) / (1000 * 60 * 60 * 24));
  const sellerProration = 0;
  // Section F now includes: prepaid interest + 12mo insurance + property tax installment
  // − sellers prorated tax credit (stored as positive, applied as negative).
  // Old single "Property Taxes" row in Section F was display-only (already counted in
  // initialEscrow / Section G), so removing it doesn't affect totals.
  const totalPrepaids = prepaidInt + prepaidIns + propertyTaxesInstallment - sellersProratedTaxCredit;
  const closeMonth = closingMonth;
  const escrowTaxMonths = (closeMonth >= 3 && closeMonth <= 9) ? closeMonth : 7;
  const escrowInsMonths = 3;
  const initialEscrow = includeEscrow ? (monthlyTax * escrowTaxMonths) + (ins * escrowInsMonths) : 0;
  const totalPrepaidExp = totalPrepaids + initialEscrow;
  // EMD: a % of price, only credited toward cash-to-close once it's actually been paid to escrow.
  const emdAmt = isRefi ? 0 : (!emdLocked && emdFlat > 0 ? emdFlat : salesPrice * (emdPct / 100));
  const emdCredit = (!isRefi && emdPaid) ? emdAmt : 0;
  const totalCredits = (isRefi ? lenderCredit : (sellerCredit + realtorCredit + emdCredit + lenderCredit)) + customFeeSum('CR');
  const cashToClose = (isRefi ? 0 : dp) + totalClosingCosts + totalPrepaidExp + payoffAtClosing - totalCredits;
  const ficoMin = loanType === "FHA" ? 580 : loanType === "Jumbo" ? 700 : loanType === "VA" ? 580 : 620;
  const ficoCheck = creditScore > 0 ? (creditScore >= ficoMin ? "Good!" : "Too Low") : "—";
  const minDPpct = loanType === "VA" ? 0 : loanType === "FHA" ? 3.5 : loanType === "Jumbo" ? 20 : (firstTimeBuyer && loanCategory === "Conforming") ? 3 : 5;
  const recDPpct = minDPpct;
  const dpWarning = downPct < minDPpct ? "fail" : null;
  const dtiCheck = qualifyingIncome > 0 && yourDTI !== null ? (yourDTI <= maxDTI ? "Good!" : "Too High") : "—";
  const cashCheck = totalForClosing > 0 ? (totalForClosing >= cashToClose ? "Good!" : "Short") : "—";
  const reserveMonths = loanType === "Jumbo" ? 12 : (isRefi ? 0 : 3);
  const reservesReq = totalPayment * reserveMonths;
  const resCheck = totalReserves > 0 ? (totalReserves >= reservesReq ? "Good!" : "Short") : "—";
  const yearlyInc = annualIncome;
  // Tax-savings engine extracted to lib/finance.js (audit M-1) — year-1 estimate.
  const {
   fedStdDeduction, stStdDeduction, fedPropTax, saltCap, mortIntDeductLimit,
   totalMortInt, deductibleLoanPct, fedMortInt, fedItemized, stateMortInt, stateItemized,
   fedTaxBefore, fedTaxAfter, fedSavings, stateTaxBefore, stateTaxAfter, stateSavings,
   totalTaxSavings, fedDelta, fedItemizes, stateDelta, stateItemizes,
   fedWaterfall, stWaterfall, fedTopRate, stTopRate, combinedTopRate,
   fedTaxableBeforeDelta, stTaxableBeforeDelta,
  } = computeTaxSavings({ yearlyInc, married, taxState, yearlyTax, loan, rate });
  const monthlyTaxSavings = totalTaxSavings / 12;
  const afterTaxPayment = housingPayment - monthlyTaxSavings;
  const monthlyPrinReduction = pi - (loan * mr);
  const monthlyAppreciation = salesPrice * (appreciationRate / 100) / 12;
  // ── Schedule E (Investment Property) Pro Forma ──
  const schedEGrossRent = subjectRentalIncome * 12;
  const schedEVacancy = Math.round(schedEGrossRent * 0.05);
  const schedEGrossIncome = schedEGrossRent - schedEVacancy;
  const schedEDepreciation = Math.round((salesPrice * 0.8) / 27.5); // 80% building / 27.5yr
  const schedEMgmt = Math.round(schedEGrossIncome * 0.10); // 10% management + maintenance
  const yearlyMortInt = totalMortInt;
  const yearlyIns = ins * 12;
  const schedECashExpenses = yearlyTax + yearlyIns + (hoa * 12) + (monthlyMI * 12) + schedEMgmt;
  const schedETotalExpenses = schedECashExpenses + yearlyMortInt + schedEDepreciation;
  const schedENetIncome = schedEGrossIncome - schedETotalExpenses;
  const schedECashFlow = schedEGrossIncome - schedECashExpenses - (pi * 12);
  const netPostSaleExpense = afterTaxPayment - monthlyPrinReduction - monthlyAppreciation;
  const refiNewMr = mr;
  const refiNewPi = calcPI(refiNewLoanAmt, rate, term);
  const refiNewMonthlyTax = refiAnnualTax > 0 ? refiAnnualTax / 12 : yearlyTax / 12;
  const refiNewMonthlyIns = refiAnnualIns > 0 ? refiAnnualIns / 12 : (salesPrice * 0.0035 / 12);
  const refiNewEscrow = refiNewMonthlyTax + refiNewMonthlyIns;
  const refiNewMI = (() => { if (refiHomeValue <= 0) return monthlyMI; const ltv = refiNewLoanAmt / refiHomeValue; if (loanType === "Conventional" && ltv <= 0.80) return 0; return monthlyMI; })();
  const refiNewTotalPmt = refiNewPi + (refiHasEscrow ? refiNewEscrow : 0) + refiNewMI;
  const refiNewIntThisMonth = refiNewLoanAmt * refiNewMr;
  const refiNewPrinThisMonth = refiNewPi - refiNewIntThisMonth;
  const refiNewTotalInt = (() => { if (refiNewPi <= 0) return 0; let bal = refiNewLoanAmt, total = 0; for (let m = 0; m < np && bal > 0; m++) { const intPmt = bal * refiNewMr; total += intPmt; bal -= (refiNewPi - intPmt); } return total; })();
  const refiNewTotalCost = refiNewPi * np + totalClosingCosts;
  const refiNewLTV = refiHomeValue > 0 ? refiNewLoanAmt / refiHomeValue : 0;
  const refiMonthlySavings = isRefi ? (refiEffPI - refiNewPi) : 0;
  const refiMonthlyTotalSavings = isRefi ? (refiCurTotalPmt - refiNewTotalPmt) : 0;
  const refiIntSavings = refiCurRemainingInt - refiNewTotalInt;
  const refiBreakevenMonths = refiMonthlySavings > 0 ? Math.ceil(totalClosingCosts / refiMonthlySavings) : 0;
  // ── Net Cash Out ──
  const refiNetNewLoan = refiNewLoanAmt;
  const refiNetClosingCosts = totalClosingCosts;
  const refiNetPrepaids = totalPrepaidExp;
  const refiNetPayoff = refiEffBalance;
  const refiEstCashOut = refiNetNewLoan - refiNetClosingCosts - refiNetPrepaids - refiNetPayoff;
  const refiSkipPmtAmt = refiCurTotalPmt * (refiSkipMonths || 0);
  const refiEscrowRefund = refiEscrowBalance || 0;
  const refiNetCashInHand = refiEstCashOut + refiSkipPmtAmt + refiEscrowRefund;
  // ── Cost of Waiting Matrix ──
  const refiCostOfWaiting = (() => {
   if (!isRefi || refiMonthlySavings <= 0) return [];
   const waitYears = [1, 2, 3, 4];
   const rateDrops = [0.125, 0.25, 0.5, 1.0];
   return rateDrops.map(drop => {
    const futureRate = (rate || 0) - drop;
    const futureMr = futureRate > 0 ? (futureRate / 100) / 12 : 0;
    const futurePi = calcPI(refiNewLoanAmt, futureRate, term);
    const futureSavings = refiNewPi - futurePi;
    return {
     drop,
     years: waitYears.map(y => {
      const lostSavings = refiMonthlySavings * y * 12;
      const breakeven = futureSavings > 0 ? Math.ceil(lostSavings / futureSavings) : 999;
      return { lostSavings, breakeven };
     })
    };
   });
  })();
  const refiLifetimeSavings = refiCurTotalCostRemaining - refiNewTotalCost;
  const refiAmortCompare = (() => {
   if (!isRefi || refiNewPi <= 0) return [];
   let curBal = refiEffBalance, newBal = refiNewLoanAmt;
   let curIntYr = 0, newIntYr = 0, curPrinYr = 0, newPrinYr = 0;
   const rows = []; const maxMonths = Math.max(refiEffRemaining, np);
   for (let m = 1; m <= maxMonths; m++) {
    if (curBal > 0) { const ci = curBal * refiCurMr; const cp = Math.min(refiEffPI - ci, curBal); curIntYr += ci; curPrinYr += cp; curBal -= cp; }
    if (newBal > 0) { const ni = newBal * refiNewMr; const nprin = Math.min(refiNewPi - ni, newBal); newIntYr += ni; newPrinYr += nprin; newBal -= nprin; }
    if (m % 12 === 0 || m === maxMonths) {
     rows.push({ year: Math.ceil(m / 12), curBal: Math.max(0, curBal), newBal: Math.max(0, newBal), curInt: curIntYr, newInt: newIntYr, curPrin: curPrinYr, newPrin: newPrinYr });
     curIntYr = 0; newIntYr = 0; curPrinYr = 0; newPrinYr = 0;
    }
   }
   return rows;
  })();
  const refiRateDrop = refiCurrentRate - (rate || 0);
  const refiTest1Pass = isRefi && refiCurrentRate > 0 ? refiRateDrop >= 0.50 : null;
  const refiTest2Pass = isRefi && refiBreakevenMonths > 0 ? refiBreakevenMonths <= 24 : isRefi && refiMonthlySavings <= 0 ? false : null;
  const refiAccelPayoff = (() => {
   if (!isRefi || refiNewPi <= 0 || refiMonthlySavings <= 0) return { newPayoffMos: 0, curPayoffMos: refiEffRemaining, yearsFaster: 0 };
   let curBal = refiEffBalance, curMos = 0;
   while (curBal > 0.01 && curMos < 600) { const ci = curBal * refiCurMr; curBal -= (refiEffPI - ci); curMos++; }
   let newBal = refiNewLoanAmt, newMos = 0;
   const extraPrin = refiMonthlySavings;
   while (newBal > 0.01 && newMos < 600) { const ni = newBal * refiNewMr; const totalPmt = refiNewPi + extraPrin; newBal -= (totalPmt - ni); newMos++; }
   const yearsFaster = (curMos - newMos) / 12;
   return { newPayoffMos: newMos, curPayoffMos: curMos, yearsFaster };
  })();
  const refiTest3Pass = isRefi && refiAccelPayoff.yearsFaster > 0 ? refiAccelPayoff.yearsFaster >= 1 : isRefi && refiMonthlySavings > 0 ? false : null;
  const refiTestScore = [refiTest1Pass, refiTest2Pass, refiTest3Pass].filter(t => t === true).length;
  const reoTotalValue = reos.reduce((s, r) => s + (Number(r.value) || 0), 0);
  const reoTotalDebt = reos.reduce((s, r) => s + (Number(r.mortgageBalance) || 0), 0);
  const reoTotalEquity = reoTotalValue - reoTotalDebt;
  const reoTotalPayments = reos.reduce((s, r) => s + (Number(r.payment) || 0), 0);
  const reoTotalIncome = reos.reduce((s, r) => s + (Number(r.rentalIncome) || 0), 0);
  const reoNetCashFlow = reoTotalIncome - reoTotalPayments;
  const sellTTEntry = getTTForCity(sellTransferTaxCity, sellPrice);
  const sellIsSF = sellTTEntry.sfSeller === true;
  const sellCityTT = sellPrice / 1000 * sellTTEntry.rate;
  const sellCountyTT = sellPrice / 1000 * 1.1;
  const sellTotalTT = sellCountyTT + (sellIsSF ? sellCityTT : sellCityTT * 0.5);
  const sellCommAmt = sellPrice * (sellCommission / 100);
  const sellTotalCosts = sellCommAmt + sellTotalTT + sellEscrow + sellTitle + sellOther + sellSellerCredit + 525;
  const sellNetProceeds = sellPrice - sellMortgagePayoff - sellTotalCosts - sellProration;
  const sellAdjBasis = sellCostBasis + sellImprovements;
  const sellGrossGain = sellPrice - sellAdjBasis - sellTotalCosts;
  const sellExclusionLimit = (sellPrimaryRes && sellYearsOwned >= 2) ? (married === "MFJ" ? 500000 : 250000) : 0;
  const sellTaxableGain = Math.max(0, sellGrossGain - sellExclusionLimit);
  const sellIsLongTerm = sellYearsOwned >= 1;
  const fedLTCGRate = (() => {
   if (!sellIsLongTerm) return null;
   const ltThresholds = married === "MFJ" ? [98900, 613700] : married === "HOH" ? [66200, 579600] : married === "MFS" ? [49450, 306850] : [49450, 545500];
   const yearlyIncome = annualIncome || 0;
   if (yearlyIncome + sellTaxableGain <= ltThresholds[0]) return 0;
   if (yearlyIncome + sellTaxableGain <= ltThresholds[1]) return 0.15;
   return 0.20;
  })();
  const niitThreshold = married === "MFJ" ? 250000 : married === "MFS" ? 125000 : 200000;
  const sellNIIT = (annualIncome + sellTaxableGain > niitThreshold && sellTaxableGain > 0) ? sellTaxableGain * 0.038 : 0;
  const sellFedCapGainsTax = sellTaxableGain > 0 ? (sellIsLongTerm ? sellTaxableGain * (fedLTCGRate || 0) : 0) + sellNIIT : 0;
  const sellStateCapGainsRate = (() => {
   const st = STATE_TAX[taxState];
   if (!st || st.type === "none") return 0;
   if (st.type === "flat") return st.rate;
   const totalInc = (annualIncome || 0) + sellTaxableGain;
   const brackets = st[married === "MFJ" ? "m" : "s"] || [];
   let margRate = 0;
   for (const b of brackets) { if (totalInc > b.from) margRate = b.rate; }
   return margRate;
  })();
  const sellStateCapGainsTax = sellTaxableGain * sellStateCapGainsRate;
  const sellTotalCapGainsTax = sellFedCapGainsTax + sellStateCapGainsTax;
  const sellNetAfterTax = sellNetProceeds - sellTotalCapGainsTax;
  // ── Net sale proceeds available as an asset toward the new purchase ──
  // When "Selling a Property" is on, the after-tax net proceeds become liquid cash the buyer
  // can apply to closing. We surface it as a read-only asset row and fold it into the asset
  // totals + cash check (fully allocated to closing → adds nothing to reserves).
  const saleProceedsAsset = (hasSellProperty && sellNetAfterTax > 0) ? Math.round(sellNetAfterTax) : 0;
  const totalAssetValueAll = totalAssetValue + saleProceedsAsset;
  const totalForClosingAll = totalForClosing + saleProceedsAsset;
  const cashCheckAll = totalForClosingAll > 0 ? (totalForClosingAll >= cashToClose ? "Good!" : "Short") : "—";
  // ── APR Calculation ──
  // APR includes all finance charges: origination, discount points, MI upfront, prepaid interest
  // Excluded per TILA: appraisal, title, escrow, recording, credit report, flood cert
  const aprFinanceCharges = (pointsCost || 0) + (fhaUp || 0) + (vaFundingFee || 0) + (usdaFee || 0) + (underwritingFee || 0) + (adminFee || 0) + (lenderWireFee || 0) + (processingFee || 0);
  const apr = calcAPR(loan, rate, term, aprFinanceCharges);
  const extra = payExtra ? extraPayment : 0;
  // Amortization engine extracted to lib/finance.js (audit M-1).
  const { amortSchedule, amortStandard, totalIntWithExtra, totalIntStandard, yearlyData, intSaved, monthsSaved, lastPayDate, firstPayDate } =
   buildAmortization({ loan, mr, np, pi, extra, closeDate });
  // In refi mode, override displayPayment to use the new refi P&I so donut matches "New" box
  const finalDisplayPayment = (isRefi && refiNewLoanAmt > 0)
   ? (includeEscrow ? (refiNewPi + refiNewMonthlyTax + refiNewMonthlyIns + refiNewMI + hoa) : (refiNewPi + refiNewMI + hoa))
   : displayPayment;
  return {
   dp, baseLoan, loan, fhaUp, vaFundingFee, autoVAFF, vaFFRate, usdaFee, ltv, pi, ins, yearlyTax, monthlyTax, pmiRate, autoPmiRate, monthlyPMI, monthlyMIP, fhaMipRate, usdaMI, monthlyMI,
   taxRate, autoTaxRate, taxableValue, baseTax, yearlyFixedAssess, effectiveTaxRate, exemption,
   housingPayment, displayPayment: finalDisplayPayment, escrowAmount, monthlyIncome, employmentMonthlyIncome: totalIncomeFromEntries, qualifyingIncome, reoPositiveIncome, reoNegativeDebt, reoPrimaryDebt, reoInvestmentNet, annualIncome, totalAssetValue: totalAssetValueAll, totalForClosing: totalForClosingAll, totalReserves, saleProceedsAsset,
   subjectRent75, investRentalOffset, multiUnitRentalIncome, effectiveHousingForDTI, isInvestment, isMultiUnitPrimary,
   qualifyingDebts, totalMonthlyDebts, reoLinkedDebtIds, payoffAtClosing, totalPayment, addDebt, updateDebt, removeDebt,
   confLimit, highBalLimit, loanCategory, maxDTI, yourDTI,
   ttEntry, buyerCityTT, buyerCountyTT, countyTTRate, pointsCost, origCharges, hoaCert, cannotShop, canShop, titleEscrowTotal,
   govCharges, sectionH, buyerCommAmt, hoaTransferActual, totalClosingCosts, dailyInt, prepaidInt, prepaidIns, sellerProration, autoPrepaidDays,
   totalPrepaids, initialEscrow, escrowTaxMonths, escrowInsMonths, closeMonth, totalPrepaidExp, totalCredits, cashToClose, emdAmt, emdCredit,
   reserveMonths, reservesReq, ficoMin, ficoCheck, dtiCheck, cashCheck: cashCheckAll, resCheck, minDPpct, recDPpct, dpWarning,
   yearlyInc, fedStdDeduction, stStdDeduction, fedPropTax, saltCap, mortIntDeductLimit, totalMortInt, deductibleLoanPct, fedMortInt, fedItemized,
   stateMortInt, stateItemized, fedTaxBefore, fedTaxAfter, fedSavings,
   stateTaxBefore, stateTaxAfter, stateSavings, totalTaxSavings, monthlyTaxSavings,
   fedDelta, fedItemizes, stateDelta, stateItemizes, fedWaterfall, stWaterfall, fedTopRate, stTopRate, combinedTopRate,
   fedTaxableBeforeDelta, stTaxableBeforeDelta,
   afterTaxPayment, monthlyPrinReduction, monthlyAppreciation, netPostSaleExpense,
   schedEGrossIncome, schedEDepreciation, schedEMgmt, schedECashExpenses, schedETotalExpenses, schedENetIncome, schedECashFlow,
   yearlyMortInt, yearlyIns, monthlyHOA: hoa,
   refiCalcPI, refiMonthsElapsed, refiCalcRemainingMonths, refiCalcBalance, refiMinBalance,
   refiEffPI, refiEffBalance, refiEffRemaining,
   refiCurMr, refiCurTotalPmt, refiCurIntThisMonth, refiCurPrinThisMonth,
   refiCurMonthlyTax, refiCurMonthlyIns, refiCurEscrowEffective,
   refiNewMonthlyTax, refiNewMonthlyIns,
   refiCurRemainingInt, refiCurTotalRemaining, refiCurTotalCostRemaining, refiCurLTV,
   refiAutoLoanAmt, refiNewLoanAmt, refiNewPi, refiNewEscrow, refiNewMI, refiNewTotalPmt,
   refiNewIntThisMonth, refiNewPrinThisMonth, refiNewTotalInt, refiNewTotalCost, refiNewLTV,
   refiMonthlySavings, refiMonthlyTotalSavings, refiIntSavings,
   refiBreakevenMonths, refiLifetimeSavings, refiAmortCompare,
   refiEstCashOut, refiSkipPmtAmt, refiEscrowRefund, refiNetCashInHand,
   refiNetClosingCosts, refiNetPrepaids, refiNetPayoff, refiNetNewLoan,
   refiCostOfWaiting,

   refiRateDrop, refiTest1Pass, refiTest2Pass, refiTest3Pass, refiAccelPayoff, refiTestScore,
   reoTotalValue, reoTotalDebt, reoTotalEquity, reoTotalPayments, reoTotalIncome, reoNetCashFlow,
   sellTTEntry, sellTotalTT, sellCommAmt, sellTotalCosts, sellNetProceeds,
   sellAdjBasis, sellGrossGain, sellExclusionLimit, sellTaxableGain, sellIsLongTerm,
   fedLTCGRate, sellNIIT, sellFedCapGainsTax, sellStateCapGainsRate, sellStateCapGainsTax,
   sellTotalCapGainsTax, sellNetAfterTax,
   apr, aprFinanceCharges,
   amortSchedule, amortStandard, yearlyData, totalIntWithExtra, totalIntStandard,
   intSaved, monthsSaved, lastPayDate, closeDate, firstPayDate, mr, np, extra,
  };
 }, [salesPrice, downPct, rate, term, loanType, vaUsage, propType, loanPurpose, city, propertyState, hoa, annualIns, includeEscrow, subjectRentalIncome,
  propTaxMode, taxBaseRateOverride, fixedAssessments, taxExemptionOverride, taxRateLocked, taxExemptionLocked,
  transferTaxCity, transferTaxSplit, transferTaxCountySplit, discountPts, adminFee, lenderWireFee, underwritingFee, processingFee, appraisalFee, creditReportFee, floodCertFee, mersFee, taxServiceFee, titleInsurance, titleSearch, settlementFee, escrowFee, courierFee, loanTieInFee, notaryFee, envProtectionLien, recordingFee, lenderCredit, sellerCredit, realtorCredit, emd, emdPct, emdPaid, emdLocked, emdFlat,
  customFees, hiddenFees,
  sellerTaxBasis, prepaidDays, coeDays, closingMonth, closingDay, closingYear, debts, married, taxState, appreciationRate,
  sellPrice, sellMortgagePayoff, sellCommission, sellTransferTaxCity,
  sellEscrow, sellTitle, sellOther, sellSellerCredit, sellProration,
  sellCostBasis, sellImprovements, sellPrimaryRes, sellYearsOwned,
  incomes, otherIncome, otherIncome2, assets, payExtra, extraPayment, creditScore, pmiRateLocked, pmiRateOverride, pmiChartOverrides, vaFundingFeeLocked, vaFundingFeeOverride,
  isRefi, reos, refiCurrentRate, refiCurrentBalance, refiCurrentPayment, refiRemainingMonths, refiCashOut,
  refiCurrentEscrow, refiCurrentMI, refiCurrentLoanType, refiHomeValue, refiOriginalAmount, refiOriginalTerm, refiPurpose,
  refiClosedDate, refiExtraPaid, refiAnnualTax, refiAnnualIns, refiHasEscrow, refiEscrowBalance, refiSkipMonths, refiNewLoanAmtOverride]);
 // === INVESTMENT PROPERTY CALCULATIONS ===
 const invCalc = useMemo(() => {
  const annualRent = invMonthlyRent * 12;
  const vacancyLoss = annualRent * invVacancy / 100;
  const egi = annualRent - vacancyLoss;
  const annualTax = calc.yearlyTax;
  const invAnnualIns = calc.ins * 12;
  const annualHOA = hoa * 12;
  const annualMgmt = egi * invMgmt / 100;
  const annualMaint = salesPrice * invMaintPct / 100;
  const annualCapEx = salesPrice * invCapEx / 100;
  const totalOpEx = annualTax + invAnnualIns + annualHOA + annualMgmt + annualMaint + annualCapEx;
  const noi = egi - totalOpEx;
  const annualDebt = calc.pi * 12;
  const annualCashFlow = noi - annualDebt - (calc.monthlyMI * 12);
  const monthlyCashFlow = annualCashFlow / 12;
  const capRate = salesPrice > 0 ? (noi / salesPrice) * 100 : 0;
  const cashInvested = calc.cashToClose;
  const cashOnCash = cashInvested > 0 ? (annualCashFlow / cashInvested) * 100 : 0;
  const dscr = annualDebt > 0 ? noi / annualDebt : 0;
  const grm = annualRent > 0 ? salesPrice / annualRent : 0;
  const opExRatio = egi > 0 ? (totalOpEx / egi) * 100 : 0;
  const breakEvenOcc = annualRent > 0 ? ((totalOpEx + annualDebt + calc.monthlyMI * 12) / annualRent) * 100 : 0;
  const onePercentRule = salesPrice > 0 ? (invMonthlyRent / salesPrice) * 100 : 0;
  const onePercentPass = onePercentRule >= 1;
  const fiftyPercentCheck = opExRatio;
  // Year-by-year projection
  const projections = [];
  let cumCashFlow = 0;
  let bal = calc.loan;
  const mr = calc.mr;
  const np = calc.np;
  for (let yr = 0; yr <= Math.min(invHoldYears, 30); yr++) {
   const rentYr = invMonthlyRent * 12 * Math.pow(1 + invRentGrowth / 100, yr);
   const vacYr = rentYr * invVacancy / 100;
   const egiYr = rentYr - vacYr;
   const valueYr = salesPrice * Math.pow(1 + appreciationRate / 100, yr);
   const maintYr = valueYr * invMaintPct / 100;
   const capExYr = valueYr * invCapEx / 100;
   const mgmtYr = egiYr * invMgmt / 100;
   const opExYr = annualTax + invAnnualIns + annualHOA + mgmtYr + maintYr + capExYr;
   const noiYr = egiYr - opExYr;
   // Amortization: compute balance at end of year
   let princPaid = 0;
   if (yr > 0 && mr > 0) {
    const startMonth = (yr - 1) * 12 + 1;
    const endMonth = yr * 12;
    let b = calc.loan;
    // fast forward to start
    if (startMonth > 1) {
     const paid = startMonth - 1;
     b = balanceAfter(calc.loan, mr, np, paid);
    }
    const bEnd = balanceAfter(calc.loan, mr, np, endMonth);
    princPaid = b - (bEnd > 0 ? bEnd : 0);
    bal = bEnd > 0 ? bEnd : 0;
   }
   const debtYr = calc.pi * 12;
   const miYr = calc.monthlyMI * 12;
   const cfYr = yr === 0 ? 0 : noiYr - debtYr - miYr;
   cumCashFlow += cfYr;
   const equity = valueYr - bal;
   // Sale proceeds at this year
   const saleGross = valueYr;
   const saleComm = saleGross * invSellerComm / 100;
   const saleClosing = saleGross * invSellClosing / 100;
   const saleNet = saleGross - bal - saleComm - saleClosing;
   const totalReturn = saleNet + cumCashFlow - calc.cashToClose;
   const totalReturnPct = calc.cashToClose > 0 ? (totalReturn / calc.cashToClose) * 100 : 0;
   // IRR calculation - simple Newton's method
   let irr = 0;
   if (yr > 0) {
    const flows = [-calc.cashToClose];
    for (let y = 1; y <= yr; y++) {
     const rY = invMonthlyRent * 12 * Math.pow(1 + invRentGrowth / 100, y);
     const vY = rY * invVacancy / 100;
     const eY = rY - vY;
     const vV = salesPrice * Math.pow(1 + appreciationRate / 100, y);
     const mY = vV * invMaintPct / 100;
     const cY = vV * invCapEx / 100;
     const gY = eY * invMgmt / 100;
     const oY = annualTax + invAnnualIns + annualHOA + gY + mY + cY;
     const nY = eY - oY;
     const cfY = nY - debtYr - miYr;
     if (y < yr) flows.push(cfY);
     else {
      const bY = mr > 0 ? balanceAfter(calc.loan, mr, np, y * 12) : calc.loan * (1 - y * 12 / np);
      const sN = vV - (bY > 0 ? bY : 0) - vV * invSellerComm / 100 - vV * invSellClosing / 100;
      flows.push(cfY + sN);
     }
    }
    // Newton's method for IRR
    let r = 0.1;
    for (let iter = 0; iter < 100; iter++) {
     let npv = 0, dnpv = 0;
     for (let t = 0; t < flows.length; t++) {
      npv += flows[t] / Math.pow(1 + r, t);
      if (t > 0) dnpv -= t * flows[t] / Math.pow(1 + r, t + 1);
     }
     if (Math.abs(dnpv) < 1e-10) break;
     const newR = r - npv / dnpv;
     if (Math.abs(newR - r) < 1e-8) { r = newR; break; }
     r = newR;
     if (r < -0.99) { r = -0.99; break; }
     if (r > 10) { r = 10; break; }
    }
    irr = r * 100;
   }
   projections.push({ yr, rent: rentYr, egi: egiYr, opEx: opExYr, noi: noiYr, cashFlow: cfYr, cumCashFlow, value: valueYr, balance: bal, equity, princPaid, saleNet, totalReturn, totalReturnPct, irr });
  }
  return {
   annualRent, vacancyLoss, egi, annualTax, annualIns: invAnnualIns, annualHOA, annualMgmt, annualMaint, annualCapEx,
   totalOpEx, noi, annualDebt, annualCashFlow, monthlyCashFlow, capRate, cashInvested, cashOnCash, dscr,
   grm, opExRatio, breakEvenOcc, onePercentRule, onePercentPass, fiftyPercentCheck, projections,
  };
 }, [invMonthlyRent, invVacancy, invMgmt, invMaintPct, invCapEx, invRentGrowth, invHoldYears, invSellerComm, invSellClosing,
  salesPrice, appreciationRate, hoa, calc]);
 // === CALIFORNIA PROP 19 TRANSFER CALCULATIONS ===
 const prop19 = useMemo(() => {
  // Prop 19 engine extracted to lib/finance.js (audit M-1; incl. the L-6
  // local-midnight date-parse fix for the 730-day window check).
  const autoCountyRate = propertyState === "California"
   ? (CITY_TAX_RATES[city] || 0.012)
   : 0.012;
  return computeProp19({
   replacementPrice: salesPrice,
   autoCountyRate,
   rateOverridePct: prop19RateOverride,
   oldTaxableValue: prop19OldTaxableValue,
   oldSalePrice: prop19OldSalePrice,
   isPrimary: loanPurpose === "Purchase Primary",
   fixedAssessments,
   transfersUsed: prop19TransfersUsed,
   saleDate: prop19SaleDate,
   purchaseDate: prop19PurchaseDate,
   isCalifornia: propertyState === "California",
  });
 }, [
  salesPrice, city, propertyState, loanPurpose,
  prop19OldTaxableValue, prop19OldSalePrice, prop19RateOverride,
  prop19TransfersUsed, prop19SaleDate, prop19PurchaseDate,
  fixedAssessments,
 ]);
 // === RENT VS BUY CALCULATIONS ===
 const rbCalc = useMemo(() => {
  const years = 30;
  const data = [];
  let rentWealth = calc.cashToClose; // renter invests the cash that would have gone to closing
  let buyEquity = calc.dp;
  let cumRentCost = 0, cumBuyCost = 0;
  let bal = calc.loan;
  const mr = calc.mr;
  const np = calc.np;
  let breakEvenYear = null;
  for (let yr = 0; yr <= years; yr++) {
   const rentMo = rbCurrentRent * Math.pow(1 + rbRentGrowth / 100, yr);
   const annualRentCost = rentMo * 12;
   // Renter: pays rent, invests savings
   if (yr > 0) {
    rentWealth = rentWealth * (1 + rbInvestReturn / 100);
    cumRentCost += annualRentCost;
   }
   // Buyer: pays PITI + HOA, builds equity
   const homeVal = salesPrice * Math.pow(1 + appreciationRate / 100, yr);
   if (yr > 0) {
    const annualHousing = calc.housingPayment * 12;
    cumBuyCost += annualHousing;
    // Principal paydown
    if (mr > 0 && yr * 12 <= np) {
     bal = balanceAfter(calc.loan, mr, np, yr * 12);
    } else if (mr === 0) {
     bal = calc.loan * Math.max(0, 1 - yr * 12 / np);
    }
   }
   buyEquity = homeVal - (bal > 0 ? bal : 0);
   // Tax savings for buyer
   const annualTaxSavings = calc.totalTaxSavings || 0;
   const renterNetWealth = rentWealth;
   const buyerNetWealth = buyEquity + (yr > 0 ? annualTaxSavings * yr * 0.5 : 0); // rough cumulative tax benefit
   // More accurate: buyer net worth = equity - cumulative extra costs vs renting
   const buyerTotalCost = yr === 0 ? calc.cashToClose : cumBuyCost + calc.cashToClose;
   const renterTotalCost = cumRentCost;
   const buyerNetPosition = buyEquity - buyerTotalCost + annualTaxSavings * yr;
   const renterNetPosition = rentWealth - renterTotalCost;
   if (breakEvenYear === null && yr > 0 && buyerNetPosition >= renterNetPosition) breakEvenYear = yr;
   data.push({
    yr, rentMo: Math.round(rentMo), annualRentCost: Math.round(annualRentCost),
    annualBuyCost: Math.round(calc.housingPayment * 12),
    homeVal: Math.round(homeVal), equity: Math.round(buyEquity),
    renterWealth: Math.round(renterNetWealth), buyerWealth: Math.round(buyEquity),
    buyerNet: Math.round(buyerNetPosition), renterNet: Math.round(renterNetPosition),
    monthlyCostDiff: Math.round(calc.housingPayment - rentMo * Math.pow(1 + rbRentGrowth / 100, 0)),
   });
  }
  const yr5 = data[5] || {};
  const yr10 = data[10] || {};
  const yr30 = data[30] || {};
  return { data, breakEvenYear, yr5, yr10, yr30 };
 }, [rbCurrentRent, rbRentGrowth, rbInvestReturn, salesPrice, appreciationRate, calc]);
 const paySegs = (isRefi && calc.refiNewLoanAmt > 0) ? [
  { v: calc.refiNewPrinThisMonth, c: T.cyan, l: "Principal", tip: "The portion of your new refi payment that reduces your loan balance. This is equity you're building." },
  { v: calc.refiNewIntThisMonth, c: T.blue, l: "Interest", tip: "The interest cost on your new refinanced loan. Lower rate = less interest each month." },
  ...(includeEscrow ? [{ v: calc.refiNewMonthlyTax, c: T.orange, l: "Tax", tip: "Property tax escrowed monthly on your new loan." }, { v: calc.refiNewMonthlyIns, c: T.green, l: "Insurance", tip: "Homeowner's insurance escrowed monthly on your new loan." }] : []),
  { v: calc.refiNewMI, c: T.red, l: loanType === "FHA" ? "MIP" : "PMI", tip: "Mortgage insurance on your new refinanced loan. Drops off at 80% LTV for conventional loans." },
  { v: hoa, c: T.purple, l: "HOA", tip: "Homeowner's Association dues remain the same after refinancing." },
 ] : [
  { v: calc.monthlyPrinReduction, c: T.cyan, l: "Principal", tip: "The portion of your payment that reduces your loan balance. This is equity you're building — like a forced savings account." },
  { v: calc.pi - calc.monthlyPrinReduction, c: T.blue, l: "Interest", tip: "The cost of borrowing money — this is the lender's profit. Early in the loan, most of your payment goes here. As you pay down the balance, this shrinks." },
  ...(includeEscrow ? [{ v: calc.monthlyTax, c: T.orange, l: "Tax", tip: "Your annual property tax divided by 12 and collected monthly by your lender. In California, property tax is typically 1.1–1.25% of your home's assessed value." }, { v: calc.ins, c: T.green, l: "Insurance", tip: "Homeowner's insurance protects your home against fire, theft, and natural disasters. Lenders require it. Typical cost: $1,200–$3,000/year depending on location and coverage." }] : []),
  { v: calc.monthlyMI, c: T.red, l: loanType === "FHA" ? "MIP" : "PMI", tip: loanType === "FHA" ? "Mortgage Insurance Premium (MIP) is required on all FHA loans regardless of down payment. The annual rate runs 0.50%–0.75% of the base loan amount depending on loan size and LTV (HUD schedule). FHA MIP lasts the life of the loan unless LTV is 90% or below at origination — you'd otherwise need to refinance to remove it." : "Private Mortgage Insurance (PMI) is required on conventional loans with less than 20% down. It protects the lender if you default. PMI automatically drops off when you reach 20% equity." },
  { v: hoa, c: T.purple, l: "HOA", tip: "Homeowner's Association dues — a monthly fee for shared amenities and maintenance in condos, townhomes, and planned communities. Covers things like landscaping, pool, gym, exterior maintenance, and building insurance." },
 ];
 const TAB_DESC = {
  setup: "Start here — enter the subject property address and zip code to auto-fill tax rates and transfer taxes, then set your borrower profile.",
  calc: "Your core mortgage calculator. Enter purchase price, rate, and terms to see your monthly payment breakdown and loan details.",
  costs: "Full closing cost breakdown — lender fees, title, escrow, transfer taxes, prepaids, and credits. This is your total cash needed.",
  qualify: "The 5-pillar qualification check — FICO, down payment, DTI, cash to close, and reserves. All 5 must clear for pre-approval.",
  debts: "Enter all monthly obligations from your credit report. These payments plus your new housing payment determine your DTI ratio.",
  income: "Enter employment income for each borrower. Each pay type (salary, bonus, commission) is qualified separately using its own method.",
  assets: "List your bank accounts and investments. Lenders verify you have enough for down payment, closing costs, and reserve requirements.",
  reo: "Real Estate Owned — existing investment properties. Rental income (at 75%) offsets mortgage payments in your DTI calculation.",
  tax: "See how mortgage interest and property tax deductions lower your effective cost of homeownership through federal and state tax savings.",
  amort: "Amortization shows how your loan balance decreases over time. Early payments are mostly interest — later payments build equity faster.",
  sell: "Estimate your net proceeds from selling a property — after commissions, transfer taxes, closing costs, and capital gains tax.",
  invest: "Analyze rental properties — cash flow, cap rate, cash-on-cash return, and break-even rent to evaluate investment deals.",
  rentvbuy: "Compare the true cost of renting vs. buying over time, including tax savings, equity buildup, and appreciation.",
  learn: "Interactive courses that teach you how mortgages work — from credit scores to closing day. Earn badges as you complete each module.",
  compare: "Side-by-side comparison of all your saved loan options — payment, cash to close, DTI, total interest, and more.",
  summary: "Share your loan estimate via email or PDF. Pre-qualified based on what you entered — click Get Pre-Approved to start your official loan application.",
  refi: "Compare your current loan to a new refinance — monthly savings, breakeven timeline, and total interest comparison.",
  refi3: "The 3-point refinance test — does the new loan save money, break even fast enough, and accelerate your payoff?",
  settings: "Customize your experience — PIN lock, privacy mode, theme, and data management.",
 };
 const TabIntro = ({ id }) => {
  const desc = TAB_DESC[id];
  if (!desc) return null;
  return (
   <div style={{ padding: "12px 14px", background: `${T.blue}06`, borderRadius: 12, marginTop: 16, marginBottom: -4 }}>
    <div style={{ fontSize: 12, lineHeight: 1.5, color: T.textTertiary }}>{desc}</div>
   </div>
  );
 };
 // ═══════════════════════════════════════════
 // PRICEPOINT — Now in PricePoint.jsx
 // ═══════════════════════════════════════════
 // (all PricePoint logic moved to PricePoint.jsx)
 const TABS = [["overview","Overview"],
  // setup, income, debts, assets, qualify, tax, amort folded into Overview and
  // hidden from the sidebar (2026-05-21, per Christo). calc + costs were folded
  // earlier. All of these remain routable tabs — Overview's jump links (setTab)
  // and deep links still resolve; they're just removed from the nav rail.
  ...(isRefi ? [["refi","Refi Summary"],["refi3","3-Point Test"]] : []),
  // Tabs below are gated only by the module/feature toggles they belong to —
  // never by flow (guided vs standard). Christo 2026-06-02: every tab shows in
  // every flow.
  ...(ownsProperties ? [["reo","REO"]] : []),
  // Compare gets its own sidebar tab (Christo 2026-07-03) — side-by-side of all
  // saved loan options. Available on every device (unlike Workspace, which is
  // the desktop-only multi-pane editor).
  ["compare","Compare"],
  ...(isDesktop ? [["workspace","Workspace"]] : []),
  ...(hasSellProperty ? [["sell","Seller Net"]] : []),
  ...(showInvestor ? [["invest","Investor"]] : []),
  ...((firstTimeBuyer || showRentVsBuy) && !isRefi ? [["rentvbuy","Rent vs Buy"]] : []),
  ["learn","Learn"],
  ...(showProp19 ? [["prop19","Prop 19"]] : []),
  ["summary","Share"],
  // Settings is now visible to borrowers too (2026-05-12, per Christo: "i want
  // them all to have the same view"). Multi-client BorrowerPicker remains
  // broker-only via the gate inside UnifiedHeader.jsx line 337.
  ["settings","Settings"]];
 const visibleTabs = TABS.map(([k]) => k).filter(k => isTabUnlocked(k));
 // ═══ "ON THIS PAGE" SECTION INDEX (Standard-mode sidebar table of contents) ═══
 // Mirrors the section ORDER + visibility conditions in OverviewTab.jsx. Each
 // `id` matches a <CollapsibleSection id="..."> rendered there, so a click can
 // scroll-jump straight to it. KEEP THIS IN SYNC WITH OverviewTab.jsx — if a
 // section is added/removed/reordered there, mirror it here. Conditional rows
 // use the same guards as OverviewTab so the list never lists a hidden section.
 const OVERVIEW_SECTIONS = [
  { id: "overview-setup",         label: "Quick Start" },
  { id: "overview-payment",       label: "Monthly Payment" },
  { id: "overview-costs",         label: isRefi ? "Refi Costs" : "Costs" },
  { id: "overview-assets",        label: "Assets" },
  { id: "overview-debts",         label: "Debts" },
  ...(ownsProperties ? [{ id: "overview-reo", label: "REO" }] : []),
  { id: "overview-income",        label: "Income" },
  { id: "overview-qualification", label: "Pre-Qualified?" },
  { id: "overview-tax",           label: "Tax Savings" },
  { id: "overview-equity",        label: "Equity" },
  ...((showRentVsBuy && !isRefi) ? [{ id: "overview-rentvbuy", label: "Rent vs Buy" }] : []),
  ...(showInvestor ? [{ id: "overview-investor", label: "Investor" }] : []),
  ...((hasSellProperty && sellPrice > 0) ? [{ id: "overview-seller", label: "Seller Net" }] : []),
  ...((showProp19 && propertyState === "California" && !isRefi) ? [{ id: "overview-prop19", label: "Prop 19" }] : []),
 ];
 // Core destinations that stay PINNED above the section index. These are real
 // tab switches (not in-page scrolls), in the order Christo specified.
 const CORE_TAB_KEYS = ["overview", "refi", "refi3", "compare", "workspace", "learn", "summary", "settings"];
 // Jump to an Overview section: make sure we're on the Overview tab, then scroll
 // the section into view. Polls briefly because OverviewTab is lazy-loaded and
 // may not be mounted on the same frame we switch tabs. scroll-margin-top (CSS,
 // [id^="overview-"]) keeps the sticky header from covering the section.
 const jumpToSection = (sectionId) => {
  if (!isDesktop) setMobileMenuOpen(false);
  const tryScroll = (attempts) => {
   const el = document.getElementById(sectionId);
   if (el) { el.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
   if (attempts > 0) setTimeout(() => tryScroll(attempts - 1), 80);
  };
  if (tab !== "overview") { setTab("overview"); setTimeout(() => tryScroll(10), 90); }
  else tryScroll(10);
 };
 // Swipe navigation between the three apps (Blueprint <-> PricePoint <-> Markets).
 // Order matches the sidebar mode toggle. Blueprint's internal tabs are reached
 // via the tab bar, not swipe. (2026-06-09)
 const APP_ORDER = ["blueprint", "pricepoint", "markets"];
 const handleTouchStart = (e) => {
  touchStartRef.current = e.touches[0].clientX;
  touchStartYRef.current = e.touches[0].clientY;
 };
 const handleTouchEnd = (e) => {
  if (touchStartRef.current === null) return;
  const dx = e.changedTouches[0].clientX - touchStartRef.current;
  const dy = e.changedTouches[0].clientY - touchStartYRef.current;
  touchStartRef.current = null;
  touchStartYRef.current = null;
  // Only trigger on horizontal swipes (more X than Y movement, and threshold)
  if (Math.abs(dx) < 60 || Math.abs(dy) > Math.abs(dx) * 0.7) return;
  // Don't hijack swipes while split-screen is active (desktop only).
  if (splitMode) return;
  const curIdx = APP_ORDER.indexOf(appMode);
  if (curIdx === -1) return;
  if (dx < -60 && curIdx < APP_ORDER.length - 1) setAppMode(APP_ORDER[curIdx + 1]);
  else if (dx > 60 && curIdx > 0) setAppMode(APP_ORDER[curIdx - 1]);
 };
 // Auto-scroll tab bar to center active tab
 React.useEffect(() => {
  if (!tabBarRef.current) return;
  const activeBtn = tabBarRef.current.querySelector(`[data-tab="${tab}"]`);
  if (activeBtn) {
   const container = tabBarRef.current;
   const scrollLeft = activeBtn.offsetLeft - container.offsetWidth / 2 + activeBtn.offsetWidth / 2;
   container.scrollTo({ left: scrollLeft, behavior: "smooth" });
  }
 }, [tab]);
 const AmortChart = () => {
  const data = calc.yearlyData;
  if (data.length === 0) return null;
  const W = 440, H = 220, pad = { t: 16, r: 16, b: 32, l: 48 };
  const cW = W - pad.l - pad.r, cH = H - pad.t - pad.b;
  const maxVal = Math.max(...data.map(d => d.int + d.prin));
  const xStep = cW / (data.length - 1 || 1);
  const y = v => pad.t + cH - (maxVal > 0 ? (v / maxVal) * cH : 0);
  const intPath = data.map((d, i) => `${i === 0 ? "M" : "L"}${pad.l + i * xStep},${y(d.int)}`).join(" ");
  const prinPath = data.map((d, i) => `${i === 0 ? "M" : "L"}${pad.l + i * xStep},${y(d.prin)}`).join(" ");
  const intArea = intPath + ` L${pad.l + (data.length - 1) * xStep},${pad.t + cH} L${pad.l},${pad.t + cH} Z`;
  const prinArea = prinPath + ` L${pad.l + (data.length - 1) * xStep},${pad.t + cH} L${pad.l},${pad.t + cH} Z`;
  const ticks = [0, 1, 2, 3, 4].map(i => maxVal * i / 4);
  return (
   <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", display: "block" }}>
    {ticks.map((t, i) => (<g key={i}><line x1={pad.l} y1={y(t)} x2={W - pad.r} y2={y(t)} stroke={T.separator} strokeWidth="0.5" />
     <text x={pad.l - 6} y={y(t) + 3} textAnchor="end" fill={T.textTertiary} fontSize="9" fontFamily={FONT}>{t >= 1000 ? `${(t/1000).toFixed(0)}k` : t.toFixed(0)}</text></g>))}
    <path d={intArea} fill={T.blue} opacity="0.2" /><path d={intPath} fill="none" stroke={T.blue} strokeWidth="2" />
    <path d={prinArea} fill={T.green} opacity="0.15" /><path d={prinPath} fill="none" stroke={T.green} strokeWidth="2" />
    {data.filter((_, i) => i % Math.max(1, Math.floor(data.length / 6)) === 0 || i === data.length - 1).map((d, i) => (
     <text key={i} x={pad.l + data.indexOf(d) * xStep} y={H - 8} textAnchor="middle" fill={T.textTertiary} fontSize="9" fontFamily={FONT}>Yr {d.year}</text>
    ))}
    <rect x={W - 120} y={pad.t} width={104} height={32} rx={8} fill={T.card} opacity="0.95" />
    <circle cx={W - 108} cy={pad.t + 10} r={4} fill={T.blue} /><text x={W - 100} y={pad.t + 14} fill={T.textSecondary} fontSize="9" fontFamily={FONT}>Interest</text>
    <circle cx={W - 108} cy={pad.t + 24} r={4} fill={T.green} /><text x={W - 100} y={pad.t + 28} fill={T.textSecondary} fontSize="9" fontFamily={FONT}>Principal</text>
   </svg>
  );
 };
 const dpOk = isRefi ? true : calc.dpWarning === null;
 const refiLtvOk = isRefi ? (calc.refiNewLTV > 0 ? calc.refiNewLTV <= (refiPurpose === "Cash-Out" ? 0.80 : 0.95) : null) : true;
 const refiLtvCheck = refiLtvOk === true ? "Good!" : refiLtvOk === false ? "High" : "—";
 const allGood = isRefi
  ? calc.ficoCheck === "Good!" && calc.dtiCheck === "Good!" && refiLtvCheck === "Good!"
  : calc.ficoCheck === "Good!" && calc.dtiCheck === "Good!" && calc.cashCheck === "Good!" && calc.resCheck === "Good!" && dpOk;
 const someGood = isRefi
  ? calc.ficoCheck === "Good!" || calc.dtiCheck === "Good!" || refiLtvCheck === "Good!"
  : calc.ficoCheck === "Good!" || calc.dtiCheck === "Good!" || calc.cashCheck === "Good!" || calc.resCheck === "Good!" || dpOk;
 const qualStatus = allGood ? "approved" : someGood ? "almost" : "none";
 const refiPillarCount = [calc.ficoCheck, calc.dtiCheck, refiLtvCheck].filter(c => c === "Good!").length;
 const purchPillarCount = [calc.ficoCheck, calc.dtiCheck, calc.cashCheck, calc.resCheck].filter(c => c === "Good!").length + (dpOk ? 1 : 0);
 return (
  <WorkspaceProvider>
  <div style={{ minHeight: "100vh", background: T.bg, color: T.text, fontFamily: FONT, width: "100%", overflowX: "clip", boxSizing: "border-box", display: isDesktop ? "flex" : "block" }}>
   <style>{`html, body, #root { overflow-x: hidden !important; max-width: 100vw !important; width: 100% !important; -webkit-text-size-adjust: 100%; box-sizing: border-box !important; background: ${T.bg}; }
    *, *::before, *::after { box-sizing: border-box; }
    input::placeholder { color: rgba(255,255,255,0.15) !important; font-weight: 400 !important; }
    @viewport { width: device-width; }
    @supports (padding-top: env(safe-area-inset-top)) {
     .mb-safe-top { padding-top: env(safe-area-inset-top) !important; }
     .mb-safe-bottom { padding-bottom: env(safe-area-inset-bottom) !important; }
    }
    @media all and (display-mode: standalone) {
     .mb-safe-top { padding-top: env(safe-area-inset-top, 20px) !important; }
    }
    @keyframes buildGlow { 0%, 100% { box-shadow: 0 0 0 2px rgba(74,144,217,0.5), 0 0 20px rgba(74,144,217,0.15); } 50% { box-shadow: 0 0 0 2px rgba(74,144,217,0.8), 0 0 30px rgba(74,144,217,0.25); } }
    @keyframes pulseBlue { 0%, 100% { box-shadow: 0 0 0 3px rgba(74,144,217,0.3), 0 0 12px rgba(74,144,217,0.1); } 50% { box-shadow: 0 0 0 3px rgba(74,144,217,0.7), 0 0 24px rgba(74,144,217,0.25); } }
    @keyframes floatBarSlide { 0% { transform: translateY(100%); opacity: 0; } 100% { transform: translateY(0); opacity: 1; } }
    @keyframes fadeSlide { 0% { opacity: 0; transform: translateY(-8px); } 100% { opacity: 1; transform: translateY(0); } }
    @keyframes highlightPulse { 0% { background: rgba(10,132,255,0.15); } 100% { background: transparent; } }
    @keyframes fadeSlideUp { 0% { opacity: 0; transform: translateY(12px); } 100% { opacity: 1; transform: translateY(0); } }
    @keyframes sheetFadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes sheetFadeOut { from { opacity: 1; } to { opacity: 0; } }
    @keyframes sheetSlideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
    @keyframes sheetSlideDown { from { transform: translateY(0); } to { transform: translateY(100%); } }
    .build-active { animation: buildGlow 2.5s ease-in-out infinite; border-radius: 20px; }
    .pulse-next { box-shadow: 0 0 0 2px rgba(99,102,241,0.5), 0 0 8px rgba(99,102,241,0.15); border-radius: 14px; padding: 4px 5px; transition: box-shadow 0.3s ease; }
    .field-updated { animation: highlightPulse 1.5s ease-out; border-radius: 8px; }
    input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; width: 20px; height: 20px; border-radius: 50%; background: #fff; box-shadow: 0 1px 4px rgba(0,0,0,0.4); cursor: pointer; margin-top: -7px; }
    input[type="range"]::-moz-range-thumb { width: 20px; height: 20px; border-radius: 50%; background: #fff; box-shadow: 0 1px 4px rgba(0,0,0,0.4); cursor: pointer; border: none; }
    input[type="range"]::-webkit-slider-runnable-track { height: 6px; border-radius: 3px; }
    /* Desktop sidebar styles */
    .bp-sidebar { scrollbar-width: thin; scrollbar-color: ${T.separator} transparent; }
    .bp-sidebar::-webkit-scrollbar { width: 4px; }
    .bp-sidebar::-webkit-scrollbar-thumb { background: ${T.separator}; border-radius: 2px; }
    .bp-sidebar-item { transition: all 0.15s ease; }
    .bp-sidebar-item:hover { background: ${T.tabActiveBg}; }
    /* Sidebar "On this page" jump-links land below the fixed header, not under it. */
    [id^="overview-"] { scroll-margin-top: calc(92px + env(safe-area-inset-top, 0px)); }
    /* Split button appears on hover */
    .split-btn { opacity: 0 !important; }
    div:hover > .split-btn { opacity: 0.6 !important; }
    .split-btn:hover { opacity: 1 !important; background: ${T.pillBg}; }
    /* Split divider */
    .split-divider { width: 6px; cursor: col-resize; background: transparent; position: relative; flex-shrink: 0; transition: background 0.15s; }
    .split-divider:hover, .split-divider:active { background: ${T.blue}30; }
    .split-divider::after { content: ''; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 2px; height: 40px; background: ${T.separator}; border-radius: 1px; transition: background 0.15s; }
    .split-divider:hover::after { background: ${T.blue}; }
    /* Desktop smooth scrollbar */
    html { scrollbar-width: thin; scrollbar-color: ${T.separator} transparent; }
    html::-webkit-scrollbar { width: 6px; }
    html::-webkit-scrollbar-thumb { background: ${T.separator}; border-radius: 3px; }
    .bp-main-content { scrollbar-width: thin; scrollbar-color: ${T.separator} transparent; }
    .bp-main-content::-webkit-scrollbar { width: 6px; }
    .bp-main-content::-webkit-scrollbar-thumb { background: ${T.separator}; border-radius: 3px; }
   `}</style>
   {/* ═══ SIDEBAR — desktop persistent OR mobile slide-in drawer ═══
       On desktop the sidebar is always visible (collapsed or expanded).
       On mobile (2026-05-03) it doubles as the RealStack shell drawer:
       the hamburger button in UnifiedHeader sets mobileMenuOpen=true,
       this sidebar slides in from the left, and tapping a product or
       the backdrop closes it. */}
   {/* Borrowers now see the same sidebar nav as the LO (2026-05-12). The
       only LO-only piece inside the sidebar is the multi-client BorrowerPicker,
       which is rendered by UnifiedHeader and stays gated there. */}
   {!isDesktop && mobileMenuOpen && (
    <div onClick={() => setMobileMenuOpen(false)} style={{
     position: "fixed", inset: 0, zIndex: 999,
     background: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)",
     transition: "opacity 0.25s ease",
    }} />
   )}
   {(isDesktop || mobileMenuOpen) && (
    <div className="bp-sidebar" style={{
     width: !isDesktop ? 280 : (sidebarCollapsed ? 56 : 270),
     minWidth: !isDesktop ? 280 : (sidebarCollapsed ? 56 : 270),
     height: "100vh", position: "fixed", top: 0, left: 0,
     background: darkMode ? "#0d0d0f" : "#FAFAFA",
     borderRight: `1px solid ${T.separator}`,
     boxShadow: !isDesktop ? "0 0 32px rgba(0,0,0,0.35)" : "none",
     display: "flex", flexDirection: "column",
     transition: "width 0.2s, min-width 0.2s, transform 0.25s ease",
     overflow: "hidden", zIndex: !isDesktop ? 1000 : 60, flexShrink: 0,
     paddingTop: !isDesktop ? "max(0px, env(safe-area-inset-top))" : 0,
    }}>
     {/* Mobile-only close button — top-right corner of the drawer */}
     {!isDesktop && (
      <button onClick={() => setMobileMenuOpen(false)}
       style={{
        position: "absolute", top: 12, right: 12, zIndex: 1,
        background: "transparent", border: "none", cursor: "pointer",
        width: 32, height: 32, padding: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: T.textSecondary, borderRadius: 8,
       }}>
       <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
     )}
     {/* Sidebar Header — Logo + Mode Toggle (matches PricePoint/Markets pattern) */}
     <div style={{ padding: (sidebarCollapsed && isDesktop) ? "12px 8px 14px" : "12px 16px 14px", borderBottom: `1px solid ${T.separator}` }}>
      {(!sidebarCollapsed || !isDesktop) && <>
       <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
         <svg viewBox="0 0 100 100" fill="none" style={{width:28,height:28,borderRadius:6,overflow:"hidden",flexShrink:0}}>
          <defs><linearGradient id="bp-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#6366F1"/><stop offset="100%" stopColor="#3B82F6"/></linearGradient></defs>
          <rect width="100" height="100" fill="url(#bp-bg)"/>
          <polygon points="50,12 8,30 50,25 92,30" fill="rgba(255,255,255,0.95)"/>
          <polygon points="50,25 92,30 92,34 50,29" fill="rgba(255,255,255,0.48)"/>
          <polygon points="50,25 8,30 8,34 50,29" fill="rgba(255,255,255,0.68)"/>
          <polygon points="8,38 50,33 92,38 50,43" fill="rgba(255,255,255,0.90)"/>
          <polygon points="8,38 50,43 50,46 8,41" fill="rgba(255,255,255,0.58)"/>
          <polygon points="50,43 92,38 92,41 50,46" fill="rgba(255,255,255,0.40)"/>
          <polygon points="8,52 50,47 92,52 50,57" fill="rgba(255,255,255,0.70)"/>
          <polygon points="8,52 50,57 50,60 8,55" fill="rgba(255,255,255,0.45)"/>
          <polygon points="50,57 92,52 92,55 50,60" fill="rgba(255,255,255,0.28)"/>
          <polygon points="8,66 50,61 92,66 50,71" fill="rgba(255,255,255,0.50)"/>
          <polygon points="8,66 50,71 50,74 8,69" fill="rgba(255,255,255,0.32)"/>
          <polygon points="50,71 92,66 92,69 50,74" fill="rgba(255,255,255,0.18)"/>
          <polygon points="8,80 50,75 92,80 50,85" fill="rgba(255,255,255,0.34)"/>
          <polygon points="8,80 50,85 50,88 8,83" fill="rgba(255,255,255,0.20)"/>
          <polygon points="50,85 92,80 92,83 50,88" fill="rgba(255,255,255,0.10)"/>
         </svg>
         <div>
          <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.1 }}><span style={{ color: T.text }}>Real</span><span style={{ color: "#6366F1" }}>Stack</span></div>
         </div>
        </div>
        {/* Collapse is a desktop-only affordance; on mobile the drawer just closes. */}
        {isDesktop && (
         <button onClick={() => setSidebarCollapsed(true)} style={{ background: "none", border: "none", cursor: "pointer", color: T.textTertiary, padding: "4px", display: "flex", borderRadius: 4 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
         </button>
        )}
       </div>
       {/* Mode Toggle with Split affordance */}
       <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {[["blueprint","settings","Blueprint"],["pricepoint","target","PricePoint"],["markets","trending-up","Markets"]].map(([k,ico,l]) => {
         const isActive = k === appMode;
         const isSplit = splitMode && k === splitApp;
         return (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: 2, position: "relative" }}>
           <button onClick={() => { if (splitMode && k !== appMode && k !== splitApp) { setSplitApp(k); } else { closeSplit(); setAppMode(k); } if (!isDesktop) setMobileMenuOpen(false); }} style={{
            display: "flex", alignItems: "center", gap: 8, flex: 1, padding: "7px 10px", borderRadius: 8,
            border: "none", fontSize: 12, fontWeight: isActive || isSplit ? 700 : 500, fontFamily: FONT,
            background: isActive ? `${T.blue}15` : isSplit ? `${T.blue}08` : "transparent",
            color: isActive ? T.blue : isSplit ? T.blue : T.textTertiary,
            cursor: "pointer", transition: "all 0.2s", textAlign: "left",
           }}><Icon name={ico} size={14} /> {l}
            {isSplit && <span style={{ fontSize: 8, opacity: 0.5, marginLeft: "auto" }}>R</span>}
           </button>
           {/* Split button — show on hover for non-active modes */}
           {k !== appMode && !isSplit && (
            <button onClick={(e) => { e.stopPropagation(); openSplit(k); }}
             title={`Open ${l} in split view`}
             className="split-btn"
             style={{
              background: "none", border: "none", cursor: "pointer", padding: "4px",
              color: T.textTertiary, opacity: 0, transition: "opacity 0.15s", display: "flex",
              borderRadius: 4, flexShrink: 0,
             }}>
             <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="3" x2="12" y2="21"/></svg>
            </button>
           )}
           {isSplit && (
            <button onClick={(e) => { e.stopPropagation(); closeSplit(); }}
             title="Close split view"
             style={{ background: "none", border: "none", cursor: "pointer", padding: "4px", color: T.textTertiary, display: "flex", borderRadius: 4, flexShrink: 0 }}>
             <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
           )}
          </div>
         );
        })}
       </div>
      </>}
      {(sidebarCollapsed && isDesktop) && (
       <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
        <svg viewBox="0 0 100 100" fill="none" style={{width:28,height:28,borderRadius:6,overflow:"hidden"}}>
         <defs><linearGradient id="bp-bg2" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#6366F1"/><stop offset="100%" stopColor="#3B82F6"/></linearGradient></defs>
         <rect width="100" height="100" fill="url(#bp-bg2)"/>
         <polygon points="50,12 8,30 50,25 92,30" fill="rgba(255,255,255,0.95)"/>
         <polygon points="50,25 92,30 92,34 50,29" fill="rgba(255,255,255,0.48)"/>
         <polygon points="50,25 8,30 8,34 50,29" fill="rgba(255,255,255,0.68)"/>
         <polygon points="8,38 50,33 92,38 50,43" fill="rgba(255,255,255,0.90)"/>
         <polygon points="8,52 50,47 92,52 50,57" fill="rgba(255,255,255,0.70)"/>
         <polygon points="8,66 50,61 92,66 50,71" fill="rgba(255,255,255,0.50)"/>
         <polygon points="8,80 50,75 92,80 50,85" fill="rgba(255,255,255,0.34)"/>
        </svg>
        <button onClick={() => setSidebarCollapsed(false)} style={{ background: "none", border: "none", cursor: "pointer", color: T.textTertiary, padding: "4px", display: "flex", borderRadius: 4 }}>
         <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
        </button>
       </div>
      )}
     </div>
     {/* Mode-specific nav items */}
     <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
      {/* Blueprint nav */}
      {appMode === "blueprint" && (() => {
       // Collapsed (icon-only) styling is a DESKTOP affordance only. The mobile
       // drawer is always full-width with labels — without this gate the desktop
       // sidebarCollapsed state leaked into mobile, forcing the icon to width:100%
       // and squeezing every label to zero width (icons-only, broken). (2026-06-02)
       const navCollapsed = sidebarCollapsed && isDesktop;
       const icons = { overview: "home", setup: "clipboard", calc: "calculator", costs: "dollar", income: "banknote", debts: "credit-card", assets: "landmark", qualify: "check", tax: "bar-chart", amort: "trending-up", invest: "grid", rentvbuy: "scale", learn: "graduation-cap", workspace: "grid", compare: "bar-chart", summary: "link", settings: "settings", reo: "home", sell: "dollar", refi: "refresh-cw", refi3: "target" };
       // Renders one core/destination nav item (real tab switch). Unchanged markup.
       const renderTabItem = ([k, l]) => {
        const locked = !isTabUnlocked(k);
        const completed = !!completedTabs[k];
        const active = tab === k;
        return (
         <div key={k} className="bp-sidebar-item" onClick={() => { if (!locked) { setTab(k); const mc = document.querySelector('.bp-main-content'); if (mc) mc.scrollTop = 0; if (!isDesktop) setMobileMenuOpen(false); } }}
          style={{
           padding: navCollapsed ? "8px 0" : "7px 12px", cursor: locked ? "not-allowed" : "pointer",
           display: "flex", alignItems: "center", gap: 8, margin: "1px 6px", borderRadius: 8,
           background: active ? T.tabActiveBg : "transparent", opacity: locked ? 0.35 : 1,
           borderLeft: active ? `3px solid ${T.blue}` : "3px solid transparent",
          }}>
          <span style={{ textAlign: "center", width: navCollapsed ? "100%" : "auto", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: active ? T.blue : locked ? T.textTertiary : T.textSecondary }}><Icon name={icons[k] || "file"} size={navCollapsed ? 18 : 15} /></span>
          {!navCollapsed && (
           <span style={{ fontSize: 13, fontWeight: active ? 700 : 500, color: active ? T.blue : locked ? T.textTertiary : T.text, flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l}</span>
          )}
          {/* Completed-tab checkmarks removed 2026-07-05 (Christo: no checkmarks on any tabs) */}
         </div>
        );
       };
       // GUIDED MODE: leave the sidebar exactly as it was — the full tab list.
       // The council flagged that letting guided users jump around the page
       // mid-wizard risks the known stale-closure soft-locks, so the "On this
       // page" jump index is a Standard-mode feature only. (2026-06-15)
       if (skillLevel === "guided") return TABS.map(renderTabItem);
       // STANDARD MODE: pinned core destinations, then a labeled "On this page"
       // index whose rows scroll-jump to Overview sections (single source of
       // truth: OVERVIEW_SECTIONS, mirroring OverviewTab.jsx order/conditions).
       const coreTabs = TABS.filter(([k]) => CORE_TAB_KEYS.includes(k));
       return (
        <>
         {coreTabs.map(renderTabItem)}
         {!navCollapsed && OVERVIEW_SECTIONS.length > 0 && (
          <>
           <div style={{ height: 1, background: T.separator, margin: "10px 12px 0" }} />
           <div style={{ padding: "10px 18px 4px" }}>
            <span style={{ fontFamily: FONT, fontSize: 11, fontWeight: 600, letterSpacing: 0.2, color: T.textTertiary }}>Overview: Jump to</span>
           </div>
           {OVERVIEW_SECTIONS.map((s) => {
            const active = tab === "overview";
            return (
             <div key={s.id} className="bp-sidebar-item" onClick={() => jumpToSection(s.id)}
              style={{
               padding: "6px 12px 6px 14px", cursor: "pointer",
               display: "flex", alignItems: "center", gap: 9, margin: "1px 6px", borderRadius: 8,
               background: "transparent",
              }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: T.textTertiary, opacity: active ? 0.55 : 0.35, flexShrink: 0 }} />
              <span style={{ fontSize: 12.5, fontWeight: 500, color: T.textSecondary, flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.label}</span>
             </div>
            );
           })}
          </>
         )}
        </>
       );
      })()}
      {/* Blueprint switcher — pinned + recent blueprints (LO view only) */}
      {appMode === "blueprint" && isCloud && !isBorrower && (!sidebarCollapsed || !isDesktop) && (
       <SidebarSwitcher
        pinned={pinnedBlueprints}
        recents={recentBlueprints}
        activeBorrowerId={activeBorrower?.id}
        onOpen={openClient}
        onTogglePin={toggleBlueprintPin}
        isPinned={isBlueprintPinned}
        T={T}
        borrowerProps={{
         borrowers: borrowerList,
         activeBorrower,
         loading: borrowerLoading,
         scenarios: borrowerScenarios,
         scenariosLoading: borrowerScenariosLoading,
         onSelect: borrowerPickerCallbacks.onSelect,
         onSelectScenario: borrowerPickerCallbacks.onSelectScenario,
         onAutoCreateScenario: borrowerPickerCallbacks.onAutoCreateScenario,
         onCreateNew: borrowerPickerCallbacks.onCreateNew,
        }}
       />
      )}
      {/* PricePoint nav (when PP is primary) */}
      {appMode === "pricepoint" && (!sidebarCollapsed || !isDesktop) && [["daily","target","Daily"],["free","play","Free Play"],["live","radio","Live"],["stats","bar-chart","Stats"],["board","award","Board"]].map(([k,ico,l]) => {
       const active = ppCurrentTab === k;
       return (
        <div key={k} className="bp-sidebar-item" onClick={() => { triggerPPTab(k); if (!isDesktop) setMobileMenuOpen(false); }} style={{
         padding: "7px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, margin: "1px 6px", borderRadius: 8,
         background: active ? `${T.blue}15` : "transparent",
         borderLeft: active ? `3px solid ${T.blue}` : "3px solid transparent",
         color: active ? T.blue : T.textSecondary,
        }}>
         <Icon name={ico} size={15} />
         <span style={{ fontSize: 13, fontWeight: active ? 700 : 500, color: active ? T.blue : T.text }}>{l}</span>
        </div>
       );
      })}
      {/* Markets nav (when Markets is primary) */}
      {appMode === "markets" && (!sidebarCollapsed || !isDesktop) && [["live","trending-up","Live Markets"],["practice","target","Practice"],["portfolio","banknote","Portfolio"]].map(([k,ico,l]) => (
       <div key={k} className="bp-sidebar-item" style={{
        padding: "7px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, margin: "1px 6px", borderRadius: 8,
        background: "transparent",
        color: T.textSecondary,
       }}><Icon name={ico} size={15} /><span style={{ fontSize: 13, fontWeight: 500 }}>{l}</span></div>
      ))}
     </div>
     {/* Sidebar Footer */}
     {appMode === "blueprint" && (!sidebarCollapsed || !isDesktop) && (
      <div style={{ padding: "10px 10px 12px", borderTop: `1px solid ${T.separator}` }}>
       <a href={`https://2179191.my1003app.com/952015/register${realtorPartnerSlug ? "?source=" + encodeURIComponent(realtorPartnerSlug) : ""}`} target="_blank" rel="noopener noreferrer"
        style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, width: "100%", boxSizing: "border-box", padding: "10px 12px", background: `linear-gradient(135deg, ${T.green}, #059669)`, border: "none", borderRadius: 10, color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: FONT, textAlign: "center", textDecoration: "none", letterSpacing: "0.02em", boxShadow: `0 2px 10px ${T.green}30` }}>
        <Icon name="check-circle" size={14} />
        Get Pre-Approved
       </a>
      </div>
     )}
     {sidebarCollapsed && isDesktop && appMode === "blueprint" && (
      <div style={{ padding: "8px 4px", borderTop: `1px solid ${T.separator}`, textAlign: "center" }}>
       <a href={`https://2179191.my1003app.com/952015/register${realtorPartnerSlug ? "?source=" + encodeURIComponent(realtorPartnerSlug) : ""}`} target="_blank" rel="noopener noreferrer"
        style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, textDecoration: "none", cursor: "pointer", padding: "4px 0" }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: `linear-gradient(135deg, ${T.green}, #059669)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
         <Icon name="check-circle" size={14} color="#fff" />
        </div>
       </a>
       <div style={{ fontSize: 9, fontWeight: 700, color: T.blue, fontFamily: FONT, marginTop: 4 }}>{fmt(calc.housingPayment)}</div>
      </div>
     )}
    </div>
   )}
   {/* ═══ MAIN CONTENT AREA ═══ */}
   <div className={isDesktop ? "bp-main-content" : ""} style={{ flex: 1, maxWidth: isDesktop && splitMode ? `calc(${splitRatio}vw - ${sidebarCollapsed ? 56 : 270}px)` : isDesktop ? `calc(100% - ${sidebarCollapsed ? 56 : 270}px)` : 480, margin: isDesktop ? 0 : "0 auto", marginLeft: isDesktop ? (sidebarCollapsed ? 56 : 270) : undefined, paddingBottom: isDesktop ? 40 : "calc(90px + env(safe-area-inset-bottom, 0px))", overflowY: "visible", height: "auto", width: isDesktop ? `calc(100% - ${sidebarCollapsed ? 56 : 270}px)` : "100%", overflow: splitMode ? "hidden" : "visible" }}>
  {/* ═══ UNIFIED HEADER — persistent across all Blueprint tabs ═══
       Now rendered for borrowers too (2026-05-12). UnifiedHeader has its
       own internal isBorrower gate that hides the multi-client picker row
       while keeping the brand + scenario name + qualification chips visible. */}
  {appMode === "blueprint" && (
   <UnifiedHeader
    salesPrice={salesPrice} calc={calc} creditScore={creditScore}
    downPct={downPct} loanType={loanType} isRefi={isRefi}
    refiPurpose={refiPurpose} firstTimeBuyer={firstTimeBuyer}
    allGood={allGood} someGood={someGood}
    purchPillarCount={purchPillarCount} refiPillarCount={refiPillarCount}
    dpOk={dpOk} refiLtvCheck={refiLtvCheck}
    scenarioName={scenarioName} scenarioList={scenarioList} switchScenario={switchScenario}
    saving={saving} loaded={loaded} cloudSyncStatus={cloudSyncStatus} sync={sync}
    borrowerName={borrowerName}
    darkMode={darkMode} themeMode={themeMode} cycleTheme={cycleTheme}
    privacyMode={privacyMode} setPrivacyMode={setPrivacyMode}
    isDesktop={isDesktop} sidebarCollapsed={sidebarCollapsed} T={T}
    skillLevel={skillLevel}
    onToggleSkillLevel={() => saveSkillLevel(skillLevel === 'guided' ? 'standard' : 'guided')}
    appMode={appMode} setAppMode={setAppMode}
    onOpenMobileMenu={() => setMobileMenuOpen(true)}
    tab={tab}
    tabLabel={(TABS.find(([k]) => k === tab) || [])[1] || ''}
    setTab={setTab} onCompare={() => setTab("compare")}
    isCloud={isCloud} isBorrower={isBorrower} auth={auth}
    showAccountButton={!isBorrower && !isCloud}
    selfAccount={selfMode ? (account.account || { email: account.session?.user?.email || '' }) : null}
    onOpenAccountSheet={() => setShowAccountSheet(true)}
    selfSyncStatus={selfMode && account.syncEnabled ? selfSync.status : ''}
    borrowerList={borrowerList} activeBorrower={activeBorrower}
    borrowerLoading={borrowerLoading}
    borrowerScenarios={borrowerScenarios}
    borrowerScenariosLoading={borrowerScenariosLoading}
    BorrowerPicker={BorrowerPicker}
    borrowerPickerCallbacks={{
     onSelect: async (b) => {
      if (!b) { setActiveBorrower(null); setActiveScenarioId(null); setBorrowerScenarios([]); return; }
      setActiveBorrower(b); setActiveScenarioId(null); setBorrowerScenariosLoading(true);
      try { const scens = await apiFetchScenarios(b.id); setBorrowerScenarios(scens || []); }
      catch (err) { console.warn('[Blueprint] Failed to load scenarios:', err.message); setBorrowerScenarios([]); }
      setBorrowerScenariosLoading(false);
     },
     onSelectScenario: (scenario) => {
      if (scenario.state_data) loadState(scenario.state_data);
      setActiveScenarioId(scenario.id);
      setScenarioName(scenario.name || 'Scenario 1');
      sync.initSync(scenario.state_data, scenario.locked_fields);
     },
     onAutoCreateScenario: async (borrower) => {
      try {
       let prefillState = {};
       try { const r = await fetchBorrowerPrefill(borrower.id); if (r?.prefill) prefillState = r.prefill; } catch {}
       const newScenario = await apiCreateScenario({ borrower_id: borrower.id, name: 'Scenario 1', type: 'purchase', state_data: prefillState, calc_summary: {} });
       const s = Array.isArray(newScenario) ? newScenario[0] : newScenario;
       if (s?.id) { if (Object.keys(prefillState).length > 0) loadState(prefillState); setActiveScenarioId(s.id); setScenarioName(s.name || 'Scenario 1'); sync.initSync(prefillState, null); setBorrowerScenarios([s]); }
      } catch (err) { console.warn('[Blueprint] Failed to auto-create scenario:', err.message); }
     },
     onCreateNew: async (prefillName) => {
      const name = prefillName || prompt("New client name:"); if (!name) return;
      try { const result = await createBorrower({ name, status: 'active' }); const newB = result?.[0] || result;
       if (newB?.id) { setBorrowerList(prev => [...prev, newB]); setActiveBorrower(newB); setActiveScenarioId(null); setBorrowerScenarios([]); }
      } catch (err) { alert('Failed to create client: ' + err.message); }
     },
    }}
    mobileTabBar={null /* horizontal scroll tab strip removed (2026-05-03)
      — all tabs now live in the RealStack shell drawer (hamburger top-left).
      Saved ~50px of sticky fold and removed nav-redundancy with the drawer. */}
   />
  )}
  {/* ═══ ACCOUNT SHEET + FIRST-RUN CLOUD MERGE (public calculator only) ═══ */}
  {!isBorrower && !isCloud && (
   <AccountSheet
    open={showAccountSheet}
    onClose={() => setShowAccountSheet(false)}
    accountHook={account}
    onResetSync={selfSync.resetSync}
    T={T} darkMode={darkMode}
   />
  )}
  {selfMode && account.syncEnabled && Array.isArray(selfSync.mergeCandidates) && selfSync.mergeCandidates.length > 0 && (
   <CloudMergeSheet
    candidates={selfSync.mergeCandidates}
    onUpload={async (names) => { await selfSync.uploadLocal(names); }}
    onSkip={selfSync.skipMerge}
    T={T} darkMode={darkMode}
   />
  )}
  {isOffline && <div style={{ background: '#F59E0B22', border: '1px solid #F59E0B44', borderRadius: 8, padding: '8px 16px', margin: '8px 16px 0', fontSize: 12, color: '#F59E0B', textAlign: 'center' }}>You're offline — some features may be unavailable</div>}
  {/* ── Borrower mode header bar (removed 2026-05-12) ──
      Was a gradient pill reading "Your Blueprint · PREPARED FOR <name>"
      shown when isBorrower. UnifiedHeader now renders for borrowers too
      (scenario name + qualification chips + sync status), so this
      duplicate header is gone. PresenceBar below still surfaces who's on
      the page in real time. */}
  {/* Real-time presence bar — shows who else is viewing this blueprint */}
  {sync.onlineUsers.length > 0 && (
   <div style={{ padding: '8px 16px 0' }}>
    <PresenceBar onlineUsers={sync.onlineUsers} fieldFocus={{}} />
   </div>
  )}
  {/* ═══ CONSENT MODAL ═══ */}
  {!consentGiven && <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
   <div style={{ background: T.card, borderRadius: 24, maxWidth: 400, width: "100%", padding: "28px 22px", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}>
    <div style={{ fontSize: 32, textAlign: "center", marginBottom: 12 }}></div>
    <div style={{ fontSize: 20, fontWeight: 700, textAlign: "center", marginBottom: 8 }}>Secure Financial Tool</div>
    <div style={{ fontSize: 13, color: T.textSecondary, lineHeight: 1.7, marginBottom: 20, textAlign: "center" }}>
     This mortgage calculator processes sensitive financial information including income, debts, credit scores, and assets. By continuing, you acknowledge:
    </div>
    <div style={{ background: T.pillBg, borderRadius: 14, padding: 14, marginBottom: 16, fontSize: 12, color: T.textSecondary, lineHeight: 1.8 }}>
     <div style={{ marginBottom: 6 }}><strong>Data stays on this device</strong> unless you sign in and turn on cloud sync</div>
     <div style={{ marginBottom: 6 }}><strong>Privacy Mode</strong> available to mask sensitive numbers</div>
     <div style={{ marginBottom: 6 }}><strong>Emailed summaries</strong> are not encrypted — use caution</div>
     <div style={{ marginBottom: 6 }}> <strong>You can delete all data</strong> at any time in Settings</div>
     <div><strong>Not a commitment to lend</strong> — estimates only</div>
    </div>
    <div style={{ fontSize: 11, color: T.textTertiary, textAlign: "center", marginBottom: 16 }}>
     Chris Granger Mortgage · NMLS #952015
    </div>
    <button onClick={handleConsent} style={{ width: "100%", padding: 16, background: T.blue, border: "none", borderRadius: 14, color: "#fff", fontWeight: 700, fontSize: 16, cursor: "pointer", fontFamily: FONT }}>
     I Understand — Continue
    </button>
   </div>
  </div>}
  {/* ═══ WELCOME TUTORIAL ═══ */}
  {showWelcome && consentGiven && !isLocked && (() => {
   const steps = [
    { emoji: "home", title: "Welcome to RealStack Blueprint", body: "Your complete mortgage planning tool — designed to help you understand exactly what you can afford, what it costs, and how homeownership builds wealth.\n\nWhether you're buying your first home or your fifth, this app breaks down every number so you can make confident decisions.", color: T.blue },
    { emoji: "", title: "How to Navigate", body: "Follow the sections from top to bottom — each one builds on the last:\n\nSetup — Enter property details\nCalculator — See your monthly payment\nCosts — Full closing cost breakdown\n Income → Debts → Assets — Your full financial picture\nQualify — Check if you're approved\nTax Savings → Amortization — See the long game", color: T.cyan },
    { emoji: "bar-chart", title: "Compare Loan Options", body: "Not sure which option is best? Create multiple loan scenarios — try different prices, rates, or loan types — then compare them side-by-side on the Workspace tab.\n\nPro tip: Duplicate a scenario instead of starting from scratch — it copies your credit, income, assets, and debts so you only need to change the numbers you're testing.", color: T.green },
    { emoji: "", title: "You're Ready!", body: "Start by entering a zip code in Setup to auto-fill tax rates and transfer taxes for your area.\n\nEvery number is calculated in real time — change anything and watch the whole picture update instantly.", color: T.green },
    { emoji: "target", title: "Bonus: PricePoint", body: "Think you know your local market? PricePoint pulls real listings from your area and challenges you to guess the price.\n\nSwipe through photos, read the MLS description, and lock in your guess — then see how close you were. Earn XP, level up from Studio Condo to Mega Mansion, and unlock achievement badges along the way.\n\nFind it in the top-left corner of the app.", color: T.purple },
   ];
   const step = steps[welcomeStep];
   return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 9997, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
     <div style={{ background: T.card, borderRadius: 24, maxWidth: 380, width: "100%", padding: "32px 24px", boxShadow: "0 20px 60px rgba(0,0,0,0.5)", textAlign: "center", position: "relative", display: "flex", flexDirection: "column", height: 520 }}>
      <span onClick={() => { setShowWelcome(false); try { localStorage.setItem("mb_welcomed", "1"); LS.set("has-seen-welcome", "1"); } catch {} }} style={{ position: "absolute", top: 16, right: 20, fontSize: 12, color: T.textTertiary, cursor: "pointer", fontFamily: FONT, opacity: 0.6 }}>Skip</span>
      <div style={{ marginBottom: 16, display: "flex", justifyContent: "center", color: step.color || T.blue, minHeight: 48 }}>{step.emoji ? <Icon name={step.emoji} size={48} /> : null}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: T.text, marginBottom: 10, fontFamily: FONT }}>{step.title}</div>
      <div style={{ fontSize: 13, color: T.textSecondary, lineHeight: 1.7, marginBottom: 24, whiteSpace: "pre-line", textAlign: "left", flex: 1, overflow: "auto" }}>{step.body}</div>
      {/* Progress dots */}
      <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 20 }}>
       {steps.map((_, i) => (
        <div key={i} style={{ width: i === welcomeStep ? 24 : 8, height: 8, borderRadius: 4, background: i === welcomeStep ? step.color : T.ringTrack, transition: "all 0.3s" }} />
       ))}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
       {welcomeStep > 0 && (
        <button onClick={() => setWelcomeStep(s => s - 1)} style={{ flex: 1, padding: "14px 0", background: T.inputBg, border: "none", borderRadius: 14, color: T.textSecondary, fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>Back</button>
       )}
       <button onClick={() => {
        if (welcomeStep < steps.length - 1) { setWelcomeStep(s => s + 1); }
        else { setShowWelcome(false); try { localStorage.setItem("mb_welcomed", "1"); LS.set("has-seen-welcome", "1"); } catch {} }
       }} style={{ flex: 2, padding: "14px 0", background: step.color, border: "none", borderRadius: 14, color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: FONT }}>
        {welcomeStep < steps.length - 1 ? "Next" : "Let's Go!"}
       </button>
      </div>
     </div>
    </div>
   );
  })()}
  {/* ═══ LOCK SCREEN ═══ */}
  {isLocked && consentGiven && <div style={{ position: "fixed", inset: 0, background: T.bg, zIndex: 9998, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 20 }}>
   <div style={{ fontSize: 48, marginBottom: 16 }}></div>
   <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>App Locked</div>
   <div style={{ fontSize: 13, color: T.textTertiary, marginBottom: 24 }}>Enter your PIN to unlock</div>
   <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
    {[0,1,2,3,4,5].map(i => (
     <div key={i} style={{ width: 16, height: 16, borderRadius: "50%", background: pinInput.length > i ? T.blue : T.ringTrack, transition: "all 0.2s" }} />
    ))}
   </div>
   <input type="password" inputMode="numeric" pattern="[0-9]*" maxLength={6} value={pinInput} onChange={e => { const v = e.target.value.replace(/\D/g,""); setPinInput(v); setPinError(""); }}
    onKeyDown={e => { if (e.key === "Enter") handleUnlock(); }}
    style={{ width: 200, textAlign: "center", fontSize: 28, letterSpacing: 12, background: T.inputBg, border: `2px solid ${pinError ? T.red : T.separator}`, borderRadius: 16, padding: "14px", color: T.text, outline: "none", fontFamily: FONT }}
    autoFocus placeholder="••••" />
   {pinError && <div style={{ color: T.red, fontSize: 13, fontWeight: 600, marginTop: 8 }}>{pinError}</div>}
   <button onClick={handleUnlock} style={{ marginTop: 16, padding: "12px 40px", background: T.blue, border: "none", borderRadius: 12, color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer", fontFamily: FONT }}>Unlock</button>
  </div>}
  {/* ═══ CLEAR DATA CONFIRMATION ═══ */}
  {showClearConfirm && <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 9997, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
   <div style={{ background: T.card, borderRadius: 20, maxWidth: 380, width: "100%", padding: "24px 20px" }}>
    <div style={{ fontSize: 28, textAlign: "center", marginBottom: 8 }}></div>
    <div style={{ fontSize: 18, fontWeight: 700, textAlign: "center", marginBottom: 8, color: T.red }}>
     {clearStep === 0 ? "Clear All Data?" : "Are You ABSOLUTELY Sure?"}
    </div>
    <div style={{ fontSize: 13, color: T.textSecondary, textAlign: "center", lineHeight: 1.6, marginBottom: 20 }}>
     {clearStep === 0 ? "This will permanently delete ALL scenarios, borrower data, PIN, and preferences. This cannot be undone." : "This is your FINAL confirmation. All financial data, scenarios, and settings will be permanently erased from this device."}
    </div>
    <div style={{ display: "flex", gap: 10 }}>
     <button onClick={() => { setShowClearConfirm(false); setClearStep(0); }} style={{ flex: 1, padding: 14, background: T.pillBg, border: `1px solid ${T.separator}`, borderRadius: 12, color: T.text, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>Cancel</button>
     <button onClick={() => { if (clearStep === 0) setClearStep(1); else handleClearAll(); }} style={{ flex: 1, padding: 14, background: T.red, border: "none", borderRadius: 12, color: "#fff", fontWeight: 700, cursor: "pointer", fontFamily: FONT }}>
      {clearStep === 0 ? "Yes, Clear" : "DELETE EVERYTHING"}
     </button>
    </div>
   </div>
  </div>}
  {/* ═══ FEES WORKSHEET → GMAIL SEND MODAL ═══ */}
  {showWorksheetModal && <SendWorksheetModal
   open={showWorksheetModal}
   onClose={() => setShowWorksheetModal(false)}
   T={T}
   buildWorksheetProps={buildWorksheetProps}
   defaultTo={borrowerEmail}
   defaultSubject={`Your ${isRefi ? "Refinance" : "Purchase"} Fees Worksheet — ${scenarioName}`}
   defaultBody={buildWorksheetEmailBody()}
   loEmail={loEmail}
   loanOfficer={loanOfficer}
   scenarioName={scenarioName}
   borrowerName={borrowerName}
   realtorPartner={realtorPartner}
   onFallbackMailto={handleEmailSummary}
  />}
  {/* ═══ BORROWER "EMAIL ME THIS WORKSHEET" (Resend via Ops) ═══ */}
  {showBorrowerSend && <BorrowerSendModal
   open={showBorrowerSend}
   onClose={() => setShowBorrowerSend(false)}
   T={T}
   buildWorksheetProps={buildWorksheetProps}
   scenarioName={scenarioName}
   borrowerName={borrowerName}
   defaultTo={borrowerEmail}
   loanOfficer={loanOfficer}
   loEmail={loEmail}
  />}
  {/* ═══ SHARE MODAL ═══ */}
  {showEmailModal && <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={() => setShowEmailModal(false)}>
   <div style={{ background: T.card, borderRadius: "20px 20px 0 0", maxWidth: 480, width: "100%", maxHeight: "85vh", overflowY: "auto", padding: "20px 18px 30px" }} onClick={e => e.stopPropagation()}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
     <div style={{ fontSize: 18, fontWeight: 700, fontFamily: FONT }}>Share {isRefi ? "Refi" : "Purchase"} Estimate</div>
     <button onClick={() => setShowEmailModal(false)} style={{ background: T.pillBg, border: "none", borderRadius: 20, width: 32, height: 32, fontSize: 16, cursor: "pointer", color: T.textSecondary }}>✕</button>
    </div>
    <div style={{ marginBottom: 12 }}>
     <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: T.textSecondary, marginBottom: 6, fontFamily: FONT }}>Borrower Name</label>
     <input value={borrowerName} onChange={e => setBorrowerName(e.target.value)} placeholder="Client's full name"
      style={{ width: "100%", boxSizing: "border-box", background: T.inputBg, borderRadius: 12, border: `1px solid ${T.inputBorder}`, padding: "12px 14px", color: T.text, fontSize: 15, outline: "none", fontFamily: FONT }} />
    </div>
    <div style={{ marginBottom: 16 }}>
     <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: T.textSecondary, marginBottom: 6, fontFamily: FONT }}>Borrower Email</label>
     <input value={borrowerEmail} onChange={e => setBorrowerEmail(e.target.value)} placeholder="borrower@email.com"
      style={{ width: "100%", boxSizing: "border-box", background: T.inputBg, borderRadius: 12, border: `1px solid ${T.inputBorder}`, padding: "12px 14px", color: T.text, fontSize: 15, outline: "none", fontFamily: FONT }} />
    </div>
    {loEmail && <div style={{ fontSize: 12, color: T.textTertiary, marginBottom: 12, padding: "8px 12px", background: T.pillBg, borderRadius: 8 }}>
     BCC: {loEmail} <span style={{ fontSize: 11 }}>(you\'ll get a copy)</span>
    </div>}
    {!loEmail && <Note color={T.orange}>Add your email in Settings → Team to auto-BCC yourself.</Note>}
    {/* ── Static summary row: Email Summary + Save PDF ── */}
    <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
     <button onClick={() => { setShowEmailModal(false); handleEmailWorksheet(); }} style={{ flex: 1, padding: 16, background: T.blue, border: "none", borderRadius: 14, color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer", fontFamily: FONT, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
      Email Worksheet (PDF)
     </button>
     {/* Purchase → fees worksheet download; refi → legacy refi estimate. */}
     <button onClick={() => { handleSaveScenarioPdf(); setShowEmailModal(false); }} style={{ flex: 1, padding: 16, background: `${T.blue}12`, border: `1px solid ${T.blue}30`, borderRadius: 14, color: T.blue, fontWeight: 700, fontSize: 15, cursor: "pointer", fontFamily: FONT, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
      Save PDF
     </button>
    </div>
    {/* ── Divider: "OR SEND A LIVE LINK" ── */}
    <div style={{
     display: "flex", alignItems: "center", gap: 10, margin: "14px 0 12px",
     fontSize: 11, fontFamily: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace",
     letterSpacing: 2, textTransform: "uppercase",
     color: T.textTertiary, fontWeight: 600,
    }}>
     <div style={{ flex: 1, height: 1, background: T.separator }} />
     Or send a live link
     <div style={{ flex: 1, height: 1, background: T.separator }} />
    </div>
    {/* ── Live-link row: Email Live Link + Copy Live Link ── */}
    {/* Live link saves the current scenario to a borrower row and ships the
        share URL by email or clipboard. The borrower clicks the link, signs
        in via magic-link, and lands inside Blueprint pre-filled — every
        change they make round-trips back to Ops where the LO can see it. */}
    <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
     <button
      disabled={liveLinkSending || !borrowerEmail || !isCloud}
      onClick={() => handleSendLiveLink('email')}
      style={{
       flex: 1, padding: 16,
       background: 'linear-gradient(135deg, #6366F1, #3B82F6)',
       border: 'none', borderRadius: 14, color: '#fff',
       fontWeight: 700, fontSize: 15,
       cursor: (liveLinkSending || !borrowerEmail || !isCloud) ? 'not-allowed' : 'pointer',
       fontFamily: FONT,
       display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
       opacity: (liveLinkSending || !borrowerEmail || !isCloud) ? 0.5 : 1,
       boxShadow: (liveLinkSending || !borrowerEmail || !isCloud) ? 'none' : '0 4px 14px rgba(99,102,241,0.3)',
      }}
     >
      <Icon name="mail" size={14} />
      {liveLinkSending ? 'Sending…' : 'Email Live Link'}
     </button>
     <button
      disabled={liveLinkSending || !isCloud}
      onClick={() => handleSendLiveLink('copy')}
      style={{
       flex: 1, padding: 16,
       background: `${T.blue}12`, border: `1px solid ${T.blue}30`,
       borderRadius: 14, color: T.blue,
       fontWeight: 700, fontSize: 15,
       cursor: (liveLinkSending || !isCloud) ? 'not-allowed' : 'pointer',
       fontFamily: FONT,
       display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
       opacity: (liveLinkSending || !isCloud) ? 0.5 : 1,
      }}
     >
      <Icon name="link" size={14} />
      Copy Live Link
     </button>
    </div>
    {/* ── Passive disabled-state hint ──
        When the user can't actually click the live-link buttons (not signed
        in, or modal email blank), tell them WHY before they wonder. We hide
        this once an error or toast banner takes over so we never stack two
        explanatory rows on top of each other. */}
    {!liveLinkError && !liveLinkToast && (!isCloud || !borrowerEmail) && (
     <div style={{
      fontSize: 12, color: T.textTertiary, lineHeight: 1.4,
      padding: '8px 12px', marginBottom: 8,
      background: T.pillBg, borderRadius: 8,
      fontFamily: FONT,
     }}>
      {!isCloud
       ? "Sign in to send a live link. The Email Summary, Save PDF, and Copy to Clipboard options below still work."
       : "Add a borrower email above to enable live-link send."}
     </div>
    )}
    {liveLinkError && (
     <div style={{
      fontSize: 12, color: T.red, lineHeight: 1.4,
      padding: '8px 12px', marginBottom: 8,
      background: `${T.red}10`, borderRadius: 8,
      fontFamily: FONT,
     }}>
      {liveLinkError}
     </div>
    )}
    {liveLinkToast && (
     <div style={{
      fontSize: 12, color: T.green, fontWeight: 600,
      padding: '8px 12px', marginBottom: 8,
      background: `${T.green}12`, borderRadius: 8,
      fontFamily: FONT,
      display: 'flex', alignItems: 'center', gap: 6,
     }}>
      <Icon name="check" size={12} /> {liveLinkToast}
     </div>
    )}
    <button onClick={() => { navigator.clipboard.writeText(generateSummaryText()); setShowEmailModal(false); }} style={{ width: "100%", padding: 12, background: "transparent", border: "none", color: T.textTertiary, fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: FONT }}>
     Copy to Clipboard
    </button>
    <div style={{ background: `${T.orange}10`, borderRadius: 10, padding: "8px 12px", marginTop: 8 }}>
     <div style={{ fontSize: 10, color: T.textTertiary, lineHeight: 1.5 }}>Email is not encrypted. This is not an official loan quote. Only send to verified recipients.</div>
    </div>
   </div>
  </div>}
   {/* PricePoint / Markets header for mobile — mirrors Blueprint's
       UnifiedHeader pattern (2026-05-03): hamburger button on the left
       opens the RealStack shell drawer, wordmark in the same bold font
       as "Blueprint". The Blueprint|PricePoint segmented pill that used
       to live here was removed because cross-product nav now lives in
       the drawer. Desktop continues to use the sidebar switcher. */}
   {!isDesktop && appMode !== "blueprint" && (
    <div style={{
      position: "sticky", top: 0,
      zIndex: 60, background: T.headerBg,
      backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
      borderBottom: `1px solid ${T.separator}`,
      paddingTop: "max(0px, env(safe-area-inset-top))",
    }}>
     <div style={{
       display: "flex", alignItems: "center", gap: 8,
       padding: "0 14px", minHeight: 40,
     }}>
      {/* Hamburger — opens the RealStack shell drawer */}
      <button
       onClick={() => setMobileMenuOpen(true)}
       title="Open menu"
       style={{
        background: "transparent", border: "none",
        width: 28, height: 28, padding: 0, cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: T.text, flexShrink: 0,
       }}
      >
       <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="3" y1="6" x2="21" y2="6" />
        <line x1="3" y1="12" x2="21" y2="12" />
        <line x1="3" y1="18" x2="21" y2="18" />
       </svg>
      </button>
      {/* Wordmark — same bold style as the Blueprint wordmark */}
      <span style={{
       fontSize: 14, fontWeight: 800,
       letterSpacing: "-0.03em", color: T.text,
       whiteSpace: "nowrap",
      }}>{appMode === "pricepoint" ? "PricePoint" : appMode === "markets" ? "Markets" : ""}</span>
     </div>
    </div>
   )}
   {/* ── Realtor Partner Co-Brand Bar ── */}
   {realtorPartner && (
    <div style={{ padding: "0 16px 8px" }}>
     <div style={{ display: "flex", alignItems: "center", gap: 12, background: T.card, borderRadius: 14, padding: "10px 14px", border: `1px solid ${T.cardBorder}`, boxShadow: T.cardShadow }}>
      {realtorPartner.photo ? (
       <img src={realtorPartner.photo} alt={realtorPartner.name} style={{ width: 40, height: 40, borderRadius: 20, objectFit: "cover", flexShrink: 0 }} />
      ) : (
       <div style={{ width: 40, height: 40, borderRadius: 20, background: `${T.blue}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700, color: T.blue, flexShrink: 0 }}>
        {realtorPartner.name.split(" ").map(n => n[0]).join("")}
       </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
       <div style={{ fontSize: 14, fontWeight: 700, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{realtorPartner.name}</div>
       <div style={{ fontSize: 11, color: T.textTertiary }}>{realtorPartner.title}{realtorPartner.brokerage ? ` · ${realtorPartner.brokerage}` : ""}{realtorPartner.dre ? ` · DRE #${realtorPartner.dre}` : ""}</div>
      </div>
      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
       {realtorPartner.phone && (
        <a href={`tel:${realtorPartner.phone}`} style={{ background: `${T.green}15`, borderRadius: 10, width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none", fontSize: 16 }}></a>
       )}
       {realtorPartner.email && (
        <a href={`mailto:${realtorPartner.email}`} style={{ background: `${T.blue}15`, borderRadius: 10, width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none", fontSize: 16 }}></a>
       )}
      </div>
     </div>
    </div>
   )}
   {/* ── Welcome Modal — shown only on first visit when no skill level set ── */}
   {appMode === "blueprint" && skillLevel === null && (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(0,0,0,0.7)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      padding: 20
    }}>
      <div style={{
        background: T.card,
        borderRadius: 20,
        padding: isDesktop ? 40 : 28,
        maxWidth: 420,
        width: '100%',
        textAlign: 'center',
        border: `1px solid ${T.cardBorder}`,
        boxShadow: '0 20px 60px rgba(0,0,0,0.4)'
      }}>
        <div style={{
          fontFamily: FONT,
          fontSize: '0.6rem',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '2px',
          color: T.textTertiary,
          marginBottom: 16
        }}>REALSTACK BLUEPRINT</div>
        <h2 style={{
          fontFamily: FONT,
          fontSize: 22,
          fontWeight: 800,
          color: T.text,
          margin: '0 0 8px 0',
          letterSpacing: '-0.03em'
        }}>Welcome</h2>
        <p style={{
          fontSize: 14,
          color: T.textSecondary,
          margin: '0 0 24px 0',
          lineHeight: 1.5
        }}>How familiar are you with the mortgage process?</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { level: 'guided', title: 'First-Time Buyer', desc: 'Walk me through it step by step', icon: '\u2302' },
            { level: 'standard', title: 'I Know the Basics', desc: "Give me full access \u2014 I'll explore on my own", icon: '\u25C8' },
          ].map(opt => (
            <button
              key={opt.level}
              onClick={() => { saveSkillLevel(opt.level); }}
              style={{
                padding: '16px 18px',
                borderRadius: 14,
                border: `1px solid ${T.cardBorder}`,
                background: T.inputBg,
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                transition: 'all 0.15s'
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = T.blue; e.currentTarget.style.background = T.blue + '10'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = T.cardBorder; e.currentTarget.style.background = T.inputBg; }}
            >
              <div style={{
                width: 40, height: 40,
                borderRadius: 10,
                background: T.blue + '15',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 18,
                color: T.blue,
                flexShrink: 0
              }}>{opt.icon}</div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: T.text }}>{opt.title}</div>
                <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 2 }}>{opt.desc}</div>
              </div>
            </button>
          ))}
        </div>
        <div style={{ fontSize: 11, color: T.textTertiary, marginTop: 16 }}>You can change this anytime in Settings</div>
      </div>
    </div>
   )}
   {/* ── Blueprint Mode ── */}
   {appMode === "blueprint" && <>
   {/* ── Content area (pushed down by fixed UnifiedHeader) ──
       Mobile header: Row 1 (48) + stats (~46) = 94px + safe-area.
       Cloud mode adds the LO picker row (+24) = 118px + safe-area.
       Desktop: Row 1 (44) + stats (48) + border = 96, no safe-area. */}
   <div style={{ paddingTop: isDesktop ? 96 : `calc(${isCloud && !isBorrower ? 116 : 92}px + env(safe-area-inset-top, 0px))` }} />
   <div style={{ padding: isDesktop ? "0 32px" : "0 20px", maxWidth: isDesktop ? "min(1600px, 92vw)" : "none", margin: isDesktop ? "0 auto" : 0 }} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
<TabIntro id={tab} />
{/* ═══ CALCULATOR ═══ */}
{tab === "calc" && <CalculatorContent {...{T, isDesktop, calc, fmt, fmt2, pct, changedFields, paySegs, salesPrice, setSalesPrice, city, taxState, isRefi, downPct, setDownPct, downMode, setDownMode, loanType, setLoanType, firstTimeBuyer, includeEscrow, setIncludeEscrow, loanPurpose, setLoanPurpose, refiCurrentRate, rate, setRate, term, setTerm, refiPurpose, refiCashOut, refiNewLoanAmtOverride, setRefiNewLoanAmtOverride, isPulse, markTouched, fetchRates, ratesLoading, ratesError, liveRates, fredApiKey, userLoanTypeRef, setAutoJumboSwitch, autoJumboSwitch, LOAN_TYPES, vaUsage, setVaUsage, VA_USAGE, getHighBalLimit, UNIT_COUNT, propType, setPropType, PROP_TYPES, subjectRentalIncome, setSubjectRentalIncome, propertyState, setPropertyState, setCity, propertyCounty, setPropertyCounty, STATE_NAMES_PROP, CITY_NAMES, STATE_CITIES, propTaxMode, STATE_PROPERTY_TAX_RATES, taxRateLocked, setTaxRateLocked, taxExemptionLocked, setTaxExemptionLocked, taxBaseRateOverride, setTaxBaseRateOverride, propTaxExpanded, setPropTaxExpanded, fixedAssessments, setFixedAssessments, CITY_TAX_RATES, taxExemptionOverride, setTaxExemptionOverride, propTaxCustomize, setPropTaxCustomize, pmiRateLocked, setPmiRateLocked, pmiRateOverride, setPmiRateOverride, pmiChartOverrides, setPmiChartOverrides, annualIns, setAnnualIns, hoa, setHoa, underwritingFee, processingFee, propertyZip, setPropertyZip, creditScore, StopLight, handlePillarClick, allGood, someGood, refiPillarCount, purchPillarCount, refiLtvCheck, PayRing, Card, Inp, Sel, Note, SearchSelect, InfoTip, Icon, GuidedNextButton, ClusterContinue}} />}
{tab === "amort" && <AmortContent {...{T, isDesktop, calc, fmt, payExtra, setPayExtra, extraPayment, setExtraPayment, amortView, setAmortView, term, rate, salesPrice, appreciationRate, setAppreciationRate, isPulse, markTouched, Hero, Card, Inp, Tab, MRow, AmortChart, GuidedNextButton}} />}
{/* ═══ COSTS ═══ */}
{tab === "costs" && <CostsContent {...{T, isDesktop, calc, fmt, fmt2, isRefi, downPct, underwritingFee, setUnderwritingFee, processingFee, setProcessingFee, adminFee, setAdminFee, lenderWireFee, setLenderWireFee, discountPts, setDiscountPts, originatorComp, setOriginatorComp, appraisalFee, setAppraisalFee, creditReportFee, setCreditReportFee, floodCertFee, setFloodCertFee, mersFee, setMersFee, taxServiceFee, setTaxServiceFee, escrowFee, setEscrowFee, courierFee, setCourierFee, loanTieInFee, setLoanTieInFee, notaryFee, setNotaryFee, envProtectionLien, setEnvProtectionLien, titleInsurance, setTitleInsurance, titleSearch, setTitleSearch, settlementFee, setSettlementFee, transferTaxCity, setTransferTaxCity, transferTaxSplit, setTransferTaxSplit, transferTaxCountySplit, setTransferTaxCountySplit, city, propertyState, salesPrice, getTTCitiesForState, getTTForCity, recordingFee, setRecordingFee, ownersTitleIns, setOwnersTitleIns, homeWarranty, setHomeWarranty, hoa, hoaTransferFee, setHoaTransferFee, buyerPaysComm, setBuyerPaysComm, buyerCommPct, setBuyerCommPct, closingMonth, setClosingMonth, closingDay, setClosingDay, closingYear, setClosingYear, propertyTaxesInstallment, setPropertyTaxesInstallment, sellersProratedTaxCredit, setSellersProratedTaxCredit, annualIns, setAnnualIns, includeEscrow, setIncludeEscrow, lenderCredit, setLenderCredit, sellerCredit, setSellerCredit, realtorCredit, setRealtorCredit, emd, setEmd, emdPct, setEmdPct, emdPaid, setEmdPaid, emdLocked, setEmdLocked, emdFlat, setEmdFlat, customFees, setCustomFees, hiddenFees, setHiddenFees, Hero, Card, Sec, Inp, Sel, Note, MRow, GuidedNextButton, skillLevel, isPulse, markTouched, ClusterContinue}} />}
{/* ═══ INCOME ═══ */}
{tab === "income" && <IncomeContent {...{T, isDesktop, calc, fmt, incomes, addIncome, updateIncome, removeIncome, removeBorrower, otherIncome, setOtherIncome, otherIncome2, setOtherIncome2, numBorrowers, setNumBorrowers, borrowerNames, setBorrowerNames, otherIncomeByBorrower, setOtherIncomeByBorrower, Hero, Card, Sec, TextInp, Inp, Sel, Note, Progress, VARIABLE_PAY_TYPES, PAY_TYPES, loanType, isPulse, GuidedNextButton, ClusterContinue}} />}
{/* ═══ ASSETS ═══ */}
{tab === "assets" && <AssetsContent {...{T, isDesktop, calc, fmt, assets, addAsset, updateAsset, removeAsset, Hero, Card, Progress, Sec, TextInp, Inp, Sel, Note, RESERVE_FACTORS, ASSET_TYPES, getReserveFactor, loanType, guideField, isPulse, GuidedNextButton, ClusterContinue}} />}
{/* ═══ DEBTS ═══ */}
{tab === "debts" && <DebtsContent {...{T, isDesktop, calc, fmt, debts, debtFree, setDebtFree, ownsProperties, setOwnsProperties, reos, setReos, syncDebtBalance, syncDebtPayment, guideTouched, markTouched, isPulse, Hero, Card, Sec, TextInp, Inp, Sel, Note, Progress, DEBT_TYPES, PAYOFF_OPTIONS, GuidedNextButton, ClusterContinue}} />}
{/* ═══ REO (Real Estate Owned) ═══ */}
{tab === "reo" && <ReoContent {...{T, isDesktop, calc, fmt, reos, addReo, updateReo, removeReo, syncReoPayment, syncReoBalance, debts, setReos, debtFree, hasSellProperty, setHasSellProperty, sellLinkedReoId, setSellLinkedReoId, sellPrice, setSellPrice, sellMortgagePayoff, setSellMortgagePayoff, sellCommission, setSellCommission, sellTransferTaxCity, setSellTransferTaxCity, sellEscrow, setSellEscrow, sellTitle, setSellTitle, sellOther, setSellOther, sellSellerCredit, setSellSellerCredit, sellCostBasis, setSellCostBasis, sellImprovements, setSellImprovements, sellYearsOwned, setSellYearsOwned, sellPrimaryRes, setSellPrimaryRes, married, taxState, TT_CITY_NAMES, getTTForCity, MRow, ownsProperties, setOwnsProperties, Hero, Card, Sec, Inp, Sel, TextInp, Note, Progress, REO_PROPERTY_TYPES, REO_OCCUPANCY_TYPES, isPulse, markTouched, GuidedNextButton}} />}
{/* ═══ QUALIFY ═══ */}
{tab === "qualify" && <QualifyContent {...{T, isDesktop, calc, fmt, pct, isRefi, loanType, firstTimeBuyer, downPct, setDownPct, creditScore, setCreditScore, refiPurpose, refiLtvCheck, allGood, someGood, refiPillarCount, purchPillarCount, setTab, handlePillarClick, isPulse, isTabUnlocked, affordIncome, affordDebts, affordDown, affordTerm, affordRate, affordLoanType, affordTargetDTI, setAffordTargetDTI, debts, debtFree, salesPrice, setSalesPrice, rate, setRate, term, setTerm, setLoanType, userLoanTypeRef, setAutoJumboSwitch, confirmAffordApply, setConfirmAffordApply, getHighBalLimit, propType, incomes, subjectRentalIncome, otherIncome, otherIncome2, reos, propertyCounty, propertyState, StopLight, Card, Sec, Inp, Note, Progress, Hero, MRow, GuidedNextButton}} />}
{/* ═══ TAX SAVINGS / SCHEDULE E ═══ */}
{tab === "tax" && <TaxContent {...{T, isDesktop, calc, fmt, loanPurpose, subjectRentalIncome, appreciationRate, setAppreciationRate, married, setMarried, FILING_STATUSES, taxState, setTaxState, STATE_NAMES, STATE_TAX, FED_BRACKETS, FED_STD_DEDUCTION, showFedBrackets, setShowFedBrackets, showStateBrackets, setShowStateBrackets, isPulse, markTouched, setTab, Hero, Card, Sec, Inp, Sel, Note, MRow, GuidedNextButton}} />}
{/* ═══ CALIFORNIA PROP 19 TRANSFER ═══ */}
{tab === "prop19" && <Prop19Content {...{T, isDesktop, fmt, prop19, prop19Eligibility, setProp19Eligibility, prop19OldTaxableValue, setProp19OldTaxableValue, prop19OldSalePrice, setProp19OldSalePrice, prop19SaleDate, setProp19SaleDate, prop19PurchaseDate, setProp19PurchaseDate, prop19TransfersUsed, setProp19TransfersUsed, city, propertyCounty, prop19RateOverride, setProp19RateOverride, fixedAssessments, setFixedAssessments, Hero, Card, Sec, Inp, Note, MRow}} />}
{/* ═══ SELLER NET ═══ */}
{tab === "sell" && <SellContent {...{T, isDesktop, calc, fmt, reos, debts, sellLinkedReoId, setSellLinkedReoId, sellPrice, setSellPrice, sellMortgagePayoff, setSellMortgagePayoff, sellCommission, setSellCommission, sellTransferTaxCity, setSellTransferTaxCity, sellEscrow, setSellEscrow, sellTitle, setSellTitle, sellOther, setSellOther, sellSellerCredit, setSellSellerCredit, sellCostBasis, setSellCostBasis, sellImprovements, setSellImprovements, sellYearsOwned, setSellYearsOwned, sellPrimaryRes, setSellPrimaryRes, married, taxState, TT_CITY_NAMES, getTTForCity, Hero, Card, Sec, Inp, Sel, Note, MRow, GuidedNextButton}} />}
{/* ═══ SUMMARY ═══ */}
{tab === "summary" && (<>
 {/* ── CTA Buttons (top of summary) ── */}
 <div style={{ marginTop: 16, marginBottom: 8, display: "flex", gap: 8 }}>
  <button onClick={() => setShowEmailModal(true)} style={{ flex: 1, padding: 16, background: T.blue, border: "none", borderRadius: 14, color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer", fontFamily: FONT, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: `0 4px 14px ${T.blue}30` }}>
   <Icon name="mail" size={16} />
   Email
  </button>
  {activeBorrower?.share_token && (
   <button
    onClick={() => {
     const url = `${WEB_ORIGIN}?share=${activeBorrower.share_token}`;
     navigator.clipboard.writeText(url).then(() => {
      const btn = document.getElementById('bp-share-link-summary');
      if (btn) { btn.querySelector('span').textContent = 'Copied!'; setTimeout(() => { btn.querySelector('span').textContent = 'Copy Link'; }, 2000); }
     }).catch(() => { prompt('Copy this link:', url); });
    }}
    id="bp-share-link-summary"
    style={{ flex: 1, padding: 16, background: 'linear-gradient(135deg, #6366F1, #3B82F6)', border: "none", borderRadius: 14, color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer", fontFamily: FONT, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: '0 4px 14px rgba(99,102,241,0.3)' }}
   >
    <Icon name="link" size={16} />
    <span>Copy Link</span>
   </button>
  )}
 </div>
 {/* ── One-click PDF: fees worksheet for purchases, legacy refi estimate
     for refis. Sits between Email and Get Pre-Approved (Christo 2026-07-05). ── */}
 <button onClick={handleSaveScenarioPdf} style={{ width: "100%", boxSizing: "border-box", padding: 13, marginBottom: 8, background: `${T.blue}12`, border: `1px solid ${T.blue}30`, borderRadius: 14, color: T.blue, fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: FONT, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
  <Icon name="download" size={15} />
  Save Scenario as PDF
 </button>
 {!activeBorrower?.share_token && isCloud && (
  <div style={{ fontSize: 11, color: T.textTertiary, textAlign: "center", marginBottom: 8, fontFamily: FONT }}>
   Select a borrower above to generate a shareable live link
  </div>
 )}
 {loanOfficer && (
  <div style={{ marginBottom: 16 }}>
   <a href={`https://2179191.my1003app.com/952015/register${realtorPartnerSlug ? "?source=" + encodeURIComponent(realtorPartnerSlug) : ""}`} target="_blank" rel="noopener noreferrer"
    style={{ display: "block", width: "100%", boxSizing: "border-box", padding: 16, background: `linear-gradient(135deg, ${T.green}, #059669)`, border: "none", borderRadius: 14, color: "#fff", fontWeight: 700, fontSize: 16, cursor: "pointer", fontFamily: FONT, textAlign: "center", textDecoration: "none", letterSpacing: "0.02em", boxShadow: `0 4px 14px ${T.green}40` }}>
     Get Pre-Approved Now
   </a>
   <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginTop: 8 }}>
    {[["zap", "48hr turnaround"], ["lock", "No hard credit pull"], ["mail", "Direct LO access"]].map(([icon, text], i) => (
     <div key={i} style={{ textAlign: "center", padding: "8px 4px", background: `${T.green}08`, borderRadius: 10, border: `1px solid ${T.green}15` }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 2, color: T.green }}><Icon name={icon} size={16} /></div>
      <div style={{ fontSize: 10, fontWeight: 600, color: T.green, fontFamily: FONT, lineHeight: 1.3 }}>{text}</div>
     </div>
    ))}
   </div>
  </div>
 )}
 <div style={{ marginTop: 8 }}>
  <Hero value={fmt(calc.displayPayment)} label={includeEscrow ? "Monthly Payment" : "Monthly Payment (No Escrow)"} sub={propertyTBD ? "TBD" : (propertyAddress ? propertyAddress : (isRefi ? (calc.refiMonthlyTotalSavings > 0 ? `Save ${fmt(calc.refiMonthlyTotalSavings)}/mo` : `${fmt(calc.totalClosingCosts)} refi costs`) : fmt(calc.cashToClose) + " to close"))} />
  {!propertyTBD && propertyAddress && <div style={{ textAlign: "center", marginTop: -8, marginBottom: 8, fontSize: 12, color: T.textTertiary }}>{fmt(calc.cashToClose)} to close · {city}{propertyCounty ? `, ${propertyCounty} Co.` : ""}</div>}
 </div>
 <Sec title="Loan Overview">
  <Card>
   {[...(propertyTBD ? [["Property", "TBD"]] : (propertyAddress ? [["Property", propertyAddress]] : [])),
    ...(city && propertyState ? [[" ", `${city}, ${propertyState}${propertyZip ? " " + propertyZip : ""}`]] : []),
    [isRefi ? "Home Value" : "Purchase Price", fmt(salesPrice)],
    ...(isRefi ? [
     ["Current Balance", fmt(calc.refiEffBalance || 0)],
     ["Equity", fmt(Math.max(0, salesPrice - (calc.refiEffBalance || 0)))],
     ...(refiPurpose === "Cash-Out" && refiCashOut > 0 ? [["Cash-Out Amount", fmt(refiCashOut)]] : []),
     ["New Loan Amount", fmt(calc.refiNewLoanAmt || 0)],
    ] : [
     ["Down Payment", `${fmt(calc.dp)} (${downPct}%)`],
     ["Base Loan", fmt(calc.baseLoan)],
    ]),
    ...(calc.fhaUp > 0 ? [["FHA UFMIP (1.75%)", fmt(calc.fhaUp)]] : []),
    ...(calc.vaFundingFee > 0 ? [[`VA Funding Fee (${(calc.vaFundingFee / calc.baseLoan * 100).toFixed(2)}%)`, fmt(calc.vaFundingFee)]] : []),
    ...(calc.usdaFee > 0 ? [["USDA Guarantee Fee", fmt(calc.usdaFee)]] : []),
    ...(!isRefi && (calc.fhaUp > 0 || calc.vaFundingFee > 0 || calc.usdaFee > 0) ? [["Total Loan Amount", fmt(calc.loan)]] : (!isRefi ? [["Loan Amount", fmt(calc.loan)]] : [])),
    ["Loan Type", `${loanType}${loanType === "VA" ? " - " + vaUsage : ""} · ${term}yr`],
    [isRefi ? "New Rate" : "Interest Rate", `${rate}%`], ["Category", calc.loanCategory],
    ...(isRefi ? [["Current Rate", refiCurrentRate + "%"], ["Refi Purpose", refiPurpose]] : []),
   ].map(([l, v], i) => (
    <MRow key={i} label={l} value={v} />
   ))}
  </Card>
 </Sec>
 <Sec title="Monthly Breakdown">
  <Card>
   {paySegs.filter(s => s.v > 0).map((s, i) => (
    <MRow key={i} label={s.l} value={fmt(s.v)} color={s.c} tip={s.tip} />
   ))}
   <div style={{ borderTop: `2px solid ${T.separator}`, marginTop: 8, paddingTop: 8 }}>
    <MRow label="Total" value={fmt(calc.displayPayment)} bold />
   </div>
   {!includeEscrow && <Note color={T.orange}>Escrow not included. Tax ({fmt(calc.monthlyTax)}) + Insurance ({fmt(calc.ins)}) = {fmt(calc.escrowAmount)}/mo paid separately. Full PITI: {fmt(calc.housingPayment)}</Note>}
  </Card>
 </Sec>
 <Sec title="Qualification">
  <Card>
   <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
    <StatusPill ok={calc.ficoCheck === "Good!" ? true : calc.ficoCheck === "—" ? null : false} label={`FICO ${creditScore || "—"}`} />
    <StatusPill ok={calc.dtiCheck === "Good!" ? true : calc.dtiCheck === "—" ? null : false} label={`DTI ${calc.qualifyingIncome > 0 ? pct(calc.yourDTI, 1) : "—"}`} />
    <StatusPill ok={calc.cashCheck === "Good!" ? true : calc.cashCheck === "—" ? null : false} label={`Cash ${calc.totalForClosing > 0 ? "✓" : "—"}`} />
    <StatusPill ok={calc.resCheck === "Good!" ? true : calc.resCheck === "—" ? null : false} label={`Reserves ${calc.totalReserves > 0 ? "✓" : "—"}`} />
   </div>
  </Card>
 </Sec>
 {(loanOfficer || realtorName) && <Sec title="Your Team">
  <Card>
   {loanOfficer && <MRow label="Loan Officer" value={loanOfficer} />}
   {loPhone && <MRow label="Phone" value={loPhone} />}
   {loNmls && <MRow label="NMLS" value={"#" + loNmls} />}
   {companyName && <MRow label="Company" value={companyName + (companyNmls ? " · NMLS #" + companyNmls : "")} />}
   {realtorName && <MRow label="Realtor" value={realtorName + (realtorPartner?.brokerage ? ` · ${realtorPartner.brokerage}` : "")} />}
   {realtorPartner?.dre && <MRow label="DRE #" value={realtorPartner.dre} />}
   {realtorPartner?.phone && <MRow label="Realtor Phone" value={realtorPartner.phone} />}
  </Card>
 </Sec>}
 {ownsProperties && reos.length > 0 && <Sec title="Real Estate Owned">
  <Card>
   <MRow label="Properties" value={reos.length.toString()} />
   <MRow label="Total Equity" value={fmt(calc.reoTotalEquity)} color={T.green} />
   <MRow label="Net Cash Flow" value={`${fmt(calc.reoNetCashFlow)}/mo`} color={calc.reoNetCashFlow >= 0 ? T.green : T.red} />
  </Card>
 </Sec>}
 {!loanOfficer && (
  <div style={{ padding: "12px 16px", background: T.warningBg, borderRadius: 12, marginBottom: 12 }}>
   <div style={{ fontSize: 12, color: T.orange, fontWeight: 600 }}>Apply Now available when a Loan Officer is set</div>
   <div style={{ fontSize: 11, color: T.textTertiary, marginTop: 2 }}>Add your LO name and email in Settings → Team.</div>
  </div>
 )}
 {/* ── Collaboration Panel (LO only) ── */}
 {isCloud && !isBorrower && activeScenarioId && (
  <div style={{ marginTop: 16 }}>
   <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
    <div style={{ width: 4, height: 16, borderRadius: 2, background: 'linear-gradient(135deg, #6366F1, #3B82F6)' }} />
    <span style={{ fontSize: 11, fontWeight: 600, color: T.textTertiary, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: FONT }}>COLLABORATION</span>
   </div>
   <LockControls
    scenarioId={activeScenarioId}
    lockedFields={sync.lockedFields}
    userType="lo"
    lockableSections={{
     incomes: { label: 'Income', description: 'Annual income, sources, and frequency' },
     debts: { label: 'Debts', description: 'Monthly debts, car payments, student loans' },
     creditScore: { label: 'Credit Score', description: 'FICO score — verified from credit pull' },
     assets: { label: 'Assets', description: 'Bank balances, retirement, gift funds' },
     employmentInfo: { label: 'Employment', description: 'Employer, years at job, title' },
    }}
    onLockChange={(newLocked) => {
     // Lock change is handled by LockControls component internally
    }}
   />
   <div style={{ marginTop: 12 }}>
    <VersionTimeline
     history={versionHistory}
     bookmarks={versionBookmarks}
     onUndo={handleVersionUndo}
     onRevertTo={handleVersionRevert}
     onCreateBookmark={handleCreateBookmark}
     userType="lo"
     maxVisible={10}
    />
   </div>
  </div>
 )}
 <Card style={{ marginTop: 8, background: T.pillBg }}>
  <div style={{ fontSize: 11, color: T.textTertiary, lineHeight: 1.6 }}>Subject to lender requirements. Rates change daily. Not a commitment to lend.</div>
 </Card>
</>)}
{/* ═══ WORKSPACE (Multi-pane calculator) ═══ */}
{tab === "workspace" && isDesktop && (
 <WorkspaceHost T={T} isDesktop={isDesktop} sidebarW={sidebarCollapsed ? 56 : 270} incomes={incomes} debts={debts} otherIncome={otherIncome} reos={reos} scenarioList={scenarioList} currentScenario={scenarioName} filingStatus={married} />
)}
{/* ═══ OVERVIEW ═══ */}
{tab === "overview" && (
 <Suspense fallback={<div style={{ padding: 40, textAlign: "center", color: T.textTertiary }}>Loading Overview...</div>}>
  <OverviewTab {...{
   /* Core */
   T, isDesktop, darkMode, calc, fmt, fmt2, pct, paySegs, changedFields,
   setTab, isCloud, auth, isBorrower,
   /* Scenario */
   scenarioName, scenarioList, switchScenario, onCompare: () => setTab("compare"),
   /* Borrower account (self-serve cloud sync) */
   showAccountButton: !isBorrower && !isCloud,
   selfAccount: selfMode ? (account.account || { email: account.session?.user?.email || '' }) : null,
   syncEnabled: selfMode && account.syncEnabled,
   onOpenAccountSheet: () => setShowAccountSheet(true),
   /* Skill / guided */
   skillLevel, onToggleSkillLevel: () => saveSkillLevel(skillLevel === 'guided' ? 'standard' : 'guided'),
   sheetContent, setSheetContent,
   isPulse, markTouched, guideField, guideTouched,
   gameMode, TAB_PROGRESSION, completedTabs, isTabFieldsComplete,
   SKILL_PRESETS, showCompareHint, setShowCompareHint,
   /* Setup / core loan */
   salesPrice, setSalesPrice, downPct, setDownPct, downMode, setDownMode,
   rate, setRate, term, setTerm, loanType, setLoanType,
   propType, setPropType, propTypes: PROP_TYPES, PROP_TYPES, UNIT_COUNT,
   loanPurpose, setLoanPurpose, loanTypes: LOAN_TYPES, LOAN_TYPES,
   propertyState, setPropertyState, propertyCounty, city, setCity, propertyZip, setPropertyZip,
   annualIns, setAnnualIns, hoa, setHoa,
   includeEscrow, setIncludeEscrow,
   closingMonth, setClosingMonth, closingDay, setClosingDay,
   closingYear, setClosingYear,
   customFees, setCustomFees, hiddenFees, setHiddenFees,
   propertyTaxesInstallment, setPropertyTaxesInstallment,
   sellersProratedTaxCredit, setSellersProratedTaxCredit,
   closingMonths: [1,2,3,4,5,6,7,8,9,10,11,12],
   isRefi, setIsRefi,
   firstTimeBuyer, setFirstTimeBuyer, creditScore, setCreditScore,
   married, setMarried, taxState, setTaxState,
   refiPurpose, setRefiPurpose, refiCurrentRate, refiCashOut,
   refiNewLoanAmtOverride, setRefiNewLoanAmtOverride,
   /* Qualification */
   allGood, someGood, purchPillarCount, refiPillarCount, dpOk, refiLtvCheck,
   affordIncome, affordDebts, affordDown, affordTerm, affordRate, affordLoanType,
   affordTargetDTI, setAffordTargetDTI, confirmAffordApply, setConfirmAffordApply,
   handlePillarClick, isTabUnlocked, userLoanTypeRef, setAutoJumboSwitch, autoJumboSwitch,
   getHighBalLimit,
   /* Debts */
   debts, debtFree, setDebtFree,
   ownsProperties, setOwnsProperties, reos, setReos,
   syncDebtBalance, syncDebtPayment,
   DEBT_TYPES, PAYOFF_OPTIONS,
   /* REO — addReo/updateReo/removeReo so the embedded REO section in Overview can function.
      Sell-related props (sellLinkedReoId, setSellPrice, setSellMortgagePayoff,
      setSellPrimaryRes) used to be duplicated here; they're now only in the Sell block
      below to avoid Vite duplicate-key errors. */
   addReo, updateReo, removeReo, syncReoBalance, syncReoPayment,
   REO_PROPERTY_TYPES, REO_OCCUPANCY_TYPES,
   /* Modules */
   showInvestor, setShowInvestor, showRentVsBuy, setShowRentVsBuy,
   showProp19, setShowProp19,
   hasSellProperty, setHasSellProperty,
   /* Income */
   incomes, addIncome, updateIncome, removeIncome,
   otherIncome, setOtherIncome,
   otherIncome2, setOtherIncome2,
   VARIABLE_PAY_TYPES, PAY_TYPES,
   subjectRentalIncome, setSubjectRentalIncome,
   /* Assets */
   assets, addAsset, updateAsset, removeAsset,
   ASSET_TYPES, RESERVE_FACTORS, getReserveFactor,
   /* Amortization */
   payExtra, setPayExtra, extraPayment, setExtraPayment,
   amortView, setAmortView,
   appreciationRate, setAppreciationRate,
   /* Sell */
   sellPrice, setSellPrice, sellMortgagePayoff, setSellMortgagePayoff,
   sellLinkedReoId, setSellLinkedReoId,
   sellCommission, setSellCommission,
   sellTransferTaxCity, setSellTransferTaxCity,
   sellEscrow, setSellEscrow, sellTitle, setSellTitle, sellOther, setSellOther,
   sellSellerCredit, setSellSellerCredit,
   sellCostBasis, setSellCostBasis, sellImprovements, setSellImprovements,
   sellYearsOwned, setSellYearsOwned, sellPrimaryRes, setSellPrimaryRes,
   TT_CITY_NAMES,
   /* Fees for IFW-style costs */
   underwritingFee, setUnderwritingFee, processingFee, setProcessingFee,
   adminFee, setAdminFee, lenderWireFee, setLenderWireFee,
   discountPts, setDiscountPts,
   appraisalFee, setAppraisalFee, creditReportFee, setCreditReportFee,
   floodCertFee, setFloodCertFee, mersFee, setMersFee, taxServiceFee, setTaxServiceFee,
   titleInsurance, setTitleInsurance, titleSearch, setTitleSearch,
   settlementFee, setSettlementFee, escrowFee, setEscrowFee,
   courierFee, setCourierFee, loanTieInFee, setLoanTieInFee,
   notaryFee, setNotaryFee, envProtectionLien, setEnvProtectionLien,
   transferTaxCity, setTransferTaxCity, transferTaxSplit, setTransferTaxSplit, transferTaxCountySplit, setTransferTaxCountySplit,
   recordingFee, setRecordingFee,
   lenderCredit, setLenderCredit, sellerCredit, setSellerCredit,
   realtorCredit, setRealtorCredit, emd, setEmd, emdPct, setEmdPct, emdPaid, setEmdPaid, emdLocked, setEmdLocked, emdFlat, setEmdFlat,
   ownersTitleIns, setOwnersTitleIns, homeWarranty, setHomeWarranty,
   hoaTransferFee, setHoaTransferFee,
   buyerPaysComm, setBuyerPaysComm, buyerCommPct, setBuyerCommPct,
   payoffAtClosing: calc.payoffAtClosing,
   /* Property tax */
   propTaxMode, setPropTaxMode,
   taxBaseRateOverride, setTaxBaseRateOverride,
   taxExemptionOverride, setTaxExemptionOverride,
   fixedAssessments, setFixedAssessments,
   taxRateLocked, setTaxRateLocked,
   taxExemptionLocked, setTaxExemptionLocked,
   propTaxExpanded, setPropTaxExpanded,
   propTaxCustomize, setPropTaxCustomize,
   STATE_PROPERTY_TAX_RATES, CITY_TAX_RATES,
   /* PMI pill + advanced chart */
   pmiRateLocked, setPmiRateLocked, pmiRateOverride, setPmiRateOverride,
   pmiChartOverrides, setPmiChartOverrides,
   /* VA Funding Fee */
   vaUsage, setVaUsage, VA_USAGE,
   vaFundingFeeLocked, setVaFundingFeeLocked,
   vaFundingFeeOverride, setVaFundingFeeOverride,
   /* Tax savings */
   FILING_STATUSES, STATE_NAMES, STATE_TAX, FED_BRACKETS, FED_STD_DEDUCTION,
   showFedBrackets, setShowFedBrackets,
   showStateBrackets, setShowStateBrackets,
   /* Prop 19 */
   prop19, prop19Eligibility, setProp19Eligibility,
   prop19OldTaxableValue, setProp19OldTaxableValue,
   prop19OldSalePrice, setProp19OldSalePrice,
   prop19SaleDate, setProp19SaleDate,
   prop19PurchaseDate, setProp19PurchaseDate,
   prop19TransfersUsed, setProp19TransfersUsed,
   prop19RateOverride, setProp19RateOverride,
   /* Rent vs Buy */
   rbCalc, rbCurrentRent, setRbCurrentRent,
   rbRentGrowth, setRbRentGrowth,
   rbInvestReturn, setRbInvestReturn,
   /* Investor */
   invCalc, invMonthlyRent, setInvMonthlyRent,
   invVacancy, setInvVacancy, invRentGrowth, setInvRentGrowth,
   invMgmt, setInvMgmt, invMaintPct, setInvMaintPct, invCapEx, setInvCapEx,
   invHoldYears, setInvHoldYears,
   invSellerComm, setInvSellerComm, invSellClosing, setInvSellClosing,
   /* Refi (for SetupContent) */
   refiCurrentLoanType, setRefiCurrentLoanType,
   refiOriginalAmount, setRefiOriginalAmount,
   refiOriginalTerm, setRefiOriginalTerm, setRefiCurrentRate,
   refiClosedDate, setRefiClosedDate,
   refiCurrentBalance, setRefiCurrentBalance,
   refiRemainingMonths, setRefiRemainingMonths,
   refiCurrentPayment, setRefiCurrentPayment,
   refiAnnualTax, setRefiAnnualTax,
   refiAnnualIns, setRefiAnnualIns,
   refiCurrentEscrow, setRefiCurrentEscrow,
   refiHasEscrow, setRefiHasEscrow,
   refiEscrowBalance, setRefiEscrowBalance,
   refiSkipMonths, setRefiSkipMonths,
   refiCurrentMI, setRefiCurrentMI, setRefiCashOut,
   refiExtraPaid, setRefiExtraPaid,
   refiHomeValue, setRefiHomeValue,
   /* Live rates */
   liveRates, fetchRates, ratesLoading, ratesError, fredApiKey,
   /* Helper lookups */
   getTTCitiesForState, getTTForCity, lookupZip,
   /* Constants */
   STATE_NAMES_PROP, CITY_NAMES, STATE_CITIES, COUNTY_AMI,
   /* Shared UI components */
   PayRing, StopLight, AmortChart, Progress, Hero, Card, Sec, MRow,
   Inp, Sel, TextInp, Note, SearchSelect, InfoTip, Icon, Tab, FieldLabel,
   GuidedNextButton, ClusterContinue, guidedStep,
  }} />
 </Suspense>
)}
{/* ═══ BOTTOM SHEETS (One-Screen Architecture) ═══ */}
<Suspense fallback={null}>
 <BottomSheet isOpen={sheetContent === "income"} onClose={() => setSheetContent(null)} title="Income" T={T}>
  <IncomeSheet
   incomes={incomes} addIncome={(borrower, source = "") => { const cy = new Date().getFullYear(); return setIncomes([...incomes, { id: Date.now(), borrower, source, start: "", end: "", payType: "Salary", amount: 0, frequency: "Annual", ytd: 0, py1: 0, py2: 0, py1Year: cy - 1, py2Year: cy - 2, selection: "Amount", verifiedBy: "", monthlyIncome: 0 }]); }}
   updateIncome={(id, f, v) => setIncomes(incomes.map(i => i.id === id ? { ...i, [f]: v } : i))}
   removeIncome={(id) => setIncomes(incomes.filter(i => i.id !== id))}
   otherIncome={otherIncome} setOtherIncome={setOtherIncome}
   otherIncome2={otherIncome2} setOtherIncome2={setOtherIncome2}
   T={T} Inp={Inp} Sel={Sel} TextInp={TextInp} Note={Note} calc={calc}
  />
 </BottomSheet>
 <BottomSheet isOpen={sheetContent === "debts"} onClose={() => setSheetContent(null)} title="Debts & Liabilities" T={T}>
  <DebtsSheet
   debts={debts} addDebt={(type) => setDebts(prev => [...prev, { id: Date.now(), name: "", type, borrower: "Joint", balance: 0, monthly: 0, rate: 0, months: 0, payoff: "No", payoffAmount: 0, linkedReoId: "" }])}
   updateDebt={(id, f, v) => setDebts(prev => prev.map(d => d.id === id ? { ...d, [f]: v } : d))}
   removeDebt={(id) => setDebts(prev => prev.filter(d => d.id !== id))}
   debtFree={debtFree} setDebtFree={setDebtFree}
   ownsProperties={ownsProperties} setOwnsProperties={setOwnsProperties}
   reos={reos} setReos={setReos}
   syncDebtPayment={syncDebtPayment} syncDebtBalance={syncDebtBalance}
   T={T} Inp={Inp} Sel={Sel} TextInp={TextInp} Note={Note} calc={calc}
  />
 </BottomSheet>
 <BottomSheet isOpen={sheetContent === "assets"} onClose={() => setSheetContent(null)} title="Assets" T={T}>
  <AssetsSheet
   assets={assets} addAsset={() => setAssets([...assets, { id: Date.now(), bank: "", last4: "", owner: "", type: "Checking", value: 0, forClosing: 0 }])}
   updateAsset={(id, f, v) => setAssets(assets.map(a => a.id === id ? { ...a, [f]: v } : a))}
   removeAsset={(id) => setAssets(assets.filter(a => a.id !== id))}
   T={T} Inp={Inp} Sel={Sel} TextInp={TextInp} Note={Note} calc={calc} Progress={Progress}
  />
 </BottomSheet>
</Suspense>
{/* ═══ SETUP (Redesigned) ═══ */}
{tab === "setup" && <SetupContent {...{T, isRefi, setIsRefi, salesPrice, setSalesPrice, downPct, setDownPct, downMode, setDownMode, loanType, setLoanType, propType, setPropType, loanPurpose, setLoanPurpose, propertyState, setPropertyState, propertyCounty, city, setCity, propertyZip, setPropertyZip, annualIns, setAnnualIns, hoa, setHoa, rate, setRate, term, setTerm, creditScore, setCreditScore, married, setMarried, firstTimeBuyer, setFirstTimeBuyer, refiPurpose, setRefiPurpose, taxState, scenarioName, ownsProperties, setOwnsProperties, hasSellProperty, setHasSellProperty, showInvestor, setShowInvestor, showRentVsBuy, setShowRentVsBuy, showProp19, setShowProp19, skillLevel, onToggleSkillLevel: () => saveSkillLevel(skillLevel === 'guided' ? 'standard' : 'guided'), Inp, Sel, SearchSelect, Note, Hero, Card, InfoTip, gameMode, TAB_PROGRESSION, completedTabs, isTabFieldsComplete, markTouched, isPulse, calc, fmt, CITY_NAMES, STATE_NAMES_PROP, STATE_CITIES, SKILL_PRESETS, FILING_STATUSES, showCompareHint, setShowCompareHint, setTab, scenarioList, isDesktop, darkMode, propTaxMode, getTTCitiesForState, getTTForCity, COUNTY_AMI, lookupZip, Icon, TextInp, FieldLabel, Sec, GuidedNextButton, refiCurrentLoanType, setRefiCurrentLoanType, refiOriginalAmount, setRefiOriginalAmount, refiOriginalTerm, setRefiOriginalTerm, refiCurrentRate, setRefiCurrentRate, refiClosedDate, setRefiClosedDate, refiCurrentBalance, setRefiCurrentBalance, refiRemainingMonths, setRefiRemainingMonths, refiCurrentPayment, setRefiCurrentPayment, refiAnnualTax, setRefiAnnualTax, refiAnnualIns, setRefiAnnualIns, refiCurrentEscrow, setRefiCurrentEscrow, refiHasEscrow, setRefiHasEscrow, refiEscrowBalance, setRefiEscrowBalance, refiSkipMonths, setRefiSkipMonths, refiCurrentMI, setRefiCurrentMI, refiCashOut, setRefiCashOut, refiExtraPaid, setRefiExtraPaid, refiHomeValue, setRefiHomeValue, ClusterContinue}} />}
{/* ═══ REFI SUMMARY ═══ */}
{tab === "refi" && (<>
 <div style={{ marginTop: 20 }}>
  <Hero value={fmt(Math.abs(calc.refiMonthlySavings))} label={calc.refiMonthlySavings >= 0 ? "Monthly P&I Savings" : "Monthly P&I Increase"} color={calc.refiMonthlySavings > 0 ? T.green : calc.refiMonthlySavings < 0 ? T.red : T.textSecondary} sub={calc.refiBreakevenMonths > 0 ? `Breakeven in ${calc.refiBreakevenMonths} months` : calc.refiMonthlySavings <= 0 ? "No P&I savings" : ""} />
 </div>
 {/* Quick verdict card */}
 <div data-field="refi-current-rate" className={isPulse("refi-current-rate") || isPulse("refi-current-balance")} onClick={() => { if (refiCurrentRate === 0 || refiCurrentBalance === 0) setTab("setup"); }} style={{ borderRadius: 18, transition: "all 0.3s", cursor: (refiCurrentRate === 0 || refiCurrentBalance === 0) ? "pointer" : "default" }}>
 <Card pad={14} style={{ marginTop: 12, background: calc.refiMonthlySavings > 0 ? T.successBg : calc.refiMonthlySavings < 0 ? T.errorBg : T.pillBg }}>
  <div style={{ fontSize: 13, fontWeight: 600, color: calc.refiMonthlySavings > 0 ? T.green : calc.refiMonthlySavings < 0 ? T.red : T.textSecondary }}>
   {calc.refiMonthlySavings > 0 ? `✓ ${refiPurpose} refinance saves ${fmt(calc.refiMonthlySavings)}/mo on P&I. Closing costs recovered in ${calc.refiBreakevenMonths} months.` :
    calc.refiMonthlySavings < 0 && refiPurpose === "Cash-Out" ? `Cash-out refinance adds ${fmt(Math.abs(calc.refiMonthlySavings))}/mo to P&I, but provides ${fmt(refiCashOut)} in cash proceeds.` :
    calc.refiMonthlySavings < 0 ? `New payment is ${fmt(Math.abs(calc.refiMonthlySavings))}/mo higher. Consider if shorter term or other benefits justify the increase.` :
    "Tap here → Enter current loan details on Setup to see comparison."}
  </div>
 </Card>
 </div>
 {/* Side-by-side comparison */}
 <Sec title="Loan Comparison">
  <Card>
   <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 0, fontSize: 11, color: T.textTertiary, fontWeight: 600, paddingBottom: 8, borderBottom: `1px solid ${T.separator}` }}>
    <span></span><span style={{textAlign:"right"}}>Current</span><span style={{textAlign:"right"}}>New</span>
   </div>
   {[
    ["Loan Type", refiCurrentLoanType, loanType + (loanType === "VA" ? " - " + vaUsage : "")],
    ["Purpose", "—", refiPurpose],
    ["Loan Amount", fmt(calc.refiEffBalance), fmt(calc.refiNewLoanAmt)],
    ["Interest Rate", refiCurrentRate.toFixed(3) + "%", rate.toFixed(3) + "%"],
    ["Term", `${calc.refiEffRemaining} mos left`, `${term * 12} mos (${term}yr)`],
   ].map(([l, c, n], i) => (
    <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 0, padding: "8px 0", borderBottom: `1px solid ${T.separator}`, fontSize: 13 }}>
     <span style={{ color: T.textSecondary, fontWeight: i === 0 ? 600 : 400 }}>{l}</span>
     <span style={{ textAlign: "right", fontFamily: FONT, fontWeight: 600 }}>{c}</span>
     <span style={{ textAlign: "right", fontFamily: FONT, fontWeight: 600, color: T.blue }}>{n}</span>
    </div>
   ))}
   {refiHomeValue > 0 && [
    ["Home Value", fmt(refiHomeValue), fmt(refiHomeValue)],
    ["LTV", pct(calc.refiCurLTV, 1), pct(calc.refiNewLTV, 1)],
    ["Equity", fmt(refiHomeValue - calc.refiEffBalance), fmt(refiHomeValue - calc.refiNewLoanAmt)],
   ].map(([l, c, n], i) => (
    <div key={"ltv" + i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 0, padding: "8px 0", borderBottom: `1px solid ${T.separator}`, fontSize: 13 }}>
     <span style={{ color: T.textSecondary }}>{l}</span>
     <span style={{ textAlign: "right", fontFamily: FONT, fontWeight: 600 }}>{c}</span>
     <span style={{ textAlign: "right", fontFamily: FONT, fontWeight: 600, color: T.blue }}>{n}</span>
    </div>
   ))}
  </Card>
 </Sec>
 {/* Monthly Payment Comparison */}
 <Sec title="Monthly Payment">
  <Card>
   {/* Header */}
   <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 0, fontSize: 10, color: T.textTertiary, fontWeight: 700, paddingBottom: 8, borderBottom: `2px solid ${T.separator}`, letterSpacing: 0.5 }}>
    <span></span><span style={{textAlign:"right"}}>Current</span><span style={{textAlign:"right"}}>New</span><span style={{textAlign:"right"}}>Delta</span>
   </div>
   {/* Rows */}
   {(() => {
    const curPrin = calc.refiCurPrinThisMonth;
    const curInt = calc.refiCurIntThisMonth;
    const newPrin = calc.refiNewPrinThisMonth;
    const newInt = calc.refiNewIntThisMonth;
    const curTax = calc.refiCurMonthlyTax;
    const curIns = calc.refiCurMonthlyIns;
    const newTax = calc.refiNewMonthlyTax;
    const newIns = calc.refiNewMonthlyIns;
    const curMI = refiCurrentMI;
    const newMI = calc.refiNewMI;
    const rows = [
     { label: "Principal", cur: curPrin, nw: newPrin },
     { label: "Interest", cur: curInt, nw: newInt },
     ...(refiHasEscrow ? [
      { label: "Taxes", cur: curTax, nw: newTax },
      { label: "Insurance", cur: curIns, nw: newIns },
     ] : (refiAnnualTax > 0 || refiAnnualIns > 0) ? [
      { label: "Taxes", cur: curTax, nw: curTax, note: "paid separately" },
      { label: "Insurance", cur: curIns, nw: curIns, note: "paid separately" },
     ] : []),
     { label: "MI/MIP", cur: curMI, nw: newMI },
    ].filter(r => r.cur > 0 || r.nw > 0 || r.note);
    return rows.map((r, i) => {
     const delta = r.nw - r.cur;
     return (
      <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 0, padding: "8px 0", borderBottom: `1px solid ${T.separator}`, fontSize: 13, alignItems: "center" }}>
       <span style={{ color: T.textSecondary }}>
        {r.label}
        {r.note && <span style={{ fontSize: 9, color: T.orange, display: "block", marginTop: 1 }}>({r.note})</span>}
       </span>
       <span style={{ textAlign: "right", fontFamily: FONT, fontWeight: 600 }}>{fmt(r.cur)}</span>
       <span style={{ textAlign: "right", fontFamily: FONT, fontWeight: 600, color: T.blue }}>{fmt(r.nw)}</span>
       <span style={{ textAlign: "right", fontFamily: FONT, fontWeight: 600, fontSize: 12, color: delta < -0.5 ? T.green : delta > 0.5 ? T.red : T.textTertiary }}>
        {Math.abs(delta) < 0.5 ? "—" : (delta > 0 ? "+" : "") + fmt(delta)}
       </span>
      </div>
     );
    });
   })()}
   {/* Total row */}
   {(() => {
    const totalDelta = calc.refiNewTotalPmt - calc.refiCurTotalPmt;
    return (
     <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 0, padding: "10px 0", borderTop: `2px solid ${T.separator}`, marginTop: 4, fontSize: 14 }}>
      <span style={{ fontWeight: 700 }}>Total Payment</span>
      <span style={{ textAlign: "right", fontFamily: FONT, fontWeight: 700 }}>{fmt(calc.refiCurTotalPmt)}</span>
      <span style={{ textAlign: "right", fontFamily: FONT, fontWeight: 700, color: T.blue }}>{fmt(calc.refiNewTotalPmt)}</span>
      <span style={{ textAlign: "right", fontFamily: FONT, fontWeight: 700, fontSize: 13, color: totalDelta < -0.5 ? T.green : totalDelta > 0.5 ? T.red : T.textTertiary }}>
       {Math.abs(totalDelta) < 0.5 ? "—" : (totalDelta > 0 ? "+" : "") + fmt(totalDelta)}
      </span>
     </div>
    );
   })()}
   {/* Savings card */}
   <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0, padding: "10px 0", marginTop: 4, background: calc.refiMonthlyTotalSavings > 0 ? T.successBg : calc.refiMonthlyTotalSavings < 0 ? T.errorBg : T.pillBg, borderRadius: 8, paddingLeft: 10, paddingRight: 10 }}>
    <span style={{ fontWeight: 600, fontSize: 13, color: calc.refiMonthlyTotalSavings > 0 ? T.green : T.red }}>Monthly {calc.refiMonthlyTotalSavings >= 0 ? "Savings" : "Increase"}</span>
    <span style={{ textAlign: "right", fontFamily: FONT, fontWeight: 700, fontSize: 16, color: calc.refiMonthlyTotalSavings > 0 ? T.green : T.red }}>{fmt(Math.abs(calc.refiMonthlyTotalSavings))}</span>
   </div>
   {!refiHasEscrow && (refiAnnualTax > 0 || refiAnnualIns > 0) && (
    <Note color={T.orange} style={{ marginTop: 8 }}>No escrow — tax ({fmt(calc.refiCurMonthlyTax)}/mo) and insurance ({fmt(calc.refiCurMonthlyIns)}/mo) paid separately on both current and new loan. Total: {fmt(calc.refiCurMonthlyTax + calc.refiCurMonthlyIns)}/mo outside of your mortgage payment.</Note>
   )}
  </Card>
 </Sec>
 {/* Interest comparison */}
 <Sec title="Interest Analysis">
  <Card>
   <MRow label="Current: This Month's Interest" value={fmt(calc.refiCurIntThisMonth)} />
   <MRow label="New: This Month's Interest" value={fmt(calc.refiNewIntThisMonth)} color={calc.refiNewIntThisMonth < calc.refiCurIntThisMonth ? T.green : T.red} />
   <div style={{ borderTop: `1px solid ${T.separator}`, marginTop: 6, paddingTop: 6 }}>
    <MRow label="Current: Remaining Interest" value={fmt(calc.refiCurRemainingInt)} sub={`over ${calc.refiEffRemaining} months`} />
    <MRow label="New: Total Interest" value={fmt(calc.refiNewTotalInt)} sub={`over ${term * 12} months`} color={calc.refiNewTotalInt < calc.refiCurRemainingInt ? T.green : T.red} />
   </div>
   <div style={{ borderTop: `2px solid ${T.separator}`, marginTop: 8, paddingTop: 8 }}>
    <MRow label="Interest Savings" value={fmt(calc.refiIntSavings)} color={calc.refiIntSavings > 0 ? T.green : T.red} bold />
    {calc.refiIntSavings < 0 && <Note color={T.orange} style={{ marginTop: 6 }}>New loan pays more total interest — often due to longer term or cash-out. Monthly savings may still justify it.</Note>}
   </div>
  </Card>
 </Sec>
 {/* Cost to refinance + breakeven */}
 <Sec title="Cost to Refinance">
  <Card>
   <MRow label="Closing Costs" value={fmt(calc.totalClosingCosts)} />
   <MRow label="Discount Points" value={fmt(calc.loan * discountPts / 100)} sub={discountPts > 0 ? `${discountPts} pts` : "none"} />
   {refiPurpose === "Cash-Out" && refiCashOut > 0 && <MRow label="Cash Proceeds" value={fmt(refiCashOut)} color={T.blue} />}
   <div style={{ borderTop: `1px solid ${T.separator}`, marginTop: 6, paddingTop: 6 }}>
    <MRow label="P&I Monthly Savings" value={fmt(calc.refiMonthlySavings)} color={calc.refiMonthlySavings > 0 ? T.green : T.red} bold />
    <MRow label="Breakeven Period" value={calc.refiBreakevenMonths > 0 ? `${calc.refiBreakevenMonths} months (${(calc.refiBreakevenMonths / 12).toFixed(1)} yrs)` : "N/A"} bold />
   </div>
   {calc.refiBreakevenMonths > 0 && <div style={{ marginTop: 10 }}>
    <div style={{ fontSize: 11, color: T.textTertiary, marginBottom: 4 }}>Breakeven Progress</div>
    <div style={{ position: "relative", height: 24, background: T.inputBg, borderRadius: 12, overflow: "hidden" }}>
     <div style={{ height: "100%", width: `${Math.min(100, (12 / calc.refiBreakevenMonths) * 100)}%`, background: T.green, borderRadius: 12, transition: "width 0.5s" }} />
     <span style={{ position: "absolute", top: 4, left: 8, fontSize: 11, fontWeight: 600, color: T.text, fontFamily: FONT }}>1 yr = {fmt(calc.refiMonthlySavings * 12)} saved</span>
    </div>
    {[2, 3, 5].filter(y => y * 12 > calc.refiBreakevenMonths).slice(0, 2).map(y => (
     <div key={y} style={{ fontSize: 12, color: T.textTertiary, marginTop: 4 }}>{y}yr net savings: <strong style={{ color: T.green }}>{fmt((calc.refiMonthlySavings * y * 12) - calc.totalClosingCosts)}</strong></div>
    ))}
   </div>}
  </Card>
 </Sec>
 {/* Lifetime comparison */}
 <Sec title="Lifetime Comparison">
  <Card>
   <MRow label="Current: Remaining Payments" value={fmt(calc.refiCurTotalCostRemaining)} sub={`${calc.refiEffRemaining} × ${fmt(calc.refiEffPI)}`} />
   <MRow label="New: Total Payments + Costs" value={fmt(calc.refiNewTotalCost)} sub={`${term * 12} × ${fmt(calc.refiNewPi)} + ${fmt(calc.totalClosingCosts)}`} />
   <div style={{ borderTop: `2px solid ${T.separator}`, marginTop: 8, paddingTop: 8 }}>
    <MRow label="Lifetime Savings" value={fmt(calc.refiLifetimeSavings)} color={calc.refiLifetimeSavings > 0 ? T.green : T.red} bold />
   </div>
  </Card>
 </Sec>
 {/* ── Net Cash Out ── */}
 <Sec title="Net Cash Out">
  <Card>
   <div style={{ fontSize: 11, fontWeight: 600, color: T.textTertiary, letterSpacing: 1, marginBottom: 10, textTransform: "uppercase" }}>Cash to Close Summary</div>
   <MRow label="New Loan Amount" value={fmt(calc.refiNetNewLoan)} color={T.blue} />
   <MRow label="− Closing Costs" value={`-${fmt(calc.refiNetClosingCosts)}`} />
   <MRow label="− Prepaids & Escrow" value={`-${fmt(calc.refiNetPrepaids)}`} />
   <MRow label="− Current Loan Payoff" value={`-${fmt(calc.refiNetPayoff)}`} />
   <div style={{ borderTop: `2px solid ${T.separator}`, marginTop: 8, paddingTop: 8 }}>
    <MRow label={calc.refiEstCashOut >= 0 ? "Estimated Cash Out" : "Cash to Close"} value={calc.refiEstCashOut >= 0 ? fmt(calc.refiEstCashOut) : fmt(Math.abs(calc.refiEstCashOut))} color={calc.refiEstCashOut >= 0 ? T.green : T.red} bold />
   </div>
   {(calc.refiSkipPmtAmt > 0 || calc.refiEscrowRefund > 0) && <>
    <div style={{ fontSize: 11, fontWeight: 600, color: T.textTertiary, letterSpacing: 1, marginTop: 16, marginBottom: 10, textTransform: "uppercase" }}>Money Back in Your Pocket</div>
    {calc.refiSkipPmtAmt > 0 && <MRow label={`Skip ${refiSkipMonths} Payment${refiSkipMonths > 1 ? "s" : ""}`} value={`+${fmt(calc.refiSkipPmtAmt)}`} color={T.green} sub={`${refiSkipMonths} × ${fmt(calc.refiCurTotalPmt)}/mo`} />}
    {calc.refiEscrowRefund > 0 && <MRow label="Current Escrow Balance Refund" value={`+${fmt(calc.refiEscrowRefund)}`} color={T.green} />}
   </>}
   <div style={{ marginTop: 12, padding: "14px 16px", background: calc.refiNetCashInHand >= 0 ? T.successBg : T.errorBg, borderRadius: 14 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
     <span style={{ fontSize: 14, fontWeight: 700, color: calc.refiNetCashInHand >= 0 ? T.green : T.red }}>{calc.refiNetCashInHand >= 0 ? "Net Cash in Hand" : "Cash to Close at Signing"}</span>
     <span style={{ fontSize: 22, fontWeight: 800, fontFamily: FONT, color: calc.refiNetCashInHand >= 0 ? T.green : T.red }}>{calc.refiNetCashInHand >= 0 ? fmt(calc.refiNetCashInHand) : fmt(Math.abs(calc.refiNetCashInHand))}</span>
    </div>
    <div style={{ fontSize: 11, color: T.textTertiary, marginTop: 4 }}>
     {calc.refiNetCashInHand >= 0 ? "You receive this amount at or after closing" : "You need to bring this amount to closing"}
    </div>
   </div>
  </Card>
 </Sec>
 {/* Year-by-year amort comparison */}
 {calc.refiAmortCompare.length > 0 && <Sec title="Year-by-Year Balance">
  <Card>
   <div style={{ display: "grid", gridTemplateColumns: "40px 1fr 1fr 1fr", gap: 0, fontSize: 10, color: T.textTertiary, fontWeight: 600, paddingBottom: 6, borderBottom: `1px solid ${T.separator}` }}>
    <span>Yr</span><span style={{textAlign:"right"}}>Cur Bal</span><span style={{textAlign:"right"}}>New Bal</span><span style={{textAlign:"right"}}>Diff</span>
   </div>
   <div style={{ maxHeight: 320, overflowY: "auto" }}>
    {calc.refiAmortCompare.map((row, i) => {
     const diff = row.curBal - row.newBal;
     return (
      <div key={i} style={{ display: "grid", gridTemplateColumns: "40px 1fr 1fr 1fr", gap: 0, padding: "5px 0", borderBottom: `1px solid ${T.separator}`, fontSize: 12 }}>
       <span style={{ color: T.textTertiary, fontWeight: 600 }}>{row.year}</span>
       <span style={{ textAlign: "right", fontFamily: FONT, fontWeight: 500, color: row.curBal > 0 ? T.text : T.textTertiary }}>{row.curBal > 0 ? fmt(row.curBal) : "Paid"}</span>
       <span style={{ textAlign: "right", fontFamily: FONT, fontWeight: 500, color: row.newBal > 0 ? T.blue : T.textTertiary }}>{row.newBal > 0 ? fmt(row.newBal) : "Paid"}</span>
       <span style={{ textAlign: "right", fontFamily: FONT, fontWeight: 600, color: diff > 0 ? T.green : diff < 0 ? T.red : T.textTertiary }}>{diff !== 0 ? fmt(diff) : "—"}</span>
      </div>
     );
    })}
   </div>
  </Card>
 </Sec>}
 <Sec title="Share">
  <Card>
   <TextInp label="Borrower Name" value={borrowerName} onChange={setBorrowerName} placeholder="Client's full name" />
   <TextInp label="Borrower Email" value={borrowerEmail} onChange={setBorrowerEmail} placeholder="borrower@email.com" />
   <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
    <button onClick={handleEmailWorksheet} style={{ padding: "14px 0", background: T.blue, color: "#fff", border: "none", borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>Email</button>
    <button onClick={handlePrintPdf} style={{ padding: "14px 0", background: T.inputBg, color: T.text, border: `1px solid ${T.separator}`, borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>PDF</button>
    <button onClick={() => { const w = window.open("", "_blank", "width=700,height=900"); w.document.write(generatePdfHtml()); w.document.close(); }} style={{ padding: "14px 0", background: T.inputBg, color: T.text, border: `1px solid ${T.separator}`, borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>Preview</button>
   </div>
   {loEmail && <div style={{ fontSize: 11, color: T.textTertiary, marginTop: 8 }}>BCC: {loEmail}</div>}
  </Card>
 </Sec>
 <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 4, marginBottom: 12 }}>
  <button onClick={() => setShowEmailModal(true)} style={{ padding: 14, background: T.blue, border: "none", borderRadius: 14, color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: FONT, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>Email</button>
  <button onClick={handlePrintPdf} style={{ padding: 14, background: `${T.blue}15`, border: `1px solid ${T.blue}33`, borderRadius: 14, color: T.blue, fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: FONT, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>Print PDF</button>
 </div>
 <Sec title="">
  <Card style={{ background: T.pillBg }}>
   <Note>Edit new loan on <strong>Calculator</strong> tab. Edit current loan on <strong>Setup</strong> tab. Closing costs on <strong>Costs</strong> tab.</Note>
  </Card>
 </Sec>
</>)}
{/* ═══ 3-POINT REFI TEST ═══ */}
{tab === "refi3" && (<>
 <div style={{ marginTop: 20, textAlign: "center" }}>
  <div style={{ fontSize: 14, fontWeight: 600, color: T.textTertiary, letterSpacing: "0.05em", marginBottom: 4 }}>THE</div>
  <div style={{ fontSize: 28, fontWeight: 800, fontFamily: FONT, color: T.text, letterSpacing: "-0.03em" }}>3-Point Refi Test</div>
  <div style={{ fontSize: 13, color: T.textTertiary, marginTop: 6 }}>Does this refinance make sense?</div>
 </div>
 {/* Score badge */}
 <div style={{ display: "flex", justifyContent: "center", margin: "20px 0" }}>
  <div style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "14px 28px", borderRadius: 99, background: calc.refiTestScore === 3 ? `${T.green}18` : calc.refiTestScore >= 2 ? `${T.orange}18` : `${T.red}18` }}>
   <span style={{ fontSize: 28 }}>{calc.refiTestScore === 3 ? "●" : calc.refiTestScore >= 2 ? "●" : "●"}</span>
   <div>
    <div style={{ fontSize: 22, fontWeight: 800, fontFamily: FONT, color: calc.refiTestScore === 3 ? T.green : calc.refiTestScore >= 2 ? T.orange : T.red }}>{calc.refiTestScore} / 3</div>
    <div style={{ fontSize: 11, color: T.textTertiary }}>{calc.refiTestScore === 3 ? "ALL CLEAR — Refi makes sense!" : calc.refiTestScore === 2 ? "Close — worth discussing" : calc.refiTestScore === 1 ? "Proceed with caution" : "Refi may not be advisable"}</div>
   </div>
  </div>
 </div>
 {/* The 3 tests */}
 <Sec title="The Tests">
  <Card>
   <RefiTestLight
    passed={calc.refiTest1Pass}
    label={`1. Rate Improvement ≥ 0.50%`}
    detail={calc.refiTest1Pass !== null ? `Current ${refiCurrentRate.toFixed(3)}% → New ${rate.toFixed(3)}% = ${calc.refiRateDrop >= 0 ? "-" : "+"}${Math.abs(calc.refiRateDrop).toFixed(3)}% ${calc.refiTest1Pass ? "✓" : "(need 0.50%+)"}` : "Enter current rate on Setup tab"}
   />
   <RefiTestLight
    passed={calc.refiTest2Pass}
    label="2. Breakeven Under 2 Years"
    detail={calc.refiTest2Pass !== null ? (calc.refiBreakevenMonths > 0 ? `Breakeven: ${calc.refiBreakevenMonths} months (${(calc.refiBreakevenMonths / 12).toFixed(1)} yrs) ${calc.refiTest2Pass ? "✓" : "— too long"}` : "No monthly savings to break even") : "Need monthly savings to calculate"}
   />
   <div style={{ borderBottom: "none" }}>
    <RefiTestLight
     passed={calc.refiTest3Pass}
     label="3. Accelerated Payoff (1+ Year Faster)"
     detail={calc.refiTest3Pass !== null ? `Reinvesting ${fmt(calc.refiMonthlySavings)}/mo savings: new loan pays off in ${calc.refiAccelPayoff.newPayoffMos} mos vs current ${calc.refiAccelPayoff.curPayoffMos} mos = ${calc.refiAccelPayoff.yearsFaster.toFixed(1)} years faster ${calc.refiTest3Pass ? "✓" : "— not enough"}` : "Need monthly savings to calculate"}
    />
   </div>
  </Card>
 </Sec>
 {/* Detailed explanation cards */}
 <Sec title="Test 1 — Rate">
  <Card>
   <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, textAlign: "center" }}>
    <div><div style={{ fontSize: 11, color: T.textTertiary }}>Current Rate</div><div style={{ fontSize: 20, fontWeight: 700, fontFamily: FONT }}>{refiCurrentRate.toFixed(3)}%</div></div>
    <div><div style={{ fontSize: 11, color: T.textTertiary }}>New Rate</div><div style={{ fontSize: 20, fontWeight: 700, fontFamily: FONT, color: T.blue }}>{rate.toFixed(3)}%</div></div>
    <div><div style={{ fontSize: 11, color: T.textTertiary }}>Improvement</div><div style={{ fontSize: 20, fontWeight: 700, fontFamily: FONT, color: calc.refiRateDrop >= 0.5 ? T.green : T.red }}>{calc.refiRateDrop.toFixed(3)}%</div></div>
   </div>
   <Note color={calc.refiTest1Pass ? T.green : T.orange}>A minimum 0.50% rate drop ensures enough savings to justify closing costs and reset the amortization clock.</Note>
  </Card>
 </Sec>
 <Sec title="Test 2 — Breakeven">
  <Card>
   <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, textAlign: "center" }}>
    <div><div style={{ fontSize: 11, color: T.textTertiary }}>Closing Costs</div><div style={{ fontSize: 20, fontWeight: 700, fontFamily: FONT }}>{fmt(calc.totalClosingCosts)}</div></div>
    <div><div style={{ fontSize: 11, color: T.textTertiary }}>Monthly Savings</div><div style={{ fontSize: 20, fontWeight: 700, fontFamily: FONT, color: calc.refiMonthlySavings > 0 ? T.green : T.red }}>{fmt(calc.refiMonthlySavings)}</div></div>
   </div>
   {calc.refiBreakevenMonths > 0 && <div style={{ marginTop: 12 }}>
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
     <span style={{ color: T.textTertiary }}>0 months</span>
     <span style={{ fontWeight: 700, color: calc.refiTest2Pass ? T.green : T.red, fontFamily: FONT }}>{calc.refiBreakevenMonths} mos</span>
     <span style={{ color: T.textTertiary }}>24 months</span>
    </div>
    <div style={{ height: 14, background: T.ringTrack, borderRadius: 99, overflow: "hidden", position: "relative" }}>
     <div style={{ height: "100%", width: `${Math.min(100, (calc.refiBreakevenMonths / 24) * 100)}%`, background: calc.refiTest2Pass ? T.green : T.red, borderRadius: 99, transition: "width 0.5s" }} />
    </div>
   </div>}
   <Note color={calc.refiTest2Pass ? T.green : T.orange}>Under 2 years means you recoup closing costs quickly. If you plan to stay shorter than the breakeven period, the refi doesn't pay for itself.</Note>
  </Card>
 </Sec>
 <Sec title="Test 3 — Accelerated Payoff">
  <Card>
   {calc.refiMonthlySavings > 0 ? <>
    <div style={{ fontSize: 13, color: T.textSecondary, marginBottom: 10 }}>If you take your <strong style={{ color: T.green }}>{fmt(calc.refiMonthlySavings)}/mo</strong> savings and apply it as extra principal:</div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, textAlign: "center" }}>
     <div><div style={{ fontSize: 11, color: T.textTertiary }}>Current Payoff</div><div style={{ fontSize: 18, fontWeight: 700, fontFamily: FONT }}>{calc.refiAccelPayoff.curPayoffMos}<span style={{ fontSize: 12 }}> mos</span></div><div style={{ fontSize: 11, color: T.textTertiary }}>{(calc.refiAccelPayoff.curPayoffMos / 12).toFixed(1)} yrs</div></div>
     <div><div style={{ fontSize: 11, color: T.textTertiary }}>New + Extra</div><div style={{ fontSize: 18, fontWeight: 700, fontFamily: FONT, color: T.blue }}>{calc.refiAccelPayoff.newPayoffMos}<span style={{ fontSize: 12 }}> mos</span></div><div style={{ fontSize: 11, color: T.textTertiary }}>{(calc.refiAccelPayoff.newPayoffMos / 12).toFixed(1)} yrs</div></div>
     <div><div style={{ fontSize: 11, color: T.textTertiary }}>Faster By</div><div style={{ fontSize: 18, fontWeight: 700, fontFamily: FONT, color: calc.refiAccelPayoff.yearsFaster >= 1 ? T.green : T.red }}>{calc.refiAccelPayoff.yearsFaster.toFixed(1)}<span style={{ fontSize: 12 }}> yrs</span></div></div>
    </div>
    <Note color={calc.refiTest3Pass ? T.green : T.orange}>{calc.refiTest3Pass ? "Reinvesting savings accelerates payoff by 1+ year — the refi creates real wealth." : "Savings don't accelerate payoff enough. Consider if other benefits (cash flow, dropping MI) still make it worthwhile."}</Note>
   </> : <Note color={T.orange}>No monthly savings to reinvest. This test requires a lower P&I payment on the new loan.</Note>}
  </Card>
 </Sec>
 <Card style={{ marginTop: 8, background: T.pillBg }}>
  <div style={{ fontSize: 12, color: T.textTertiary, lineHeight: 1.6, textAlign: "center" }}>The 3-Point Refi Test is a framework by Three Point Thursday. Not all 3 points need to pass — but if they do, the refi is a no-brainer.</div>
 </Card>
 {/* ── Cost of Waiting / Breakeven Analysis ── */}
 {calc.refiMonthlySavings > 0 && calc.refiCostOfWaiting.length > 0 && (
  <Sec title="Cost of Waiting">
   <Card>
    <div style={{ fontSize: 13, color: T.textSecondary, lineHeight: 1.5, marginBottom: 14 }}>
     If you <strong>wait</strong> for rates to drop further, how long would a future lower-rate refi take to <strong>catch up</strong> to the savings you missed by not refinancing now?
    </div>
    <div style={{ fontSize: 11, fontWeight: 600, color: T.textTertiary, letterSpacing: 1, marginBottom: 8, textTransform: "uppercase" }}>Breakeven Months to Recoup Lost Savings</div>
    {/* Header row */}
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", gap: 0, fontSize: 10, fontWeight: 700, color: T.textTertiary, paddingBottom: 6, borderBottom: `2px solid ${T.separator}` }}>
     <span>Wait for</span>
     <span style={{ textAlign: "center" }}>1 Year</span>
     <span style={{ textAlign: "center" }}>2 Years</span>
     <span style={{ textAlign: "center" }}>3 Years</span>
     <span style={{ textAlign: "center" }}>4 Years</span>
    </div>
    {/* Data rows */}
    {calc.refiCostOfWaiting.map((row, i) => (
     <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", gap: 0, padding: "8px 0", borderBottom: `1px solid ${T.separator}`, fontSize: 12, alignItems: "center" }}>
      <span style={{ fontWeight: 600, color: T.text }}>-{row.drop}%</span>
      {row.years.map((cell, j) => (
       <span key={j} style={{ textAlign: "center", fontFamily: FONT, fontWeight: 600, fontSize: 11, color: cell.breakeven >= 120 ? T.red : cell.breakeven >= 60 ? T.orange : T.green }}>
        {cell.breakeven >= 999 ? "Never" : cell.breakeven >= 120 ? `${Math.round(cell.breakeven / 12)}+ yrs` : `${cell.breakeven} mo`}
       </span>
      ))}
     </div>
    ))}
    {/* Legend */}
    <div style={{ marginTop: 12, padding: "10px 12px", background: T.pillBg, borderRadius: 10, fontSize: 11, color: T.textTertiary, lineHeight: 1.6 }}>
     <strong>How to read:</strong> If you wait <strong>2 years</strong> hoping rates drop <strong>0.50%</strong>, the lost savings during that wait would take the future refi's savings a certain number of months to recoup. High numbers mean <strong>don't wait</strong>.
    </div>
    {/* Lost savings summary */}
    <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6 }}>
     {[1, 2, 3, 4].map(yr => (
      <div key={yr} style={{ background: T.inputBg, borderRadius: 10, padding: "8px 6px", textAlign: "center" }}>
       <div style={{ fontSize: 14, fontWeight: 700, color: T.red, fontFamily: FONT }}>{fmt(calc.refiMonthlySavings * yr * 12)}</div>
       <div style={{ fontSize: 9, color: T.textTertiary, marginTop: 2 }}>Lost if wait {yr}yr</div>
      </div>
     ))}
    </div>
   </Card>
  </Sec>
 )}
 <GuidedNextButton />
</>)}
{/* ═══ INVESTMENT PROPERTY ═══ */}
{tab === "invest" && <InvestContent {...{T, isDesktop, calc, fmt, invCalc, invMonthlyRent, setInvMonthlyRent, invVacancy, setInvVacancy, invRentGrowth, setInvRentGrowth, invMgmt, setInvMgmt, invMaintPct, setInvMaintPct, invCapEx, setInvCapEx, hoa, invHoldYears, setInvHoldYears, invSellerComm, setInvSellerComm, invSellClosing, setInvSellClosing, appreciationRate, setAppreciationRate, Hero, Card, Sec, Inp, MRow, GuidedNextButton}} />}
{/* ═══ RENT VS BUY ═══ */}
{tab === "rentvbuy" && <RentVsBuyContent {...{T, isDesktop, calc, fmt, rbCalc, rbCurrentRent, setRbCurrentRent, rbRentGrowth, setRbRentGrowth, rbInvestReturn, setRbInvestReturn, Hero, Card, Sec, Inp, Note, MRow, GuidedNextButton}} />}
{/* ═══ LEARNING CENTER ═══ */}
{tab === "learn" && (<>
 <div style={{ marginTop: 20 }}>
  <Hero value="home" label="Homebuyer Academy" color={T.blue} sub={courseComplete ? "Course Complete!" : `${completedCount}/${COURSE_CHAPTERS.length} chapters`} />
 </div>
 {/* Toggle: Course / Library / Guidelines */}
 <div style={{ display: "flex", gap: 4, background: T.pillBg, borderRadius: 12, padding: 3, marginTop: 12 }}>
  {[["course","Build Your Home"],["library","Article Library"],["guidelines","Loan Guidelines"]].map(([v,l]) => (
   <button key={v} onClick={() => setCourseView(v)} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "none", fontSize: 13, fontWeight: 600, fontFamily: FONT, cursor: "pointer", background: courseView === v ? T.card : "transparent", color: courseView === v ? T.blue : T.textTertiary, boxShadow: courseView === v ? "0 1px 4px rgba(0,0,0,0.12)" : "none", transition: "all 0.2s" }}>{l}</button>
  ))}
 </div>
 {/* Subscribe CTA — always visible at top */}
 <Card style={{ marginTop: 12, background: `linear-gradient(135deg, ${T.blue}15, ${T.purple}10)`, border: `1px solid ${T.blue}25`, textAlign: "center", padding: "16px 20px" }}>
  <div style={{ fontSize: 18, fontWeight: 700, fontFamily: FONT, color: T.blue }}> Three Point Thursday</div>
  <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 4, lineHeight: 1.5 }}>3 actionable mortgage insights delivered to your inbox every Thursday.</div>
  <a href="https://chrisgranger.substack.com/subscribe" target="_blank" rel="noopener noreferrer" style={{ marginTop: 10, padding: "10px 24px", background: "linear-gradient(135deg, #4a90d9, #3a7dc4)", color: "#fff", borderRadius: 12, display: "inline-block", fontWeight: 600, fontSize: 14, fontFamily: FONT, cursor: "pointer", textDecoration: "none", boxShadow: "0 4px 16px rgba(74,144,217,0.35)" }}>Subscribe Free →</a>
 </Card>

 {courseView === "course" && (<>
  {/* ── SVG HOUSE ILLUSTRATION ── */}
  {courseChapter === null && (
  <>
  <Card style={{ marginTop: 12, overflow: "hidden" }}>
   <div style={{ display: "flex", justifyContent: "center", padding: "16px 0 8px" }}>
    <svg viewBox="0 0 300 240" style={{ width: "100%", maxWidth: 320 }}>
     {/* Sky gradient */}
     <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={darkMode?"#1a1a3e":"#87CEEB"}/><stop offset="100%" stopColor={darkMode?"#0d0d1a":"#E0F0FF"}/></linearGradient>
      <linearGradient id="grass" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={darkMode?"#1a3a1a":"#4CAF50"}/><stop offset="100%" stopColor={darkMode?"#0f250f":"#388E3C"}/></linearGradient>
     </defs>
     <rect width="300" height="240" fill="url(#sky)" rx="12"/>
     {/* Ground */}
     <rect y="190" width="300" height="50" fill="url(#grass)" rx="0"/>
     <ellipse cx="150" cy="192" rx="120" ry="8" fill={darkMode?"#2a4a2a":"#66BB6A"} opacity="0.5"/>

     {/* 1. Foundation slab */}
     <g opacity={courseProgress[1] ? 1 : 0.12}>
      <rect x="55" y="178" width="190" height="14" fill={darkMode?"#555":"#9E9E9E"} rx="2"/>
      <rect x="58" y="180" width="184" height="2" fill={darkMode?"#666":"#BDBDBD"} opacity="0.5"/>
     </g>
     {/* 2. Foundation walls */}
     <g opacity={courseProgress[2] ? 1 : 0.12}>
      <rect x="60" y="160" width="180" height="20" fill={darkMode?"#5D4037":"#795548"} rx="1"/>
      <rect x="60" y="165" width="180" height="2" fill={darkMode?"#4E342E":"#6D4C41"} opacity="0.6"/>
     </g>
     {/* 3. Foundation complete - basement window */}
     <g opacity={courseProgress[3] ? 1 : 0.12}>
      <rect x="130" y="163" width="40" height="12" fill={darkMode?"#333":"#546E7A"} rx="2"/>
      <line x1="150" y1="163" x2="150" y2="175" stroke={darkMode?"#555":"#78909C"} strokeWidth="1"/>
     </g>
     {/* 4. Floor/subfloor framing */}
     <g opacity={courseProgress[4] ? 1 : 0.12}>
      <rect x="58" y="155" width="184" height="6" fill={darkMode?"#8D6E63":"#D7CCC8"} rx="1"/>
      {[0,1,2,3,4,5,6,7,8].map(i => <rect key={i} x={65+i*20} y="155" width="3" height="6" fill={darkMode?"#6D4C41":"#BCAAA4"} opacity="0.7"/>)}
     </g>
     {/* 5. Wall framing */}
     <g opacity={courseProgress[5] ? 1 : 0.12}>
      <rect x="65" y="90" width="6" height="65" fill={darkMode?"#8D6E63":"#D7CCC8"}/>
      <rect x="229" y="90" width="6" height="65" fill={darkMode?"#8D6E63":"#D7CCC8"}/>
      {[0,1,2,3,4].map(i => <rect key={i} x={95+i*30} y="95" width="4" height="60" fill={darkMode?"#8D6E63":"#D7CCC8"} opacity="0.6"/>)}
      <rect x="65" y="90" width="170" height="5" fill={darkMode?"#A1887F":"#BCAAA4"}/>
     </g>
     {/* 6. Roof framing / trusses */}
     <g opacity={courseProgress[6] ? 1 : 0.12}>
      <line x1="55" y1="92" x2="150" y2="35" stroke={darkMode?"#8D6E63":"#BCAAA4"} strokeWidth="5" strokeLinecap="round"/>
      <line x1="245" y1="92" x2="150" y2="35" stroke={darkMode?"#8D6E63":"#BCAAA4"} strokeWidth="5" strokeLinecap="round"/>
      <line x1="100" y1="92" x2="150" y2="50" stroke={darkMode?"#6D4C41":"#D7CCC8"} strokeWidth="3" opacity="0.5"/>
      <line x1="200" y1="92" x2="150" y2="50" stroke={darkMode?"#6D4C41":"#D7CCC8"} strokeWidth="3" opacity="0.5"/>
     </g>
     {/* 7. Windows & door */}
     <g opacity={courseProgress[7] ? 1 : 0.12}>
      <rect x="80" y="105" width="35" height="35" fill={darkMode?"#1565C0":"#90CAF9"} rx="2" stroke={darkMode?"#eee":"#fff"} strokeWidth="2"/>
      <line x1="97.5" y1="105" x2="97.5" y2="140" stroke={darkMode?"#eee":"#fff"} strokeWidth="1.5"/>
      <line x1="80" y1="122.5" x2="115" y2="122.5" stroke={darkMode?"#eee":"#fff"} strokeWidth="1.5"/>
      <rect x="185" y="105" width="35" height="35" fill={darkMode?"#1565C0":"#90CAF9"} rx="2" stroke={darkMode?"#eee":"#fff"} strokeWidth="2"/>
      <line x1="202.5" y1="105" x2="202.5" y2="140" stroke={darkMode?"#eee":"#fff"} strokeWidth="1.5"/>
      <line x1="185" y1="122.5" x2="220" y2="122.5" stroke={darkMode?"#eee":"#fff"} strokeWidth="1.5"/>
      <rect x="133" y="115" width="34" height="42" fill={darkMode?"#5D4037":"#8D6E63"} rx="2"/>
      <circle cx="161" cy="137" r="2.5" fill={darkMode?"#FFD54F":"#FFC107"}/>
     </g>
     {/* 8. Siding / exterior walls */}
     <g opacity={courseProgress[8] ? 1 : 0.12}>
      <rect x="66" y="92" width="63" height="63" fill={darkMode?"#37474F":"#ECEFF1"} opacity="0.85" rx="1"/>
      <rect x="171" y="92" width="63" height="63" fill={darkMode?"#37474F":"#ECEFF1"} opacity="0.85" rx="1"/>
      <rect x="66" y="142" width="168" height="13" fill={darkMode?"#37474F":"#ECEFF1"} opacity="0.85"/>
      {[0,1,2,3,4,5,6].map(i => <line key={i} x1="66" y1={97+i*9} x2="234" y2={97+i*9} stroke={darkMode?"#455A64":"#CFD8DC"} strokeWidth="0.5" opacity="0.5"/>)}
     </g>
     {/* 9. Roof shingles */}
     <g opacity={courseProgress[9] ? 1 : 0.12}>
      <polygon points="150,30 45,92 255,92" fill={darkMode?"#B71C1C":"#E53935"}/>
      <polygon points="150,30 45,92 255,92" fill="none" stroke={darkMode?"#D32F2F":"#EF5350"} strokeWidth="2"/>
      {[0,1,2,3].map(i => <line key={i} x1={75+i*15} y1={80-i*10} x2={225-i*15} y2={80-i*10} stroke={darkMode?"#C62828":"#EF5350"} strokeWidth="0.7" opacity="0.4"/>)}
     </g>
     {/* 10. Complete - chimney, path, landscaping */}
     <g opacity={courseProgress[10] ? 1 : 0.12}>
      <rect x="190" y="32" width="18" height="38" fill={darkMode?"#5D4037":"#795548"} rx="2"/>
      <rect x="187" y="28" width="24" height="6" fill={darkMode?"#6D4C41":"#8D6E63"} rx="1"/>
      {/* Smoke */}
      <circle cx="199" cy="20" r="4" fill={darkMode?"#666":"#ccc"} opacity="0.4"/>
      <circle cx="205" cy="12" r="3" fill={darkMode?"#555":"#ddd"} opacity="0.3"/>
      {/* Path */}
      <path d="M150,192 Q145,205 140,215 Q135,225 130,240" stroke={darkMode?"#8D6E63":"#D7CCC8"} strokeWidth="12" fill="none" strokeLinecap="round" opacity="0.7"/>
      {/* Bushes */}
      <circle cx="55" cy="187" r="10" fill={darkMode?"#2E7D32":"#66BB6A"}/>
      <circle cx="245" cy="187" r="10" fill={darkMode?"#2E7D32":"#66BB6A"}/>
      <circle cx="42" cy="185" r="8" fill={darkMode?"#388E3C":"#81C784"}/>
      <circle cx="258" cy="185" r="8" fill={darkMode?"#388E3C":"#81C784"}/>
      {/* Mailbox */}
      <rect x="270" y="176" width="2" height="16" fill={darkMode?"#666":"#999"}/>
      <rect x="265" y="172" width="14" height="8" fill={darkMode?"#B71C1C":"#E53935"} rx="2"/>
     </g>
     {/* Progress label */}
     {courseComplete && <text x="150" y="222" textAnchor="middle" fill="#FFF" fontSize="11" fontWeight="700" fontFamily="-apple-system,sans-serif">Welcome Home!</text>}
    </svg>
   </div>
   <div style={{ textAlign: "center", padding: "4px 0 12px" }}>
    <div style={{ fontSize: 22, fontWeight: 800, fontFamily: FONT, color: courseComplete ? T.green : T.text }}>{courseComplete ? "You Built Your Home!" : "Build Your Home"}</div>
    <div style={{ fontSize: 13, color: T.textSecondary, marginTop: 4 }}>Complete each chapter to add a new piece. {completedCount}/{COURSE_CHAPTERS.length} built.</div>
    {/* Progress bar */}
    <div style={{ margin: "12px auto 0", width: "80%", height: 8, background: T.inputBg, borderRadius: 4, overflow: "hidden" }}>
     <div style={{ width: `${(completedCount / COURSE_CHAPTERS.length) * 100}%`, height: "100%", background: `linear-gradient(90deg, #FF9500, #0A84FF, #30D158)`, borderRadius: 4, transition: "width 0.5s ease" }}/>
    </div>
   </div>
  </Card>

  {/* ── PHASE SECTIONS ── */}
  {PHASE_INFO.map(phase => {
   const phaseChapters = COURSE_CHAPTERS.filter(c => c.phase === phase.num);
   const phaseComplete = phaseChapters.every(c => courseProgress[c.id]);
   const phaseCount = phaseChapters.filter(c => courseProgress[c.id]).length;
   return (
    <Sec key={phase.num} title={`Phase ${phase.num}: ${phase.title}`} color={phase.color}>
     <Card>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
       <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, color: T.textTertiary }}>{phase.sub}</div>
        <div style={{ height: 4, background: T.inputBg, borderRadius: 2, marginTop: 4, overflow: "hidden" }}>
         <div style={{ width: `${(phaseCount/phaseChapters.length)*100}%`, height: "100%", background: phase.color, borderRadius: 2, transition: "width 0.4s" }}/>
        </div>
       </div>
       {phaseComplete && <div style={{ fontSize: 20 }}></div>}
      </div>
      {phaseChapters.map((ch, ci) => {
       const done = courseProgress[ch.id];
       const prevDone = ch.id === 1 || courseProgress[ch.id - 1];
       const locked = !prevDone && !done;
       return (
        <div key={ch.id} onClick={() => !locked && (setCourseChapter(ch.id), setCourseQuizAnswers({}), setCourseQuizSubmitted(false))}
         style={{ display: "flex", gap: 12, padding: "12px 0", borderTop: ci > 0 ? `1px solid ${T.separator}` : "none", cursor: locked ? "not-allowed" : "pointer", opacity: locked ? 0.4 : 1 }}>
         <div style={{ width: 44, height: 44, borderRadius: 14, background: done ? `${T.green}20` : locked ? T.inputBg : `${phase.color}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0, border: done ? `2px solid ${T.green}` : `2px solid transparent`, color: done ? T.green : locked ? T.textTertiary : phase.color }}>
          <Icon name={done ? "check" : locked ? "lock" : ch.icon} size={22} />
         </div>
         <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: done ? T.green : locked ? T.textTertiary : T.text }}>Ch. {ch.id}: {ch.title}</div>
          <div style={{ fontSize: 12, color: T.textTertiary, marginTop: 2 }}>{done ? "Completed" : locked ? "Complete previous chapter first" : "Tap to start"}</div>
         </div>
         {!locked && <div style={{ display: "flex", alignItems: "center", color: T.textTertiary, fontSize: 16 }}>›</div>}
        </div>
       );
      })}
     </Card>
    </Sec>
   );
  })}

  {/* Reset course */}
  {completedCount > 0 && <Card style={{ marginTop: 8 }}>
   <div style={{ textAlign: "center", padding: 4 }}>
    <span onClick={() => { saveCourseProgress({}); setCourseChapter(null); }} style={{ fontSize: 12, color: T.textTertiary, cursor: "pointer", textDecoration: "underline" }}>Reset course progress</span>
   </div>
  </Card>}
  </>)}

  {/* ── CHAPTER VIEW ── */}
  {courseChapter !== null && (() => {
   const ch = COURSE_CHAPTERS.find(c => c.id === courseChapter);
   if (!ch) return null;
   const done = courseProgress[ch.id];
   const allCorrect = ch.quiz.every((q, i) => courseQuizAnswers[i] === q.a);
   return (<>
    {/* Back nav */}
    <div onClick={() => setCourseChapter(null)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "14px 0 6px", cursor: "pointer", color: T.blue, fontSize: 14, fontWeight: 600 }}>
     ← Back to Course
    </div>
    {/* Chapter header */}
    <Card style={{ background: `linear-gradient(135deg, ${PHASE_INFO[ch.phase-1].color}12, ${T.card})`, border: `1px solid ${PHASE_INFO[ch.phase-1].color}30` }}>
     <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ width: 52, height: 52, borderRadius: 16, background: `${PHASE_INFO[ch.phase-1].color}20`, display: "flex", alignItems: "center", justifyContent: "center", color: PHASE_INFO[ch.phase-1].color }}><Icon name={ch.icon} size={28} /></div>
      <div>
       <div style={{ fontSize: 11, fontWeight: 700, color: PHASE_INFO[ch.phase-1].color, textTransform: "uppercase", letterSpacing: 1 }}>Phase {ch.phase} · Chapter {ch.id}</div>
       <div style={{ fontSize: 18, fontWeight: 800, color: T.text, fontFamily: FONT }}>{ch.title}</div>
      </div>
     </div>
    </Card>
    {/* Lesson content */}
    <Sec title="Lesson">
     <Card>
      {ch.lesson.split("\n\n").map((para, pi) => (
       <div key={pi} style={{ fontSize: 14, color: T.textSecondary, lineHeight: 1.7, marginBottom: 12 }}>
        {para.split("\n").map((line, li) => {
         const parts = line.split(/(\*\*[^*]+\*\*)/g);
         return (
          <span key={li}>{li > 0 && <br/>}{parts.map((p, pk) =>
           p.startsWith("**") && p.endsWith("**")
            ? <strong key={pk} style={{ color: T.text, fontWeight: 700 }}>{p.slice(2,-2)}</strong>
            : <span key={pk}>{p.startsWith("•") ? <span style={{ color: T.blue }}>  •  </span> : ""}{p.startsWith("•") ? p.slice(1).trim() : p}</span>
          )}</span>
         );
        })}
       </div>
      ))}
      {/* Link to app tab */}
      <div style={{ marginTop: 8, padding: "10px 14px", background: `${T.blue}10`, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}
       onClick={() => { setTab(ch.tabLink); setCourseChapter(null); }}>
       <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: T.blue }}>Try it yourself →</div>
        <div style={{ fontSize: 11, color: T.textTertiary }}>Open the {ch.tabLabel} tab</div>
       </div>
       <div style={{ fontSize: 20 }}></div>
      </div>
     </Card>
    </Sec>
    {/* Quiz */}
    <Sec title={done ? "Quiz " : "Quiz — Pass to Build"}>
     <Card>
      {ch.quiz.map((q, qi) => {
       const answered = courseQuizAnswers[qi] !== undefined;
       const correct = courseQuizAnswers[qi] === q.a;
       return (
        <div key={qi} style={{ marginBottom: qi < ch.quiz.length - 1 ? 16 : 0 }}>
         <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 8 }}>{qi+1}. {q.q}</div>
         {q.opts.map((opt, oi) => {
          const selected = courseQuizAnswers[qi] === oi;
          const isCorrect = oi === q.a;
          const showResult = courseQuizSubmitted && selected;
          return (
           <div key={oi} onClick={() => { if (!courseQuizSubmitted && !done) { setCourseQuizAnswers({...courseQuizAnswers, [qi]: oi}); Haptics.light(); } }}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", marginBottom: 4, borderRadius: 10, cursor: (courseQuizSubmitted || done) ? "default" : "pointer",
             background: showResult ? (correct ? `${T.green}15` : `${T.red}15`) : (courseQuizSubmitted && isCorrect) ? `${T.green}10` : selected ? `${T.blue}12` : T.inputBg,
             border: selected ? `2px solid ${showResult ? (correct ? T.green : T.red) : T.blue}` : `2px solid transparent`,
             transition: "all 0.15s" }}>
            <div style={{ width: 22, height: 22, borderRadius: "50%", border: `2px solid ${selected ? (showResult ? (correct ? T.green : T.red) : T.blue) : T.textTertiary}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, flexShrink: 0, background: selected ? (showResult ? (correct ? T.green : T.red) : T.blue) : "transparent", color: selected ? "#FFF" : "transparent" }}>
             {showResult ? (correct ? "✓" : "✗") : selected ? "●" : ""}
            </div>
            <div style={{ fontSize: 13, color: T.text, flex: 1 }}>{opt}</div>
           </div>
          );
         })}
        </div>
       );
      })}
      {/* Submit / Result */}
      {!done && !courseQuizSubmitted && (
       <button onClick={() => { if (Object.keys(courseQuizAnswers).length === ch.quiz.length) setCourseQuizSubmitted(true); }}
        disabled={Object.keys(courseQuizAnswers).length < ch.quiz.length}
        style={{ width: "100%", padding: "14px 0", borderRadius: 12, border: "none", fontSize: 15, fontWeight: 700, fontFamily: FONT, cursor: Object.keys(courseQuizAnswers).length === ch.quiz.length ? "pointer" : "not-allowed",
         background: Object.keys(courseQuizAnswers).length === ch.quiz.length ? T.blue : T.inputBg,
         color: Object.keys(courseQuizAnswers).length === ch.quiz.length ? "#FFF" : T.textTertiary, marginTop: 12 }}>
        Check Answers ({Object.keys(courseQuizAnswers).length}/{ch.quiz.length})
       </button>
      )}
      {courseQuizSubmitted && !done && (
       <div style={{ marginTop: 12, textAlign: "center", padding: 16, borderRadius: 12, background: allCorrect ? `${T.green}12` : `${T.red}08` }}>
        {allCorrect ? (<>
         <div style={{ fontSize: 32, marginBottom: 8 }}></div>
         <div style={{ fontSize: 16, fontWeight: 800, color: T.green, fontFamily: FONT }}>Perfect Score!</div>
         <div style={{ fontSize: 13, color: T.textSecondary, marginTop: 4, marginBottom: 12 }}>You just built the {ch.title.toLowerCase()} of your home!</div>
         <button onClick={() => { const np = {...courseProgress, [ch.id]: true}; saveCourseProgress(np); const next = COURSE_CHAPTERS.find(c => c.id === ch.id + 1); if (next) { setCourseChapter(next.id); setCourseQuizAnswers({}); setCourseQuizSubmitted(false); } else { setCourseChapter(null); setShowCourseComplete(true); } }}
          style={{ padding: "12px 28px", borderRadius: 12, border: "none", fontSize: 15, fontWeight: 700, fontFamily: FONT, cursor: "pointer", background: T.green, color: "#FFF" }}>
          {ch.id < 10 ? "Next Chapter →" : "Complete Course "}
         </button>
        </>) : (<>
         <div style={{ fontSize: 32, marginBottom: 8 }}></div>
         <div style={{ fontSize: 16, fontWeight: 700, color: T.red, fontFamily: FONT }}>Not Quite — Try Again</div>
         <div style={{ fontSize: 13, color: T.textSecondary, marginTop: 4, marginBottom: 12 }}>Review the lesson and fix the red answers.</div>
         <button onClick={() => { setCourseQuizAnswers({}); setCourseQuizSubmitted(false); }}
          style={{ padding: "12px 28px", borderRadius: 12, border: "none", fontSize: 15, fontWeight: 600, fontFamily: FONT, cursor: "pointer", background: T.blue, color: "#FFF" }}>
          Retry Quiz
         </button>
        </>)}
       </div>
      )}
      {done && (
       <div style={{ marginTop: 12, textAlign: "center", padding: 12, borderRadius: 12, background: `${T.green}10` }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: T.green }}>Chapter completed — house piece built!</div>
       </div>
      )}
     </Card>
    </Sec>
    {/* Nav between chapters */}
    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
     {ch.id > 1 && <button onClick={() => { setCourseChapter(ch.id - 1); setCourseQuizAnswers({}); setCourseQuizSubmitted(false); }} style={{ flex: 1, padding: "12px 0", borderRadius: 12, border: `1px solid ${T.cardBorder}`, background: T.card, fontSize: 13, fontWeight: 600, color: T.textSecondary, cursor: "pointer", fontFamily: FONT }}>← Ch. {ch.id-1}</button>}
     {ch.id < 10 && courseProgress[ch.id] && <button onClick={() => { setCourseChapter(ch.id + 1); setCourseQuizAnswers({}); setCourseQuizSubmitted(false); }} style={{ flex: 1, padding: "12px 0", borderRadius: 12, border: "none", background: T.blue, fontSize: 13, fontWeight: 600, color: "#FFF", cursor: "pointer", fontFamily: FONT }}>Ch. {ch.id+1} →</button>}
    </div>
   </>);
  })()}

  {/* Course complete celebration */}
  {showCourseComplete && (
   <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999, padding: 20 }}
    onClick={() => setShowCourseComplete(false)}>
    <div onClick={e => e.stopPropagation()} style={{ background: T.card, borderRadius: 24, padding: 32, maxWidth: 340, width: "100%", textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
     <div style={{ fontSize: 60, marginBottom: 16 }}></div>
     <div style={{ fontSize: 24, fontWeight: 800, fontFamily: FONT, color: T.text }}>Welcome Home!</div>
     <div style={{ fontSize: 15, color: T.textSecondary, marginTop: 8, lineHeight: 1.6 }}>You completed all 10 chapters and built your home from the ground up. You went from "where do I start?" to "I can totally do this."</div>
     <div style={{ fontSize: 13, color: T.blue, fontWeight: 600, marginTop: 12 }}>You're ready. Let's find you a home.</div>
     <button onClick={() => { setShowCourseComplete(false); setTab("qualify"); }} style={{ marginTop: 20, padding: "14px 32px", borderRadius: 12, border: "none", background: T.green, color: "#FFF", fontSize: 16, fontWeight: 700, fontFamily: FONT, cursor: "pointer" }}>
      See What I Can Afford →
     </button>
    </div>
   </div>
  )}
 </>)}

 {courseView === "library" && (<>
  <Card pad={14} style={{ marginTop: 12 }}>
   <div style={{ fontSize: 13, color: T.textSecondary, lineHeight: 1.6 }}>Bite-sized mortgage education from <strong style={{ color: T.text }}>Three Point Thursday</strong> — the weekly newsletter that breaks down complex mortgage topics into 3 actionable points.</div>
  </Card>
  {[
   { cat: "Getting Started", items: [
    { title: "The 5 Pillars of Qualifying", icon: "", desc: "What lenders really look at before saying yes", body: "Every mortgage approval comes down to 5 pillars:\n\n1. Credit Score (FICO) — Minimum 580 for FHA, 620 for Conventional, 700 for Jumbo. A 740+ score unlocks the best pricing tiers.\n\n2. Down Payment — VA: 0%, FHA: 3.5%, Conventional: 3% (first-time buyer, conforming, ≤100% AMI) or 5%. Jumbo: 20%.\n\n3. Debt-to-Income Ratio (DTI) — Your total monthly debts divided by gross monthly income. Max DTI varies: Conventional 50%, FHA 57% (but also checks Housing-to-Income at 47%), VA 60%, Jumbo 43–50%.\n\n4. Cash to Close — Down payment + closing costs + prepaids – credits. You need to show you have enough liquid funds.\n\n5. Reserves — Most lenders want 6 months of mortgage payments in savings after closing. Reserves can include 401(k), stocks, and savings." },
    { title: "How Mortgage Rates Work", icon: "trending-up", desc: "Rates follow the 10-Year Treasury, not the Fed", body: "A common misconception: the Fed controls mortgage rates. They don't.\n\nMortgage rates are tied to the 10-Year Treasury yield. When inflation cools, bond markets relax, yields drop, and mortgage rates usually follow.\n\nThe Fed Funds Rate directly affects HELOCs and adjustable-rate products (tied to Prime), but fixed mortgage rates move independently based on bond market sentiment, inflation data (CPI), and economic outlook.\n\nKey signals to watch: CPI reports (monthly), Fed meetings (8x/year), and the 10-Year Treasury yield (daily). When the 10-Year drops, expect mortgage rates to follow — usually within days." },
    { title: "Conforming vs High Balance vs Jumbo", icon: "bar-chart", desc: "Loan limits determine your pricing and guidelines", body: "Your loan amount determines which \"bucket\" you fall into — and that changes everything about your rate, down payment, and qualification.\n\nConforming: Up to $832,750 (2025). Best rates, most flexible guidelines, lowest down payments.\n\nHigh Balance: $832,751 – $1,249,125. Slightly higher rates, still conventional guidelines.\n\nJumbo: Above $1,249,125. Higher rates, 700+ FICO typically required, 10–20% down, stricter DTI (43% max), and more reserves needed.\n\nWhy it matters: If your loan amount is just above a limit, even a small increase in down payment can drop you into a better bucket — saving you thousands over the life of the loan." },
   ]},
   { cat: "Loan Programs", items: [
    { title: "VA Loans: The Best Loan in America", icon: "", desc: "0% down, no PMI, lower rates, no loan limits", body: "If you're a veteran or active-duty service member, the VA loan is hands down the best mortgage product available.\n\n• 0% Down Payment — Buy a home with nothing down.\n• No PMI — Save hundreds per month vs. FHA or Conventional with <20% down.\n• Lower Rates — VA rates are typically 0.25–0.50% lower than conventional.\n• No Loan Limits — With full entitlement and no active VA loans, there's no cap from the VA. Many lenders go up to $4,000,000.\n• Lenient DTI — Up to 60% DTI allowed.\n• Min 580 FICO.\n\nThe VA Funding Fee (1.25–3.3% depending on use) can be rolled into the loan. Disabled veterans are exempt.\n\nMyth-busting: Sellers used to avoid VA offers. With longer days on market and softened competition, that's changing fast." },
    { title: "FHA Loans & The FHA Duplex", icon: "home", desc: "3.5% down, 580 FICO — and a house-hacking cheat code", body: "FHA loans are government-backed mortgages designed for buyers who need a lower barrier to entry: 3.5% down with a 580+ credit score.\n\nThe trade-off: FHA requires both upfront (1.75%) and monthly mortgage insurance (MIP) for the life of the loan. If you put 20%+ down, conventional is usually the better play.\n\nThe Power Move — FHA Duplex:\nBuy a duplex with 3.5% down, live in one unit, rent the other. A $1M duplex requires just $35K down. If rent covers $2,000/mo of your $7,500 payment, your net housing cost is $5,500 — for a million-dollar income-producing asset.\n\nFHA duplex limits are higher than single-family: up to $1,032,650 (standard) or $1,548,975 (high-cost areas like the Bay Area).\n\nOccupancy rule: You must live in one unit for at least 12 months. After that, you can move out and keep it as an investment." },
    { title: "ARMs: Lower Rates for Strategic Buyers", icon: "", desc: "~0.50% lower starting rate — but have a game plan", body: "An Adjustable-Rate Mortgage (ARM) gives you a lower starting rate — typically about 0.50% below a 30-year fixed. On a $600K loan, that can save ~$300+/month.\n\nHow it works: Your rate is fixed for an initial period (3, 5, 7, or 10 years), then adjusts annually based on market conditions.\n\nARMs make sense when you:\n• Plan to sell before the adjustment period\n• Expect to refinance when rates drop\n• Want to maximize cash flow in the short term\n\nARMs do NOT make sense when:\n• This is your forever home\n• You have no exit strategy\n• You can't absorb a potential payment increase\n\nAvailable on Conventional, FHA, and VA loans. Always have a game plan before going adjustable." },
    { title: "1% Down Programs", icon: "info", desc: "Bring 1%, get a 2% grant — 3% total down from you", body: "Some lenders offer programs where you bring just 1% down and receive a 2% grant — giving you 3% total down payment with only 1% out of pocket. The grant does not need to be repaid.\n\nWho qualifies:\n• First-time homebuyers\n• Income caps apply (varies by area — check AMI limits)\n• Must be a primary residence\n• Conforming loan amounts\n\nThis is one of the most powerful affordability tools available right now for buyers who have income but limited savings." },
   ]},
   { cat: "Refinancing", items: [
    { title: "The 3-Point Refi Test", icon: "", desc: "Only refinance if it passes all 3 checkpoints", body: "Before refinancing, run every scenario through the 3-Point Refi Test. Only move forward if the new loan:\n\n1. Saves at least 0.500% on your rate OR $300+/month on your payment\n2. Requires no points (keep upfront costs low)\n3. Shaves 1+ year off your loan if you keep the same monthly payment\n\nIf it checks all three boxes: it's a no-brainer.\n\nThink of refinancing like rock climbing down the mountain. Every time you can lock in a lower rate and shave 0.500% off your loan — clip in. Secure the savings. Then keep climbing down." },
    { title: "Rate & Term vs Cash-Out Refi", icon: "banknote", desc: "Different purposes, different rules, different rates", body: "Rate & Term Refi: You're refinancing to get a better rate, shorter term, or both. Small cash out is allowed (greater of $2,000 or 1% of loan amount). This gets the best pricing.\n\nCash-Out Refi: You're pulling equity from your home — to pay off debt, fund renovations, or invest. Higher rate (typically +0.25–0.50%) but more flexibility.\n\nKey refi facts:\n• You can refinance every 6 months (start the process around month 4)\n• Choose any term from 8–30 years — no need to reset to 30\n• You'll skip 1–2 mortgage payments at closing\n• You'll get an escrow refund from your old lender\n• Your payoff will be higher than your balance (lenders collect interest in arrears)\n\nNet Cash Out = Refi proceeds + skipped payments + escrow refund" },
    { title: "How to Remove PMI", icon: "", desc: "Ditch the training wheels and save hundreds per month", body: "If you didn't put 20% down, you're likely paying Private Mortgage Insurance (PMI). It protects the lender, not you — and you want to remove it ASAP.\n\nWhen can you remove PMI?\n• Automatically removed at 78% LTV (based on original purchase price)\n• Request removal at 80% LTV (also based on original price)\n• Loan is 2+ years old: remove at 75% LTV using current appraised value\n• Loan is 5+ years old: remove at 80% LTV using current appraised value\n\nSteps: Contact your servicer, submit a written request with your loan number, may need an appraisal, and must show on-time payment history.\n\nImportant: FHA mortgage insurance (MIP) lasts for the life of the loan. The only way to remove FHA MIP is to refinance into a conventional loan once you have 20%+ equity." },
   ]},
   { cat: "Strategy & Wealth", items: [
    { title: "Buying Before Selling", icon: "home", desc: "Three financing structures to move up without moving twice", body: "The classic dilemma: you need to sell your current home to buy the next one. Here are three ways to buy first:\n\nOption 1 — Conventional Loan: Works if you can qualify carrying two mortgage payments AND have cash for the down payment. Best pricing, but only fits a small slice of buyers.\n\nOption 2 — Bridge Loan: Short-term (6–12 months) using your current home's equity. No sale contingency, you move once. But they're pricey: ~10% interest + 2–3 points, often $30–40K+ all-in.\n\nOption 3 — Conventional-Bridge Hybrid (the sweet spot): Conventional pricing with bridge-like flexibility. You can exclude your current mortgage from qualifying if you have 30%+ equity in your departing home AND it's listed on the MLS.\n\nDown payment solutions: 401(k) loan (repaid after sale), gift funds, HELOC on departing home, or a 60-day retirement rollover." },
    { title: "HELOCs: Your Rich Grandma", icon: "landmark", desc: "A safety net that costs nothing when unused", body: "A Home Equity Line of Credit (HELOC) is a revolving credit line secured by your home's equity. It costs nothing when unused and gives you fast, low-cost access to cash.\n\nBest uses:\n• Buy before you sell — use as a built-in bridge for your next down payment\n• Emergency cushion — job change, medical bills, unexpected repairs\n• Home improvements — kitchen remodel, ADU, solar (interest may be tax-deductible)\n• Tax & business flexibility — cover quarterly taxes or smooth out self-employment cash flow\n\nHELOC rates are tied to Prime (Fed Funds Rate + 3%), so they move with Fed decisions.\n\nPro tip: Open a HELOC BEFORE you need one. When you actually need it, it's usually too late to get one quickly. For HELOCs, going direct to a bank or credit union is typically best — smaller regional banks often offer the best speed and service." },
    { title: "Mortgage Points: Pay or Skip?", icon: "diamond", desc: "When buying down your rate makes sense — and when it doesn't", body: "Mortgage points (discount points) are prepaid interest. You pay upfront at closing in exchange for a permanently lower rate. 1 point = 1% of your loan amount.\n\nExample on a $600K loan:\n• Paying 1 point ($6,000) might save ~$148/month\n• Breakeven: ~40 months (just over 3 years)\n• After breakeven, you're saving every month\n\nPay points when: You'll keep the loan 5+ years and want the lowest possible payment.\n\nSkip points (or take lender credit) when: You plan to refinance, sell, or move in a few years. A lender credit gives you money toward closing costs in exchange for a slightly higher rate.\n\nTaking a lender credit vs paying 1 point = a $12,000 swing in upfront costs on a $600K loan.\n\nTax note: Points paid on a purchase may be tax-deductible in the year you close. Check with your CPA." },
    { title: "Lowkey Homebuying Season", icon: "target", desc: "The Black Friday of housing that most buyers miss", body: "Spring and summer are the typical homebuying seasons. But deal hunters should circle November through February — Lowkey Homebuying SZN.\n\nWhy it works:\n• Less competition — many buyers pause for the holidays\n• More motivated sellers — winter listings usually mean sellers need to move, not just want to. Carrying costs add up, and that's your leverage.\n• Real-time inspections — rainy season gives you an instant reality check on roofs, drainage, and leaks\n\nIf you could wait until spring, you would — but so would the seller. That mismatch is your opportunity." },
   ]},
   { cat: "Investor Corner", items: [
    { title: "Fix & Flip Loans", icon: "", desc: "Short-term, asset-based loans for buy-renovate-resell", body: "Fix & Flip loans are short-term (6–18 months), interest-only loans for investors looking to buy, renovate, and resell.\n\nKey features:\n• Asset-based: approval is based on After-Repair Value (ARV), not your income or credit\n• Fast closings: often 5–7 days\n• Lenders typically fund 75–90% of purchase + 100% of rehab, capped at 75% of ARV\n\nThe 70% Rule: Don't pay more than 70% of ARV minus repair costs. If ARV = $1,000,000 and reno = $100,000, cap your purchase at $600,000.\n\nWhat lenders want to see: A detailed scope of work, realistic timeline, contractor bids, and your experience level.\n\nFirst-time flipper? Start small, partner with an experienced contractor, and expect the unexpected." },
    { title: "House Hacking with FHA", icon: "key", desc: "Live in one unit, rent the other — build wealth from day one", body: "House hacking means buying a multi-unit property, living in one unit, and renting the others to offset your mortgage.\n\nWith an FHA loan, you can buy a duplex with just 3.5% down. The rental income from the other unit can dramatically reduce your effective housing cost.\n\nThe math: $1M duplex → $35K down → $7,500/mo PITI. Rent the other unit for $2,000/mo → your net cost is $5,500/mo for a million-dollar appreciating, income-producing asset.\n\nAfter 12 months of occupancy, you can move out and keep it as a full rental property. Then repeat with your next primary residence.\n\nThis is one of the most reliable paths to building a real estate portfolio starting from scratch." },
   ]},
  ].map((section, si) => <LearnSec key={si} cat={section.cat} items={section.items} />)}
 </>)}

 {courseView === "guidelines" && (<>
  <Card pad={14} style={{ marginTop: 12 }}>
   <div style={{ fontSize: 13, color: T.textSecondary, lineHeight: 1.6 }}>Qualification guidelines by loan program. Your current selection (<strong style={{ color: T.blue }}>{loanType}</strong>) is highlighted.</div>
  </Card>

  {(() => {
   const programs = [
    { name: "Conventional", sub: "Conforming & High Balance", icon: "landmark", active: loanType === "Conventional",
      rows: [
       ["Min Down Payment", "3% (FTHB ≤100% AMI)\n5% standard", "3% requires first-time buyer status + income ≤ area median. Non-FTHB or high-balance = 5% min."],
       ["Min FICO", "620", "Below 680 may trigger pricing adjustments (LLPAs). 740+ gets the best rates."],
       ["Max DTI", "50%", "With strong compensating factors (reserves, high FICO). Standard comfort zone is 45%."],
       ["Reserves", "2–6 months PITI", "2 months for conforming, up to 6 for high-balance or investment. 401(k), stocks, and savings all count at face value."],
       ["PMI", "Required until 80% LTV", "Auto-removed at 78% LTV. Request removal at 80%. After 2 yrs: remove at 75% with new appraisal. After 5 yrs: 80%."],
       ["Loan Limits (2026)", `Conforming: ${fmt(calc.confLimit)}\nHigh Bal: ${fmt(calc.highBalLimit)}`, "2026 FHFA limits. High-balance applies in high-cost counties. Above high-balance = Jumbo."],
       ["Occupancy", "Primary, 2nd Home, Investment", "Investment properties require 15–25% down and higher reserves."],
      ]},
    { name: "FHA", sub: "Government-Backed", icon: "home", active: loanType === "FHA",
      rows: [
       ["Min Down Payment", "3.5%", "With 580+ FICO. Minimum score for FHA is 580."],
       ["Min FICO", "580", "Many lenders overlay at 620. FHA allows 2 yrs post-bankruptcy, 3 yrs post-foreclosure."],
       ["Max DTI / HTI", "DTI: 57%\nHTI: 47%", "FHA looks at both total DTI (all debts) and Housing-to-Income ratio (housing payment only). HTI max of 47% is the more common limiting factor."],
       ["Reserves", "0–1 month", "Rarely required for 1–2 unit primary. 3–4 unit = 3 months."],
       ["Mortgage Insurance", "Upfront: 1.75% (financed)\nMonthly: varies by LTV & loan amt", "MIP rate depends on loan amount and down payment:\n• ≤$726,200 & >95% LTV: 0.55%/yr (life of loan)\n• ≤$726,200 & 90.01–95% LTV: 0.50% (life of loan)\n• ≤$726,200 & ≤90% LTV: 0.50% (11 years)\n• >$726,200 & >95% LTV: 0.75% (life of loan)\n• >$726,200 & 90.01–95% LTV: 0.70% (life of loan)\n• >$726,200 & ≤90% LTV: 0.70% (11 years)"],
       ["Loan Limits (2026)", `1-unit: ${fmt(832750)}\n2-unit: ${fmt(1066250)}`, "FHA floor = conforming limit. Higher in high-cost areas (ceiling = 150% of conforming). FHA duplex limits are generous — great for house-hacking."],
       ["Occupancy", "Primary residence only", "Must occupy within 60 days. 12-month occupancy requirement."],
      ]},
    { name: "VA", sub: "Veterans & Active Duty", icon: "", active: loanType === "VA",
      rows: [
       ["Min Down Payment", "0%", "True zero down. For veterans, active duty, National Guard, reservists, and surviving spouses."],
       ["Min FICO", "580", "VA has no official minimum — most lenders overlay at 580–620."],
       ["Max DTI", "60%", "Most flexible DTI of any program. VA also uses residual income analysis."],
       ["Reserves", "None required", "Standard purchases. Lender may require reserves above $1M or for lower FICO."],
       ["Mortgage Insurance", "None — No PMI ever", "VA Funding Fee (1.25–3.3%) can be financed. First use 0% down = 2.15%. Waived if 10%+ disability."],
       ["Loan Limits", "No limit (full entitlement)", "No VA cap with full entitlement. Lenders may cap at $2–4M."],
       ["Occupancy", "Primary residence only", "Must certify intent to occupy. Refi to conventional to convert to rental."],
       ["Residual Income", "Required", "Leftover monthly income after all obligations — varies by region and family size."],
      ]},
    { name: "Jumbo", sub: "Non-Conforming", icon: "diamond", active: loanType === "Jumbo",
      rows: [
       ["Min Down Payment", "20%", "Standard minimum for Jumbo. Some niche programs allow 10–15% with strong compensating factors."],
       ["Min FICO", "700", "Some lenders require 720. Below 700 severely limits options."],
       ["Max DTI", "43–50%", "43% is standard. Some programs allow up to 50% with exceptional reserves and credit."],
       ["Reserves", "6–12 months PITI", "6 months minimum, 12 preferred. Liquid reserves are critical."],
       ["PMI", "Required if <20% down", "Jumbo PMI is more expensive than conforming. Most put 20%+ down to avoid."],
       ["Loan Limits (2026)", `Above ${fmt(calc.highBalLimit)}`, "Anything above the 2026 high-balance limit for your county."],
       ["Occupancy", "Primary, 2nd Home, Investment", "Investment Jumbo available — typically 25–30% down with 12+ months reserves."],
       ["Asset Docs", "Full verification", "Manual underwriting. Expect large deposit explanations, full sourcing, business docs if self-employed."],
      ]},
   ];
   return programs.map((prog, pi) => (
    <Card key={pi} style={{ marginTop: 12, border: prog.active ? `2px solid ${T.blue}` : `1px solid ${T.cardBorder}`, position: "relative", overflow: "hidden" }}>
     {prog.active && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: T.blue }} />}
     <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", color: prog.active ? T.blue : T.textSecondary }}>{prog.icon ? <Icon name={prog.icon} size={28} /> : null}</div>
      <div>
       <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ fontSize: 17, fontWeight: 800, fontFamily: FONT, color: T.text }}>{prog.name}</div>
        {prog.active && <div style={{ fontSize: 10, fontWeight: 700, color: T.blue, background: `${T.blue}15`, padding: "2px 8px", borderRadius: 6 }}>YOUR LOAN</div>}
       </div>
       <div style={{ fontSize: 12, color: T.textTertiary }}>{prog.sub}</div>
      </div>
     </div>
     {prog.rows.map(([label, value, note], ri) => (
      <div key={ri} style={{ borderTop: `1px solid ${T.separator}`, padding: "10px 0" }}>
       <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: T.text, minWidth: 110 }}>{label}</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: prog.active ? T.blue : T.text, textAlign: "right", whiteSpace: "pre-line" }}>{value}</div>
       </div>
       {note && <div style={{ fontSize: 11, color: T.textTertiary, marginTop: 4, lineHeight: 1.5 }}>{note}</div>}
      </div>
     ))}
    </Card>
   ));
  })()}

  <Card style={{ marginTop: 12, overflow: "auto" }}>
   <div style={{ fontSize: 15, fontWeight: 700, fontFamily: FONT, color: T.text, marginBottom: 10 }}>Side-by-Side Comparison</div>
   <div style={{ overflowX: "auto" }}>
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
     <thead>
      <tr style={{ borderBottom: `2px solid ${T.separator}` }}>
       {["", "Conv.", "FHA", "VA", "Jumbo"].map((h, i) => (
        <th key={i} style={{ padding: "8px 6px", textAlign: i === 0 ? "left" : "center", fontWeight: 700, color: (h === "Conv." && loanType === "Conventional") || (h === loanType) ? T.blue : T.text, fontSize: 12 }}>{h}</th>
       ))}
      </tr>
     </thead>
     <tbody>
      {[
       ["Min Down", "3–5%", "3.5%", "0%", "20%"],
       ["Min FICO", "620", "580", "580", "700"],
       ["Max DTI", "50%", "57% / 47% HTI", "60%", "43–50%"],
       ["Reserves", "2–6 mo", "0–1 mo", "None", "6–12 mo"],
       ["PMI/MIP", "Until 80%", "Life of loan*", "None", "Until 80%"],
       ["Investment", "Yes (15%+)", "No", "No", "Yes (25%+)"],
      ].map(([label, ...vals], ri) => (
       <tr key={ri} style={{ borderBottom: `1px solid ${T.separator}` }}>
        <td style={{ padding: "8px 6px", fontWeight: 600, color: T.text, whiteSpace: "nowrap" }}>{label}</td>
        {vals.map((v, vi) => {
         const types = ["Conventional", "FHA", "VA", "Jumbo"];
         const isActive = loanType === types[vi];
         return <td key={vi} style={{ padding: "8px 6px", textAlign: "center", color: isActive ? T.blue : T.textSecondary, fontWeight: isActive ? 700 : 400, background: isActive ? `${T.blue}08` : "transparent" }}>{v}</td>;
        })}
       </tr>
      ))}
     </tbody>
    </table>
   </div>
  </Card>

  <Card style={{ marginTop: 12, border: `1px solid ${T.blue}33`, background: `${T.blue}06` }}>
   <div style={{ fontSize: 14, fontWeight: 700, fontFamily: FONT, color: T.blue, marginBottom: 10 }}>Your Current Thresholds</div>
   <div style={{ fontSize: 12, color: T.textTertiary, marginBottom: 10 }}>Based on your {loanType} loan setup</div>
   {[["Loan Type", loanType], ["Min Down %", calc.minDPpct + "%" + (loanType === "Conventional" && firstTimeBuyer ? " (FTHB)" : "")], ["Max DTI", pct(calc.maxDTI, 0)], ["Min FICO", calc.ficoMin.toString()],
    ["Reserve Months", calc.reserveMonths.toString()], ["Conforming Limit", fmt(calc.confLimit)], ["High Balance", fmt(calc.highBalLimit)]
   ].map(([l, v], i) => (
    <MRow key={i} label={l} value={v} />
   ))}
  </Card>
 </>)}
</>)}
{tab === "compare" && (<>
 <div style={{ marginTop: 20 }}>
  <Hero value={<Icon name="bar-chart" size={34} />} label="Compare Loan Options" color={T.blue} sub={`${scenarioList.length} option${scenarioList.length !== 1 ? "s" : ""}`} />
 </div>
 {/* ── Scenario Manager ── */}
 <Sec title="Your Loan Options" action="+ New" onAction={() => setNewScenarioName("New Option")}>
  {newScenarioName !== "" && (
   <Card>
    <div style={{ fontSize: 13, fontWeight: 600, color: T.textSecondary, marginBottom: 8 }}>Create New Loan Option</div>
    <TextInp label="Name" value={newScenarioName} onChange={setNewScenarioName} placeholder="e.g. 3BR Condo Oakland" />
    <div style={{ display: "flex", gap: 8 }}>
     <button onClick={() => { createScenario(newScenarioName); loadCompareData(); }} style={{ flex: 1, background: T.blue, color: "#FFF", border: "none", borderRadius: 12, padding: "12px 0", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>Create</button>
     <button onClick={() => setNewScenarioName("")} style={{ flex: 1, background: T.inputBg, color: T.textSecondary, border: "none", borderRadius: 12, padding: "12px 0", fontSize: 15, fontWeight: 500, cursor: "pointer", fontFamily: FONT }}>Cancel</button>
    </div>
   </Card>
  )}
  {scenarioList.map((name) => (
   <Card key={name} onClick={() => name !== scenarioName && editingScenarioName !== name ? switchScenario(name) : null}
    style={{ border: name === scenarioName ? `2px solid ${T.blue}` : `1px solid ${T.cardBorder}`, cursor: name === scenarioName || editingScenarioName === name ? "default" : "pointer" }}>
    {editingScenarioName === name ? (
     <div>
      <div style={{ fontSize: 11, fontWeight: 600, color: T.textTertiary, marginBottom: 4 }}>Rename Loan Option</div>
      <input value={editScenarioValue} onChange={e => setEditScenarioValue(e.target.value)}
       onKeyDown={e => { if (e.key === "Enter") { renameScenario(name, editScenarioValue); setEditingScenarioName(null); } if (e.key === "Escape") setEditingScenarioName(null); }}
       autoFocus
       style={{ width: "100%", background: T.inputBg, border: `1px solid ${T.blue}`, borderRadius: 8, padding: "10px 12px", fontSize: 15, fontWeight: 600, color: T.text, fontFamily: FONT, outline: "none", boxSizing: "border-box", marginBottom: 8 }} />
      <div style={{ display: "flex", gap: 6 }}>
       <button onClick={() => { renameScenario(name, editScenarioValue); setEditingScenarioName(null); }} style={{ flex: 1, background: T.blue, color: "#FFF", border: "none", borderRadius: 8, padding: "8px 0", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>Save</button>
       <button onClick={() => setEditingScenarioName(null)} style={{ flex: 1, background: T.inputBg, color: T.textSecondary, border: "none", borderRadius: 8, padding: "8px 0", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: FONT }}>Cancel</button>
      </div>
     </div>
    ) : (
     <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div style={{ flex: 1 }}>
       <div style={{ fontSize: 15, fontWeight: 600, color: name === scenarioName ? T.blue : T.text }}>{name}</div>
       {name === scenarioName ? <div style={{ fontSize: 12, color: T.green, fontWeight: 500, marginTop: 2 }}>Active — editing this one</div> : <div style={{ fontSize: 12, color: T.textTertiary, marginTop: 2 }}>Tap to switch</div>}
      </div>
      {name === scenarioName && (
       <div style={{ display: "flex", gap: 6 }}>
        <button onClick={(e) => { e.stopPropagation(); setEditingScenarioName(name); setEditScenarioValue(name); }} style={{ background: T.inputBg, border: "none", borderRadius: 8, padding: "6px 10px", fontSize: 12, fontWeight: 500, color: T.text, cursor: "pointer", fontFamily: FONT }}>Rename</button>
        <button onClick={(e) => { e.stopPropagation(); duplicateScenario(); setTimeout(loadCompareData, 500); }} style={{ background: T.inputBg, border: "none", borderRadius: 8, padding: "6px 10px", fontSize: 12, fontWeight: 500, color: T.blue, cursor: "pointer", fontFamily: FONT }}>Duplicate</button>
        {scenarioList.length > 1 && <button onClick={(e) => { e.stopPropagation(); deleteScenario(name); setTimeout(loadCompareData, 500); }} style={{ background: T.errorBg, border: "none", borderRadius: 8, padding: "6px 10px", fontSize: 12, fontWeight: 500, color: T.red, cursor: "pointer", fontFamily: FONT }}>Delete</button>}
       </div>
      )}
     </div>
    )}
   </Card>
  ))}
  <div style={{ fontSize: 12, color: T.textTertiary, lineHeight: 1.5, marginTop: 4 }}>Tap any option to switch, then go to Setup or Calculator to edit its details. Come back here to see them side-by-side.</div>
 </Sec>
 {/* ── Comparison Data ── */}
 {compareLoading ? (
  <Card><div style={{ textAlign: "center", padding: 20, color: T.textSecondary }}>Loading comparison...</div></Card>
 ) : compareData.length <= 1 ? (
  <Card style={{ marginTop: 8 }}>
   <div style={{ textAlign: "center", padding: 20 }}>
    <div style={{ fontSize: 32, marginBottom: 8 }}></div>
    <div style={{ fontSize: 14, fontWeight: 600, color: T.textSecondary }}>Create a second loan option above to see a side-by-side comparison</div>
    <div style={{ fontSize: 12, color: T.textTertiary, marginTop: 6 }}>Try a different price, rate, loan type, or down payment to see which works best for you.</div>
   </div>
  </Card>
 ) : (<>
  {/* Comparison cards — side-by-side on desktop, scrollable on mobile */}
  <div style={isDesktop ? { display: "grid", gridTemplateColumns: `repeat(${Math.min(compareData.length, 4)}, 1fr)`, gap: 14, margin: "12px 0" } : { overflowX: "auto", WebkitOverflowScrolling: "touch", margin: "12px -6px", padding: "0 6px" }}>
   <div style={isDesktop ? { display: "contents" } : { display: "flex", gap: 10, minWidth: "max-content" }}>
    {compareData.map((sc, i) => {
     const m = sc.metrics;
     const best = (field, dir = "low") => {
      const vals = compareData.map(s => s.metrics[field]).filter(v => v != null && !isNaN(v));
      return dir === "low" ? m[field] <= Math.min(...vals) : m[field] >= Math.max(...vals);
     };
     return (
      <div key={i} style={isDesktop ? { background: T.card, borderRadius: 16, border: sc.isCurrent ? `2px solid ${T.blue}` : `1px solid ${T.cardBorder}`, padding: 16, boxShadow: T.cardShadow } : { minWidth: 200, maxWidth: 240, flex: "0 0 auto", background: T.card, borderRadius: 16, border: sc.isCurrent ? `2px solid ${T.blue}` : `1px solid ${T.cardBorder}`, padding: 14, boxShadow: T.cardShadow }}>
       <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
        {sc.isCurrent && <div style={{ width: 8, height: 8, borderRadius: 4, background: T.blue, flexShrink: 0 }} />}
        <div style={{ fontSize: 14, fontWeight: 700, color: sc.isCurrent ? T.blue : T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sc.name}</div>
       </div>
       <div style={{ fontSize: 11, color: T.textTertiary, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>{m.loanType} · {m.term}yr · {m.rate}%</div>
       <div style={{ fontSize: 24, fontWeight: 800, color: best("monthlyPayment") ? T.green : T.text, fontFamily: FONT, marginBottom: 2 }}>{fmt(m.monthlyPayment)}</div>
       <div style={{ fontSize: 11, color: T.textTertiary, marginBottom: 14 }}>Monthly Payment</div>
       {[
        ["Purchase Price", fmt(m.salesPrice), null],
        ["Down Payment", `${m.downPct}%`, null],
        ["Loan Amount", fmt(m.loan), null],
        ["Cash to Close", fmt(m.cashToClose), best("cashToClose") ? T.green : null],
        ["DTI", m.dti != null ? (m.dti * 100).toFixed(1) + "%" : "—", m.dti != null ? (m.dti <= 0.43 ? T.green : m.dti <= 0.5 ? T.yellow : T.red) : null],
        ["LTV", (m.ltv * 100).toFixed(1) + "%", null],
        ["Total Interest", fmt(m.totalInt), best("totalInt") ? T.green : null],
       ].map(([label, val, color], ri) => (
        <div key={ri} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderTop: ri === 0 ? `1px solid ${T.separator}` : "none" }}>
         <span style={{ fontSize: 12, color: T.textSecondary }}>{label}</span>
         <span style={{ fontSize: 12, fontWeight: 600, color: color || T.text }}>{PRIVACY ? "$•••••" : val}</span>
        </div>
       ))}
      </div>
     );
    })}
   </div>
  </div>
  {/* Winner Summary */}
  {compareData.length >= 2 && (() => {
   const sorted = [...compareData].sort((a, b) => a.metrics.monthlyPayment - b.metrics.monthlyPayment);
   const lowest = sorted[0];
   const highest = sorted[sorted.length - 1];
   const diff = highest.metrics.monthlyPayment - lowest.metrics.monthlyPayment;
   const lowestCash = [...compareData].sort((a, b) => a.metrics.cashToClose - b.metrics.cashToClose)[0];
   const lowestInt = [...compareData].sort((a, b) => a.metrics.totalInt - b.metrics.totalInt)[0];
   return (
   <Card style={{ background: `${T.green}08`, border: `1px solid ${T.green}22`, marginTop: 12 }}>
    <div style={{ fontSize: 13, fontWeight: 700, color: T.green, marginBottom: 10 }}>Quick Verdict</div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
     {[
      ["Lowest Payment", lowest.name, fmt(lowest.metrics.monthlyPayment) + "/mo"],
      ["Least Cash Needed", lowestCash.name, fmt(lowestCash.metrics.cashToClose)],
      ["Least Interest", lowestInt.name, fmt(lowestInt.metrics.totalInt)],
     ].map(([label, winner, val], i) => (
      <div key={i} style={{ textAlign: "center" }}>
       <div style={{ fontSize: 10, color: T.textTertiary, fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
       <div style={{ fontSize: 13, fontWeight: 700, color: T.green, fontFamily: FONT }}>{val}</div>
       <div style={{ fontSize: 11, color: T.textSecondary, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{winner}</div>
      </div>
     ))}
    </div>
    {diff > 0 && (
     <div style={{ borderTop: `1px solid ${T.green}22`, marginTop: 12, paddingTop: 10 }}>
      <div style={{ fontSize: 12, color: T.textSecondary, lineHeight: 1.6, textAlign: "center" }}>
       <strong style={{ color: T.green }}>{lowest.name}</strong> saves <strong style={{ color: T.green }}>{fmt(diff)}/mo</strong> ({fmt(diff * 12)}/yr) over <strong>{highest.name}</strong>
       {diff * 360 > 1000 && <span> — that's <strong style={{ color: T.green }}>{fmt(diff * 360)}</strong> over 30 years</span>}
      </div>
     </div>
    )}
   </Card>);
  })()}
  {/* Metric comparison rows */}
  <Sec title="Payment Breakdown">
   <Card>
    <div style={{ overflowX: "auto" }}>
     <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
      <thead>
       <tr style={{ borderBottom: `2px solid ${T.separator}` }}>
        <th style={{ textAlign: "left", padding: "8px 6px", color: T.textSecondary, fontWeight: 500 }}>Component</th>
        {compareData.map((sc, i) => <th key={i} style={{ textAlign: "right", padding: "8px 6px", color: sc.isCurrent ? T.blue : T.text, fontWeight: 600, whiteSpace: "nowrap" }}>{sc.name.length > 12 ? sc.name.slice(0,12) + "…" : sc.name}</th>)}
       </tr>
      </thead>
      <tbody>
       {["P&I", "Tax", "Insurance", "MI/PMI", "HOA", "Total"].map((row, ri) => (
        <tr key={ri} style={{ borderBottom: ri < 5 ? `1px solid ${T.separator}` : "none", background: ri === 5 ? `${T.blue}08` : "transparent" }}>
         <td style={{ padding: "7px 6px", color: ri === 5 ? T.text : T.textSecondary, fontWeight: ri === 5 ? 600 : 400 }}>{row}</td>
         {compareData.map((sc, ci) => {
          const m = sc.metrics;
          const vals = [m.pi, m.monthlyTax, m.ins, m.mi, m.hoaM, m.monthlyPayment];
          return <td key={ci} style={{ textAlign: "right", padding: "7px 6px", fontWeight: ri === 5 ? 700 : 500, color: ri === 5 ? (sc.isCurrent ? T.blue : T.text) : T.text }}>{fmt(vals[ri])}</td>;
         })}
        </tr>
       ))}
      </tbody>
     </table>
    </div>
   </Card>
  </Sec>
  <Sec title="Loan Details">
   <Card>
    <div style={{ overflowX: "auto" }}>
     <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
      <thead>
       <tr style={{ borderBottom: `2px solid ${T.separator}` }}>
        <th style={{ textAlign: "left", padding: "8px 6px", color: T.textSecondary, fontWeight: 500 }}>Detail</th>
        {compareData.map((sc, i) => <th key={i} style={{ textAlign: "right", padding: "8px 6px", color: sc.isCurrent ? T.blue : T.text, fontWeight: 600, whiteSpace: "nowrap" }}>{sc.name.length > 12 ? sc.name.slice(0,12) + "…" : sc.name}</th>)}
       </tr>
      </thead>
      <tbody>
       {[
        ["Price", d => fmt(d.salesPrice)],
        ["Down %", d => d.downPct + "%"],
        ["Down $", d => fmt(d.salesPrice * d.downPct / 100)],
        ["Loan", d => fmt(d.loan)],
        ["Rate", d => d.rate + "%"],
        ["Term", d => d.term + " yr"],
        ["Type", d => d.loanType],
        ["LTV", d => (d.ltv * 100).toFixed(1) + "%"],
        ["DTI", d => d.dti != null ? (d.dti * 100).toFixed(1) + "%" : "—"],
        ["Cash to Close", d => fmt(d.cashToClose)],
       ].map(([label, fn], ri) => {
        const vals = compareData.map(sc => fn(sc.metrics));
        const isTotal = label === "Cash to Close";
        return (
         <tr key={ri} style={{ borderBottom: ri < 9 ? `1px solid ${T.separator}` : "none", background: isTotal ? `${T.blue}08` : "transparent" }}>
          <td style={{ padding: "7px 6px", color: isTotal ? T.text : T.textSecondary, fontWeight: isTotal ? 600 : 400 }}>{label}</td>
          {compareData.map((sc, ci) => <td key={ci} style={{ textAlign: "right", padding: "7px 6px", fontWeight: isTotal ? 700 : 500, color: isTotal ? (sc.isCurrent ? T.blue : T.text) : T.text }}>{vals[ci]}</td>)}
         </tr>
        );
       })}
      </tbody>
     </table>
    </div>
   </Card>
  </Sec>
  <Sec title="Total Cost of Ownership">
   <Card>
    <div style={{ overflowX: "auto" }}>
     <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
      <thead>
       <tr style={{ borderBottom: `2px solid ${T.separator}` }}>
        <th style={{ textAlign: "left", padding: "8px 6px", color: T.textSecondary, fontWeight: 500 }}>Cost</th>
        {compareData.map((sc, i) => <th key={i} style={{ textAlign: "right", padding: "8px 6px", color: sc.isCurrent ? T.blue : T.text, fontWeight: 600, whiteSpace: "nowrap" }}>{sc.name.length > 12 ? sc.name.slice(0,12) + "…" : sc.name}</th>)}
       </tr>
      </thead>
      <tbody>
       {[
        ["Total Interest", d => fmt(d.totalInt), "low"],
        ["Cash to Close", d => fmt(d.cashToClose), "low"],
        ["5yr Payments", d => fmt(d.monthlyPayment * 60), "low"],
        ["10yr Payments", d => fmt(d.monthlyPayment * 120), "low"],
        ["Lifetime Payments", d => fmt(d.monthlyPayment * d.term * 12), "low"],
       ].map(([label, fn, dir], ri) => {
        const rawVals = compareData.map(sc => fn(sc.metrics));
        const numVals = compareData.map(sc => {
         const s = fn(sc.metrics).replace(/[$,]/g, "");
         return parseFloat(s) || 0;
        });
        const bestVal = dir === "low" ? Math.min(...numVals) : Math.max(...numVals);
        const isTotal = label === "Lifetime Payments";
        return (
         <tr key={ri} style={{ borderBottom: ri < 4 ? `1px solid ${T.separator}` : "none", background: isTotal ? `${T.blue}08` : "transparent" }}>
          <td style={{ padding: "7px 6px", color: isTotal ? T.text : T.textSecondary, fontWeight: isTotal ? 600 : 400 }}>{label}</td>
          {compareData.map((sc, ci) => (
           <td key={ci} style={{ textAlign: "right", padding: "7px 6px", fontWeight: isTotal ? 700 : 500, color: numVals[ci] === bestVal ? T.green : (isTotal ? T.text : T.text) }}>
            {rawVals[ci]}
           </td>
          ))}
         </tr>
        );
       })}
      </tbody>
     </table>
    </div>
   </Card>
  </Sec>
  <Card style={{ marginTop: 8, padding: 14 }}>
   <div style={{ fontSize: 12, color: T.textTertiary, lineHeight: 1.5, textAlign: "center" }}>Current scenario metrics use exact calculations. Other scenarios use simplified estimates for quick comparison. Switch to a scenario in Setup for full detail.</div>
  </Card>
  <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
   <button onClick={() => { setNewScenarioName("New Option"); window.scrollTo({ top: 0, behavior: "smooth" }); }} style={{ flex: 1, background: T.blue, color: "#FFF", border: "none", borderRadius: 14, padding: "14px 0", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: FONT, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
    <span style={{ fontSize: 18 }}>+</span> Build Another Option
   </button>
   <button onClick={() => { duplicateScenario(); setTimeout(loadCompareData, 500); }} style={{ background: `${T.blue}12`, color: T.blue, border: `1px solid ${T.blue}25`, borderRadius: 14, padding: "14px 18px", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>
    Duplicate
   </button>
  </div>
  {/* End of Compare tab */}
 </>)}
</>)}
{tab === "settings" && (<>
 <div style={{ marginTop: 20 }}>
  <Hero value="Settings" label="Preferences & info" small />
 </div>
 <Sec title="Appearance">
  <Card>
   <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0" }}>
    <div>
     <div style={{ fontSize: 15, fontWeight: 600 }}>Theme</div>
     <div style={{ fontSize: 13, color: T.textTertiary }}>{themeMode === 'dark' ? 'Dark mode' : 'Light mode'}</div>
    </div>
    <div style={{ display: "flex", gap: 4, background: T.pillBg, borderRadius: 10, padding: 3 }}>
     {[['light','○'],['dark','☽']].map(([k,e]) => (
      <button key={k} onClick={() => { setThemeMode(k); try { localStorage.setItem('bp_theme_mode', k); } catch {} Haptics.light(); }} style={{ padding: "5px 10px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: themeMode === k ? 700 : 500, background: themeMode === k ? T.tabActiveBg : "transparent", color: themeMode === k ? T.text : T.textTertiary, cursor: "pointer" }}>{e}</button>
     ))}
    </div>
   </div>
  </Card>
 </Sec>
 <Sec title="Loan Officer Info">
  <Card>
   <div style={{ fontSize: 11, color: T.textTertiary, marginBottom: 10 }}>This info appears on shared Blueprints and email summaries. Set once — applies to all scenarios.</div>
   {!isBorrower && !isCloud && (
    <button onClick={() => rawAuth?.requestLogin?.()}
     style={{ width: "100%", boxSizing: "border-box", padding: 13, marginBottom: 12, background: "linear-gradient(135deg, #6366F1, #3B82F6)", border: "none", borderRadius: 9999, color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: FONT, boxShadow: "0 0 20px rgba(99,102,241,0.3)" }}>
     Sign in as Loan Officer (Google) — unlocks clients, live links & Gmail send
    </button>
   )}
   <Inp label="Loan Officer" value={loanOfficer} onChange={setLoanOfficer} prefix="" type="text" />
   <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
    <Inp label="LO Phone" value={loPhone} onChange={setLoPhone} prefix="" type="text" />
    <Inp label="LO NMLS" value={loNmls} onChange={setLoNmls} prefix="" type="text" />
   </div>
   <Inp label="LO Email" value={loEmail} onChange={setLoEmail} prefix="" type="text" />
   <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
    <Inp label="Company" value={companyName} onChange={setCompanyName} prefix="" type="text" />
    <Inp label="Company NMLS" value={companyNmls} onChange={setCompanyNmls} prefix="" type="text" />
   </div>
   {/* ── Email Signature (Christo 2026-07-05): matches Homebase/Ops — used
       at the bottom of worksheet emails sent from Blueprint. Device-level. ── */}
   <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${T.separator}` }}>
    <div style={{ fontSize: 13, fontWeight: 700, color: T.text, fontFamily: FONT, marginBottom: 4 }}>Email Signature</div>
    <div style={{ fontSize: 12, color: T.textTertiary, lineHeight: 1.5, marginBottom: 8, fontFamily: FONT }}>
     Appears at the bottom of worksheet emails. Leave blank to use your name, company, NMLS, and phone from above.
    </div>
    <textarea
     value={loSignature}
     onChange={(e) => setLoSignature(e.target.value)}
     rows={4}
     placeholder={"Chris Granger\nChris Granger Mortgage · NMLS #952015\n(415) 987-8489"}
     style={{ width: "100%", boxSizing: "border-box", background: T.inputBg, borderRadius: 12, border: `1px solid ${T.inputBorder}`, padding: "10px 12px", color: T.text, fontSize: 13, outline: "none", fontFamily: FONT, resize: "vertical", lineHeight: 1.5 }}
    />
   </div>
   {/* ── My Default Fees (Christo 2026-07-05): snapshot the current Costs
       fee sheet (values + added/removed fees) as this LO's template — every
       new scenario starts from it. Device-level (localStorage). ── */}
   <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${T.separator}` }}>
    <div style={{ fontSize: 13, fontWeight: 700, color: T.text, fontFamily: FONT, marginBottom: 4 }}>My Default Fees</div>
    <div style={{ fontSize: 12, color: T.textTertiary, lineHeight: 1.5, marginBottom: 10, fontFamily: FONT }}>
     Set up the Costs tab the way you quote (edit amounts, add or remove fees), then save it as your default fee sheet. Every new scenario will start from it.
    </div>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
     <button onClick={saveMyFeeDefaults} style={{ padding: "9px 16px", background: T.blue, border: "none", borderRadius: 9999, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: FONT }}>
      Save current fees as my defaults
     </button>
     <button onClick={applyMyFeeDefaults} disabled={!feeDefaultsSavedAt} style={{ padding: "9px 16px", background: "transparent", border: `1px solid ${T.separator}`, borderRadius: 9999, color: feeDefaultsSavedAt ? T.text : T.textTertiary, fontWeight: 600, fontSize: 13, cursor: feeDefaultsSavedAt ? "pointer" : "default", fontFamily: FONT }}>
      Apply to this scenario
     </button>
     {feeDefaultsSavedAt && (
      <span onClick={clearMyFeeDefaults} style={{ fontSize: 11, color: T.textTertiary, cursor: "pointer", textDecoration: "underline", fontFamily: FONT }}>Clear</span>
     )}
    </div>
    {feeDefaultsSavedAt && (
     <div style={{ fontSize: 11, color: T.green, marginTop: 8, fontFamily: FONT }}>
      ✓ Defaults saved {new Date(feeDefaultsSavedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })} — applied to every new scenario on this device
     </div>
    )}
   </div>
  </Card>
 </Sec>
 {/* Settings ▸ Modules section removed (2026-06-02, Christo): it duplicated the
     Quick Start module toggles (same isRefi/ownsProperties/hasSellProperty/
     showInvestor/showRentVsBuy state). Quick Start is the single source of truth. */}
 {/* Settings ▸ Integrations section hidden (2026-06-02, Christo): read-only,
     admin-managed; nothing actionable for the user. FRED/Freddie Mac rate
     attribution lives in the footer blurb if needed. */}
 <Sec title="Security & Privacy">
  <Card>
   <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${T.separator}` }}>
    <div>
     <div style={{ fontSize: 15, fontWeight: 600 }}>Privacy Mode</div>
     <div style={{ fontSize: 12, color: T.textTertiary }}>Mask all dollar amounts & sensitive numbers</div>
    </div>
    <button onClick={() => { setPrivacyMode(!privacyMode); Haptics.light(); }} style={{ width: 52, height: 30, borderRadius: 15, background: privacyMode ? T.green : T.ringTrack, border: "none", cursor: "pointer", position: "relative", transition: "background 0.3s" }}>
     <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#FFF", position: "absolute", top: 3, left: privacyMode ? 25 : 3, transition: "left 0.3s" }} />
    </button>
   </div>
   <div style={{ padding: "12px 0", borderBottom: `1px solid ${T.separator}` }}>
    <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>PIN Lock</div>
    {!pinSet ? (
     <div>
      <div style={{ fontSize: 12, color: T.textTertiary, marginBottom: 8 }}>Set a PIN to auto-lock the app after inactivity</div>
      {!pinSetup ? (
       <button onClick={() => setPinSetup("")} style={{ padding: "10px 20px", background: T.blue, border: "none", borderRadius: 10, color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: FONT }}>Set PIN</button>
      ) : (
       <div>
        <input type="password" inputMode="numeric" pattern="[0-9]*" maxLength={6} placeholder={pinConfirm === "" && typeof pinSetup === "string" && pinSetup.length >= 4 ? "Confirm PIN" : "Enter 4-6 digit PIN"} value={typeof pinSetup === "string" && pinSetup.length < 4 ? pinSetup : pinConfirm}
         onChange={e => { const v = e.target.value.replace(/\D/g,"");
          if (typeof pinSetup === "string" && pinSetup.length < 4) setPinSetup(v);
          else if (typeof pinSetup === "string" && pinSetup.length >= 4 && pinConfirm.length < 6) setPinConfirm(v);
         }}
         onKeyDown={e => { if (e.key === "Enter" && typeof pinSetup === "string" && pinSetup.length >= 4 && pinConfirm.length >= 4) handleSetPin(); }}
         style={{ width: "100%", boxSizing: "border-box", textAlign: "center", fontSize: 22, letterSpacing: 8, background: T.inputBg, border: `1px solid ${T.separator}`, borderRadius: 12, padding: "10px", color: T.text, outline: "none", fontFamily: FONT, marginBottom: 8 }} autoFocus />
        {typeof pinSetup === "string" && pinSetup.length >= 4 && <div style={{ fontSize: 11, color: T.blue, marginBottom: 6 }}>Now confirm your PIN</div>}
        {pinError && <div style={{ fontSize: 12, color: T.red, marginBottom: 6 }}>{pinError}</div>}
        <div style={{ display: "flex", gap: 8 }}>
         <button onClick={() => { setPinSetup(false); setPinConfirm(""); setPinError(""); }} style={{ flex: 1, padding: 10, background: T.pillBg, border: `1px solid ${T.separator}`, borderRadius: 10, color: T.textSecondary, fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: FONT }}>Cancel</button>
         <button onClick={handleSetPin} disabled={!(typeof pinSetup === "string" && pinSetup.length >= 4 && pinConfirm.length >= 4)} style={{ flex: 1, padding: 10, background: T.blue, border: "none", borderRadius: 10, color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: FONT, opacity: typeof pinSetup === "string" && pinSetup.length >= 4 && pinConfirm.length >= 4 ? 1 : 0.5 }}>Confirm</button>
        </div>
       </div>
      )}
     </div>
    ) : (
     <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
       <div style={{ width: 10, height: 10, borderRadius: "50%", background: T.green }} />
       <span style={{ fontSize: 13, color: T.green, fontWeight: 600 }}>PIN active — auto-locks after {autoLockMin} min</span>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
       {[2,5,10].map(m => (
        <button key={m} onClick={async () => { setAutoLockMin(m); try { await LS.set("sec:autolock", String(m)); } catch(e) {} }} style={{ flex: 1, padding: "8px 0", background: autoLockMin === m ? `${T.blue}22` : T.pillBg, border: autoLockMin === m ? `2px solid ${T.blue}` : `1px solid ${T.separator}`, borderRadius: 10, color: autoLockMin === m ? T.blue : T.textSecondary, fontWeight: 600, fontSize: 12, cursor: "pointer", fontFamily: FONT }}>{m} min</button>
       ))}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
       <button onClick={() => setIsLocked(true)} style={{ flex: 1, padding: 10, background: T.pillBg, border: `1px solid ${T.separator}`, borderRadius: 10, color: T.textSecondary, fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: FONT }}>Lock Now</button>
       <button onClick={handleRemovePin} style={{ flex: 1, padding: 10, background: `${T.red}15`, border: `1px solid ${T.red}33`, borderRadius: 10, color: T.red, fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: FONT }}>Remove PIN</button>
      </div>
     </div>
    )}
   </div>
   <div style={{ padding: "12px 0", borderBottom: `1px solid ${T.separator}` }}>
    <div onClick={() => setShowPrivacy(!showPrivacy)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
     <div style={{ fontSize: 15, fontWeight: 600 }}>Privacy Policy</div>
     <span style={{ fontSize: 18, color: T.textTertiary, transition: "transform 0.3s", transform: showPrivacy ? "rotate(90deg)" : "rotate(0deg)" }}>›</span>
    </div>
    {showPrivacy && (
     <div style={{ marginTop: 12, fontSize: 13, color: T.textSecondary, lineHeight: 1.6 }}>
      <div style={{ fontWeight: 700, fontSize: 14, color: T.text, marginBottom: 8 }}>Privacy Policy — RealStack Blueprint</div>
      <div style={{ fontSize: 11, color: T.textTertiary, marginBottom: 12 }}>Last updated: February 2026</div>
      <div style={{ marginBottom: 10 }}><strong style={{ color: T.text }}>Data Storage:</strong> By default, everything you enter is stored locally on this device using browser storage and is not sent to our servers. If you create an account and turn on cloud sync, your blueprints are stored encrypted in our database so they can sync across your devices — you can export or delete them anytime from your account settings. Blueprints shared with you by a loan officer are stored securely so you can both work on them. See our <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: T.blue }}>Privacy Policy</a>.</div>
      <div style={{ marginBottom: 10 }}><strong style={{ color: T.text }}>No Tracking:</strong> RealStack Blueprint does not use cookies, analytics, or any third-party tracking. We do not collect, store, or sell your personal information.</div>
      <div style={{ marginBottom: 10 }}><strong style={{ color: T.text }}>FRED API:</strong> If you enable live rate fetching, your device makes direct requests to the Federal Reserve Economic Data (FRED) API to retrieve current mortgage rates. No personal or financial data is included in these requests — only your API key and the rate series ID.</div>
      <div style={{ marginBottom: 10 }}><strong style={{ color: T.text }}>No Accounts:</strong> RealStack Blueprint does not require account creation, login, or any personal identification to use.</div>
      <div style={{ marginBottom: 10 }}><strong style={{ color: T.text }}>Data Deletion:</strong> You can permanently delete all stored data at any time using the "Clear All Data" button in Settings.</div>
      <div><strong style={{ color: T.text }}>Contact:</strong> For questions about this privacy policy, contact Chris Granger (NMLS #952015).</div>
     </div>
    )}
   </div>
   <div style={{ padding: "12px 0", borderBottom: `1px solid ${T.separator}` }}>
    <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Welcome Tutorial</div>
    <div style={{ fontSize: 12, color: T.textTertiary, marginBottom: 10 }}>Replay the intro walkthrough for new users</div>
    <button onClick={() => { setWelcomeStep(0); setShowWelcome(true); }} style={{ width: "100%", padding: 14, background: `${T.blue}12`, border: `1px solid ${T.blue}33`, borderRadius: 12, color: T.blue, fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: FONT }}> Replay Tutorial</button>
   </div>
   <div style={{ padding: "12px 0" }}>
    <div style={{ fontSize: 15, fontWeight: 600, color: T.red, marginBottom: 4 }}>Danger Zone</div>
    <div style={{ fontSize: 12, color: T.textTertiary, marginBottom: 10 }}>Permanently delete all scenarios, borrower data, and preferences</div>
    <button onClick={() => { setShowClearConfirm(true); setClearStep(0); }} style={{ width: "100%", padding: 14, background: `${T.red}12`, border: `1px solid ${T.red}33`, borderRadius: 12, color: T.red, fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: FONT }}> Clear All Data</button>
   </div>
  </Card>
 </Sec>
 {/* Loan Settings section removed (Christo 2026-07-05) — coeDays/sellerTaxBasis
     state remains for saved scenarios; the closing-date picker on the Costs tab
     supersedes COE Days as the user-facing control. */}
 <Card style={{ background: T.pillBg, marginTop: 8 }}>
  <div style={{ fontSize: 13, color: T.textSecondary, lineHeight: 1.6 }}>RealStack Blueprint v5 — 13 modules, Investor analysis, Rent vs Buy, 50-state property tax rates + 153 CA city rates, Federal + state brackets, 5-pillar qualification engine, PIN lock + full privacy masking + input validation.</div>
 </Card>
 {realtorPartner && (
  <Sec title="Realtor Partner Link">
   <Card>
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
     {realtorPartner.photo ? (
      <img src={realtorPartner.photo} alt={realtorPartner.name} style={{ width: 36, height: 36, borderRadius: 18, objectFit: "cover" }} />
     ) : (
      <div style={{ width: 36, height: 36, borderRadius: 18, background: `${T.blue}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, color: T.blue }}>
       {realtorPartner.name.split(" ").map(n => n[0]).join("")}
      </div>
     )}
     <div>
      <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{realtorPartner.name}</div>
      <div style={{ fontSize: 11, color: T.textTertiary }}>{realtorPartner.title}{realtorPartner.brokerage ? ` · ${realtorPartner.brokerage}` : ""}{realtorPartner.dre ? ` · DRE #${realtorPartner.dre}` : ""}</div>
     </div>
    </div>
    <div style={{ fontSize: 12, color: T.textTertiary, lineHeight: 1.5 }}>This app was shared via <strong>{realtorPartner.name}</strong>'s partner link. Source tracking is active — all pre-approval clicks attribute to <strong>{realtorPartnerSlug}</strong>.</div>
   </Card>
  </Sec>
 )}
</>)}
   </div>
   </>}
   {/* ═══════════════════════════════════════════ */}
   {/* PRICEPOINT MODE */}
   {/* ═══════════════════════════════════════════ */}
   {appMode === "pricepoint" && (
    <div onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
    <Suspense fallback={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: T.textDim, fontSize: 13 }}>Loading PricePoint...</div>}>
    <PricePoint
     T={T}
     isDesktop={isDesktop}
     FONT={FONT}
     realtorPartner={realtorPartner}
     appMode={null}
     setAppMode={null}
     sidebarTab={ppSidebarTab}
     sidebarTabKey={ppSidebarTabCounter}
     onTabChange={setPpCurrentTab}
     onRunNumbers={({ price, state, city, zip }) => {
      if (price) setSalesPrice(price);
      if (state) setPropertyState(state);
      if (city) setCity(city);
      if (zip) setPropertyZip(zip);
      if (splitMode && splitApp === "blueprint") { /* Blueprint pane will react to state changes */ }
      else { setAppMode("blueprint"); }
      setTab("calc");
     }}
     onBackToBlueprint={() => setAppMode("blueprint")}
     onOpenMarkets={() => setAppMode("markets")}
    />
    </Suspense>
    </div>
   )}
   {/* ═══════════════════════════════════════════ */}
   {/* MARKETS MODE */}
   {/* ═══════════════════════════════════════════ */}
   {appMode === "markets" && (
    <div onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
    <Suspense fallback={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: T.textDim, fontSize: 13 }}>Loading Markets...</div>}>
    <Markets
     T={T}
     isDesktop={isDesktop}
     FONT={FONT}
     appMode={null}
     setAppMode={null}
     onBackToBlueprint={() => setAppMode("blueprint")}
    />
    </Suspense>
    </div>
   )}
   {/* FloatingNextBar removed — replaced by TabProgressUnderline */}

   {/* ═══════════════════════════════════════════ */}
   {/* SPLIT-SCREEN MODE (desktop only) */}
   {/* ═══════════════════════════════════════════ */}
   {/* ═══ SPLIT-SCREEN: Right-side panel (desktop only) ═══ */}
   {splitMode && isDesktop && splitApp && (() => {
    const sidebarW = appMode === "blueprint" ? (sidebarCollapsed ? 56 : 270) : 180;
    const splitW = `${100 - splitRatio}vw`;
    const splitLeft = `${splitRatio}vw`;

    const renderSplitPane = (mode) => {
     if (mode === "pricepoint") return (
      <Suspense fallback={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: T.textDim, fontSize: 13 }}>Loading...</div>}>
      <PricePoint
       T={T}
       isDesktop={false}
       FONT={FONT}
       realtorPartner={realtorPartner}
       appMode={null}
       setAppMode={null}
       onRunNumbers={({ price, state, city, zip }) => {
        if (price) setSalesPrice(price);
        if (state) setPropertyState(state);
        if (city) setCity(city);
        if (zip) setPropertyZip(zip);
        setTab("calc");
       }}
       onBackToBlueprint={() => { closeSplit(); setAppMode("blueprint"); }}
       onOpenMarkets={() => { closeSplit(); setAppMode("markets"); }}
      />
      </Suspense>
     );
     if (mode === "markets") return (
      <Suspense fallback={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: T.textDim, fontSize: 13 }}>Loading...</div>}>
      <Markets
       T={T}
       isDesktop={false}
       FONT={FONT}
       appMode={null}
       setAppMode={null}
       onBackToBlueprint={() => { closeSplit(); setAppMode("blueprint"); }}
      />
      </Suspense>
     );
     return null;
    };

    return (
     <>
      {/* Divider — draggable */}
      <div ref={splitContainerRef} className="split-divider"
       onMouseDown={onSplitDragStart} onTouchStart={onSplitDragStart}
       style={{ position: "fixed", top: 0, bottom: 0, left: `calc(${splitRatio}vw)`, width: 6, zIndex: 20 }} />
      {/* Right Pane — secondary mode */}
      <div style={{ position: "fixed", top: 0, bottom: 0, right: 0, left: `calc(${splitRatio}vw + 6px)`, background: T.bg, zIndex: 15, overflow: "auto", borderLeft: `1px solid ${T.separator}` }}>
       <div style={{ padding: "8px 12px", borderBottom: `1px solid ${T.separator}`, display: "flex", justifyContent: "space-between", alignItems: "center", background: T.headerBg, backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
         <Icon name={splitApp === "pricepoint" ? "target" : splitApp === "markets" ? "trending-up" : "settings"} size={14} />
         <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{splitApp === "pricepoint" ? "PricePoint" : splitApp === "markets" ? "Markets" : "Blueprint"}</span>
        </div>
        <button onClick={closeSplit} style={{ background: "none", border: "none", cursor: "pointer", color: T.textTertiary, padding: 4, display: "flex" }}>
         <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
       </div>
       {renderSplitPane(splitApp)}
      </div>
     </>
    );
   })()}
  </div>{/* end main content wrapper */}
  </div>
  </WorkspaceProvider>
 );
}
