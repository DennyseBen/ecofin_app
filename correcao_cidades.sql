-- ============================================================
-- CORREÇÃO DE CIDADES NAS TABELAS licencas E clientes
-- Gerado a partir das planilhas: Registro ANM, CEPROF,
-- Outorgas, LAR_ASV, LO/Lic.Prefeito
-- Data: 2026-05-14
-- ============================================================
-- CONFLITOS IDENTIFICADOS (não atualizados automaticamente):
--   03.995.515/0037-78  → LAR_ASV diz Marituba; LO diz Jacundá → VERIFICAR
--   11.090.652/0001-80  → Aparece em Marabá E Novo Repartimento (filiais distintas)
--   23.439.441/0036-10  → LAR_ASV diz Santa Isabel do Pará; LO diz Novo Repartimento/Belém
--   03.895.515/0092-02  → Provável erro de digitação de 03.995.515/0092-02 (Belém)
--   03.95.515/0354-67   → Dígito faltando; provável 03.995.515/0354-67 (Imperatriz)
-- ============================================================

-- ============================================================
-- PASSO 0: DIAGNÓSTICO — execute antes para ver o impacto
-- ============================================================
SELECT
  'licencas' AS tabela,
  COUNT(*) AS total_sem_cidade
FROM licencas
WHERE cidade IS NULL OR TRIM(cidade) = ''
UNION ALL
SELECT
  'clientes' AS tabela,
  COUNT(*) AS total_sem_cidade
FROM clientes
WHERE cidade IS NULL OR TRIM(cidade) = '';

