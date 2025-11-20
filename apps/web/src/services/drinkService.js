import { collection, getDocs, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../firebase";
import { CATEGORIES, CATEGORY_IDS, DEFAULT_VARIANTS } from "../constants/drinks";

const drinkVariationsRef = collection(db, "drinkVariations");
const categorySet = new Set(CATEGORY_IDS);

function normalizeVariantDoc(docSnapshot) {
  const data = docSnapshot.data() || {};
  const name = data.name?.trim();
  const description = data.description?.trim() ?? "";
  const categoryId = data.categoryId;

  if (!name || !categorySet.has(categoryId)) {
    return null;
  }

  return {
    id: docSnapshot.id,
    name,
    description,
    categoryId,
    isCustom: true,
  };
}

function groupCustomVariants(docs) {
  return docs.reduce((acc, docSnapshot) => {
    const variant = normalizeVariantDoc(docSnapshot);
    if (!variant) return acc;

    if (!acc[variant.categoryId]) {
      acc[variant.categoryId] = [];
    }

    acc[variant.categoryId].push({
      id: variant.id,
      name: variant.name,
      description: variant.description,
      isCustom: true,
    });

    return acc;
  }, {});
}

function mergeWithDefaults(customGrouped) {
  return CATEGORIES.reduce((acc, category) => {
    const base = DEFAULT_VARIANTS[category.id] ?? [];
    const custom = customGrouped[category.id] ?? [];
    acc[category.id] = [...base, ...custom];
    return acc;
  }, {});
}

export async function fetchDrinkVariantsOnce() {
  const q = query(drinkVariationsRef, orderBy("createdAt", "asc"));
  const snapshot = await getDocs(q);
  const grouped = groupCustomVariants(snapshot.docs);
  return mergeWithDefaults(grouped);
}

export function subscribeToDrinkVariants(onChange, onError) {
  const q = query(drinkVariationsRef, orderBy("createdAt", "asc"));
  return onSnapshot(
    q,
    (snapshot) => {
      const grouped = groupCustomVariants(snapshot.docs);
      onChange(mergeWithDefaults(grouped));
    },
    (error) => {
      onError?.(error);
    }
  );
}

