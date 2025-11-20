import { useState } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import Card from "../components/Card";
import Page from "../components/Page";
import { db } from "../firebase";
import { useAuth } from "../hooks/useAuth";
import { isAdminUser } from "../config/admin";

const DRINK_CATEGORIES = [
  { value: "beer", label: "Beer" },
  { value: "cider", label: "Cider" },
  { value: "wine", label: "Wine" },
  { value: "cocktail", label: "Cocktails" },
  { value: "shot", label: "Shots" },
];

const initialVariationState = {
  name: "",
  category: DRINK_CATEGORIES[0].value,
  emoji: "",
  color: "",
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
        Dismiss
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

  const handleVariationSubmit = async (event) => {
    event.preventDefault();
    setVariationFeedback(null);

    if (!currentUser || !isAdmin) {
      setVariationFeedback({
        status: "error",
        message: "You must be signed in as the admin to create variations.",
      });
      return;
    }

    if (!variationForm.name.trim()) {
      setVariationFeedback({
        status: "error",
        message: "Name is required.",
      });
      return;
    }

    setIsSavingVariation(true);
    try {
      await addDoc(collection(db, "drinkVariations"), {
        name: variationForm.name.trim(),
        category: variationForm.category,
        type: variationForm.category,
        emoji: variationForm.emoji.trim() || null,
        color: variationForm.color.trim() || null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: currentUser?.uid ?? null,
      });

      setVariationFeedback({
        status: "success",
        message: "Drink variation created.",
      });
      setVariationForm(initialVariationState);
    } catch (error) {
      console.error("Failed to create drink variation", error);
      setVariationFeedback({
        status: "error",
        message: error.message || "Could not create variation.",
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
        message: "You must be signed in as the admin to create channels.",
      });
      return;
    }

    if (!channelForm.name.trim()) {
      setChannelFeedback({
        status: "error",
        message: "Channel name is required.",
      });
      return;
    }

    if (!channelForm.code.trim()) {
      setChannelFeedback({
        status: "error",
        message: "Channel code is required.",
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
        message: "Channel created.",
      });
      setChannelForm(initialChannelState);
    } catch (error) {
      console.error("Failed to create channel", error);
      setChannelFeedback({
        status: "error",
        message: error.message || "Could not create channel.",
      });
    } finally {
      setIsSavingChannel(false);
    }
  };

  return (
    <Page title="Admin Portal">
      <div className="flex flex-col gap-6">
        <section className="space-y-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
              Drink Variations
            </div>
            <p className="text-sm text-[color:var(--muted)]">
              Add new drink variations for everyone to use.
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
                  Name
                </label>
                <input
                  type="text"
                  value={variationForm.name}
                  onChange={handleVariationChange("name")}
                  placeholder="e.g. IPA"
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
                  Category
                </label>
                <select
                  value={variationForm.category}
                  onChange={handleVariationChange("category")}
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
              <div className="flex gap-3">
                <div className="flex-1 space-y-2">
                  <label className="text-xs font-medium uppercase tracking-wide text-[color:var(--muted)]">
                    Emoji
                  </label>
                  <input
                    type="text"
                    value={variationForm.emoji}
                    onChange={handleVariationChange("emoji")}
                    placeholder="🍺"
                    className="w-full rounded-2xl border px-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[color:var(--brand,#FF385C)] focus:ring-offset-1"
                    style={{
                      borderColor: "var(--line)",
                      backgroundColor: "var(--subtle)",
                      color: "var(--ink)",
                      "--tw-ring-offset-color": "var(--bg)",
                    }}
                  />
                </div>
                <div className="flex-1 space-y-2">
                  <label className="text-xs font-medium uppercase tracking-wide text-[color:var(--muted)]">
                    Accent Color
                  </label>
                  <input
                    type="text"
                    value={variationForm.color}
                    onChange={handleVariationChange("color")}
                    placeholder="from-amber-400 to-orange-500"
                    className="w-full rounded-2xl border px-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[color:var(--brand,#FF385C)] focus:ring-offset-1"
                    style={{
                      borderColor: "var(--line)",
                      backgroundColor: "var(--subtle)",
                      color: "var(--ink)",
                      "--tw-ring-offset-color": "var(--bg)",
                    }}
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={isSavingVariation}
                className="w-full rounded-2xl bg-[color:var(--brand,#FF385C)] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSavingVariation ? "Saving..." : "Create variation"}
              </button>
            </form>
          </Card>
        </section>

        <section className="space-y-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
              Channels
            </div>
            <p className="text-sm text-[color:var(--muted)]">
              Spin up new channels. Membership logic comes later.
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
                  Name
                </label>
                <input
                  type="text"
                  value={channelForm.name}
                  onChange={handleChannelChange("name")}
                  placeholder="e.g. CPH Friday Bar"
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
                  Code
                </label>
                <input
                  type="text"
                  value={channelForm.code}
                  onChange={handleChannelChange("code")}
                  placeholder="e.g. FRI-9024"
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
                  Description (optional)
                </label>
                <textarea
                  value={channelForm.description}
                  onChange={handleChannelChange("description")}
                  rows={3}
                  placeholder="What is this channel for?"
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
                {isSavingChannel ? "Saving..." : "Create channel"}
              </button>
            </form>
          </Card>
        </section>
      </div>
    </Page>
  );
}