-- Ver quais CNPJs do lookup têm registros sem cidade
WITH lookup (cnpj_digits, cidade) AS (
  VALUES
  -- === MATEUS SUPERMERCADOS S.A. (03.995.515/XXXX-XX) ===
  ('03995515000248', 'Imperatriz'),
  ('03995515000400', 'Imperatriz'),
  ('03995515001309', 'Ananindeua'),
  ('03995515001562', 'Imperatriz'),
  ('03995515001805', 'Açailândia'),
  ('03995515002704', 'Imperatriz'),
  ('03995515002968', 'Imperatriz'),
  ('03995515003425', 'Imperatriz'),
  ('03995515004588', 'Imperatriz'),
  ('03995515005207', 'Marabá'),
  ('03995515005398', 'Marabá'),
  ('03995515005479', 'Marabá'),
  ('03995515006289', 'Parauapebas'),
  ('03995515006521', 'Açailândia'),
  ('03995515007501', 'Parauapebas'),
  ('03995515007565', 'Parauapebas'),
  ('03995515007584', 'Parauapebas'),
  ('03995515007665', 'Parauapebas'),
  ('03995515007927', 'Eldorado dos Carajás'),
  ('03995515008060', 'Curionópolis'),
  ('03995515008303', 'Marabá'),
  ('03995515008494', 'Marabá'),
  ('03995515008575', 'Marabá'),
  ('03995515008656', 'Jacundá'),
  ('03995515008818', 'Marabá'),
  ('03995515009032', 'Castanhal'),
  ('03995515009285', 'Belém'),
  ('03995515009202', 'Belém'),
  ('03995515009385', 'Altamira'),
  ('03995515009466', 'Tucuruí'),
  ('03995515009484', 'Marabá'),
  ('03995515009628', 'Belém'),
  ('03995515009987', 'Uruará'),
  ('03995515010120', 'Altamira'),
  ('03995515010553', 'Altamira'),
  ('03995515010634', 'Medicilândia'),
  ('03995515010987', 'Uruará'),
  ('03995515011282', 'Castanhal'),
  ('03995515011363', 'Abaetetuba'),
  ('03995515011773', 'Marabá'),
  ('03995515011797', 'Marabá'),
  ('03995515012092', 'Marituba'),
  ('03995515012173', 'Xinguara'),
  ('03995515012335', 'Açailândia'),
  ('03995515012607', 'Rondon do Pará'),
  ('03995515012840', 'Rondon do Pará'),
  ('03995515012920', 'Parauapebas'),
  ('03995515013226', 'Conceição do Araguaia'),
  ('03995515013307', 'Redenção'),
  ('03995515013811', 'Parauapebas'),
  ('03995515014321', 'Tailândia'),
  ('03995515014389', 'Tailândia'),
  ('03995515014893', 'Ananindeua'),
  ('03995515015512', 'Barcarena'),
  ('03995515016080', 'Tucuruí'),
  ('03995515016322', 'Redenção'),
  ('03995515017085', 'Barcarena'),
  ('03995515017485', 'Ananindeua'),
  ('03995515018019', 'Bragança'),
  ('03995515018023', 'Canaã dos Carajás'),
  ('03995515018880', 'Paragominas'),
  ('03995515019348', 'São Miguel do Guamá'),
  ('03995515022560', 'Belém'),
  ('03995515025385', 'Balsas'),
  ('03995515025566', 'Belém'),
  ('03995515029815', 'Marituba'),
  ('03995515025313', 'Vigia de Nazaré'),
  ('03995515004621', 'Capanema'),
  ('03995515014621', 'Capanema'),
  ('03995515020435', 'Cametá'),
  -- === ARMAZÉM MATEUS S.A. (23.439.441/XXXX-XX) ===
  ('23439441001595', 'Davinópolis'),
  ('23439441002103', 'Parauapebas'),
  ('23439441002303', 'Benevides'),
  ('23439441003410', 'Belém'),
  ('23439441003666', 'São Miguel do Guamá'),
  ('23439441003881', 'Marabá'),
  ('23439441004004', 'Marituba'),
  ('23439441004268', 'Santa Izabel do Pará'),
  ('23439441004420', 'Santa Izabel do Pará'),
  ('23439441005159', 'Marabá'),
  -- === POSTERUS SUPERMERCADOS LTDA (27.352.414/XXXX-XX) ===
  ('27352414000306', 'Jacundá'),
  ('27352414000560', 'Tucumã'),
  ('27352414000993', 'Marabá'),
  ('27352414001027', 'Dom Eliseu'),
  ('27352414001299', 'Rondon do Pará'),
  ('27352414001965', 'Conceição do Araguaia'),
  ('27352414002422', 'Goianésia do Pará'),
  ('27352414002775', 'Itupiranga'),
  ('27352414003232', 'Itinga do Maranhão'),
  ('27352414003628', 'São Miguel do Guamá'),
  ('27352414003828', 'Tomé-Açu'),
  ('27352414004042', 'Dom Eliseu'),
  -- === XINGU LÁCTEOS LTDA (13.145.851/XXXX-XX) ===
  ('13145851000174', 'São Geraldo do Araguaia'),
  ('13145851000255', 'Tucumã'),
  ('13145851000336', 'Marabá'),
  -- === SULPARÁ CAMINHÕES E MÁQUINAS LTDA (14.133.730/XXXX-XX) ===
  ('14133730000175', 'Marabá'),
  ('14133730000256', 'Redenção'),
  ('14133730000418', 'Parauapebas'),
  ('14133730000507', 'Marabá'),
  ('14133730001570', 'Santarém'),
  -- === FÊNIX AUTOMÓVEIS LTDA (05.025.625/XXXX-XX) ===
  ('05025625000202', 'Marabá'),
  ('05025625000717', 'Parauapebas'),
  ('05025625000989', 'Redenção'),
  -- === DE PNEUS COMÉRCIO LTDA (09.647.935/XXXX-XX) ===
  ('09647935000139', 'Marabá'),
  ('09647935000309', 'Marabá'),
  ('09647935000210', 'Belém'),
  ('09647935000481', 'Ananindeua'),
  -- === TRANSPORTADORA PATRIARCA LTDA (05.023.528/XXXX-XX) ===
  ('05023528000108', 'Marituba'),
  ('05023528000442', 'Marabá'),
  ('05023528000523', 'Marituba'),
  -- === REVEMAR (04.747.226 e outras) ===
  ('04747226000101', 'Marabá'),
  ('04747226000373', 'Parauapebas'),
  ('42282613000109', 'Belém'),
  ('09580023000197', 'Marabá'),
  ('17449881000125', 'Marabá'),
  ('17449881000206', 'Ananindeua'),
  ('40070881000212', 'Marabá'),
  -- === DIAMANTINO (08.893.457/XXXX-XX) ===
  ('08893457000699', 'Marabá'),
  ('08893457000770', 'Parauapebas'),
  ('08890160000750', 'Marabá'),
  -- === R MOTOS LTDA (01.219.219/XXXX-XX) ===
  ('01219219000149', 'Marabá'),
  ('01219219000653', 'Tucuruí'),
  ('01219219000734', 'Parauapebas'),
  ('01219219001110', 'Pacajá'),
  ('01219219001544', 'Anapú'),
  -- === AUTO POSTO WR (25.033.773 e outras) ===
  ('25033773000103', 'Abel Figueiredo'),
  ('63654088000194', 'Marabá'),
  ('45711303000150', 'Itupiranga'),
  ('35610162000126', 'São Pedro da Água Branca'),
  ('58071492000196', 'São Bento do Tocantins'),
  ('53719864000124', 'Araguatins'),
  -- === PETRO CENTER / PETROCEM / PETROCOM (Eldorado) ===
  ('08713905000110', 'Eldorado dos Carajás'),
  ('08713905000200', 'Santana do Araguaia'),
  ('27262701000155', 'Eldorado dos Carajás'),
  ('40221039000153', 'Eldorado dos Carajás'),
  ('40221039000234', 'Itaituba'),
  -- === DOM ELISEU GÁS (42.722.591/XXXX-XX) ===
  ('42722591000150', 'Dom Eliseu'),
  ('42722591000312', 'Ulianópolis'),
  ('42722591000401', 'Itinga do Maranhão'),
  -- === UMARIZAL PNEUS (29.314.237/XXXX-XX) ===
  ('29314237000129', 'Belém'),
  ('29314237000200', 'Belém'),
  -- === H. VELOSO SOARES (15.715.870/XXXX-XX) ===
  ('15715870000114', 'Canaã dos Carajás'),
  ('15715870000195', 'Canaã dos Carajás'),
  -- === INDÚSTRIA DE PÃES MATEUS (08.898.073/XXXX-XX) ===
  ('08898073000316', 'Davinópolis'),
  ('08898073000588', 'Santa Izabel do Pará'),
  -- === LATICÍNIOS OURILÂNDIA (04.510.915/XXXX-XX) ===
  ('04510915000106', 'Ourilândia do Norte'),
  ('04510915000197', 'Ourilândia do Norte'),
  -- === CERÂMICA ITABAIANA (38.023.637/XXXX-XX) ===
  ('38023637000176', 'Eldorado dos Carajás'),
  ('38023637000177', 'Eldorado dos Carajás'),
  -- === MIRANTE EMPREENDIMENTOS (condomínios) ===
  ('18972572000106', 'Marabá'),
  ('15812085000180', 'Marabá'),
  ('28860289000139', 'Marabá'),
  ('28860289000197', 'Marabá'),
  ('12021777000111', 'Marabá'),
  ('12021777000112', 'Marabá'),
  ('47103712000108', 'Marabá'),
  ('47103712000109', 'Marabá'),
  ('27742354000168', 'Marabá'),
  ('48275955000188', 'Parauapebas'),
  ('43403561000144', 'Marabá'),
  ('41397871000178', 'Marabá'),
  ('59112246000106', 'Marabá'),
  ('56331061000164', 'Ananindeua'),
  ('44128527000171', 'Marabá'),
  ('44280527000171', 'Marabá'),
  ('54974815000109', 'Marabá'),
  -- === AUTO POSTOS ===
  ('01240986000130', 'Marabá'),
  ('20665359000195', 'Marabá'),
  ('16384237000154', 'Marabá'),
  ('16384237000153', 'Marabá'),
  ('28038550000119', 'Marabá'),
  ('13608538000125', 'Marabá'),
  ('04384239000163', 'Jacundá'),
  ('05014246000136', 'Redenção'),
  ('03795537000183', 'Nova Ipixuna'),
  ('07820895000121', 'Nova Ipixuna'),
  ('11167054000162', 'Nova Ipixuna'),
  ('41640802000143', 'Nova Ipixuna'),
  ('58365911000100', 'Nova Ipixuna'),
  ('14312055000141', 'São Félix do Xingu'),
  ('44609340000190', 'São Félix do Xingu'),
  ('44609340000270', 'São Félix do Xingu'),
  ('53208704000110', 'São João do Araguaia'),
  ('14036628000151', 'São João do Araguaia'),
  ('07561621000193', 'Araguatins'),
  ('04323802000193', 'Augustinópolis'),
  ('31972369000190', 'Augustinópolis'),
  ('09664019000107', 'Buriti do Tocantins'),
  ('83324921000137', 'Marituba'),
  ('84146638000125', 'Xinguara'),
  ('63842801000114', 'Tucumã'),
  ('05458900000109', 'Tucumã'),
  ('23982735000163', 'Bujaru'),
  ('04305405000199', 'Aurora do Pará'),
  ('14378618000102', 'Palestina do Pará'),
  ('83653709000113', 'Palestina do Pará'),
  ('35164797000147', 'Itinga do Maranhão'),
  ('12811039000178', 'Açailândia'),
  ('08267784000120', 'Dom Eliseu'),
  ('01286739000175', 'Dom Eliseu'),
  ('17304428000120', 'Grajaú'),
  ('37497562000100', 'Curionópolis'),
  ('39272432000197', 'Curionópolis'),
  ('46887736000124', 'Jacundá'),
  ('37469272000145', 'Jacundá'),
  ('31908665000121', 'Eldorado dos Carajás'),
  ('24300827000189', 'Eldorado dos Carajás'),
  ('63589448000102', 'Eldorado dos Carajás'),
  ('37510845000137', 'Eldorado dos Carajás'),
  ('31819219000140', 'Eldorado dos Carajás'),
  ('40221039000153', 'Eldorado dos Carajás'),
  ('07011010000171', 'Eldorado dos Carajás'),
  ('26090328000193', 'Goianésia do Pará'),
  ('28010059000180', 'Ananindeua'),
  ('07234517000356', 'Marabá'),
  ('07234517000194', 'Marabá'),
  ('05632683000113', 'Marabá'),
  ('29929091000126', 'Marabá'),
  ('07897481000129', 'Marabá'),
  ('34074424000112', 'Marabá'),
  ('12397417000119', 'Marabá'),
  ('07845121000183', 'Marabá'),
  ('33872388000170', 'Marabá'),
  ('60910190000106', 'Marabá'),
  ('53168404000155', 'Marabá'),
  ('20998397000160', 'Marabá'),
  ('37808513000133', 'Marabá'),
  ('58497760000136', 'Marabá'),
  ('34308918000114', 'Marabá'),
  ('40553645000176', 'Marabá'),
  ('53848885000140', 'Bom Jesus do Tocantins'),
  ('37900975000186', 'Bom Jesus do Tocantins'),
  ('54228965000185', 'Bom Jesus do Tocantins'),
  ('12501269000130', 'Bom Jesus do Tocantins'),
  ('27694440000142', 'Bom Jesus do Tocantins'),
  -- === CERÂMICAS E MINERAÇÃO ===
  ('05894596000134', 'Marabá'),
  ('05894596000135', 'Marabá'),
  ('83897983000138', 'Marabá'),
  ('05340297000158', 'Marabá'),
  ('05340297000159', 'Marabá'),
  ('33171819000170', 'Marabá'),
  ('05725796000163', 'Marabá'),
  ('53912064000125', 'Marabá'),
  ('37880832000150', 'Marabá'),
  ('13538260000167', 'Marabá'),
  ('42166026000154', 'Marabá'),
  ('51862001000102', 'Eldorado dos Carajás'),
  ('14442534000182', 'Eldorado dos Carajás'),
  ('42282609000190', 'Abel Figueiredo'),
  ('10962529000140', 'São Geraldo do Araguaia'),
  ('13549336000150', 'São Geraldo do Araguaia'),
  ('13549336000151', 'São Geraldo do Araguaia'),
  ('55334461000192', 'Marabá'),
  -- === LATICÍNIOS E ALIMENTOS ===
  ('03443704000127', 'Marabá'),
  ('23183719000100', 'Marabá'),
  ('04911702000340', 'Piçarra'),
  ('23457049000173', 'Sapucaia'),
  ('05646631000872', 'Marabá'),
  ('19001972000129', 'Novo Repartimento'),
  ('33376314000142', 'Marabá'),
  ('83593590000130', 'Marabá'),
  ('27584009000143', 'Marabá'),
  ('30064708000177', 'Itupiranga'),
  ('05758084000140', 'Rondon do Pará'),
  ('39329902000101', 'Rondon do Pará'),
  ('25044697000123', 'Eldorado dos Carajás'),
  ('41731903000120', 'Itupiranga'),
  -- === COMBUSTÍVEIS / GÁS ===
  ('24440525000106', 'Marabá'),
  ('24440525000297', 'Marabá'),
  ('24440525000378', 'Marabá'),
  ('25088751000135', 'Marabá'),
  ('33626638000191', 'Marabá'),
  ('19061921000192', 'Marabá'),
  ('27052610000195', 'Marabá'),
  ('32712558000196', 'Marabá'),
  -- === EMPRESAS DIVERSAS (MARABÁ) ===
  ('01062089000183', 'Marabá'),
  ('15659254000193', 'Itupiranga'),
  ('20665397000148', 'Marabá'),
  ('39931615000177', 'Marabá'),
  ('02692797000837', 'Marabá'),
  ('75315333020053', 'Marabá'),
  ('75315333020054', 'Marabá'),
  ('27352414000993', 'Marabá'),
  ('08890157000141', 'Marabá'),
  ('05025652000202', 'Marabá'),
  ('10528755000117', 'Marabá'),
  ('03738205000248', 'Marabá'),
  ('22808569000110', 'Marabá'),
  ('15204568000100', 'Marabá'),
  ('09576614000190', 'Marabá'),
  ('33090068000168', 'Marabá'),
  ('54802325000117', 'Marabá'),
  ('12475787000127', 'Marabá'),
  ('29314576000296', 'Marabá'),
  ('62331630000104', 'Marabá'),
  ('50030474000154', 'Marabá'),
  ('29803165000183', 'Palestina do Pará'),
  ('43978229000108', 'Novo Repartimento'),
  ('29497817000107', 'Novo Repartimento'),
  ('20548634000190', 'Novo Repartimento'),
  ('07064237000185', 'Itupiranga'),
  ('28391419000105', 'Itupiranga'),
  ('52317978000185', 'Itupiranga'),
  ('41166135000109', 'Itupiranga'),
  ('45711303000150', 'Itupiranga'),
  ('15659254000193', 'Itupiranga'),
  ('08981853000163', 'Parauapebas'),
  ('07986911000189', 'Parauapebas'),
  ('14996274000197', 'Parauapebas'),
  ('05100432000198', 'Marabá'),
  ('00861387000170', 'Marabá'),
  ('16695129000100', 'Marabá'),
  ('05400710000122', 'Marabá'),
  ('13323235000166', 'Marabá'),
  ('61710210000168', 'Marabá'),
  ('19969637000119', 'Marabá'),
  ('02581315000148', 'Marabá'),
  ('05484088000188', 'Marabá'),
  ('21058147000102', 'Marabá'),
  ('11813872000276', 'Marabá'),
  ('83584433000169', 'Marabá'),
  ('79379491008087', 'Marabá'),
  ('08436345000285', 'Marabá'),
  ('09136709000193', 'Marabá'),
  ('16630928000190', 'Marabá'),
  ('52847495000192', 'Marabá'),
  ('13165116000122', 'Marabá'),
  ('54021335000115', 'Marabá'),
  ('55645757000124', 'Marabá'),
  ('28786506000197', 'Marabá'),
  ('17449850000255', 'Marabá'),
  ('05861201000105', 'Marabá'),
  ('04384239000163', 'Jacundá'),
  ('10452564000119', 'Marabá'),
  ('31175229000190', 'Marabá'),
  ('22338136000149', 'Marabá'),
  ('56264668000109', 'Marabá'),
  ('30813744000196', 'Marabá'),
  ('28206904000197', 'Marabá'),
  ('45106089000103', 'Marabá'),
  ('36132658000102', 'Marabá'),
  ('20390520000165', 'Marabá'),
  ('00799698000166', 'Marabá'),
  ('01699258000190', 'Marabá'),
  ('10669522000134', 'Marabá'),
  ('07805488000173', 'Marabá'),
  ('59506213000485', 'Marabá'),
  ('25054492000129', 'Marabá'),
  ('20611472000198', 'Marabá'),
  ('45883595000109', 'Marabá'),
  ('12933200000186', 'Marabá'),
  ('05403409000172', 'Marabá'),
  ('39818482000127', 'Marabá'),
  ('53168404000155', 'Marabá'),
  ('46625188000164', 'Marabá'),
  ('07712240000168', 'Marabá'),
  ('33090721001756', 'Marabá'),
  ('19834208000215', 'Marabá'),
  ('39723244000366', 'Marabá'),
  ('16185368000149', 'Marabá'),
  ('15463814000130', 'Marabá'),
  ('14087165000238', 'Abel Figueiredo'),
  ('42553557000108', 'Marabá'),
  ('47480889000115', 'Macapá'),
  ('06775522000141', 'São Luís'),
  ('45937632000114', 'Imperatriz'),
  ('33978984000210', 'Imperatriz'),
  ('46675814000712', 'Imperatriz'),
  ('59970624001741', 'Imperatriz'),
  ('09262377000436', 'Marabá'),
  ('14737889000107', 'Marabá'),
  ('04510915000197', 'Ourilândia do Norte'),
  ('14133730000680', 'Redenção'),
  ('42043912000190', 'Vila Nova dos Martírios'),
  ('13215054000116', 'Eldorado dos Carajás'),
  ('14112023000445', 'Marabá'),
  ('14112023000364', 'Marabá'),
  ('14112023000526', 'Marabá'),
  ('14112023001093', 'Marabá'),
  ('45833037000139', 'Marabá'),
  ('59970624001903', 'Marabá'),
  ('05049200000152', 'Marabá'),
  ('24929776000159', 'Marabá'),
  ('01219219000149', 'Marabá'),
  ('46127182000167', 'Manaus'),
  ('17048388000101', 'Marabá'),
  ('08053284000136', 'Marabá'),
  ('04384239000163', 'Jacundá'),
  ('37152233000110', 'Canaã dos Carajás'),  -- Conflito no PDF; usar Canaã como mais provável
  ('43978229000108', 'Novo Repartimento')
)
SELECT
  'licencas' AS tabela,
  l.cnpj,
  l.cidade AS cidade_atual,
  lk.cidade AS cidade_correta
