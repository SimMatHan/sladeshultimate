export const CATEGORIES = [
  { id: "beer", name: "Øl", icon: "🍺" },
  { id: "cider", name: "Cider", icon: "🍏" },
  { id: "wine", name: "Vin", icon: "🍷" },
  { id: "cocktail", name: "Cocktails", icon: "🍸" },
  { id: "shot", name: "Shots", icon: "🥃" },
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
};

export const FALLBACK_THEME = {
  gradient: "linear-gradient(135deg, rgba(246, 211, 101, 0.75), rgba(253, 160, 133, 0.75))",
};

export const DEFAULT_VARIANTS = {
  beer: [
    { name: "Lager", description: "Ren og sprød gylden øl." },
    { name: "Classic", description: "Balanceret favorit med maltsødme." },
    { name: "IPA", description: "Humlet med citrus- og blomsternoter." },
    { name: "Stout", description: "Mørke ristede malte med strejf af chokolade." },
    { name: "Guinness", description: "Ikonisk irsk stout med cremet skum." },
    { name: "Pilsner", description: "Let i kroppen med floral bitterhed." },
    { name: "Hvede Øl", description: "Uklar hvedeøl med banan og nellike." },
    { name: "Sour", description: "Syrlig ale med livlig syre." },
    { name: "Blanc", description: "Hvedeøl i belgisk stil med citrus og krydderi." },
  ],
  cider: [
    { name: "Apple", description: "Klassisk æblecider med frisk syrlighed." },
    { name: "Pear", description: "Blød, saftig pæresødme." },
    { name: "Mixed Berries", description: "Blend af bær med livlig farve." },
    { name: "Elderflower", description: "Blomstrende twist med let brus." },
    { name: "Strawberry", description: "Sommerlig sødme med frugtig finish." },
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
    { name: "Mojito", description: "Rom, mynte og lime over knust is." },
    { name: "Smirnoff Ice", description: "Vodkadrik med citruskick." },
    { name: "Gin & Tonic", description: "Botanisk gin balanceret med tonic." },
    { name: "Dark 'n Stormy", description: "Mørk rom og ginger beer med bid." },
    { name: "White Russian", description: "Vodka, kaffelikør og fløde." },
    { name: "Espresso Martini", description: "Espresso rystet med vodka og likør." },
    { name: "Vermouth Tonic", description: "Aperitif serveret langt med tonic." },
  ],
  shot: [
    { name: "Tequila", description: "Serveres med salt og lime." },
    { name: "Jägermeister", description: "Urte-likør serveret iskold." },
    { name: "Fisk", description: "Nordisk lakridsshot med mentol." },
    { name: "Bailey", description: "Cremet irsk likør i et hurtigt skud." },
    { name: "Gammel Dansk", description: "Bitter urtelikør fra Danmark." },
    { name: "Snaps", description: "Traditionel akvavit bedst iskold." },
  ],
};

export const CATEGORY_IDS = CATEGORIES.map((category) => category.id);

