export const CATEGORIES = [
  { id: "beer", name: "Beer", icon: "🍺" },
  { id: "cider", name: "Cider", icon: "🍏" },
  { id: "wine", name: "Wine", icon: "🍷" },
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
    { name: "Lager", description: "Clean and crisp golden brew." },
    { name: "Classic", description: "Balanced malt-forward favorite." },
    { name: "IPA", description: "Hoppy with citrus and floral notes." },
    { name: "Stout", description: "Dark roasted malts with chocolate hints." },
    { name: "Guinness", description: "Iconic Irish stout with creamy head." },
    { name: "Pilsner", description: "Light-bodied with floral bitterness." },
    { name: "Hvede Øl", description: "Cloudy wheat beer with banana and clove." },
    { name: "Sour", description: "Tart ale with lively acidity." },
    { name: "Blanc", description: "Belgian-style wit with citrus spice." },
  ],
  cider: [
    { name: "Apple", description: "Classic apple cider with bright tartness." },
    { name: "Pear", description: "Gentle, juicy pear sweetness." },
    { name: "Mixed Berries", description: "Blend of berries with vibrant color." },
    { name: "Elderflower", description: "Floral twist with soft sparkle." },
    { name: "Strawberry", description: "Summer-sweet with a fruity finish." },
  ],
  wine: [
    { name: "Red", description: "Deep, velvety notes of dark fruit." },
    { name: "White", description: "Bright, crisp finish with citrus hints." },
    { name: "Rosé", description: "Dry pink wine perfect for sunny days." },
    { name: "Sparkling", description: "Effervescent bubbles with festive flair." },
    { name: "Gløgg", description: "Warm spiced wine for cosy evenings." },
    { name: "Orange", description: "Skin-contact white with bold character." },
  ],
  cocktail: [
    { name: "Mojito", description: "Rum, mint and lime over crushed ice." },
    { name: "Smirnoff Ice", description: "Vodka cooler with citrus zing." },
    { name: "Gin & Tonic", description: "Botanical gin balanced with tonic." },
    { name: "Dark 'n Stormy", description: "Dark rum and ginger beer kick." },
    { name: "White Russian", description: "Vodka, coffee liqueur and cream." },
    { name: "Espresso Martini", description: "Espresso shaken with vodka and liqueur." },
    { name: "Vermouth Tonic", description: "Aperitif served long with tonic." },
  ],
  shot: [
    { name: "Tequila", description: "Served with salt and lime wedge." },
    { name: "Jägermeister", description: "Herbal liqueur served ice cold." },
    { name: "Fisk", description: "Nordic licorice shot with menthol." },
    { name: "Bailey", description: "Creamy Irish liqueur in a quick sip." },
    { name: "Gammel Dansk", description: "Bitter herbal classic from Denmark." },
    { name: "Snaps", description: "Traditional aquavit best served chilled." },
  ],
};

export const CATEGORY_IDS = CATEGORIES.map((category) => category.id);

