export const CATEGORIES = [
  { id: "beer", name: "Øl", icon: "🍺", isDrink: true },
  { id: "cider", name: "Cider", icon: "🍏", isDrink: true },
  { id: "wine", name: "Vin", icon: "🍷", isDrink: true },
  { id: "cocktail", name: "Cocktails", icon: "🍸", isDrink: true },
  { id: "shot", name: "Shots", icon: "🥃", isDrink: true },
  // Non-drink events are logged under the "Andet" category but excluded from drink stats.
  { id: "other", name: "Andet", icon: "🌀", isDrink: false },
];

export const CATEGORY_THEMES = {
  beer: {
    gradient: "linear-gradient(135deg, rgba(249, 217, 118, 0.75), rgba(243, 159, 134, 0.75))",
  },
  cider: {
    gradient: "linear-gradient(135deg, rgba(168, 224, 99, 0.75), rgba(86, 171, 47, 0.75))",
  },
  wine: {
    gradient: "linear-gradient(135deg, rgba(215, 109, 119, 0.75), rgba(58, 28, 113, 0.75))",
  },
  cocktail: {
    gradient: "linear-gradient(135deg, rgba(251, 215, 134, 0.75), rgba(198, 255, 221, 0.75))",
  },
  shot: {
    gradient: "linear-gradient(135deg, rgba(242, 153, 74, 0.75), rgba(242, 201, 76, 0.75))",
  },
  other: {
    gradient: "linear-gradient(135deg, rgba(146, 168, 209, 0.75), rgba(99, 102, 241, 0.75))",
  },
};

export const FALLBACK_THEME = {
  gradient: "linear-gradient(135deg, rgba(246, 211, 101, 0.75), rgba(253, 160, 133, 0.75))",
};

export const DEFAULT_VARIANTS = {
  beer: [
    { name: "Pilsner", description: "Let i kroppen med floral bitterhed." },
    { name: "Lager", description: "Ren og sprød gylden øl." },
    { name: "Classic", description: "Balanceret favorit med maltsødme." },
    { name: "IPA", description: "Humlet med citrus- og blomsternoter." },
    { name: "Hvede Øl", description: "Uklar hvedeøl med banan og nellike." },
    { name: "Blanc", description: "Hvedeøl i belgisk stil med citrus og krydderi." },
    { name: "Stout", description: "Mørke ristede malte med strejf af chokolade." },
    { name: "Guinness", description: "Ikonisk irsk stout med cremet skum." },
    { name: "Sour", description: "Syrlig ale med livlig syre." },
  ],
  cider: [
    { name: "Apple", description: "Klassisk æblecider med frisk syrlighed." },
    { name: "Pear", description: "Blød, saftig pæresødme." },
    { name: "Strawberry", description: "Sommerlig sødme med frugtig finish." },
    { name: "Mixed Berries", description: "Blend af bær med livlig farve." },
    { name: "Elderflower", description: "Blomstrende twist med let brus." },
  ],
  wine: [
    { name: "Red", description: "Dybe, fløjlsbløde noter af mørke frugter." },
    { name: "White", description: "Lys, sprød afslutning med citrus." },
    { name: "Rosé", description: "Tør rosé perfekt til solrige dage." },
    { name: "Sparkling", description: "Bobler med festligt flair." },
    { name: "Gløgg", description: "Varm krydret vin til hyggelige aftener." },
    { name: "Orange", description: "Skinkontakt-hvidvin med markant karakter." },
  ],
  cocktail: [
    { name: "Gin & Tonic", description: "Botanisk gin balanceret med tonic." },
    { name: "Mojito", description: "Rom, mynte og lime over knust is." },
    { name: "Espresso Martini", description: "Espresso rystet med vodka og likør." },
    { name: "Smirnoff Ice", description: "Vodkadrik med citruskick." },
    { name: "Dark 'n Stormy", description: "Mørk rom og ginger beer med bid." },
    { name: "White Russian", description: "Vodka, kaffelikør og fløde." },
    { name: "Vermouth Tonic", description: "Aperitif serveret langt med tonic." },
  ],
  shot: [
    { name: "Tequila", description: "Serveres med salt og lime." },
    { name: "Fisk", description: "Nordisk lakridsshot med mentol." },
    { name: "Jägermeister", description: "Urte-likør serveret iskold." },
    { name: "Bailey", description: "Cremet irsk likør i et hurtigt skud." },
    { name: "Snaps", description: "Traditionel akvavit bedst iskold." },
    { name: "Gammel Dansk", description: "Bitter urtelikør fra Danmark." },
  ],
  other: [
    { name: "Cigaret", description: "Hold styr på smøgerne uden at tælle dem som drinks." },
    { name: "Toiletbesøg", description: "Log pauser uden at påvirke promille og stats." },
    { name: "Vand", description: "Husk at drik vand!" },
  ],
};


export const CATEGORY_IDS = CATEGORIES.map((category) => category.id);
export const NON_DRINK_CATEGORY_IDS = CATEGORIES.filter((category) => category.isDrink === false).map(
  (category) => category.id
);
export const DRINK_CATEGORIES = CATEGORIES.filter((category) => category.isDrink !== false);
export const DRINK_CATEGORY_IDS = DRINK_CATEGORIES.map((category) => category.id);
export const DRINK_CATEGORY_ID_SET = new Set(DRINK_CATEGORY_IDS);
export const NON_DRINK_CATEGORY_ID_SET = new Set(NON_DRINK_CATEGORY_IDS);