FROM licencas l
JOIN lookup lk
  ON REPLACE(REPLACE(REPLACE(REPLACE(l.cnpj, '.', ''), '/', ''), '-', ''), ' ', '') = lk.cnpj_digits
WHERE l.cidade IS NULL OR TRIM(l.cidade) = '' OR l.cidade <> lk.cidade
ORDER BY l.cnpj;


-- ============================================================
-- PASSO 1: PREENCHER cidade NULL/VAZIA em licencas
-- (seguro — não sobrescreve dados existentes)
-- ============================================================
WITH lookup (cnpj_digits, cidade) AS (
  VALUES
  ('03995515000248', 'Imperatriz'),
  ('03995515000400', 'Imperatriz'),
  ('03995515001309', 'Ananindeua'),
  ('03995515001562', 'Imperatriz'),
  ('03995515001805', 'Açailândia'),
  ('03995515002704', 'Imperatriz'),
  ('03995515002968', 'Imperatriz'),
  ('03995515003425', 'Imperatriz'),
  ('03995515004588', 'Imperatriz'),
  ('03995515005207', 'Marabá'),
  ('03995515005398', 'Marabá'),
  ('03995515005479', 'Marabá'),
  ('03995515006289', 'Parauapebas'),
  ('03995515006521', 'Açailândia'),
  ('03995515007501', 'Parauapebas'),
  ('03995515007565', 'Parauapebas'),
  ('03995515007584', 'Parauapebas'),
  ('03995515007665', 'Parauapebas'),
  ('03995515007927', 'Eldorado dos Carajás'),
  ('03995515008060', 'Curionópolis'),
  ('03995515008303', 'Marabá'),
  ('03995515008494', 'Marabá'),
  ('03995515008575', 'Marabá'),
  ('03995515008656', 'Jacundá'),
  ('03995515008818', 'Marabá'),
  ('03995515009032', 'Castanhal'),
  ('03995515009202', 'Belém'),
  ('03995515009285', 'Belém'),
  ('03995515009385', 'Altamira'),
  ('03995515009466', 'Tucuruí'),
  ('03995515009484', 'Marabá'),
  ('03995515009628', 'Belém'),
  ('03995515009987', 'Uruará'),
  ('03995515010120', 'Altamira'),
  ('03995515010553', 'Altamira'),
  ('03995515010634', 'Medicilândia'),
  ('03995515010987', 'Uruará'),
  ('03995515011282', 'Castanhal'),
  ('03995515011363', 'Abaetetuba'),
  ('03995515011773', 'Marabá'),
  ('03995515011797', 'Marabá'),
  ('03995515012092', 'Marituba'),
  ('03995515012173', 'Xinguara'),
  ('03995515012335', 'Açailândia'),
  ('03995515012607', 'Rondon do Pará'),
  ('03995515012840', 'Rondon do Pará'),
  ('03995515012920', 'Parauapebas'),
  ('03995515013226', 'Conceição do Araguaia'),
  ('03995515013307', 'Redenção'),
  ('03995515013811', 'Parauapebas'),
  ('03995515014321', 'Tailândia'),
  ('03995515014389', 'Tailândia'),
  ('03995515014893', 'Ananindeua'),
  ('03995515015512', 'Barcarena'),
  ('03995515016080', 'Tucuruí'),
  ('03995515016322', 'Redenção'),
  ('03995515017085', 'Barcarena'),
  ('03995515017485', 'Ananindeua'),
  ('03995515018019', 'Bragança'),
  ('03995515018023', 'Canaã dos Carajás'),
  ('03995515018880', 'Paragominas'),
  ('03995515019348', 'São Miguel do Guamá'),
  ('03995515022560', 'Belém'),
  ('03995515025313', 'Vigia de Nazaré'),
  ('03995515025385', 'Balsas'),
  ('03995515025566', 'Belém'),
  ('03995515029815', 'Marituba'),
  ('03995515004621', 'Capanema'),
  ('03995515014621', 'Capanema'),
  ('03995515020435', 'Cametá'),
  ('23439441001595', 'Davinópolis'),
  ('23439441002103', 'Parauapebas'),
  ('23439441002303', 'Benevides'),
  ('23439441003410', 'Belém'),
  ('23439441003666', 'São Miguel do Guamá'),
  ('23439441003881', 'Marabá'),
  ('23439441004004', 'Marituba'),
  ('23439441004268', 'Santa Izabel do Pará'),
  ('23439441004420', 'Santa Izabel do Pará'),
  ('23439441005159', 'Marabá'),
  ('27352414000306', 'Jacundá'),
  ('27352414000560', 'Tucumã'),
  ('27352414000993', 'Marabá'),
  ('27352414001027', 'Dom Eliseu'),
  ('27352414001299', 'Rondon do Pará'),
  ('27352414001965', 'Conceição do Araguaia'),
  ('27352414002422', 'Goianésia do Pará'),
  ('27352414002775', 'Itupiranga'),
  ('27352414003232', 'Itinga do Maranhão'),
  ('27352414003628', 'São Miguel do Guamá'),
  ('27352414003828', 'Tomé-Açu'),
  ('27352414004042', 'Dom Eliseu'),
  ('13145851000174', 'São Geraldo do Araguaia'),
  ('13145851000255', 'Tucumã'),
  ('13145851000336', 'Marabá'),
  ('14133730000175', 'Marabá'),
  ('14133730000256', 'Redenção'),
  ('14133730000418', 'Parauapebas'),
  ('14133730000507', 'Marabá'),
  ('14133730001570', 'Santarém'),
  ('05025625000202', 'Marabá'),
  ('05025625000717', 'Parauapebas'),
  ('05025625000989', 'Redenção'),
  ('09647935000139', 'Marabá'),
  ('09647935000309', 'Marabá'),
  ('09647935000210', 'Belém'),
  ('09647935000481', 'Ananindeua'),
  ('05023528000108', 'Marituba'),
  ('05023528000442', 'Marabá'),
  ('05023528000523', 'Marituba'),
  ('04747226000101', 'Marabá'),
  ('04747226000373', 'Parauapebas'),
  ('42282613000109', 'Belém'),
  ('09580023000197', 'Marabá'),
  ('17449881000125', 'Marabá'),
  ('17449881000206', 'Ananindeua'),
  ('40070881000212', 'Marabá'),
  ('08893457000699', 'Marabá'),
  ('08893457000770', 'Parauapebas'),
  ('08890160000750', 'Marabá'),
  ('01219219000149', 'Marabá'),
  ('01219219000653', 'Tucuruí'),
  ('01219219000734', 'Parauapebas'),
  ('01219219001110', 'Pacajá'),
  ('01219219001544', 'Anapú'),
  ('25033773000103', 'Abel Figueiredo'),
  ('63654088000194', 'Marabá'),
  ('45711303000150', 'Itupiranga'),
  ('35610162000126', 'São Pedro da Água Branca'),
  ('58071492000196', 'São Bento do Tocantins'),
  ('53719864000124', 'Araguatins'),
  ('08713905000110', 'Eldorado dos Carajás'),
  ('08713905000200', 'Santana do Araguaia'),
  ('27262701000155', 'Eldorado dos Carajás'),
  ('40221039000153', 'Eldorado dos Carajás'),
  ('40221039000234', 'Itaituba'),
  ('42722591000150', 'Dom Eliseu'),
  ('42722591000312', 'Ulianópolis'),
  ('42722591000401', 'Itinga do Maranhão'),
  ('29314237000129', 'Belém'),
  ('29314237000200', 'Belém'),
  ('15715870000114', 'Canaã dos Carajás'),
  ('15715870000195', 'Canaã dos Carajás'),
  ('08898073000316', 'Davinópolis'),
  ('08898073000588', 'Santa Izabel do Pará'),
  ('04510915000106', 'Ourilândia do Norte'),
  ('04510915000197', 'Ourilândia do Norte'),
  ('38023637000176', 'Eldorado dos Carajás'),
  ('38023637000177', 'Eldorado dos Carajás'),
  ('18972572000106', 'Marabá'),
  ('15812085000180', 'Marabá'),
  ('28860289000139', 'Marabá'),
  ('28860289000197', 'Marabá'),
  ('12021777000111', 'Marabá'),
  ('12021777000112', 'Marabá'),
  ('47103712000108', 'Marabá'),
  ('47103712000109', 'Marabá'),
  ('27742354000168', 'Marabá'),
  ('48275955000188', 'Parauapebas'),
  ('43403561000144', 'Marabá'),
  ('41397871000178', 'Marabá'),
  ('59112246000106', 'Marabá'),
  ('56331061000164', 'Ananindeua'),
  ('44128527000171', 'Marabá'),
  ('44280527000171', 'Marabá'),
  ('54974815000109', 'Marabá'),
  ('01240986000130', 'Marabá'),
  ('20665359000195', 'Marabá'),
  ('16384237000154', 'Marabá'),
  ('16384237000153', 'Marabá'),
  ('28038550000119', 'Marabá'),
  ('13608538000125', 'Marabá'),
  ('04384239000163', 'Jacundá'),
  ('05014246000136', 'Redenção'),
  ('03795537000183', 'Nova Ipixuna'),
  ('07820895000121', 'Nova Ipixuna'),
  ('11167054000162', 'Nova Ipixuna'),
  ('41640802000143', 'Nova Ipixuna'),
  ('58365911000100', 'Nova Ipixuna'),
  ('14312055000141', 'São Félix do Xingu'),
  ('44609340000190', 'São Félix do Xingu'),
  ('44609340000270', 'São Félix do Xingu'),
  ('53208704000110', 'São João do Araguaia'),
  ('14036628000151', 'São João do Araguaia'),
  ('07561621000193', 'Araguatins'),
  ('04323802000193', 'Augustinópolis'),
  ('31972369000190', 'Augustinópolis'),
  ('09664019000107', 'Buriti do Tocantins'),
  ('83324921000137', 'Marituba'),
  ('84146638000125', 'Xinguara'),
  ('63842801000114', 'Tucumã'),
  ('05458900000109', 'Tucumã'),
  ('23982735000163', 'Bujaru'),
  ('04305405000199', 'Aurora do Pará'),
  ('14378618000102', 'Palestina do Pará'),
  ('83653709000113', 'Palestina do Pará'),
  ('35164797000147', 'Itinga do Maranhão'),
  ('12811039000178', 'Açailândia'),
  ('08267784000120', 'Dom Eliseu'),
  ('01286739000175', 'Dom Eliseu'),
  ('17304428000120', 'Grajaú'),
  ('37497562000100', 'Curionópolis'),
  ('39272432000197', 'Curionópolis'),
  ('46887736000124', 'Jacundá'),
  ('37469272000145', 'Jacundá'),
  ('31908665000121', 'Eldorado dos Carajás'),
  ('24300827000189', 'Eldorado dos Carajás'),
  ('63589448000102', 'Eldorado dos Carajás'),
  ('37510845000137', 'Eldorado dos Carajás'),
  ('31819219000140', 'Eldorado dos Carajás'),
  ('07011010000171', 'Eldorado dos Carajás'),
  ('26090328000193', 'Goianésia do Pará'),
  ('28010059000180', 'Ananindeua'),
  ('07234517000356', 'Marabá'),
  ('07234517000194', 'Marabá'),
  ('05632683000113', 'Marabá'),
  ('29929091000126', 'Marabá'),
  ('07897481000129', 'Marabá'),
  ('34074424000112', 'Marabá'),
  ('12397417000119', 'Marabá'),
  ('07845121000183', 'Marabá'),
  ('33872388000170', 'Marabá'),
  ('60910190000106', 'Marabá'),
  ('53168404000155', 'Marabá'),
  ('20998397000160', 'Marabá'),
  ('37808513000133', 'Marabá'),
  ('58497760000136', 'Marabá'),
  ('34308918000114', 'Marabá'),
  ('40553645000176', 'Marabá'),
  ('53848885000140', 'Bom Jesus do Tocantins'),
  ('37900975000186', 'Bom Jesus do Tocantins'),
  ('54228965000185', 'Bom Jesus do Tocantins'),
  ('12501269000130', 'Bom Jesus do Tocantins'),
  ('27694440000142', 'Bom Jesus do Tocantins'),
  ('05894596000134', 'Marabá'),
  ('05894596000135', 'Marabá'),
  ('83897983000138', 'Marabá'),
  ('05340297000158', 'Marabá'),
  ('05340297000159', 'Marabá'),
  ('33171819000170', 'Marabá'),
  ('05725796000163', 'Marabá'),
  ('53912064000125', 'Marabá'),
  ('37880832000150', 'Marabá'),
  ('13538260000167', 'Marabá'),
  ('42166026000154', 'Marabá'),
  ('51862001000102', 'Eldorado dos Carajás'),
  ('14442534000182', 'Eldorado dos Carajás'),
  ('42282609000190', 'Abel Figueiredo'),
  ('10962529000140', 'São Geraldo do Araguaia'),
  ('13549336000150', 'São Geraldo do Araguaia'),
  ('13549336000151', 'São Geraldo do Araguaia'),
  ('55334461000192', 'Marabá'),
  ('03443704000127', 'Marabá'),
  ('23183719000100', 'Marabá'),
  ('04911702000340', 'Piçarra'),
  ('23457049000173', 'Sapucaia'),
  ('05646631000872', 'Marabá'),
  ('19001972000129', 'Novo Repartimento'),
  ('33376314000142', 'Marabá'),
  ('83593590000130', 'Marabá'),
  ('27584009000143', 'Marabá'),
  ('30064708000177', 'Itupiranga'),
  ('05758084000140', 'Rondon do Pará'),
  ('39329902000101', 'Rondon do Pará'),
  ('25044697000123', 'Eldorado dos Carajás'),
  ('41731903000120', 'Itupiranga'),
  ('24440525000106', 'Marabá'),
  ('24440525000297', 'Marabá'),
  ('24440525000378', 'Marabá'),
  ('25088751000135', 'Marabá'),
  ('33626638000191', 'Marabá'),
  ('19061921000192', 'Marabá'),
  ('27052610000195', 'Marabá'),
  ('32712558000196', 'Marabá'),
  ('01062089000183', 'Marabá'),
  ('15659254000193', 'Itupiranga'),
  ('20665397000148', 'Marabá'),
  ('39931615000177', 'Marabá'),
  ('02692797000837', 'Marabá'),
  ('75315333020053', 'Marabá'),
  ('75315333020054', 'Marabá'),
  ('08890157000141', 'Marabá'),
  ('05025652000202', 'Marabá'),
  ('10528755000117', 'Marabá'),
  ('03738205000248', 'Marabá'),
  ('22808569000110', 'Marabá'),
  ('15204568000100', 'Marabá'),
  ('09576614000190', 'Marabá'),
  ('33090068000168', 'Marabá'),
  ('54802325000117', 'Marabá'),
  ('12475787000127', 'Marabá'),
  ('29314576000296', 'Marabá'),
  ('62331630000104', 'Marabá'),
  ('50030474000154', 'Marabá'),
  ('29803165000183', 'Palestina do Pará'),
  ('43978229000108', 'Novo Repartimento'),
  ('29497817000107', 'Novo Repartimento'),
  ('20548634000190', 'Novo Repartimento'),
  ('07064237000185', 'Itupiranga'),
  ('28391419000105', 'Itupiranga'),
  ('52317978000185', 'Itupiranga'),
  ('41166135000109', 'Itupiranga'),
  ('08981853000163', 'Parauapebas'),
  ('07986911000189', 'Parauapebas'),
  ('14996274000197', 'Parauapebas'),
  ('05100432000198', 'Marabá'),
  ('00861387000170', 'Marabá'),
  ('16695129000100', 'Marabá'),
  ('05400710000122', 'Marabá'),
  ('13323235000166', 'Marabá'),
  ('61710210000168', 'Marabá'),
  ('19969637000119', 'Marabá'),
  ('02581315000148', 'Marabá'),
  ('05484088000188', 'Marabá'),
  ('21058147000102', 'Marabá'),
  ('11813872000276', 'Marabá'),
  ('83584433000169', 'Marabá'),
  ('79379491008087', 'Marabá'),
  ('08436345000285', 'Marabá'),
  ('09136709000193', 'Marabá'),
  ('16630928000190', 'Marabá'),
  ('52847495000192', 'Marabá'),
  ('13165116000122', 'Marabá'),
  ('54021335000115', 'Marabá'),
  ('55645757000124', 'Marabá'),
  ('28786506000197', 'Marabá'),
  ('17449850000255', 'Marabá'),
  ('05861201000105', 'Marabá'),
  ('10452564000119', 'Marabá'),
  ('31175229000190', 'Marabá'),
  ('22338136000149', 'Marabá'),
  ('56264668000109', 'Marabá'),
  ('30813744000196', 'Marabá'),
  ('28206904000197', 'Marabá'),
  ('45106089000103', 'Marabá'),
  ('36132658000102', 'Marabá'),
  ('20390520000165', 'Marabá'),
  ('00799698000166', 'Marabá'),
  ('01699258000190', 'Marabá'),
  ('10669522000134', 'Marabá'),
  ('07805488000173', 'Marabá'),
  ('59506213000485', 'Marabá'),
  ('25054492000129', 'Marabá'),
  ('20611472000198', 'Marabá'),
  ('45883595000109', 'Marabá'),
  ('12933200000186', 'Marabá'),
  ('05403409000172', 'Marabá'),
  ('39818482000127', 'Marabá'),
  ('46625188000164', 'Marabá'),
  ('07712240000168', 'Marabá'),
  ('33090721001756', 'Marabá'),
  ('19834208000215', 'Marabá'),
  ('39723244000366', 'Marabá'),
  ('16185368000149', 'Marabá'),
  ('15463814000130', 'Marabá'),
  ('14087165000238', 'Abel Figueiredo'),
  ('42553557000108', 'Marabá'),
  ('47480889000115', 'Macapá'),
  ('06775522000141', 'São Luís'),
  ('45937632000114', 'Imperatriz'),
  ('33978984000210', 'Imperatriz'),
  ('46675814000712', 'Imperatriz'),
  ('59970624001741', 'Imperatriz'),
  ('09262377000436', 'Marabá'),
  ('14737889000107', 'Marabá'),
  ('14133730000680', 'Redenção'),
  ('42043912000190', 'Vila Nova dos Martírios'),
  ('13215054000116', 'Eldorado dos Carajás'),
  ('14112023000445', 'Marabá'),
  ('14112023000364', 'Marabá'),
  ('14112023000526', 'Marabá'),
  ('14112023001093', 'Marabá'),
  ('45833037000139', 'Marabá'),
  ('59970624001903', 'Marabá'),
  ('05049200000152', 'Marabá'),
  ('24929776000159', 'Marabá'),
  ('46127182000167', 'Manaus'),
  ('17048388000101', 'Marabá'),
  ('08053284000136', 'Marabá'),
  ('41731903000120', 'Itupiranga'),
  ('52317978000185', 'Itupiranga'),
  ('14112023000445', 'Marabá')
)
UPDATE licencas
SET cidade = lk.cidade
FROM lookup lk
WHERE REPLACE(REPLACE(REPLACE(REPLACE(licencas.cnpj, '.', ''), '/', ''), '-', ''), ' ', '') = lk.cnpj_digits
  AND (licencas.cidade IS NULL OR TRIM(licencas.cidade) = '');

