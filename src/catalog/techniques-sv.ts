import type { TechniqueTexts } from "./techniques";

/** The techniques in Swedish: a draft until reviewed. */
export const TECHNIQUES_SV: TechniqueTexts = {
  "attach-thread": {
    name: "Fästa tråden",
    summary: "Att fästa bindtråden på en bar krok med en låsknut.",
    how: `Håll trådens lösa ände ovanför och bakom kroken, med bobbinhållaren under. Lägg tråden mot krokskaftet och linda den över sig själv, bort från dig, tre eller fyra varv mot krokböjen. Varven binder fast den lösa änden och låser sig själva: det är låsknuten.

Klipp av den lösa änden tätt intill, så har du en fast grund att binda på.`,
    mistakes: ["Att linda mot dig: varven glider i stället för att låsa sig.", "För få varv, så att tråden snurrar runt krokskaftet."],
  },
  "thread-base": {
    name: "Lägga en trådbädd",
    summary: "Täta trådvarv längs krokskaftet, så att materialen får fäste och kroppen blir slät.",
    how: `Linda tråden längs krokskaftet i varv som precis ligger an mot varandra, med jämn spänning. Låt bobbinhållaren hänga några centimeter under kroken: en kort tråd är lättare att placera.

En slät bädd är viktig: varje ojämnhet i den syns igenom en smal kropp.`,
    mistakes: ["Glapp eller varv som ligger över varandra, vilket ger en knölig kropp.", "Tråd som byggs upp på ett och samma ställe."],
  },
  "tie-in": {
    name: "Binda in material",
    summary: "Att fästa ett material på kroken med fasta trådvarv: nypgreppet.",
    how: `Håll materialet ovanpå krokskaftet. För upp tråden mellan tummen och materialet, över toppen och ner mellan fingret och materialet, så att öglan sluts ovanifrån. Dra rakt nedåt för att dra åt.

Materialet stannar ovanpå i stället för att rulla runt till krokskaftets bortre sida. Två eller tre varv till håller det på plats.`,
    mistakes: ["Att binda in med lösa varv, så att materialet vrider sig runt krokskaftet.", "För många varv, som bygger upp onödig volym."],
  },
  tail: {
    name: "Stjärtar och tagar",
    summary: "En bunt fibrer eller garn som binds in vid krokböjen och sticker ut bakåt.",
    how: `Mät längden mot kroken innan du binder in. Håll bunten ovanpå krokskaftet vid krokböjens början, lägg två lösa varv och dra sedan åt med nypgreppet.

Bind ner rotändarna längs krokskaftet mot krokögat och klipp dem där kroppen kommer att täcka dem, så att kroppen blir jämn.`,
    mistakes: ["Stjärtar som rullar runt till krokskaftets bortre sida.", "För lång: flugan landar ojämnt och fisken nafsar i stjärten."],
  },
  dubbing: {
    name: "Dubba en kropp",
    summary: "Att snurra pälshår på tråden och linda det till en luddig kropp.",
    how: `Ta lite dubbing, mycket mindre än du tror, och dra isär fibrerna så att de ligger löst. Tryck den mot tråden och snurra mellan tumme och finger åt ett enda håll, så att den dras åt runt tråden till ett smalt rep.

Linda repet framåt i täta varv. Lägg på lite mer framtill, så att kroppen smalnar av bakåt.`,
    mistakes: ["För mycket dubbing, som ger en tjock, formlös kropp.", "Att snurra fram och tillbaka, vilket lossar repet igen."],
  },
  "herl-body": {
    name: "Herlkroppar",
    summary: "Att linda påfågelherl till en bronsgrön, luddig kropp.",
    how: `Bind in två eller tre herl vid spetsarna och linda dem framåt tillsammans i täta varv. För en tåligare kropp kan du först tvinna dem runt tråden till ett rep.

Håll fjunet riktat bakåt medan du lindar, så att det står ut.`,
    mistakes: ["Att linda enstaka strån: de går lätt av.", "Att klämma ner fjunet med nästa varv."],
  },
  ribbing: {
    name: "Ribba kroppen",
    summary: "Glesa varv av metalltråd, tinsel eller tråd över kroppen: för segmentering och hållfasthet.",
    how: `Bind in ribben vid krokböjen innan du gör kroppen. När kroppen är klar lindar du ribben framåt i jämnt fördelade, glesa varv, åt motsatt håll mot kroppen om du vill att den ska skydda kroppen.

Fäst och klipp den framtill.`,
    mistakes: ["Ojämna avstånd mellan varven.", "Att linda åt samma håll som kroppen, så att ribben sjunker in i den."],
  },
  "wound-body": {
    name: "Lindade kroppar",
    summary: "Kroppar av flossilke, tinsel, chenille eller fibrer, lindade i täta varv.",
    how: `Bind in materialet vid krokböjen och linda tråden framåt till där kroppen ska sluta. Linda materialet framåt i täta eller lätt överlappande varv, och håll det platt och otvinnat.

Fäst och klipp där tråden hänger.`,
    mistakes: ["Att låta flossilke eller tinsel tvinna sig till ett snöre.", "Glapp mellan varven."],
  },
  "hackle-collar": {
    name: "Linda en hackelkrage",
    summary: "Ett hackel lindat i täta varv bakom krokögat, så att fibrerna står ut runt om.",
    how: `Bind in hacklet i den skalade stjälken, med den blanka sidan mot dig. Ta spetsen i hackeltången och linda framåt, varje varv strax framför det förra, utan att fånga fibrerna du redan har lindat.

Fäst med några hårda varv och klipp av spetsen.`,
    mistakes: ["Att linda över tidigare varv och platta till fibrerna.", "Ett hackel som är för långt eller för kort för kroken: kontrollera fiberlängden först."],
  },
  palmering: {
    name: "Palmera ett hackel",
    summary: "Att linda ett hackel i glesa varv längs kroppen, ofta säkrat av ribben.",
    how: `Ett palmerat hackel kan lindas åt båda hållen längs kroppen.

Framåt: bind in hacklet vid kroppens bakre ände och gör kroppen. Linda hacklet framåt över den i jämnt fördelade, glesa varv, och fäst det sedan framtill som en krage.

Bakåt: bind in hacklet vid kroppens främre ände, linda det bakåt mot krokböjen i glesa varv och håll spetsen kvar där med hackeltången. Linda sedan ribben framåt genom hacklet och vicka den fram och tillbaka så att den inte fångar några fibrer. Det första ribbvarvet låser hackelspetsen; klipp av spetsen efteråt.`,
    mistakes: ["Att fånga fibrer under ribben.", "För täta varv, så att hacklet döljer kroppen."],
  },
  "soft-hackle": {
    name: "Mjukhackel",
    summary: "Ett eller två varv av en mjuk fjäder, till exempel rapphöna, som sveper bakåt över kroppen.",
    how: `Förbered fjädern genom att skala bort fjunet vid basen. Bind in den vid spetsen eller stjälken och linda högst två varv: mjukhackelflugor ska se glesa ut.

Stryk fibrerna bakåt medan du fäster, så att de sveper över kroppen.`,
    mistakes: ["För många varv, som döljer kroppen och tar död på rörelsen.", "Fibrer som är mycket längre än kroken."],
  },
  parachute: {
    name: "Parachutehackel",
    summary: "Ett hackel lindat vågrätt runt en upprättstående post, så att flugan sitter lågt i ytfilmen.",
    how: `Bind in posten upprätt och styva upp dess bas med några trådvarv upp och ner längs den. Bind in hacklet mot posten och linda det sedan runt posten, varje varv under det förra.

Håll undan hacklet och fäst det på krokskaftet med några varv under fibrerna.`,
    mistakes: ["En slapp post: hacklet glider av.", "Att fånga fibrer när du fäster."],
  },
  "wing-post": {
    name: "Upprättstående vingar och poster",
    summary: "Vingar eller en post som står upp från krokskaftet, för synlighet och siluett.",
    how: `Bind in vingmaterialet så att det pekar framåt över krokögat, res det sedan upprätt och lägg flera trådvarv tätt framför det så att det står kvar.

För delade vingar delar du materialet i två halvor och binder dem i ett V med åttor.`,
    mistakes: ["Vingar som lutar framåt eller bakåt.", "Olika stora halvor på en delad vinge."],
  },
  "hair-wing": {
    name: "Hårvingar",
    summary: "En bunt hår som binds in ovanpå som vinge och spretar ut när tråden dras åt.",
    how: `Klipp en liten bunt, kamma ur underullen och jämna till spetsarna i en hårutjämnare. Mät, håll sedan bunten ovanpå och lägg två lösa varv innan du drar åt: håret spretar ut när tråden biter.

Klipp rotändarna snett (eller rakt, för ett nattsländehuvud) och bind ner dem.`,
    mistakes: ["Att hoppa över hårutjämnaren, så att spetsarna blir ojämna.", "För mycket hår, som inte stannar på plats."],
  },
  "feather-wing": {
    name: "Fjädervingar",
    summary: "Hela fjädrar eller sektioner av vingpennor som binds in som vingar.",
    how: `För sektioner klipper du ut matchande bitar ur en vänster och en höger vingpenna, så att de böjer sig åt samma håll. Håll paret ovanpå kroken, lägg ett löst varv och dra rakt nedåt så att fibrerna läggs på varandra.

Hela fjädrar binds in i stjälken; skala först bort fjunet vid basen.`,
    mistakes: ["Sektioner som spricker isär: öglan drogs inte rakt nedåt.", "Omaka sektioner som får flugan att vrida sig."],
  },
  beard: {
    name: "Skägg",
    summary: "En liten bunt fibrer som binds in under kroken, bakom krokögat.",
    how: `Vänd kroken eller nå in under den, håll bunten under krokskaftet och fäst den med nypgreppet. På en våtfluga når fibrerna ungefär till krokspetsen; ett skägg av hår på en laxfluga är ofta kortare och når ungefär halvvägs dit.`,
    mistakes: ["Ett skägg som glider runt åt sidan.", "För tjockt, vilket rubbar flugans balans."],
  },
  "wing-case": {
    name: "Vingsäckar och ryggar",
    summary: "En remsa som dras framåt över kroppens ovansida och binds ner.",
    how: `Bind in materialet vid thoraxens bakre ände (eller vid krokböjen för en rygg), liggande bakåt. Gör thorax eller kropp, dra sedan remsan framåt över ovansidan, håll den centrerad och platt och bind ner den framtill med några fasta varv.`,
    mistakes: ["En vingsäck som glider åt ena sidan.", "Att dra så hårt att remsan spricker."],
  },
  "bead-head": {
    name: "Skallar",
    summary: "En metallskalle som träs på kroken före tråden, för vikt och glitter.",
    how: `Trä skallen runt krokböjen med det lilla hålet först, upp till krokögat. Håll den där medan du fäster tråden bakom den, och bygg upp några varv bindtråd eller metalltråd bakom skallen så att den sitter kvar.`,
    mistakes: ["Skallen är påträdd åt fel håll.", "En skalle som är för stor för krokgapet."],
  },
  weighting: {
    name: "Förtyngning",
    summary: "Varv av metalltråd under kroppen som får flugan att sjunka.",
    how: `Linda blyfri tråd runt det bara krokskaftet i täta varv över mitten av skaftet, tryck sedan ihop varven och lås dem med bindtråd innan du gör kroppen över dem.`,
    mistakes: ["Förtyngning som snurrar på krokskaftet: lås den med bindtråd.", "Förtyngning för nära krokögat, så att det inte blir plats för huvudet."],
  },
  eyes: {
    name: "Hantelögon och kulkedjeögon",
    summary: "Ögon som binds tvärs över krokskaftet med åttor; tunga ögon vänder flugan så att krokspetsen pekar uppåt.",
    how: `Placera ögonen tvärs över krokskaftet, ungefär en tredjedel av skaftets längd bakom krokögat. Bind fast dem med åttor åt båda hållen och sedan några varv runt basen för att dra åt alltihop. En droppe lim hindrar dem från att vrida sig.`,
    mistakes: ["Ögon för nära krokögat.", "Ögon som vrider sig runt krokskaftet."],
  },
  "spinning-hair": {
    name: "Spinna och klippa hjorthår",
    summary: "Buntar av ihåligt hår som spinns runt krokskaftet och klipps till ett huvud.",
    how: `Håll en bunt hjorthår över krokskaftet, lägg två lösa varv och dra sedan hårt nedåt samtidigt som du släpper taget: håret spretar ut och spinner runt krokskaftet. Tryck det tätt bakåt med fingrarna, lägg nästa bunt framför och fortsätt fram till krokögat.

Gör en whipfinishknut och klipp sedan huvudet till form med en vass sax eller ett rakblad.`,
    mistakes: ["Buntar som är för stora för att spinna.", "Att inte packa buntarna, så att huvudet blir löst."],
  },
  "tie-off": {
    name: "Fästa och klippa",
    summary: "Att fästa ett lindat material framtill med fasta trådvarv och klippa bort överskottet.",
    how: `Håll materialet ovanpå krokskaftet där tråden hänger och lägg tre eller fyra fasta varv över det. Klipp bort överskottet tätt intill och täck sedan den avklippta änden med ett par varv till.`,
    mistakes: ["Att klippa innan materialet sitter fast.", "En stump som syns."],
  },
  "whip-finish": {
    name: "Whipfinish",
    summary: "Knuten som avslutar en fluga: trådvarv som läggs över en ögla av samma tråd.",
    how: `För hand eller med ett whipfinishverktyg lägger du fyra eller fem varv tråd över en ögla av samma tråd och drar sedan ihop öglan, så att varven låser fast änden. Klipp av tråden.

En droppe huvudlack eller lack gör knuten beständig.`,
    mistakes: ["Ett stort huvud som tränger in mot krokögat.", "Att dra ihop öglan innan alla varv är lagda."],
  },
};
