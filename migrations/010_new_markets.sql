-- ═══════════════════════════════════════════════════════════════════════════
-- PricePoint — Add new markets + nickname function
-- Run in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. NICKNAME FUNCTION ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION pp_set_display_name(
  p_player_id UUID,
  p_device_id TEXT,
  p_name TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_updated BOOLEAN := FALSE;
BEGIN
  UPDATE pp_players
  SET display_name = LEFT(TRIM(p_name), 20)
  WHERE id = p_player_id
    AND device_id = p_device_id;

  v_updated := FOUND;
  RETURN v_updated;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ─── 2. NEW MARKETS ─────────────────────────────────────────────────────

-- Los Angeles
INSERT INTO pp_markets (id, name, state, zips, neighborhoods, sort_order) VALUES
('la', 'Los Angeles', 'CA',
  ARRAY['90004','90005','90006','90007','90008','90010','90011','90012','90013','90014','90015','90016','90017','90018','90019','90020','90023','90024','90025','90026','90027','90028','90029','90031','90032','90033','90034','90035','90036','90037','90038','90039','90041','90042','90043','90044','90045','90046','90047','90048','90049','90056','90057','90058','90059','90061','90062','90063','90064','90065','90066','90067','90068','90069','90071','90077','90210','90212','90230','90232','90245','90247','90248','90249','90250','90254','90260','90266','90272','90274','90275','90277','90278','90290','90291','90292','90293','90301','90302','90303','90304','90305','90401','90402','90403','90404','90405'],
  '[{"name":"Hollywood","zips":["90028"]},{"name":"Silver Lake","zips":["90026"]},{"name":"Los Feliz","zips":["90027"]},{"name":"West Hollywood","zips":["90046","90069"]},{"name":"Beverly Hills","zips":["90210","90212"]},{"name":"Santa Monica","zips":["90401","90402","90403","90404","90405"]},{"name":"Venice","zips":["90291"]},{"name":"Brentwood","zips":["90049"]},{"name":"Pacific Palisades","zips":["90272"]},{"name":"Downtown LA","zips":["90012","90013","90014","90015"]},{"name":"Manhattan Beach","zips":["90266"]},{"name":"Hermosa Beach","zips":["90254"]},{"name":"Redondo Beach","zips":["90277","90278"]},{"name":"Palos Verdes","zips":["90274","90275"]}]'::JSONB,
  5
);

-- San Diego
INSERT INTO pp_markets (id, name, state, zips, neighborhoods, sort_order) VALUES
('sd', 'San Diego', 'CA',
  ARRAY['92101','92102','92103','92104','92105','92106','92107','92108','92109','92110','92111','92113','92114','92115','92116','92117','92118','92119','92120','92121','92122','92123','92124','92126','92127','92128','92129','92130','92131'],
  '[{"name":"Downtown","zips":["92101"]},{"name":"North Park","zips":["92104"]},{"name":"Hillcrest","zips":["92103"]},{"name":"Pacific Beach","zips":["92109"]},{"name":"Ocean Beach","zips":["92107"]},{"name":"Point Loma","zips":["92106"]},{"name":"La Jolla","zips":["92037"]},{"name":"Coronado","zips":["92118"]},{"name":"Carmel Valley","zips":["92130"]},{"name":"Scripps Ranch","zips":["92131"]}]'::JSONB,
  6
);

-- Seattle
INSERT INTO pp_markets (id, name, state, zips, neighborhoods, sort_order) VALUES
('seattle', 'Seattle', 'WA',
  ARRAY['98101','98102','98103','98104','98105','98106','98107','98108','98109','98112','98115','98116','98117','98118','98119','98121','98122','98125','98126','98133','98134','98136','98144','98146','98154','98164','98174','98177','98178','98195','98199'],
  '[{"name":"Capitol Hill","zips":["98102"]},{"name":"Ballard","zips":["98107"]},{"name":"Fremont","zips":["98103"]},{"name":"Queen Anne","zips":["98109"]},{"name":"Magnolia","zips":["98199"]},{"name":"West Seattle","zips":["98116"]},{"name":"Columbia City","zips":["98118"]},{"name":"University District","zips":["98105"]},{"name":"Madison Park","zips":["98112"]},{"name":"Green Lake","zips":["98103"]}]'::JSONB,
  7
);

-- Miami
INSERT INTO pp_markets (id, name, state, zips, neighborhoods, sort_order) VALUES
('miami', 'Miami', 'FL',
  ARRAY['33125','33126','33127','33128','33129','33130','33131','33132','33133','33134','33135','33136','33137','33138','33139','33140','33141','33142','33143','33144','33145','33146','33147','33149','33150','33154','33155','33156','33157','33158','33160','33161','33162','33165','33166','33167','33168','33169','33170','33172','33173','33174','33175','33176','33177','33178','33179','33180','33181','33182','33183','33184','33185','33186','33187','33189','33190','33193','33194','33196'],
  '[{"name":"Brickell","zips":["33131"]},{"name":"Downtown","zips":["33132"]},{"name":"Wynwood","zips":["33127"]},{"name":"Coconut Grove","zips":["33133"]},{"name":"Coral Gables","zips":["33134"]},{"name":"Miami Beach","zips":["33139"]},{"name":"South Beach","zips":["33139"]},{"name":"Key Biscayne","zips":["33149"]},{"name":"Doral","zips":["33178"]},{"name":"Kendall","zips":["33176"]},{"name":"Pinecrest","zips":["33156"]},{"name":"Aventura","zips":["33180"]}]'::JSONB,
  8
);

-- New York City
INSERT INTO pp_markets (id, name, state, zips, neighborhoods, sort_order) VALUES
('nyc', 'New York City', 'NY',
  ARRAY['10001','10002','10003','10004','10005','10006','10007','10009','10010','10011','10012','10013','10014','10016','10017','10018','10019','10020','10021','10022','10023','10024','10025','10026','10027','10028','10029','10030','10031','10032','10033','10034','10035','10036','10037','10038','10039','10040','10044','10065','10069','10075','10128','10280','10282','11201','11205','11206','11207','11208','11209','11210','11211','11212','11213','11214','11215','11216','11217','11218','11219','11220','11221','11222','11223','11224','11225','11226','11228','11229','11230','11231','11232','11233','11234','11235','11236','11237','11238','11239'],
  '[{"name":"Upper East Side","zips":["10021","10028","10075"]},{"name":"Upper West Side","zips":["10023","10024","10025"]},{"name":"Tribeca","zips":["10013"]},{"name":"SoHo","zips":["10012"]},{"name":"West Village","zips":["10014"]},{"name":"East Village","zips":["10009","10003"]},{"name":"Chelsea","zips":["10011"]},{"name":"Harlem","zips":["10027","10026","10030"]},{"name":"Williamsburg","zips":["11211"]},{"name":"Park Slope","zips":["11215"]},{"name":"Brooklyn Heights","zips":["11201"]},{"name":"Bushwick","zips":["11237"]},{"name":"Bed-Stuy","zips":["11216","11233"]},{"name":"Greenpoint","zips":["11222"]}]'::JSONB,
  9
);

-- Chicago
INSERT INTO pp_markets (id, name, state, zips, neighborhoods, sort_order) VALUES
('chicago', 'Chicago', 'IL',
  ARRAY['60601','60602','60603','60604','60605','60606','60607','60608','60609','60610','60611','60612','60613','60614','60615','60616','60617','60618','60619','60620','60621','60622','60623','60624','60625','60626','60628','60629','60630','60631','60632','60633','60634','60636','60637','60638','60639','60640','60641','60642','60643','60644','60645','60646','60647','60649','60651','60652','60653','60654','60655','60656','60657','60659','60660','60661'],
  '[{"name":"Lincoln Park","zips":["60614"]},{"name":"Lakeview","zips":["60657"]},{"name":"Wicker Park","zips":["60622"]},{"name":"Logan Square","zips":["60647"]},{"name":"West Loop","zips":["60607"]},{"name":"River North","zips":["60654"]},{"name":"Gold Coast","zips":["60610"]},{"name":"Hyde Park","zips":["60615","60637"]},{"name":"Pilsen","zips":["60608"]},{"name":"Andersonville","zips":["60640"]},{"name":"Old Town","zips":["60610"]},{"name":"Bucktown","zips":["60647"]}]'::JSONB,
  10
);

-- Denver
INSERT INTO pp_markets (id, name, state, zips, neighborhoods, sort_order) VALUES
('denver', 'Denver', 'CO',
  ARRAY['80202','80203','80204','80205','80206','80207','80209','80210','80211','80212','80216','80218','80219','80220','80222','80223','80224','80230','80231','80238','80239','80110','80111','80112','80113','80120','80121','80122','80123'],
  '[{"name":"LoDo","zips":["80202"]},{"name":"RiNo","zips":["80205"]},{"name":"Capitol Hill","zips":["80203"]},{"name":"Cherry Creek","zips":["80206"]},{"name":"Wash Park","zips":["80209"]},{"name":"Highland","zips":["80211"]},{"name":"Sloan''s Lake","zips":["80212"]},{"name":"Baker","zips":["80223"]},{"name":"Park Hill","zips":["80207"]},{"name":"Stapleton","zips":["80238"]}]'::JSONB,
  11
);

-- Portland
INSERT INTO pp_markets (id, name, state, zips, neighborhoods, sort_order) VALUES
('portland', 'Portland', 'OR',
  ARRAY['97201','97202','97203','97204','97205','97206','97209','97210','97211','97212','97213','97214','97215','97216','97217','97218','97219','97220','97221','97222','97223','97224','97225','97227','97229','97230','97231','97232','97233','97236','97239','97266'],
  '[{"name":"Pearl District","zips":["97209"]},{"name":"Alberta","zips":["97211"]},{"name":"Hawthorne","zips":["97214"]},{"name":"Division","zips":["97202"]},{"name":"Sellwood","zips":["97202"]},{"name":"Mississippi","zips":["97217"]},{"name":"Nob Hill","zips":["97210"]},{"name":"Irvington","zips":["97212"]},{"name":"Laurelhurst","zips":["97215"]},{"name":"Woodstock","zips":["97206"]}]'::JSONB,
  12
);

-- Boston
INSERT INTO pp_markets (id, name, state, zips, neighborhoods, sort_order) VALUES
('boston', 'Boston', 'MA',
  ARRAY['02108','02109','02110','02111','02113','02114','02115','02116','02118','02119','02120','02121','02122','02124','02125','02126','02127','02128','02129','02130','02131','02132','02134','02135','02136','02163','02199','02210','02215'],
  '[{"name":"Back Bay","zips":["02116"]},{"name":"South End","zips":["02118"]},{"name":"Beacon Hill","zips":["02108"]},{"name":"North End","zips":["02113"]},{"name":"Seaport","zips":["02210"]},{"name":"Fenway","zips":["02215"]},{"name":"Jamaica Plain","zips":["02130"]},{"name":"South Boston","zips":["02127"]},{"name":"Charlestown","zips":["02129"]},{"name":"Brighton","zips":["02135"]}]'::JSONB,
  13
);

-- Phoenix
INSERT INTO pp_markets (id, name, state, zips, neighborhoods, sort_order) VALUES
('phoenix', 'Phoenix', 'AZ',
  ARRAY['85003','85004','85006','85007','85008','85009','85012','85013','85014','85015','85016','85017','85018','85019','85020','85021','85022','85023','85024','85027','85028','85029','85031','85032','85033','85034','85035','85037','85040','85041','85042','85043','85044','85045','85048','85050','85051','85053','85054','85083','85085','85251','85253','85254','85255','85257','85258','85259','85260','85262','85266','85281','85282','85283','85284'],
  '[{"name":"Downtown","zips":["85004"]},{"name":"Arcadia","zips":["85018"]},{"name":"Biltmore","zips":["85016"]},{"name":"Paradise Valley","zips":["85253"]},{"name":"Scottsdale","zips":["85251","85254"]},{"name":"North Scottsdale","zips":["85260","85262"]},{"name":"Tempe","zips":["85281","85282"]},{"name":"Camelback East","zips":["85016"]},{"name":"Ahwatukee","zips":["85044","85048"]},{"name":"Desert Ridge","zips":["85050"]}]'::JSONB,
  14
);