-- ============================================================
-- PASSO 2: CORRIGIR cidades ERRADAS em licencas
-- (Mateus com cidade errada — troca independente de ser NULL)
-- Use apenas para CNPJs que você tem CERTEZA da cidade correta
-- ============================================================

-- Corrige filiais do Mateus que podem estar salvas com cidade errada
UPDATE licencas SET cidade = 'Imperatriz'
WHERE REPLACE(REPLACE(REPLACE(REPLACE(cnpj, '.', ''), '/', ''), '-', ''), ' ', '')
  IN ('03995515000248','03995515000400','03995515001562','03995515002704',
      '03995515002968','03995515003425','03995515004588','03995515015620')
  AND cidade IS DISTINCT FROM 'Imperatriz';

UPDATE licencas SET cidade = 'Altamira'
WHERE REPLACE(REPLACE(REPLACE(REPLACE(cnpj, '.', ''), '/', ''), '-', ''), ' ', '')
  IN ('03995515009385','03995515010120','03995515010553')
  AND cidade IS DISTINCT FROM 'Altamira';

UPDATE licencas SET cidade = 'Parauapebas'
WHERE REPLACE(REPLACE(REPLACE(REPLACE(cnpj, '.', ''), '/', ''), '-', ''), ' ', '')
  IN ('03995515006289','03995515007501','03995515007565',
      '03995515007584','03995515007665','03995515012920','03995515013811')
  AND cidade IS DISTINCT FROM 'Parauapebas';

