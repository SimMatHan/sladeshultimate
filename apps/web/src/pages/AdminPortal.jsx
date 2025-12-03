import { useEffect, useMemo, useState } from "react";
import {
  collection,
  addDoc,
  serverTimestamp,
  onSnapshot,
  query,
  orderBy,
  deleteDoc,
  doc,
  updateDoc,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import Card from "../components/Card";
import Page from "../components/Page";
import { db } from "../firebase";
import { useAuth } from "../hooks/useAuth";
import { isAdminUser } from "../config/admin";
import { CATEGORIES } from "../constants/drinks";
import { resetAchievements } from "../services/userService";
import { useSladesh } from "../contexts/SladeshContext";

const DRINK_CATEGORIES = CATEGORIES.map(({ id, name }) => ({
  value: id,
  label: name,
}));

const initialVariationState = {
  name: "",
  description: "",
  categoryId: DRINK_CATEGORIES[0].value,
};

const initialChannelState = {
  name: "",
  code: "",
  description: "",
};

function FeedbackBanner({ feedback, onDismiss }) {
  if (!feedback) return null;

  const tone =
    feedback.status === "error"
      ? "border-red-200 bg-red-50 text-red-700"
      : "border-emerald-200 bg-emerald-50 text-emerald-700";

  return (
    <div
      className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-sm font-medium ${tone}`}
    >
      <span>{feedback.message}</span>
      <button
        type="button"
        onClick={onDismiss}
        className="text-xs underline decoration-dotted"
      >
        Luk
      </button>
    </div>
  );
}

export default function AdminPortal() {
  const { currentUser } = useAuth();
  const isAdmin = isAdminUser(currentUser);

  const [variationForm, setVariationForm] = useState(initialVariationState);
  const [channelForm, setChannelForm] = useState(initialChannelState);

  const [variationFeedback, setVariationFeedback] = useState(null);
  const [channelFeedback, setChannelFeedback] = useState(null);

  const [isSavingVariation, setIsSavingVariation] = useState(false);
  const [isSavingChannel, setIsSavingChannel] = useState(false);
  const [channels, setChannels] = useState([]);
  const [channelsLoading, setChannelsLoading] = useState(true);
  const [channelsError, setChannelsError] = useState(null);
  const [channelEditingId, setChannelEditingId] = useState(null);
  const [channelEditingForm, setChannelEditingForm] = useState(initialChannelState);
  const [isUpdatingChannel, setIsUpdatingChannel] = useState(false);
  const [customVariations, setCustomVariations] = useState([]);
  const [variationsLoading, setVariationsLoading] = useState(true);
  const [variationsError, setVariationsError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editingForm, setEditingForm] = useState(initialVariationState);
  const [isUpdatingVariation, setIsUpdatingVariation] = useState(false);
  const [achievementFeedback, setAchievementFeedback] = useState(null);
  const [isResettingAchievements, setIsResettingAchievements] = useState(false);
  const { debugReceiveSladesh } = useSladesh();

  const handleVariationChange = (field) => (event) => {
    setVariationForm((prev) => ({
      ...prev,
      [field]: event.target.value,
    }));
  };

  const handleChannelChange = (field) => (event) => {
    setChannelForm((prev) => ({
      ...prev,
      [field]: event.target.value,
    }));
  };

  useEffect(() => {
    const variationsRef = collection(db, "drinkVariations");
    const variationsQuery = query(variationsRef, orderBy("name"));

    const unsubscribe = onSnapshot(
      variationsQuery,
      (snapshot) => {
        setCustomVariations(
          snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data(),
          }))
        );
        setVariationsError(null);
        setVariationsLoading(false);
      },
      (error) => {
        console.error("[AdminPortal] Failed to load drink variations", error);
        setVariationsError(error.message || "Kunne ikke indlæse drinkvariationer.");
        setVariationsLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!isAdmin) {
      setChannels([]);
      setChannelsLoading(false);
      setChannelsError(null);
      return;
    }

    const channelsRef = collection(db, "channels");
    const channelsQuery = query(channelsRef, orderBy("name"));

    const unsubscribe = onSnapshot(
      channelsQuery,
      (snapshot) => {
        setChannels(
          snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data(),
          }))
        );
        setChannelsError(null);
        setChannelsLoading(false);
      },
      (error) => {
        console.error("[AdminPortal] Failed to load channels", error);
        setChannelsError(error.message || "Kunne ikke indlæse kanaler.");
        setChannelsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [isAdmin]);

  const groupedVariations = useMemo(() => {
    const groups = CATEGORIES.reduce((acc, category) => {
      acc[category.id] = [];
      return acc;
    }, {});

    customVariations.forEach((variation) => {
      if (groups[variation.categoryId]) {
        groups[variation.categoryId].push(variation);
      }
    });

    Object.values(groups).forEach((entries) => {
      entries.sort((a, b) => a.name.localeCompare(b.name));
    });

    return groups;
  }, [customVariations]);

  const startEditingVariation = (variation) => {
    setEditingId(variation.id);
    setEditingForm({
      name: variation.name ?? "",
      description: variation.description ?? "",
      categoryId: variation.categoryId ?? DRINK_CATEGORIES[0].value,
    });
  };

  const cancelEditingVariation = () => {
    setEditingId(null);
    setEditingForm(initialVariationState);
    setIsUpdatingVariation(false);
  };

  const handleEditingChange = (field) => (event) => {
    setEditingForm((prev) => ({
      ...prev,
      [field]: event.target.value,
    }));
  };

  const startEditingChannel = (channel) => {
    setChannelEditingId(channel.id);
    setChannelEditingForm({
      name: channel.name ?? "",
      code: channel.code ?? "",
      description: channel.description ?? "",
    });
  };

  const cancelEditingChannel = () => {
    setChannelEditingId(null);
    setChannelEditingForm(initialChannelState);
    setIsUpdatingChannel(false);
  };

  const handleChannelEditChange = (field) => (event) => {
    setChannelEditingForm((prev) => ({
      ...prev,
      [field]: event.target.value,
    }));
  };

  const handleUpdateVariation = async (event) => {
    event.preventDefault();

    if (!editingId) {
      return;
    }

    if (!editingForm.name.trim() || !editingForm.description.trim()) {
      setVariationFeedback({
        status: "error",
        message: "Alle felter skal udfyldes for at opdatere en variation.",
      });
      return;
    }

    setIsUpdatingVariation(true);
    try {
      await updateDoc(doc(db, "drinkVariations", editingId), {
        name: editingForm.name.trim(),
        description: editingForm.description.trim(),
        categoryId: editingForm.categoryId,
        updatedAt: serverTimestamp(),
      });
      setVariationFeedback({
        status: "success",
        message: "Drinkvariation opdateret.",
      });
      cancelEditingVariation();
    } catch (error) {
      console.error("[AdminPortal] Failed to update drink variation", {
        code: error?.code,
        message: error?.message,
        name: error?.name,
      });
      setVariationFeedback({
        status: "error",
        message: error?.message || "Kunne ikke opdatere variationen.",
      });
    } finally {
      setIsUpdatingVariation(false);
    }
  };

  const handleDeleteVariation = async (variationId) => {
    if (!variationId) return;
    if (!window.confirm("Slet denne drinkvariation?")) {
      return;
    }

    try {
      await deleteDoc(doc(db, "drinkVariations", variationId));
      setVariationFeedback({
        status: "success",
        message: "Drinkvariation slettet.",
      });
      if (editingId === variationId) {
        cancelEditingVariation();
      }
    } catch (error) {
      console.error("[AdminPortal] Failed to delete drink variation", {
        code: error?.code,
        message: error?.message,
        name: error?.name,
      });
      setVariationFeedback({
        status: "error",
        message: error?.message || "Kunne ikke slette variationen.",
      });
    }
  };

  const handleUpdateChannel = async (event) => {
    event.preventDefault();
    if (!channelEditingId) return;

    const trimmedName = channelEditingForm.name.trim();
    const trimmedCode = channelEditingForm.code.trim();
    const trimmedDescription = channelEditingForm.description.trim();

    if (!trimmedName || !trimmedCode) {
      setChannelFeedback({
        status: "error",
        message: "Navn og kode skal udfyldes for at opdatere en kanal.",
      });
      return;
    }

    setIsUpdatingChannel(true);
    try {
      await updateDoc(doc(db, "channels", channelEditingId), {
        name: trimmedName,
        code: trimmedCode,
        description: trimmedDescription || null,
        updatedAt: serverTimestamp(),
      });
      setChannelFeedback({
        status: "success",
        message: "Kanal opdateret.",
      });
      cancelEditingChannel();
    } catch (error) {
      console.error("[AdminPortal] Failed to update channel", {
        code: error?.code,
        message: error?.message,
        name: error?.name,
      });
      setChannelFeedback({
        status: "error",
        message: error?.message || "Kunne ikke opdatere kanalen.",
      });
    } finally {
      setIsUpdatingChannel(false);
    }
  };

  const handleDeleteChannel = async (channelId) => {
    if (!channelId) return;
    if (!window.confirm("Er du sikker på, at du vil slette denne kanal?")) {
      return;
    }

    try {
      await deleteDoc(doc(db, "channels", channelId));
      setChannelFeedback({
        status: "success",
        message: "Kanal slettet.",
      });
      if (channelEditingId === channelId) {
        cancelEditingChannel();
      }
    } catch (error) {
      console.error("[AdminPortal] Failed to delete channel", {
        code: error?.code,
        message: error?.message,
        name: error?.name,
      });
      setChannelFeedback({
        status: "error",
        message: error?.message || "Kunne ikke slette kanalen.",
      });
    }
  };

  const handleVariationSubmit = async (event) => {
    event.preventDefault();
    setVariationFeedback(null);

    if (!currentUser || !isAdmin) {
      setVariationFeedback({
        status: "error",
        message: "Du skal være logget ind som admin for at oprette variationer.",
      });
      return;
    }

    if (!variationForm.name.trim()) {
      setVariationFeedback({
        status: "error",
        message: "Navn er påkrævet.",
      });
      return;
    }

    if (!variationForm.description.trim()) {
      setVariationFeedback({
        status: "error",
        message: "Beskrivelse er påkrævet.",
      });
      return;
    }

    setIsSavingVariation(true);
    try {
      const authInstance = getAuth();
      const activeUser = authInstance.currentUser;
      const isAuthenticated = !!activeUser;
      console.info("[AdminPortal] Attempting to create drink variation with user:", {
        uid: activeUser?.uid,
        email: activeUser?.email,
        isAuthenticated,
      });

      const payload = {
        name: variationForm.name.trim(),
        description: variationForm.description.trim(),
        categoryId: variationForm.categoryId,
        createdAt: serverTimestamp(),
        createdBy: currentUser?.email || currentUser?.uid || null,
      };
      console.info("[AdminPortal] Writing drink variation payload", {
        collection: "drinkVariations",
        payload,
      });

      await addDoc(collection(db, "drinkVariations"), payload);
      console.info("[AdminPortal] Drink variation created", {
        name: variationForm.name.trim(),
        categoryId: variationForm.categoryId,
      });
      setVariationFeedback({
        status: "success",
        message: "Drinkvariation oprettet.",
      });
      setVariationForm(initialVariationState);
    } catch (error) {
      console.error("[AdminPortal] Failed to create drink variation", {
        code: error?.code,
        message: error?.message,
        name: error?.name,
      });
      setVariationFeedback({
        status: "error",
        message: error.message || "Kunne ikke oprette variationen.",
      });
    } finally {
      setIsSavingVariation(false);
    }
  };

  const handleChannelSubmit = async (event) => {
    event.preventDefault();
    setChannelFeedback(null);

    if (!currentUser || !isAdmin) {
      setChannelFeedback({
        status: "error",
        message: "Du skal være logget ind som admin for at oprette kanaler.",
      });
      return;
    }

    if (!channelForm.name.trim()) {
      setChannelFeedback({
        status: "error",
        message: "Kanalnavn er påkrævet.",
      });
      return;
    }

    if (!channelForm.code.trim()) {
      setChannelFeedback({
        status: "error",
        message: "Kanalkode er påkrævet.",
      });
      return;
    }

    setIsSavingChannel(true);
    try {
      await addDoc(collection(db, "channels"), {
        name: channelForm.name.trim(),
        code: channelForm.code.trim(),
        description: channelForm.description.trim() || null,
        isDefault: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: currentUser?.uid ?? null,
      });

      setChannelFeedback({
        status: "success",
        message: "Kanal oprettet.",
      });
      setChannelForm(initialChannelState);
    } catch (error) {
      console.error("Failed to create channel", error);
      setChannelFeedback({
        status: "error",
        message: error.message || "Kunne ikke oprette kanalen.",
      });
    } finally {
      setIsSavingChannel(false);
    }
  };

  const handleResetAchievements = async () => {
    if (!currentUser || !isAdmin) {
      setAchievementFeedback({
        status: "error",
        message: "Du skal være logget ind som admin.",
      });
      return;
    }

    if (!window.confirm("Er du sikker på, at du vil nulstille alle achievement-tællere? Dette kan ikke fortrydes.")) {
      return;
    }

    setIsResettingAchievements(true);
    setAchievementFeedback(null);
    try {
      await resetAchievements(currentUser.uid);
      setAchievementFeedback({
        status: "success",
        message: "Alle achievement-tællere er nulstillet.",
      });
    } catch (error) {
      console.error("[AdminPortal] Failed to reset achievements", error);
      setAchievementFeedback({
        status: "error",
        message: error.message || "Kunne ikke nulstille achievements.",
      });
    } finally {
      setIsResettingAchievements(false);
    }
  };

  return (
    <Page title="Adminportal">
      <div className="flex flex-col gap-6">
        <section className="space-y-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
              Dev Tools
            </div>
            <p className="text-sm text-[color:var(--muted)]">
              Dev-only funktioner til test og rydning.
            </p>
          </div>
          <Card className="space-y-4 px-5 py-6">
            <FeedbackBanner
              feedback={achievementFeedback}
              onDismiss={() => setAchievementFeedback(null)}
            />
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                Achievements
              </div>
              <p className="text-xs text-[color:var(--muted)]">
                Nulstil alle achievement-tællere for din bruger. Dette fjerner alle achievements og starter forfra.
              </p>
              <button
                type="button"
                onClick={handleResetAchievements}
                disabled={isResettingAchievements || !isAdmin}
                className="rounded-2xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 shadow-sm transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isResettingAchievements ? "Nulstiller..." : "Nulstil Achievement-tællere"}
              </button>
            </div>
            <div className="space-y-2 pt-4 border-t" style={{ borderColor: 'var(--line)' }}>
              <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                Sladesh Debug
              </div>
              <p className="text-xs text-[color:var(--muted)]">
                Simuler at du modtager en Sladesh for at teste flowet (overlay, timer, kamera).
              </p>
              <button
                type="button"
                onClick={debugReceiveSladesh}
                className="rounded-2xl border border-amber-200 bg-white px-4 py-2 text-sm font-semibold text-amber-600 shadow-sm transition hover:bg-amber-50"
              >
                Simuler Sladesh
              </button>
            </div>
          </Card>
        </section>

        <section className="space-y-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
              Drinkvariationer
            </div>
            <p className="text-sm text-[color:var(--muted)]">
              Tilføj nye drinkvariationer, som alle kan bruge.
            </p>
          </div>
          <Card className="space-y-4 px-5 py-6">
            <FeedbackBanner
              feedback={variationFeedback}
              onDismiss={() => setVariationFeedback(null)}
            />
            <form className="space-y-4" onSubmit={handleVariationSubmit}>
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wide text-[color:var(--muted)]">
                  Navn
                </label>
                <input
                  type="text"
                  value={variationForm.name}
                  onChange={handleVariationChange("name")}
                  placeholder="fx IPA"
                  className="w-full rounded-2xl border px-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[color:var(--brand,#FF385C)] focus:ring-offset-1"
                  style={{
                    borderColor: "var(--line)",
                    backgroundColor: "var(--subtle)",
                    color: "var(--ink)",
                    "--tw-ring-offset-color": "var(--bg)",
                  }}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wide text-[color:var(--muted)]">
                  Beskrivelse
                </label>
                <textarea
                  value={variationForm.description}
                  onChange={handleVariationChange("description")}
                  rows={3}
                  placeholder="Kort beskrivelse af drinken."
                  className="w-full rounded-2xl border px-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[color:var(--brand,#FF385C)] focus:ring-offset-1"
                  style={{
                    borderColor: "var(--line)",
                    backgroundColor: "var(--subtle)",
                    color: "var(--ink)",
                    "--tw-ring-offset-color": "var(--bg)",
                  }}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wide text-[color:var(--muted)]">
                  Kategori
                </label>
                <select
                  value={variationForm.categoryId}
                  onChange={handleVariationChange("categoryId")}
                  className="w-full rounded-2xl border px-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[color:var(--brand,#FF385C)] focus:ring-offset-1"
                  style={{
                    borderColor: "var(--line)",
                    backgroundColor: "var(--subtle)",
                    color: "var(--ink)",
                    "--tw-ring-offset-color": "var(--bg)",
                  }}
                >
                  {DRINK_CATEGORIES.map((category) => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                disabled={isSavingVariation}
                className="w-full rounded-2xl bg-[color:var(--brand,#FF385C)] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSavingVariation ? "Gemmer..." : "Opret variation"}
              </button>
            </form>
          </Card>

          <Card className="space-y-4 px-5 py-6">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                Brugerdefinerede variationer
              </div>
              {variationsLoading && (
                <span className="text-xs text-[color:var(--muted)]">Indlæser…</span>
              )}
            </div>
            {variationsError && (
              <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-xs text-red-700">
                {variationsError}
              </div>
            )}
            {!variationsLoading && customVariations.length === 0 && !variationsError && (
              <div className="rounded-2xl border border-dashed px-4 py-3 text-sm text-[color:var(--muted)]">
                Ingen brugerdefinerede variationer endnu.
              </div>
            )}
            <div className="space-y-6">
              {CATEGORIES.map((category) => {
                const items = groupedVariations[category.id] ?? [];
                if (items.length === 0) return null;

                return (
                  <div key={category.id} className="space-y-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                      {category.name}
                    </div>
                    <div className="space-y-3">
                      {items.map((variation) => {
                        const isEditing = editingId === variation.id;
                        return (
                          <div
                            key={variation.id}
                            className="rounded-2xl border px-4 py-3"
                            style={{
                              borderColor: "var(--line)",
                              backgroundColor: "var(--subtle)",
                            }}
                          >
                            {isEditing ? (
                              <form className="space-y-3" onSubmit={handleUpdateVariation}>
                                <div className="space-y-2">
                                  <label className="text-xs font-medium uppercase tracking-wide text-[color:var(--muted)]">
                                    Navn
                                  </label>
                                  <input
                                    type="text"
                                    value={editingForm.name}
                                    onChange={handleEditingChange("name")}
                                    className="w-full rounded-2xl border px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[color:var(--brand,#FF385C)] focus:ring-offset-1"
                                    style={{
                                      borderColor: "var(--line)",
                                      backgroundColor: "var(--surface)",
                                      color: "var(--ink)",
                                      "--tw-ring-offset-color": "var(--bg)",
                                    }}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <label className="text-xs font-medium uppercase tracking-wide text-[color:var(--muted)]">
                                    Beskrivelse
                                  </label>
                                  <textarea
                                    value={editingForm.description}
                                    onChange={handleEditingChange("description")}
                                    rows={3}
                                    className="w-full rounded-2xl border px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[color:var(--brand,#FF385C)] focus:ring-offset-1"
                                    style={{
                                      borderColor: "var(--line)",
                                      backgroundColor: "var(--surface)",
                                      color: "var(--ink)",
                                      "--tw-ring-offset-color": "var(--bg)",
                                    }}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <label className="text-xs font-medium uppercase tracking-wide text-[color:var(--muted)]">
                                    Kategori
                                  </label>
                                  <select
                                    value={editingForm.categoryId}
                                    onChange={handleEditingChange("categoryId")}
                                    className="w-full rounded-2xl border px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[color:var(--brand,#FF385C)] focus:ring-offset-1"
                                    style={{
                                      borderColor: "var(--line)",
                                      backgroundColor: "var(--surface)",
                                      color: "var(--ink)",
                                      "--tw-ring-offset-color": "var(--bg)",
                                    }}
                                  >
                                    {DRINK_CATEGORIES.map((option) => (
                                      <option key={option.value} value={option.value}>
                                        {option.label}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    onClick={cancelEditingVariation}
                                    className="flex-1 rounded-2xl border px-4 py-2 text-sm font-semibold text-[color:var(--muted)] hover:text-[color:var(--ink)]"
                                    style={{ borderColor: "var(--line)" }}
                                    disabled={isUpdatingVariation}
                                  >
                                    Annuller
                                  </button>
                                  <button
                                    type="submit"
                                    disabled={isUpdatingVariation}
                                    className="flex-1 rounded-2xl bg-[color:var(--brand,#FF385C)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition disabled:opacity-60"
                                  >
                                    {isUpdatingVariation ? "Gemmer..." : "Gem"}
                                  </button>
                                </div>
                              </form>
                            ) : (
                              <div className="flex flex-col gap-3">
                                <div className="flex items-center justify-between gap-3">
                                  <div>
                                    <div className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
                                      {variation.name}
                                    </div>
                                    <div className="mt-1 text-xs text-[color:var(--muted)]">
                                      {variation.description}
                                    </div>
                                  </div>
                                  <span className="rounded-full bg-white/60 px-3 py-1 text-xs font-semibold text-[color:var(--muted)]">
                                    {category.name}
                                  </span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={() => startEditingVariation(variation)}
                                    className="rounded-2xl border px-3 py-1 text-xs font-semibold text-[color:var(--muted)] hover:text-[color:var(--ink)]"
                                    style={{ borderColor: "var(--line)" }}
                                  >
                                    Redigér
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteVariation(variation.id)}
                                    className="rounded-2xl border border-red-200 px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                                  >
                                    Slet
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </section >

        <section className="space-y-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
              Kanaler
            </div>
            <p className="text-sm text-[color:var(--muted)]">
              Opret nye kanaler. Medlemslogik kommer senere.
            </p>
          </div>
          <Card className="space-y-4 px-5 py-6">
            <FeedbackBanner
              feedback={channelFeedback}
              onDismiss={() => setChannelFeedback(null)}
            />
            <form className="space-y-4" onSubmit={handleChannelSubmit}>
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wide text-[color:var(--muted)]">
                  Navn
                </label>
                <input
                  type="text"
                  value={channelForm.name}
                  onChange={handleChannelChange("name")}
                  required
                  placeholder="fx CPH Friday Bar"
                  className="w-full rounded-2xl border px-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[color:var(--brand,#FF385C)] focus:ring-offset-1"
                  style={{
                    borderColor: "var(--line)",
                    backgroundColor: "var(--subtle)",
                    color: "var(--ink)",
                    "--tw-ring-offset-color": "var(--bg)",
                  }}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wide text-[color:var(--muted)]">
                  Kode
                </label>
                <input
                  type="text"
                  value={channelForm.code}
                  onChange={handleChannelChange("code")}
                  required
                  placeholder="fx FRI-9024"
                  className="w-full rounded-2xl border px-4 py-3 text-sm font-semibold uppercase tracking-[0.2em] focus:outline-none focus:ring-2 focus:ring-[color:var(--brand,#FF385C)] focus:ring-offset-1"
                  style={{
                    borderColor: "var(--line)",
                    backgroundColor: "var(--subtle)",
                    color: "var(--ink)",
                    "--tw-ring-offset-color": "var(--bg)",
                  }}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wide text-[color:var(--muted)]">
                  Beskrivelse (valgfri)
                </label>
                <textarea
                  value={channelForm.description}
                  onChange={handleChannelChange("description")}
                  rows={3}
                  placeholder="Hvad bruges denne kanal til?"
                  className="w-full rounded-2xl border px-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[color:var(--brand,#FF385C)] focus:ring-offset-1"
                  style={{
                    borderColor: "var(--line)",
                    backgroundColor: "var(--subtle)",
                    color: "var(--ink)",
                    "--tw-ring-offset-color": "var(--bg)",
                  }}
                />
              </div>
              <button
                type="submit"
                disabled={isSavingChannel}
                className="w-full rounded-2xl bg-[color:var(--brand,#FF385C)] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSavingChannel ? "Gemmer..." : "Opret kanal"}
              </button>
            </form>
          </Card>

          {isAdmin && (
            <Card className="space-y-4 px-5 py-6">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                  Alle kanaler
                </div>
                {channelsLoading && (
                  <span className="text-xs text-[color:var(--muted)]">Indlæser…</span>
                )}
              </div>
              {channelsError && (
                <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-xs text-red-700">
                  {channelsError}
                </div>
              )}
              {!channelsLoading && channels.length === 0 && !channelsError && (
                <div className="rounded-2xl border border-dashed px-4 py-3 text-sm text-[color:var(--muted)]">
                  Ingen kanaler endnu.
                </div>
              )}
              <div className="space-y-3">
                {channels.map((channel) => {
                  const isEditing = channelEditingId === channel.id;
                  return (
                    <div
                      key={channel.id}
                      className="rounded-2xl border px-4 py-3"
                      style={{
                        borderColor: "var(--line)",
                        backgroundColor: "var(--subtle)",
                      }}
                    >
                      {isEditing ? (
                        <form className="space-y-3" onSubmit={handleUpdateChannel}>
                          <div className="space-y-2">
                            <label className="text-xs font-medium uppercase tracking-wide text-[color:var(--muted)]">
                              Navn
                            </label>
                            <input
                              type="text"
                              value={channelEditingForm.name}
                              onChange={handleChannelEditChange("name")}
                              required
                              className="w-full rounded-2xl border px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[color:var(--brand,#FF385C)] focus:ring-offset-1"
                              style={{
                                borderColor: "var(--line)",
                                backgroundColor: "var(--surface)",
                                color: "var(--ink)",
                                "--tw-ring-offset-color": "var(--bg)",
                              }}
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-medium uppercase tracking-wide text-[color:var(--muted)]">
                              Kode
                            </label>
                            <input
                              type="text"
                              value={channelEditingForm.code}
                              onChange={handleChannelEditChange("code")}
                              required
                              className="w-full rounded-2xl border px-3 py-2 text-sm font-semibold uppercase tracking-[0.2em] focus:outline-none focus:ring-2 focus:ring-[color:var(--brand,#FF385C)] focus:ring-offset-1"
                              style={{
                                borderColor: "var(--line)",
                                backgroundColor: "var(--surface)",
                                color: "var(--ink)",
                                "--tw-ring-offset-color": "var(--bg)",
                              }}
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-medium uppercase tracking-wide text-[color:var(--muted)]">
                              Beskrivelse
                            </label>
                            <textarea
                              value={channelEditingForm.description}
                              onChange={handleChannelEditChange("description")}
                              rows={3}
                              className="w-full rounded-2xl border px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[color:var(--brand,#FF385C)] focus:ring-offset-1"
                              style={{
                                borderColor: "var(--line)",
                                backgroundColor: "var(--surface)",
                                color: "var(--ink)",
                                "--tw-ring-offset-color": "var(--bg)",
                              }}
                            />
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={cancelEditingChannel}
                              className="flex-1 rounded-2xl border px-4 py-2 text-sm font-semibold text-[color:var(--muted)] hover:text-[color:var(--ink)]"
                              style={{ borderColor: "var(--line)" }}
                              disabled={isUpdatingChannel}
                            >
                              Annuller
                            </button>
                            <button
                              type="submit"
                              disabled={isUpdatingChannel}
                              className="flex-1 rounded-2xl bg-[color:var(--brand,#FF385C)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition disabled:opacity-60"
                            >
                              {isUpdatingChannel ? "Gemmer..." : "Gem"}
                            </button>
                          </div>
                        </form>
                      ) : (
                        <div className="flex flex-col gap-3">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
                                {channel.name}
                              </div>
                              <div className="mt-1 text-xs font-semibold uppercase tracking-[0.3em]" style={{ color: "var(--muted)" }}>
                                {channel.code}
                              </div>
                              {channel.description && (
                                <div className="mt-1 text-xs text-[color:var(--muted)]">
                                  {channel.description}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {channel.isDefault && (
                                <span className="rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                                  Standard
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => startEditingChannel(channel)}
                              className="rounded-2xl border px-3 py-1 text-xs font-semibold text-[color:var(--muted)] hover:text-[color:var(--ink)]"
                              style={{ borderColor: "var(--line)" }}
                            >
                              Redigér
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteChannel(channel.id)}
                              className="rounded-2xl border border-red-200 px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                            >
                              Slet
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </section>
      </div >
    </Page >
  );
}

