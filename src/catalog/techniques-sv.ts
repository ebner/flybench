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

Gör en whipfinishknut och klipp sedan huvudet till form med en vass sax eller ett rakblad. För en kropp som ska ligga plant på vattnet, som en mus, klipps håret plant upptill och undertill med ett rakblad, och håret på sidorna får vara långt.`,
    mistakes: ["Buntar som är för stora för att spinna.", "Att inte packa buntarna, så att huvudet blir löst."],
  },
  "tubing-body": {
    name: "Kroppar av mylarslang",
    summary: "Flätad mylarslang som träs över ögat och längs kroppen som ett hölje och binds ner i båda ändar.",
    how: `Klipp slangen lite längre än kroppen och dra ut bomullskärnan. Trä den över ögat och bakåt över underkroppen, och bind ner ena änden med hårda varv av stark tråd; dra i slangen medan du lindar, så att den sträcks och följer underkroppen.

Bind ner den andra änden på samma sätt, klipp bort överskottet och limma varven. En uppriven ände blir en kort glitterstjärt: repa upp flätan med en nål.`,
    mistakes: ["Lösa varv: den hala flätan glider ur dem.", "En slang som är för vid för kroppen, så att den påsar sig i stället för att ligga tätt."],
  },
  "hair-body": {
    name: "Hårhuvuden och förlängda hårkroppar",
    summary: "Hår som binds in pekande framåt över ögat, viks bakåt till ett slätt huvud och binds med bindtråden längs kroppen och vidare bakom krokböjen.",
    how: `Jämna till en bunt hår och klipp rotändarna raka. Bind in den bakom ögat med spetsarna framåt över ögat: först två lösa varv, dra sedan åt så att håret fördelar sig jämnt runt krokskaftet.

Skjut håret bakåt över ögat, med fingrarna eller hålet i ett halvslagsverktyg, tills det ligger slätt runt om, och bind ner det bakom huvudet med två eller tre hårda varv. Det är hårhuvudet.

För en förlängd kropp håller du håret bakåt runt krokskaftet (och runt en stjärt inbunden vid krokböjen) och lindar bindtråden i spiral bakåt över det med jämn spänning, vidare bakom krokböjen runt bara håret, och sedan framåt igen så att varven korsar varandra. Klipp spetsarna strax bakom det sista varvet.`,
    mistakes: ["För hård spänning, så att håret spretar i stället för att ligga slätt.", "Ojämna varv bakom krokböjen, så att kroppen blir sned eller segmenten ojämna."],
  },
  "needle-body": {
    name: "Förlängda foamkroppar gjorda på en nål",
    summary: "En remsa foam som viks runt en nål över stjärtsprötet och binds i segment, dras av och binds fast på kroken.",
    how: `Spänn fast en nål i städet och lägg ett glest underlag av bindtråd på den, ungefär en kroklängd. Bind in stjärtfibrerna nära spetsen, med rotändarna liggande framåt längs nålen.

Skär en remsa tunn foam med slutna celler, avsmalnande mot ena änden och med ett hack där för stjärtsprötet. Vik den över nålens spets med stjärtsprötet mellan halvorna, och bind det första segmentet med några varv lätt spänning: så att foamen nyps ihop men inte skärs av. För tråden framåt med ett par glesa varv och bind nästa segment, och så vidare.

Slå ett halvslag, klipp tråden och dra av kroppen från nålen. Bind fast den ovanpå kroken med det främre segmentet, med foamens ändar och stjärtfibrernas rotändar liggande framåt. Ändarna kan senare dras framåt över thoraxen, en på var sida om vingen, och bindas ner bakom ögat som huvud.`,
    mistakes: ["För hård spänning, så att tråden skär av foamen.", "Foam som glider runt skaftet när det binds ner: håll det på plats medan du drar åt."],
  },
  "glued-body": {
    name: "Limmade fiberkroppar",
    summary: "Bitar av fibrer som limmas tvärs över skaftet efter whipfinishknuten, ovanpå och undertill, och klipps till en platt skiva: en krabbas kropp.",
    how: `Avsluta tråden först: kroppen hålls bara av limmet. Dra av en bit av fibrerna, platta till den mellan fingrarna och klipp den lika bred som kroppen ska bli.

Med krokspetsen nedåt lägger du en sträng lim längs skaftets ovansida och trycker ner biten i den, med fibrerna tvärs över skaftet, hälften på varje sida. Lägg en andra bit ovanpå. Vänd kroken och limma en eller två bitar undertill, och sätt ben som bundits in tidigare i det våta limmet så som de ska peka. Vänd tillbaka kroken och lägg en bit till ovanpå, så att ovansidan bär mer än undersidan.

Låt limmet härda och klipp sedan kroppen rund till en platt skiva.`,
    mistakes: ["Bitar som läggs längs skaftet i stället för tvärs över, så att de inte går att klippa till en rund kropp.", "Att klippa innan limmet har härdat, så att bitarna lossnar."],
  },
  "woven-body": {
    name: "Vävda kroppar",
    summary: "Två chenilletrådar som vävs längs skaftet, den ena färgen på ryggen och den andra på buken.",
    how: `Bind in båda vid krokböjen, den mörka på den närmre sidan och den ljusa på den bortre. Vävningen kräver båda händerna, så för fram bindtråden ur vägen och klipp av den, eller slå ett halvslag och låt den hänga där kroppen ska sluta.

För vid varje korsning den mörka bara över skaftets ovansida, från den ena sidan till den andra, och den ljusa över den och runt under skaftet. Den mörka stannar överst och den ljusa underst, och de möts i en linje längs varje sida med en kort tand av den mörka vid varje korsning. Dra båda lika hårt så att linjen blir rak. Håll framtill båda ändarna, fäst tråden igen och fäst och klipp dem.`,
    mistakes: ["Att dra hårdare i den ena tråden än i den andra, så att linjen längs sidan slingrar sig.", "Lösa korsningar, så att kroppen vrider sig runt skaftet."],
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