UPDATE licencas SET cidade = 'Tucuruí'
WHERE REPLACE(REPLACE(REPLACE(REPLACE(cnpj, '.', ''), '/', ''), '-', ''), ' ', '')
  IN ('03995515016080','03995515009466')
  AND cidade IS DISTINCT FROM 'Tucuruí';

UPDATE licencas SET cidade = 'Marituba'
WHERE REPLACE(REPLACE(REPLACE(REPLACE(cnpj, '.', ''), '/', ''), '-', ''), ' ', '')
  IN ('03995515012092','03995515029815','05023528000108','05023528000523','83324921000137')
  AND cidade IS DISTINCT FROM 'Marituba';

UPDATE licencas SET cidade = 'Curionópolis'
WHERE REPLACE(REPLACE(REPLACE(REPLACE(cnpj, '.', ''), '/', ''), '-', ''), ' ', '')
  IN ('03995515008060','37497562000100','39272432000197')
  AND cidade IS DISTINCT FROM 'Curionópolis';

UPDATE licencas SET cidade = 'Redenção'
WHERE REPLACE(REPLACE(REPLACE(REPLACE(cnpj, '.', ''), '/', ''), '-', ''), ' ', '')
  IN ('03995515016322','03995515013307','05025625000989','05014246000136','14133730000256')
  AND cidade IS DISTINCT FROM 'Redenção';

