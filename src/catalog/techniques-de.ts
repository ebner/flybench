import type { TechniqueTexts } from "./techniques";

/** The techniques in German: a draft until reviewed. */
export const TECHNIQUES_DE: TechniqueTexts = {
  "attach-thread": {
    name: "Faden anlegen",
    summary: "Den Bindefaden mit einem Klemmknoten am blanken Haken anlegen.",
    how: `Halte das Fadenende über und hinter dem Haken, den Bobbin darunter. Lege den Faden an den Hakenschenkel und wickle ihn drei- oder viermal von dir weg über sich selbst, in Richtung Hakenbogen. Die Windungen binden das Fadenende ein und klemmen sich selbst fest: Das ist der Klemmknoten.

Schneide das Fadenende knapp ab, und du hast eine feste Grundlage zum Einbinden.`,
    mistakes: ["Zu dir hin wickeln: Die Windungen rutschen, statt sich festzuklemmen.", "Zu wenige Windungen, sodass sich der Faden um den Hakenschenkel dreht."],
  },
  "thread-base": {
    name: "Fadenunterlage wickeln",
    summary: "Dichte Windungen Bindefaden entlang des Hakenschenkels, damit die Materialien halten und der Körper glatt wird.",
    how: `Wickle den Faden mit gleichmäßiger Spannung in Windungen, die sich gerade berühren, entlang des Hakenschenkels. Lass den Bobbin ein paar Zentimeter unter dem Haken hängen: Ein kurzer Faden lässt sich leichter platzieren.

Eine glatte Unterlage ist wichtig: Jede Unebenheit darin zeichnet sich durch einen schlanken Körper ab.`,
    mistakes: ["Lücken oder überlappende Windungen, die einen klumpigen Körper ergeben.", "An einer Stelle zu viel Faden aufbauen."],
  },
  "tie-in": {
    name: "Material einbinden",
    summary: "Ein Material mit festen Fadenwindungen am Haken befestigen: die weiche Schlaufe (Pinch Wrap).",
    how: `Halte das Material oben auf dem Hakenschenkel. Führe den Faden zwischen Daumen und Material nach oben, über das Material hinweg und zwischen Finger und Material wieder nach unten, sodass sich die Schlaufe von oben schließt. Ziehe senkrecht nach unten fest.

Das Material bleibt oben, statt auf die abgewandte Seite zu rollen. Zwei oder drei weitere Windungen sichern es.`,
    mistakes: ["Mit lockeren Windungen einbinden, sodass sich das Material um den Hakenschenkel dreht.", "Zu viele Windungen, die unnötig auftragen."],
  },
  tail: {
    name: "Schwänze und Tags",
    summary: "Ein Büschel Fibern oder Garn, am Hakenbogen eingebunden, das nach hinten absteht.",
    how: `Miss die Länge am Haken ab, bevor du einbindest. Halte das Büschel am Beginn des Hakenbogens oben auf den Hakenschenkel, mache zwei lockere Windungen und ziehe dann mit einer weichen Schlaufe fest.

Binde die Enden entlang des Schenkels zum Öhr hin fest und schneide sie dort ab, wo der Körper sie bedecken wird, damit der Körper gleichmäßig bleibt.`,
    mistakes: ["Schwänze, die auf die abgewandte Seite des Hakenschenkels rollen.", "Zu lang: Die Fliege landet schief, und die Fische zupfen am Schwanz."],
  },
  dubbing: {
    name: "Einen Körper dubben",
    summary: "Fell auf den Faden drehen und zu einem flauschigen Körper winden.",
    how: `Nimm ein wenig Dubbing, viel weniger, als du denkst, und zupfe die Fasern auseinander, damit sie locker liegen. Drücke es an den Faden und drehe es zwischen Daumen und Finger nur in eine Richtung, sodass es sich als schlanke Rolle um den Faden festzieht.

Winde die Rolle in dichten Windungen nach vorn. Gib nach vorn hin etwas mehr dazu, damit der Körper konisch wird.`,
    mistakes: ["Zu viel Dubbing, das einen dicken, formlosen Körper ergibt.", "Hin und her drehen, wodurch sich die Rolle wieder lockert."],
  },
  "herl-body": {
    name: "Körper aus Pfauengras",
    summary: "Pfauengras winden, um einen bronzegrünen, flauschigen Körper zu formen.",
    how: `Binde zwei oder drei Stränge Pfauengras an den Spitzen ein und winde sie gemeinsam in dichten Windungen nach vorn. Für einen haltbareren Körper verdrehe sie vorher mit dem Faden zu einem Seil.

Achte beim Winden darauf, dass der Flaum (die feinen Härchen) nach hinten zeigt, damit er absteht.`,
    mistakes: ["Einzelne Stränge winden: Sie reißen leicht.", "Den Flaum mit der nächsten Windung plattdrücken."],
  },
  ribbing: {
    name: "Rippung",
    summary: "Offene Windungen aus Draht, Tinsel oder Faden über dem Körper: für Segmentierung und Haltbarkeit.",
    how: `Binde die Rippung am Hakenbogen ein, bevor du den Körper formst. Ist der Körper fertig, winde die Rippung in gleichmäßig offenen Windungen nach vorn, gegenläufig zum Körper, wenn sie ihn schützen soll.

Binde sie vorn ab und schneide den Überstand ab.`,
    mistakes: ["Ungleichmäßige Abstände.", "In derselben Richtung wie der Körper winden, sodass die Rippung darin versinkt."],
  },
  "wound-body": {
    name: "Gewickelte Körper",
    summary: "Körper aus Floss, Tinsel, Chenille oder Fibern, in dichten Windungen gewickelt.",
    how: `Binde das Material am Hakenbogen ein und führe den Faden nach vorn bis dorthin, wo der Körper endet. Winde das Material in dichten oder leicht überlappenden Windungen nach vorn und halte es dabei flach und unverdreht.

Binde es dort ab, wo der Faden hängt, und schneide den Überstand ab.`,
    mistakes: ["Floss oder Tinsel sich zu einer Kordel verdrehen lassen.", "Lücken zwischen den Windungen."],
  },
  "hackle-collar": {
    name: "Hechelkragen winden",
    summary: "Eine Hechel, in dichten Windungen hinter dem Öhr gewunden, sodass die Fibern rundum abstehen.",
    how: `Binde die Hechel am abgestreiften Kiel ein, die glänzende Seite zu dir. Fasse die Spitze mit der Hechelklemme und winde sie nach vorn, jede Windung direkt vor die vorige, ohne die schon gewundenen Fibern einzuklemmen.

Binde sie mit ein paar festen Windungen ab und schneide die Spitze ab.`,
    mistakes: ["Über frühere Windungen winden und die Fibern plattdrücken.", "Eine Hechel, die für den Haken zu lang oder zu kurz ist: Prüfe vorher die Fiberlänge."],
  },
  palmering: {
    name: "Palmern",
    summary: "Eine Hechel in offenen Windungen über den Körper winden, oft von der Rippung gesichert.",
    how: `Eine Körperhechel lässt sich in beide Richtungen über den Körper winden.

Nach vorn: Binde die Hechel am hinteren Ende des Körpers ein und forme den Körper. Winde die Hechel in gleichmäßig offenen Windungen darüber nach vorn und binde sie vorn ab wie einen Kragen.

Zurück: Binde die Hechel am vorderen Ende des Körpers ein, winde sie in offenen Windungen zurück zum Hakenbogen und halte die Spitze dort mit der Hechelklemme fest. Winde dann die Rippung durch die Hechel nach vorn und bewege sie dabei hin und her, damit sie keine Fibern einklemmt. Die erste Windung der Rippung hält die Hechelspitze fest; schneide die Spitze danach ab.`,
    mistakes: ["Fibern unter der Rippung einklemmen.", "Zu enge Windungen, sodass die Hechel den Körper verdeckt."],
  },
  "soft-hackle": {
    name: "Weiche Hecheln",
    summary: "Ein oder zwei Windungen einer weichen Feder wie Rebhuhn, die sich nach hinten über den Körper legen.",
    how: `Bereite die Feder vor, indem du den Flaum an ihrem Ansatz abstreifst. Binde sie an der Spitze oder am Kiel ein und mache höchstens zwei Windungen: Soft-Hackle-Fliegen sollen spärlich aussehen.

Streiche die Fibern beim Abbinden nach hinten, damit sie sich über den Körper legen.`,
    mistakes: ["Zu viele Windungen, die den Körper verdecken und der Fliege das Spiel nehmen.", "Fibern, die viel länger als der Haken sind."],
  },
  parachute: {
    name: "Parachute-Hecheln",
    summary: "Eine Hechel, waagerecht um einen aufrechten Post gewunden, sodass die Fliege tief im Oberflächenfilm sitzt.",
    how: `Binde den Post aufrecht ein und versteife seinen Ansatz mit ein paar Fadenwindungen, die an ihm hinauf- und wieder hinunterlaufen. Binde die Hechel dicht am Post ein und winde sie um den Post, jede Windung unter die vorige.

Halte die Hechel aus dem Weg und binde sie mit ein paar Windungen unter den Fibern am Hakenschenkel ab.`,
    mistakes: ["Ein schlaffer Post: Die Hechel rutscht ab.", "Beim Abbinden Fibern einklemmen."],
  },
  "wing-post": {
    name: "Aufrechte Flügel und Posts",
    summary: "Flügel oder ein Post, die vom Hakenschenkel aufragen, für Sichtbarkeit und Silhouette.",
    how: `Binde das Flügelmaterial so ein, dass es nach vorn über das Öhr zeigt, richte es dann auf und setze mehrere Fadenwindungen dicht davor, damit es stehen bleibt.

Für geteilte Flügel trennst du die beiden Hälften und bindest sie mit Achterwicklungen zu einem V.`,
    mistakes: ["Flügel, die nach vorn oder hinten kippen.", "Ungleiche Hälften bei einem geteilten Flügel."],
  },
  "hair-wing": {
    name: "Haarflügel",
    summary: "Ein Büschel Haar, oben als Flügel eingebunden, das sich spreizt, wenn der Faden sich festzieht.",
    how: `Schneide ein kleines Büschel ab, kämme die Unterwolle aus und gleiche die Spitzen im Hairstacker an. Miss ab, halte es dann oben auf den Hakenschenkel und mache zwei lockere Windungen, bevor du festziehst: Das Haar spreizt sich, sobald der Faden greift.

Schneide die Enden schräg ab (oder gerade, für einen Köcherfliegenkopf) und binde sie fest.`,
    mistakes: ["Den Hairstacker auslassen, sodass die Spitzen ausgefranst sind.", "Zu viel Haar, das nicht an seinem Platz bleibt."],
  },
  "feather-wing": {
    name: "Federflügel",
    summary: "Ganze Federn oder Federsegmente, als Flügel eingebunden.",
    how: `Für Segmente schneidest du passende Abschnitte aus einer linken und einer rechten Schwungfeder, damit sie sich in dieselbe Richtung wölben. Halte das Paar oben auf den Haken, mache eine lockere Windung und ziehe senkrecht nach unten, sodass sich die Fibern übereinander stapeln.

Ganze Federn werden am Kiel eingebunden; streife vorher den Flaum am Ansatz ab.`,
    mistakes: ["Segmente, die auseinanderklaffen: Die Schlaufe wurde nicht senkrecht nach unten gezogen.", "Ungleiche Segmente, die die Fliege verdrehen."],
  },
  beard: {
    name: "Bärte und Kehlhecheln",
    summary: "Ein kleines Büschel Fibern, unter dem Haken hinter dem Öhr eingebunden.",
    how: `Drehe den Haken um oder greife darunter, halte das Büschel unter den Hakenschenkel und sichere es mit einer weichen Schlaufe. Bei einer Nassfliege reichen die Fibern etwa bis zur Hakenspitze; ein Bart aus Haar ist bei Lachsfliegen oft kürzer und reicht etwa bis zur Hälfte.`,
    mistakes: ["Ein Bart, der zur Seite rutscht.", "Zu dick, was die Fliege aus dem Gleichgewicht bringt."],
  },
  "wing-case": {
    name: "Flügelscheiden und Rückenschilde",
    summary: "Ein Streifen, der oben über den Körper nach vorn gezogen und festgebunden wird.",
    how: `Binde das Material am hinteren Ende des Thorax ein (bei einem Rückenschild am Hakenbogen), nach hinten liegend. Forme den Thorax oder den Körper, ziehe den Streifen dann oben darüber nach vorn, halte ihn mittig und flach und binde ihn vorn mit ein paar festen Windungen ab.`,
    mistakes: ["Eine Flügelscheide, die zur Seite rutscht.", "So fest ziehen, dass der Streifen einreißt."],
  },
  "bead-head": {
    name: "Kopfperlen",
    summary: "Eine Metallperle, vor dem Faden auf den Haken geschoben, für Gewicht und Glanz.",
    how: `Schiebe die Perle mit dem kleinen Loch zuerst um den Hakenbogen bis zum Öhr. Halte sie dort, während du dahinter den Faden anlegst, und baue hinter der Perle ein paar Windungen Faden oder Draht auf, damit sie an ihrem Platz bleibt.`,
    mistakes: ["Die Perle falsch herum aufgeschoben.", "Eine Perle, die für die Bogenweite des Hakens zu groß ist."],
  },
  weighting: {
    name: "Beschweren",
    summary: "Drahtwindungen unter dem Körper, damit die Fliege sinkt.",
    how: `Wickle bleifreien Draht in dichten Windungen um die Mitte des blanken Hakenschenkels, schiebe die Windungen dann zusammen und fixiere sie mit Faden, bevor du den Körper darüber formst.`,
    mistakes: ["Eine Beschwerung, die sich auf dem Schenkel dreht: Fixiere sie mit Faden.", "Eine Beschwerung zu nah am Öhr, sodass kein Platz für den Kopf bleibt."],
  },
  eyes: {
    name: "Bleiaugen und Kettenaugen",
    summary: "Augen, mit Achterwicklungen quer über den Hakenschenkel gebunden; schwere Augen drehen die Fliege mit der Hakenspitze nach oben.",
    how: `Setze die Augen etwa ein Drittel der Schenkellänge hinter dem Öhr quer auf den Hakenschenkel. Binde sie mit Achterwicklungen in beide Richtungen fest und ziehe dann mit ein paar Windungen um ihren Ansatz alles fest. Ein Tropfen Kleber verhindert, dass sie sich verdrehen.`,
    mistakes: ["Augen zu nah am Hakenöhr.", "Augen, die sich um den Schenkel drehen."],
  },
  "spinning-hair": {
    name: "Rehhaar aufspinnen und schneiden",
    summary: "Büschel hohler Haare, um den Hakenschenkel gesponnen und zu einem Kopf geschnitten.",
    how: `Halte ein Büschel Rehhaar über den Hakenschenkel, mache zwei lockere Windungen und ziehe dann kräftig nach unten, während du loslässt: Das Haar spreizt sich und dreht sich um den Schenkel. Schiebe es mit den Fingern fest nach hinten, setze das nächste Büschel davor und mache so weiter bis zum Öhr.

Mache den Kopfknoten und schneide den Kopf dann mit einer scharfen Schere oder einer Rasierklinge in Form.`,
    mistakes: ["Zu große Büschel, die sich nicht aufspinnen lassen.", "Die Büschel nicht dicht zusammenschieben, sodass der Kopf locker bleibt."],
  },
  "tie-off": {
    name: "Abbinden",
    summary: "Ein gewundenes Material vorn mit festen Fadenwindungen sichern und den Rest abschneiden.",
    how: `Halte das Material dort, wo der Faden hängt, oben auf den Hakenschenkel und mache drei oder vier feste Windungen darüber. Schneide den Überstand knapp ab und bedecke das abgeschnittene Ende mit ein paar weiteren Windungen.`,
    mistakes: ["Abschneiden, bevor das Material gesichert ist.", "Einen Stummel stehen lassen, der sichtbar bleibt."],
  },
  "whip-finish": {
    name: "Kopfknoten",
    summary: "Der Knoten, der eine Fliege abschließt: Fadenwindungen, über eine Schlaufe aus demselben Faden gelegt.",
    how: `Lege von Hand oder mit einem Whip Finisher vier oder fünf Windungen Faden über eine Schlaufe aus demselben Faden und ziehe die Schlaufe dann zu, sodass die Windungen das Ende einklemmen. Schneide den Faden ab.

Ein Tropfen Kopflack oder Klarlack macht ihn dauerhaft.`,
    mistakes: ["Ein dicker Kopf, der das Öhr zubaut.", "Die Schlaufe zuziehen, bevor alle Windungen liegen."],
  },
};