UPDATE licencas SET cidade = 'Canaã dos Carajás'
WHERE REPLACE(REPLACE(REPLACE(REPLACE(cnpj, '.', ''), '/', ''), '-', ''), ' ', '')
  IN ('03995515018023','15715870000114','15715870000195')
  AND cidade IS DISTINCT FROM 'Canaã dos Carajás';

UPDATE licencas SET cidade = 'Castanhal'
WHERE REPLACE(REPLACE(REPLACE(REPLACE(cnpj, '.', ''), '/', ''), '-', ''), ' ', '')
  IN ('03995515009032','03995515011282','03995515014540')
  AND cidade IS DISTINCT FROM 'Castanhal';

UPDATE licencas SET cidade = 'Belém'
WHERE REPLACE(REPLACE(REPLACE(REPLACE(cnpj, '.', ''), '/', ''), '-', ''), ' ', '')
  IN ('03995515009202','03995515009285','03995515009628','03995515013730',
      '03995515022560','03995515025566','23439441003410','29314237000129',
      '29314237000200','42282613000109')
  AND cidade IS DISTINCT FROM 'Belém';

UPDATE licencas SET cidade = 'Abaetetuba'
WHERE REPLACE(REPLACE(REPLACE(REPLACE(cnpj, '.', ''), '/', ''), '-', ''), ' ', '')
  IN ('03995515011363')
  AND cidade IS DISTINCT FROM 'Abaetetuba';

UPDATE licencas SET cidade = 'Barcarena'
WHERE REPLACE(REPLACE(REPLACE(REPLACE(cnpj, '.', ''), '/', ''), '-', ''), ' ', '')
  IN ('03995515015512','03995515017085')
  AND cidade IS DISTINCT FROM 'Barcarena';

UPDATE licencas SET cidade = 'Bragança'
WHERE REPLACE(REPLACE(REPLACE(REPLACE(cnpj, '.', ''), '/', ''), '-', ''), ' ', '')
  IN ('03995515018019')
  AND cidade IS DISTINCT FROM 'Bragança';

UPDATE licencas SET cidade = 'Paragominas'
WHERE REPLACE(REPLACE(REPLACE(REPLACE(cnpj, '.', ''), '/', ''), '-', ''), ' ', '')
  IN ('03995515018880')
  AND cidade IS DISTINCT FROM 'Paragominas';

UPDATE licencas SET cidade = 'Tailândia'
WHERE REPLACE(REPLACE(REPLACE(REPLACE(cnpj, '.', ''), '/', ''), '-', ''), ' ', '')
  IN ('03995515014321','03995515014389')
  AND cidade IS DISTINCT FROM 'Tailândia';

UPDATE licencas SET cidade = 'Ananindeua'
WHERE REPLACE(REPLACE(REPLACE(REPLACE(cnpj, '.', ''), '/', ''), '-', ''), ' ', '')
  IN ('03995515001309','03995515014893','03995515017485','56331061000164')
  AND cidade IS DISTINCT FROM 'Ananindeua';

UPDATE licencas SET cidade = 'Conceição do Araguaia'
WHERE REPLACE(REPLACE(REPLACE(REPLACE(cnpj, '.', ''), '/', ''), '-', ''), ' ', '')
  IN ('03995515013226','27352414001965')
  AND cidade IS DISTINCT FROM 'Conceição do Araguaia';

UPDATE licencas SET cidade = 'Jacundá'
WHERE REPLACE(REPLACE(REPLACE(REPLACE(cnpj, '.', ''), '/', ''), '-', ''), ' ', '')
  IN ('03995515008656','27352414000306','04384239000163','46887736000124','37469272000145')
  AND cidade IS DISTINCT FROM 'Jacundá';

UPDATE licencas SET cidade = 'Eldorado dos Carajás'
WHERE REPLACE(REPLACE(REPLACE(REPLACE(cnpj, '.', ''), '/', ''), '-', ''), ' ', '')
  IN ('03995515007927','08740651000120','38023637000176','38023637000177',
      '63589448000102','08713905000110','27262701000155','40221039000153',
      '31908665000121','24300827000189','37510845000137','31819219000140',
      '07011010000171','51862001000102','14442534000182','25044697000123',
      '13215054000116')
  AND cidade IS DISTINCT FROM 'Eldorado dos Carajás';

-- ============================================================
-- PASSO 3: MESMOS UPDATES PARA A TABELA clientes
-- (clientes.cidade é usada como fallback pelo código)
-- ============================================================

-- 3A: Preencher clientes com cidade NULL/vazia
WITH lookup (cnpj_digits, cidade) AS (
  VALUES
  ('03995515000248', 'Imperatriz'),
  ('03995515000400', 'Imperatriz'),
  ('03995515001309', 'Ananindeua'),
  ('03995515001562', 'Imperatriz'),
  ('03995515001805', 'Açailândia'),
  ('03995515002704', 'Imperatriz'),
  ('03995515002968', 'Imperatriz'),
  ('03995515003425', 'Imperatriz'),
  ('03995515004588', 'Imperatriz'),
  ('03995515005207', 'Marabá'),
  ('03995515005398', 'Marabá'),
  ('03995515005479', 'Marabá'),
  ('03995515006289', 'Parauapebas'),
  ('03995515006521', 'Açailândia'),
  ('03995515007501', 'Parauapebas'),
  ('03995515007565', 'Parauapebas'),
  ('03995515007584', 'Parauapebas'),
  ('03995515007665', 'Parauapebas'),
  ('03995515007927', 'Eldorado dos Carajás'),
  ('03995515008060', 'Curionópolis'),
  ('03995515008303', 'Marabá'),
  ('03995515008494', 'Marabá'),
  ('03995515008575', 'Marabá'),
  ('03995515008656', 'Jacundá'),
  ('03995515008818', 'Marabá'),
  ('03995515009032', 'Castanhal'),
  ('03995515009202', 'Belém'),
  ('03995515009285', 'Belém'),
  ('03995515009385', 'Altamira'),
  ('03995515009466', 'Tucuruí'),
  ('03995515009484', 'Marabá'),
  ('03995515009628', 'Belém'),
  ('03995515009987', 'Uruará'),
  ('03995515010120', 'Altamira'),
  ('03995515010553', 'Altamira'),
  ('03995515010634', 'Medicilândia'),
  ('03995515010987', 'Uruará'),
  ('03995515011282', 'Castanhal'),
  ('03995515011363', 'Abaetetuba'),
  ('03995515011773', 'Marabá'),
  ('03995515011797', 'Marabá'),
  ('03995515012092', 'Marituba'),
  ('03995515012173', 'Xinguara'),
  ('03995515012335', 'Açailândia'),
  ('03995515012607', 'Rondon do Pará'),
  ('03995515012840', 'Rondon do Pará'),
  ('03995515012920', 'Parauapebas'),
  ('03995515013226', 'Conceição do Araguaia'),
  ('03995515013307', 'Redenção'),
  ('03995515013811', 'Parauapebas'),
  ('03995515014321', 'Tailândia'),
  ('03995515014389', 'Tailândia'),
  ('03995515014893', 'Ananindeua'),
  ('03995515015512', 'Barcarena'),
  ('03995515016080', 'Tucuruí'),
  ('03995515016322', 'Redenção'),
  ('03995515017085', 'Barcarena'),
  ('03995515017485', 'Ananindeua'),
  ('03995515018019', 'Bragança'),
  ('03995515018023', 'Canaã dos Carajás'),
  ('03995515018880', 'Paragominas'),
  ('03995515019348', 'São Miguel do Guamá'),
  ('03995515022560', 'Belém'),
  ('03995515025313', 'Vigia de Nazaré'),
  ('03995515025385', 'Balsas'),
  ('03995515025566', 'Belém'),
  ('03995515029815', 'Marituba'),
  ('03995515004621', 'Capanema'),
  ('03995515014621', 'Capanema'),
  ('03995515020435', 'Cametá'),
  ('23439441001595', 'Davinópolis'),
  ('23439441002103', 'Parauapebas'),
  ('23439441002303', 'Benevides'),
  ('23439441003410', 'Belém'),
  ('23439441003666', 'São Miguel do Guamá'),
  ('23439441003881', 'Marabá'),
  ('23439441004004', 'Marituba'),
  ('23439441004268', 'Santa Izabel do Pará'),
  ('23439441004420', 'Santa Izabel do Pará'),
  ('23439441005159', 'Marabá'),
  ('27352414000306', 'Jacundá'),
  ('27352414000560', 'Tucumã'),
  ('27352414000993', 'Marabá'),
  ('27352414001027', 'Dom Eliseu'),
  ('27352414001299', 'Rondon do Pará'),
  ('27352414001965', 'Conceição do Araguaia'),
  ('27352414002422', 'Goianésia do Pará'),
  ('27352414002775', 'Itupiranga'),
  ('27352414003232', 'Itinga do Maranhão'),
  ('27352414003628', 'São Miguel do Guamá'),
  ('27352414003828', 'Tomé-Açu'),
  ('27352414004042', 'Dom Eliseu'),
  ('13145851000174', 'São Geraldo do Araguaia'),
  ('13145851000255', 'Tucumã'),
  ('13145851000336', 'Marabá'),
  ('14133730000175', 'Marabá'),
  ('14133730000256', 'Redenção'),
  ('14133730000418', 'Parauapebas'),
  ('14133730000507', 'Marabá'),
  ('14133730001570', 'Santarém'),
  ('05025625000202', 'Marabá'),
  ('05025625000717', 'Parauapebas'),
  ('05025625000989', 'Redenção'),
  ('09647935000139', 'Marabá'),
  ('09647935000309', 'Marabá'),
  ('09647935000210', 'Belém'),
  ('09647935000481', 'Ananindeua'),
  ('05023528000108', 'Marituba'),
  ('05023528000442', 'Marabá'),
  ('05023528000523', 'Marituba'),
  ('04747226000101', 'Marabá'),
  ('04747226000373', 'Parauapebas'),
  ('42282613000109', 'Belém'),
  ('09580023000197', 'Marabá'),
  ('17449881000125', 'Marabá'),
  ('17449881000206', 'Ananindeua'),
  ('40070881000212', 'Marabá'),
  ('08893457000699', 'Marabá'),
  ('08893457000770', 'Parauapebas'),
  ('08890160000750', 'Marabá'),
  ('01219219000149', 'Marabá'),
  ('01219219000653', 'Tucuruí'),
  ('01219219000734', 'Parauapebas'),
  ('01219219001110', 'Pacajá'),
  ('01219219001544', 'Anapú'),
  ('15715870000114', 'Canaã dos Carajás'),
  ('15715870000195', 'Canaã dos Carajás'),
  ('04510915000106', 'Ourilândia do Norte'),
  ('04510915000197', 'Ourilândia do Norte'),
  ('38023637000176', 'Eldorado dos Carajás'),
  ('38023637000177', 'Eldorado dos Carajás'),
  ('08740651000120', 'Eldorado dos Carajás'),
  ('39329902000101', 'Rondon do Pará'),
  ('05758084000140', 'Rondon do Pará'),
  ('04911702000340', 'Piçarra'),
  ('23457049000173', 'Sapucaia'),
  ('19001972000129', 'Novo Repartimento'),
  ('43978229000108', 'Novo Repartimento'),
  ('29497817000107', 'Novo Repartimento'),
  ('20548634000190', 'Novo Repartimento'),
  ('05023528000108', 'Marituba'),
  ('83324921000137', 'Marituba'),
  ('07561621000193', 'Araguatins'),
  ('04323802000193', 'Augustinópolis'),
  ('31972369000190', 'Augustinópolis'),
  ('09664019000107', 'Buriti do Tocantins'),
  ('37900975000186', 'Bom Jesus do Tocantins'),
  ('27694440000142', 'Bom Jesus do Tocantins'),
  ('14312055000141', 'São Félix do Xingu'),
  ('14378618000102', 'Palestina do Pará'),
  ('83653709000113', 'Palestina do Pará'),
  ('29803165000183', 'Palestina do Pará'),
  ('53208704000110', 'São João do Araguaia'),
  ('10962529000140', 'São Geraldo do Araguaia'),
  ('13549336000150', 'São Geraldo do Araguaia'),
  ('08713905000110', 'Eldorado dos Carajás'),
  ('27262701000155', 'Eldorado dos Carajás'),
  ('40221039000153', 'Eldorado dos Carajás'),
  ('40221039000234', 'Itaituba'),
  ('42722591000150', 'Dom Eliseu'),
  ('42722591000312', 'Ulianópolis'),
  ('42722591000401', 'Itinga do Maranhão'),
  ('35164797000147', 'Itinga do Maranhão'),
  ('17304428000120', 'Grajaú'),
  ('47480889000115', 'Macapá'),
  ('06775522000141', 'São Luís'),
  ('46127182000167', 'Manaus'),
  ('84146638000125', 'Xinguara'),
  ('63842801000114', 'Tucumã'),
  ('05458900000109', 'Tucumã'),
  ('23982735000163', 'Bujaru'),
  ('04305405000199', 'Aurora do Pará'),
  ('42043912000190', 'Vila Nova dos Martírios'),
  ('08267784000120', 'Dom Eliseu'),
  ('01286739000175', 'Dom Eliseu'),
  ('37497562000100', 'Curionópolis'),
  ('39272432000197', 'Curionópolis'),
  ('25033773000103', 'Abel Figueiredo'),
  ('42282609000190', 'Abel Figueiredo'),
  ('14087165000238', 'Abel Figueiredo'),
  ('35610162000126', 'São Pedro da Água Branca'),
  ('58071492000196', 'São Bento do Tocantins'),
  ('53719864000124', 'Araguatins'),
  ('07820895000121', 'Nova Ipixuna'),
  ('03795537000183', 'Nova Ipixuna'),
  ('11167054000162', 'Nova Ipixuna'),
  ('45937632000114', 'Imperatriz'),
  ('33978984000210', 'Imperatriz'),
  ('46675814000712', 'Imperatriz'),
  ('59970624001741', 'Imperatriz'),
  ('08898073000316', 'Davinópolis'),
  ('08898073000588', 'Santa Izabel do Pará'),
  ('26090328000193', 'Goianésia do Pará'),
  ('28010059000180', 'Ananindeua'),
  ('56331061000164', 'Ananindeua'),
  ('17449881000206', 'Ananindeua'),
  ('30064708000177', 'Itupiranga'),
  ('15659254000193', 'Itupiranga'),
  ('07064237000185', 'Itupiranga'),
  ('28391419000105', 'Itupiranga'),
  ('52317978000185', 'Itupiranga'),
  ('41166135000109', 'Itupiranga'),
  ('41731903000120', 'Itupiranga'),
  ('08981853000163', 'Parauapebas'),
  ('07986911000189', 'Parauapebas'),
  ('14996274000197', 'Parauapebas'),
  ('48275955000188', 'Parauapebas'),
  ('14133730000418', 'Parauapebas'),
  ('04747226000373', 'Parauapebas'),
  ('08893457000770', 'Parauapebas'),
  ('01219219000734', 'Parauapebas'),
  ('05025625000717', 'Parauapebas'),
  ('14133730001570', 'Santarém'),
  ('14036628000151', 'São João do Araguaia'),
  ('01219219000653', 'Tucuruí'),
  ('25044697000123', 'Eldorado dos Carajás'),
  ('51862001000102', 'Eldorado dos Carajás'),
  ('14442534000182', 'Eldorado dos Carajás'),
  ('13215054000116', 'Eldorado dos Carajás'),
  ('31908665000121', 'Eldorado dos Carajás'),
  ('24300827000189', 'Eldorado dos Carajás'),
  ('63589448000102', 'Eldorado dos Carajás'),
  ('37510845000137', 'Eldorado dos Carajás'),
  ('31819219000140', 'Eldorado dos Carajás'),
  ('07011010000171', 'Eldorado dos Carajás'),
  ('08713905000200', 'Santana do Araguaia'),
  ('29314237000129', 'Belém'),
  ('29314237000200', 'Belém'),
  ('09647935000210', 'Belém'),
  ('42282613000109', 'Belém'),
  ('05014246000136', 'Redenção'),
  ('14133730000256', 'Redenção'),
  ('05025625000989', 'Redenção')
)
UPDATE clientes
SET cidade = lk.cidade
FROM lookup lk
WHERE REPLACE(REPLACE(REPLACE(REPLACE(clientes.cnpj, '.', ''), '/', ''), '-', ''), ' ', '') = lk.cnpj_digits
  AND (clientes.cidade IS NULL OR TRIM(clientes.cidade) = '');

-- 3B: Corrigir cidades ERRADAS em clientes (mesma lógica do Passo 2)
UPDATE clientes SET cidade = 'Imperatriz'
WHERE REPLACE(REPLACE(REPLACE(REPLACE(cnpj, '.', ''), '/', ''), '-', ''), ' ', '')
  IN ('03995515000248','03995515000400','03995515001562','03995515002704',
      '03995515002968','03995515003425','03995515004588','03995515015620')
  AND cidade IS DISTINCT FROM 'Imperatriz';

UPDATE clientes SET cidade = 'Altamira'
WHERE REPLACE(REPLACE(REPLACE(REPLACE(cnpj, '.', ''), '/', ''), '-', ''), ' ', '')
  IN ('03995515009385','03995515010120','03995515010553')
  AND cidade IS DISTINCT FROM 'Altamira';

UPDATE clientes SET cidade = 'Parauapebas'
WHERE REPLACE(REPLACE(REPLACE(REPLACE(cnpj, '.', ''), '/', ''), '-', ''), ' ', '')
  IN ('03995515006289','03995515007501','03995515007565',
      '03995515007584','03995515007665','03995515012920','03995515013811')
  AND cidade IS DISTINCT FROM 'Parauapebas';

UPDATE clientes SET cidade = 'Tucuruí'
WHERE REPLACE(REPLACE(REPLACE(REPLACE(cnpj, '.', ''), '/', ''), '-', ''), ' ', '')
  IN ('03995515016080','03995515009466')
  AND cidade IS DISTINCT FROM 'Tucuruí';

UPDATE clientes SET cidade = 'Marituba'
WHERE REPLACE(REPLACE(REPLACE(REPLACE(cnpj, '.', ''), '/', ''), '-', ''), ' ', '')
  IN ('03995515012092','03995515029815','05023528000108','05023528000523','83324921000137')
  AND cidade IS DISTINCT FROM 'Marituba';

UPDATE clientes SET cidade = 'Curionópolis'
WHERE REPLACE(REPLACE(REPLACE(REPLACE(cnpj, '.', ''), '/', ''), '-', ''), ' ', '')
  IN ('03995515008060','37497562000100','39272432000197')
  AND cidade IS DISTINCT FROM 'Curionópolis';

UPDATE clientes SET cidade = 'Redenção'
WHERE REPLACE(REPLACE(REPLACE(REPLACE(cnpj, '.', ''), '/', ''), '-', ''), ' ', '')
  IN ('03995515016322','03995515013307','05025625000989','05014246000136','14133730000256')
  AND cidade IS DISTINCT FROM 'Redenção';

UPDATE clientes SET cidade = 'Canaã dos Carajás'
WHERE REPLACE(REPLACE(REPLACE(REPLACE(cnpj, '.', ''), '/', ''), '-', ''), ' ', '')
  IN ('03995515018023','15715870000114','15715870000195')
  AND cidade IS DISTINCT FROM 'Canaã dos Carajás';

UPDATE clientes SET cidade = 'Castanhal'
WHERE REPLACE(REPLACE(REPLACE(REPLACE(cnpj, '.', ''), '/', ''), '-', ''), ' ', '')
  IN ('03995515009032','03995515011282','03995515014540')
  AND cidade IS DISTINCT FROM 'Castanhal';

UPDATE clientes SET cidade = 'Belém'
WHERE REPLACE(REPLACE(REPLACE(REPLACE(cnpj, '.', ''), '/', ''), '-', ''), ' ', '')
  IN ('03995515009202','03995515009285','03995515009628','03995515013730',
      '03995515022560','03995515025566','23439441003410','29314237000129',
      '29314237000200','42282613000109')
  AND cidade IS DISTINCT FROM 'Belém';

UPDATE clientes SET cidade = 'Abaetetuba'
WHERE REPLACE(REPLACE(REPLACE(REPLACE(cnpj, '.', ''), '/', ''), '-', ''), ' ', '')
  IN ('03995515011363')
  AND cidade IS DISTINCT FROM 'Abaetetuba';

UPDATE clientes SET cidade = 'Barcarena'
WHERE REPLACE(REPLACE(REPLACE(REPLACE(cnpj, '.', ''), '/', ''), '-', ''), ' ', '')
  IN ('03995515015512','03995515017085')
  AND cidade IS DISTINCT FROM 'Barcarena';

UPDATE clientes SET cidade = 'Bragança'
WHERE REPLACE(REPLACE(REPLACE(REPLACE(cnpj, '.', ''), '/', ''), '-', ''), ' ', '')
  IN ('03995515018019')
  AND cidade IS DISTINCT FROM 'Bragança';

UPDATE clientes SET cidade = 'Paragominas'
WHERE REPLACE(REPLACE(REPLACE(REPLACE(cnpj, '.', ''), '/', ''), '-', ''), ' ', '')
  IN ('03995515018880')
  AND cidade IS DISTINCT FROM 'Paragominas';

UPDATE clientes SET cidade = 'Tailândia'
WHERE REPLACE(REPLACE(REPLACE(REPLACE(cnpj, '.', ''), '/', ''), '-', ''), ' ', '')
  IN ('03995515014321','03995515014389')
  AND cidade IS DISTINCT FROM 'Tailândia';

UPDATE clientes SET cidade = 'Ananindeua'
WHERE REPLACE(REPLACE(REPLACE(REPLACE(cnpj, '.', ''), '/', ''), '-', ''), ' ', '')
  IN ('03995515001309','03995515014893','03995515017485','56331061000164')
  AND cidade IS DISTINCT FROM 'Ananindeua';

UPDATE clientes SET cidade = 'Conceição do Araguaia'
WHERE REPLACE(REPLACE(REPLACE(REPLACE(cnpj, '.', ''), '/', ''), '-', ''), ' ', '')
  IN ('03995515013226','27352414001965')
  AND cidade IS DISTINCT FROM 'Conceição do Araguaia';

UPDATE clientes SET cidade = 'Jacundá'
WHERE REPLACE(REPLACE(REPLACE(REPLACE(cnpj, '.', ''), '/', ''), '-', ''), ' ', '')
  IN ('03995515008656','27352414000306','04384239000163','46887736000124','37469272000145')
  AND cidade IS DISTINCT FROM 'Jacundá';

UPDATE clientes SET cidade = 'Eldorado dos Carajás'
WHERE REPLACE(REPLACE(REPLACE(REPLACE(cnpj, '.', ''), '/', ''), '-', ''), ' ', '')
  IN ('03995515007927','08740651000120','38023637000176','38023637000177',
      '63589448000102','08713905000110','27262701000155','40221039000153',
      '31908665000121','24300827000189','37510845000137','31819219000140',
      '07011010000171','51862001000102','14442534000182','25044697000123',
      '13215054000116')
  AND cidade IS DISTINCT FROM 'Eldorado dos Carajás';

-- ============================================================
-- PASSO 4: VERIFICAÇÃO FINAL
-- ============================================================
SELECT
  'licencas' AS tabela,
  COUNT(*) FILTER (WHERE cidade IS NULL OR TRIM(cidade) = '') AS ainda_sem_cidade,
  COUNT(*) AS total
FROM licencas
UNION ALL
SELECT
  'clientes' AS tabela,
  COUNT(*) FILTER (WHERE cidade IS NULL OR TRIM(cidade) = '') AS ainda_sem_cidade,
  COUNT(*) AS total
FROM clientes;
