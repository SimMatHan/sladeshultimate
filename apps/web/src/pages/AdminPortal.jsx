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
  getDocs,
  where,
  setDoc,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import Card from "../components/Card";
import Page from "../components/Page";
import { db } from "../firebase";
import { useAuth } from "../hooks/useAuth";
import { useLocation } from "../contexts/LocationContext";
import { IS_DEVELOPMENT, API_BASE_URL } from "../config/env";
import { isAdminUser } from "../config/admin";
import { CATEGORIES } from "../constants/drinks";
import { resetAchievements, resetSladeshState, getAllUsers, resetSladeshStateForUser } from "../services/userService";
import { useSladesh } from "../contexts/SladeshContext";
import { subscribeToDonors, addDonor, updateDonor, deleteDonor } from "../services/donorService";

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
  const { userLocation } = useLocation();
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
  const [sladeshFeedback, setSladeshFeedback] = useState(null);
  const [isResettingSladesh, setIsResettingSladesh] = useState(false);
  const { debugReceiveSladesh } = useSladesh();

  // Donor state
  const [donors, setDonors] = useState([]);
  const [donorsLoading, setDonorsLoading] = useState(true);
  const [donorForm, setDonorForm] = useState({ userId: "", amount: "", date: "", message: "" });
  const [donorFeedback, setDonorFeedback] = useState(null);
  const [isSavingDonor, setIsSavingDonor] = useState(false);
  const [donorEditingId, setDonorEditingId] = useState(null);
  const [donorEditingForm, setDonorEditingForm] = useState({ userId: "", amount: "", date: "", message: "" });
  const [isUpdatingDonor, setIsUpdatingDonor] = useState(false);
  const [selectedDonorUser, setSelectedDonorUser] = useState(null);

  // Stress Signal state
  const [stressSignalForm, setStressSignalForm] = useState({ channelId: "", title: "", message: "" });
  const [stressSignalFeedback, setStressSignalFeedback] = useState(null);
  const [isSendingStressSignal, setIsSendingStressSignal] = useState(false);

  // User Sladesh Management state
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [userResetFeedback, setUserResetFeedback] = useState(null);
  const [isResettingUserSladesh, setIsResettingUserSladesh] = useState(false);
  const [userSearchTerm, setUserSearchTerm] = useState("");

  // Theme Drop state
  const [themeDropForm, setThemeDropForm] = useState({ themeName: "" });
  const [themeDropFeedback, setThemeDropFeedback] = useState(null);
  const [isSendingThemeDrop, setIsSendingThemeDrop] = useState(false);

  // Stress Beacon state
  const [beaconForm, setBeaconForm] = useState({ latitude: "", longitude: "" });
  const [beaconFeedback, setBeaconFeedback] = useState(null);
  const [isCreatingBeacon, setIsCreatingBeacon] = useState(false);
  const [activeBeacons, setActiveBeacons] = useState([]);
  const [beaconsLoading, setBeaconsLoading] = useState(true);

  // Predefined theme presets
  const THEME_PRESETS = {
    winter: { name: "Vintertema", emojis: ["⛷️", "🎿", "❄️", "☃️", "🏔️"] },
    summer: { name: "Sommertema", emojis: ["☀️", "🏖️", "🌊", "🍹", "🌴"] },
    halloween: { name: "Halloween", emojis: ["🎃", "👻", "🦇", "🕷️", "💀"] },
    christmas: { name: "Julefrokost", emojis: ["🎅", "🎄", "🎁", "⭐", "🔔"] },
    party: { name: "Fest", emojis: ["🎉", "🎊", "🥳", "🎈", "✨"] }
  };

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

  // Subscribe to real-time donor updates from Firestore
  useEffect(() => {
    const unsubscribe = subscribeToDonors(
      (donorList) => {
        setDonors(donorList);
        setDonorsLoading(false);
      },
      (error) => {
        console.error('[AdminPortal] Failed to load donors', error);
        setDonorFeedback({
          status: "error",
          message: error.message || "Kunne ikke indlæse donorer.",
        });
        setDonorsLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Load all users for Sladesh management
  useEffect(() => {
    if (!isAdmin) {
      setUsers([]);
      setUsersLoading(false);
      return;
    }

    async function loadUsers() {
      try {
        const allUsers = await getAllUsers();
        setUsers(allUsers);
      } catch (error) {
        console.error('[AdminPortal] Failed to load users', error);
        setUserResetFeedback({
          status: "error",
          message: error.message || "Kunne ikke indlæse brugere.",
        });
      } finally {
        setUsersLoading(false);
      }
    }

    loadUsers();
  }, [isAdmin]);

  // Load active beacons
  useEffect(() => {
    loadActiveBeacons();
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
        message: "Du skal vaere logget ind som admin.",
      });
      return;
    }

    if (!window.confirm("Er du sikker paa, at du vil nulstille alle achievement-taellere? Dette kan ikke fortrydes.")) {
      return;
    }

    setIsResettingAchievements(true);
    setAchievementFeedback(null);
    try {
      await resetAchievements(currentUser.uid);
      setAchievementFeedback({
        status: "success",
        message: "Alle achievement-taellere er nulstillet.",
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

  const handleResetSladesh = async () => {
    if (!currentUser || !isAdmin) {
      setSladeshFeedback({
        status: "error",
        message: "Du skal vaere logget ind som admin.",
      });
      return;
    }

    setIsResettingSladesh(true);
    setSladeshFeedback(null);
    try {
      await resetSladeshState(currentUser.uid);
      setSladeshFeedback({
        status: "success",
        message: "Sladesh data er nulstillet for din bruger.",
      });
    } catch (error) {
      console.error("[AdminPortal] Failed to reset sladesh", error);
      setSladeshFeedback({
        status: "error",
        message: error.message || "Kunne ikke nulstille Sladesh.",
      });
    } finally {
      setIsResettingSladesh(false);
    }
  };

  // Donor handlers
  const handleDonorChange = (field) => (event) => {
    setDonorForm((prev) => ({
      ...prev,
      [field]: event.target.value,
    }));
  };

  const handleDonorEditChange = (field) => (event) => {
    setDonorEditingForm((prev) => ({
      ...prev,
      [field]: event.target.value,
    }));
  };

  const startEditingDonor = (donor) => {
    setDonorEditingId(donor.id);
    setDonorEditingForm({
      userId: donor.userId ?? "",
      amount: donor.amount?.toString() ?? "",
      date: donor.date instanceof Date ? donor.date.toISOString().split('T')[0] : donor.date ?? "",
      message: donor.message ?? "",
    });
  };

  const cancelEditingDonor = () => {
    setDonorEditingId(null);
    setDonorEditingForm({ userId: "", amount: "", date: "", message: "" });
    setIsUpdatingDonor(false);
  };

  const handleDonorSubmit = async (event) => {
    event.preventDefault();
    setDonorFeedback(null);

    if (!currentUser || !isAdmin) {
      setDonorFeedback({
        status: "error",
        message: "Du skal være logget ind som admin for at oprette donorer.",
      });
      return;
    }

    if (!selectedDonorUser || !donorForm.amount || !donorForm.date) {
      setDonorFeedback({
        status: "error",
        message: "Bruger, beløb og dato er påkrævet.",
      });
      return;
    }

    setIsSavingDonor(true);
    try {
      // Generate fallback initials if missing
      const userName = selectedDonorUser.fullName || selectedDonorUser.displayName || 'Ukendt';
      const userInitials = selectedDonorUser.initials || userName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
      const userAvatarGradient = selectedDonorUser.avatarGradient || {
        angle: 135,
        from: '#FF385C',
        to: '#FF6B9D'
      };

      await addDonor({
        userId: selectedDonorUser.id,
        userName,
        userInitials,
        userAvatarGradient,
        amount: donorForm.amount,
        date: donorForm.date,
        message: donorForm.message,
        createdBy: currentUser.uid,
      });

      setDonorFeedback({
        status: "success",
        message: "Donor oprettet.",
      });
      setDonorForm({ userId: "", amount: "", date: "", message: "" });
      setSelectedDonorUser(null);
    } catch (error) {
      console.error("[AdminPortal] Failed to create donor", error);
      setDonorFeedback({
        status: "error",
        message: error.message || "Kunne ikke oprette donor.",
      });
    } finally {
      setIsSavingDonor(false);
    }
  };

  const handleUpdateDonor = async (event) => {
    event.preventDefault();

    if (!donorEditingId) return;

    if (!donorEditingForm.amount || !donorEditingForm.date) {
      setDonorFeedback({
        status: "error",
        message: "Beløb og dato er påkrævet.",
      });
      return;
    }

    setIsUpdatingDonor(true);
    try {
      await updateDonor(donorEditingId, {
        amount: donorEditingForm.amount,
        date: donorEditingForm.date,
        message: donorEditingForm.message,
      });

      setDonorFeedback({
        status: "success",
        message: "Donor opdateret.",
      });
      cancelEditingDonor();
    } catch (error) {
      console.error("[AdminPortal] Failed to update donor", error);
      setDonorFeedback({
        status: "error",
        message: error.message || "Kunne ikke opdatere donor.",
      });
    } finally {
      setIsUpdatingDonor(false);
    }
  };

  const handleDeleteDonor = async (donorId) => {
    if (!donorId) return;
    if (!window.confirm("Er du sikker på, at du vil slette denne donor?")) {
      return;
    }

    try {
      await deleteDonor(donorId);

      setDonorFeedback({
        status: "success",
        message: "Donor slettet.",
      });
      if (donorEditingId === donorId) {
        cancelEditingDonor();
      }
    } catch (error) {
      console.error("[AdminPortal] Failed to delete donor", error);
      setDonorFeedback({
        status: "error",
        message: error.message || "Kunne ikke slette donor.",
      });
    }
  };

  // Stress Signal handlers
  const handleStressSignalChange = (field) => (event) => {
    setStressSignalForm((prev) => ({
      ...prev,
      [field]: event.target.value,
    }));
  };

  const handleStressSignalSubmit = async (event) => {
    event.preventDefault();
    setStressSignalFeedback(null);

    if (!currentUser || !isAdmin) {
      setStressSignalFeedback({
        status: "error",
        message: "Du skal være logget ind som admin for at sende stress signals.",
      });
      return;
    }

    if (!stressSignalForm.channelId || !stressSignalForm.title.trim() || !stressSignalForm.message.trim()) {
      setStressSignalFeedback({
        status: "error",
        message: "Kanal, titel og besked er påkrævet.",
      });
      return;
    }

    // Confirmation dialog
    if (!window.confirm(`Er du sikker på, at du vil sende denne stress signal til alle i kanalen?\n\nTitel: ${stressSignalForm.title}\nBesked: ${stressSignalForm.message}`)) {
      return;
    }

    setIsSendingStressSignal(true);
    try {
      const auth = getAuth();
      const token = await auth.currentUser.getIdToken();

      const response = await fetch(`${API_BASE_URL}/api/adminBroadcast`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          channelId: stressSignalForm.channelId,
          title: stressSignalForm.title.trim(),
          message: stressSignalForm.message.trim(),
        }),
      });

      // Handle non-OK responses with better error logging
      if (!response.ok) {
        const rawText = await response.text();
        console.error('[AdminPortal] Stress Signal API error', {
          status: response.status,
          statusText: response.statusText,
          url: response.url,
          rawResponse: rawText.substring(0, 500)
        });

        // Try to parse as JSON, fallback to generic error
        let errorMessage = 'Kunne ikke sende stress signal';
        try {
          const errorData = JSON.parse(rawText);
          errorMessage = errorData.error || errorMessage;
        } catch {
          errorMessage = `API returnerede HTML i stedet for JSON. Status: ${response.status}`;
        }

        throw new Error(errorMessage);
      }

      const result = await response.json();

      if (!result.ok) {
        throw new Error(result.error || 'Kunne ikke sende stress signal');
      }

      setStressSignalFeedback({
        status: "success",
        message: `Stress signal sendt til ${result.sent} modtagere. ${result.cleaned > 0 ? `${result.cleaned} døde subscriptions ryddet op.` : ''}`,
      });
      setStressSignalForm({ channelId: "", title: "", message: "" });
    } catch (error) {
      console.error("[AdminPortal] Failed to send stress signal", error);
      setStressSignalFeedback({
        status: "error",
        message: error.message || "Kunne ikke sende stress signal.",
      });
    } finally {
      setIsSendingStressSignal(false);
    }
  };

  // Stress Beacon handlers
  const handleBeaconChange = (field) => (event) => {
    setBeaconForm((prev) => ({
      ...prev,
      [field]: event.target.value,
    }));
  };

  const handleUseMyLocation = () => {
    if (userLocation?.lat && userLocation?.lng) {
      setBeaconForm({
        latitude: userLocation.lat.toString(),
        longitude: userLocation.lng.toString(),
      });
      setBeaconFeedback({
        status: "success",
        message: "Din lokation er indsat i formularen.",
      });
    } else {
      setBeaconFeedback({
        status: "error",
        message: "Kunne ikke finde din lokation. Sørg for at du har givet lokationstilladelse.",
      });
    }
  };

  const handleBeaconSubmit = async (event) => {
    event.preventDefault();
    setBeaconFeedback(null);

    if (!currentUser || !isAdmin) {
      setBeaconFeedback({
        status: "error",
        message: "Du skal være logget ind som admin for at oprette beacons.",
      });
      return;
    }

    const lat = parseFloat(beaconForm.latitude);
    const lng = parseFloat(beaconForm.longitude);

    if (isNaN(lat) || isNaN(lng)) {
      setBeaconFeedback({
        status: "error",
        message: "Latitude og longitude skal være gyldige tal.",
      });
      return;
    }

    if (lat < -90 || lat > 90) {
      setBeaconFeedback({
        status: "error",
        message: "Latitude skal være mellem -90 og 90.",
      });
      return;
    }

    if (lng < -180 || lng > 180) {
      setBeaconFeedback({
        status: "error",
        message: "Longitude skal være mellem -180 og 180.",
      });
      return;
    }

    // Confirmation dialog
    if (!window.confirm(`Er du sikker på, at du vil oprette en Stress Beacon?\n\nPosition: ${lat}, ${lng}\n\nBeaconen vil sende påmindelser hver 15. minut i 2 timer til brugere inden for 100m.`)) {
      return;
    }

    setIsCreatingBeacon(true);
    try {
      const auth = getAuth();
      const token = await auth.currentUser.getIdToken();

      const response = await fetch(`${API_BASE_URL}/api/createBeacon`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          latitude: lat,
          longitude: lng,
          userName: currentUser.displayName || currentUser.email || 'Admin',
        }),
      });

      // Handle non-OK responses with better error logging
      if (!response.ok) {
        const rawText = await response.text();
        console.error('[AdminPortal] Create Beacon API error', {
          status: response.status,
          statusText: response.statusText,
          url: response.url,
          rawResponse: rawText.substring(0, 500)
        });

        // Try to parse as JSON, fallback to generic error
        let errorMessage = 'Kunne ikke oprette beacon';
        try {
          const errorData = JSON.parse(rawText);
          errorMessage = errorData.error || errorMessage;
        } catch {
          errorMessage = `API returnerede HTML i stedet for JSON. Status: ${response.status}`;
        }

        throw new Error(errorMessage);
      }

      const result = await response.json();

      if (!result.ok) {
        throw new Error(result.error || 'Kunne ikke oprette beacon');
      }

      setBeaconFeedback({
        status: "success",
        message: `Stress Beacon oprettet! Beacon ID: ${result.beaconId}. Udløber om 2 timer.`,
      });
      setBeaconForm({ latitude: "", longitude: "" });

      // Reload active beacons
      loadActiveBeacons();
    } catch (error) {
      console.error("[AdminPortal] Failed to create beacon", error);
      setBeaconFeedback({
        status: "error",
        message: error.message || "Kunne ikke oprette beacon.",
      });
    } finally {
      setIsCreatingBeacon(false);
    }
  };

  const handleDeactivateBeacon = async (beaconId) => {
    if (!beaconId) return;
    if (!window.confirm("Er du sikker på, at du vil deaktivere denne beacon?")) {
      return;
    }

    try {
      await updateDoc(doc(db, "stressBeacons", beaconId), {
        active: false,
        updatedAt: serverTimestamp(),
      });

      setBeaconFeedback({
        status: "success",
        message: "Beacon deaktiveret.",
      });

      // Reload active beacons
      loadActiveBeacons();
    } catch (error) {
      console.error("[AdminPortal] Failed to deactivate beacon", error);
      setBeaconFeedback({
        status: "error",
        message: error.message || "Kunne ikke deaktivere beacon.",
      });
    }
  };

  const loadActiveBeacons = async () => {
    if (!isAdmin) {
      setActiveBeacons([]);
      setBeaconsLoading(false);
      return;
    }

    try {
      const beaconsRef = collection(db, "stressBeacons");
      const beaconsQuery = query(
        beaconsRef,
        where("active", "==", true),
        orderBy("createdAt", "desc")
      );
      const snapshot = await getDocs(beaconsQuery);

      setActiveBeacons(
        snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }))
      );
    } catch (error) {
      console.error("[AdminPortal] Failed to load active beacons", error);
      setBeaconFeedback({
        status: "error",
        message: error.message || "Kunne ikke indlæse beacons.",
      });
    } finally {
      setBeaconsLoading(false);
    }
  };

  // User Sladesh Management handlers
  const handleResetUserSladesh = async () => {
    if (!currentUser || !isAdmin) {
      setUserResetFeedback({
        status: "error",
        message: "Du skal være logget ind som admin.",
      });
      return;
    }

    if (!selectedUserId) {
      setUserResetFeedback({
        status: "error",
        message: "Vælg en bruger først.",
      });
      return;
    }

    const selectedUser = users.find(u => u.id === selectedUserId);
    if (!selectedUser) {
      setUserResetFeedback({
        status: "error",
        message: "Bruger ikke fundet.",
      });
      return;
    }

    // Confirmation dialog
    if (!window.confirm(`Er du sikker på, at du vil nulstille Sladesh for ${selectedUser.fullName}?\n\nDette vil nulstille alle Sladesh-tællere og markere aktive udfordringer som failed.`)) {
      return;
    }

    setIsResettingUserSladesh(true);
    setUserResetFeedback(null);
    try {
      await resetSladeshStateForUser(selectedUserId);

      // Reload users to get updated stats
      const allUsers = await getAllUsers();
      setUsers(allUsers);

      setUserResetFeedback({
        status: "success",
        message: `Sladesh data er nulstillet for ${selectedUser.fullName}.`,
      });
      setSelectedUserId(""); // Clear selection
    } catch (error) {
      console.error("[AdminPortal] Failed to reset user sladesh", error);
      setUserResetFeedback({
        status: "error",
        message: error.message || "Kunne ikke nulstille Sladesh.",
      });
    } finally {
      setIsResettingUserSladesh(false);
    }
  };

  // Theme Drop handlers
  const handleThemeDropChange = (field) => (event) => {
    setThemeDropForm((prev) => ({
      ...prev,
      [field]: event.target.value,
    }));
  };

  const handleThemeDropSubmit = async (event) => {
    event.preventDefault();
    setThemeDropFeedback(null);

    if (!currentUser || !isAdmin) {
      setThemeDropFeedback({
        status: "error",
        message: "Du skal være logget ind som admin for at sende theme drops.",
      });
      return;
    }

    if (!themeDropForm.themeName) {
      setThemeDropFeedback({
        status: "error",
        message: "Vælg et tema først.",
      });
      return;
    }

    const selectedTheme = THEME_PRESETS[themeDropForm.themeName];
    if (!selectedTheme) {
      setThemeDropFeedback({
        status: "error",
        message: "Ugyldigt tema valgt.",
      });
      return;
    }

    // Confirmation dialog
    if (!window.confirm(`Er du sikker på, at du vil udløse "${selectedTheme.name}" theme drop for alle aktive brugere?`)) {
      return;
    }

    setIsSendingThemeDrop(true);
    try {
      // Update the settings/theme_event document
      // All active users listening to this document will see the update
      const themeEventRef = doc(db, 'settings', 'theme_event');
      await setDoc(themeEventRef, {
        themeName: selectedTheme.name,
        emojis: selectedTheme.emojis,
        timestamp: serverTimestamp(),
        triggeredBy: currentUser.uid,
      });

      console.log('[AdminPortal] Theme drop triggered', {
        themeName: selectedTheme.name,
        emojiCount: selectedTheme.emojis.length
      });

      setThemeDropFeedback({
        status: "success",
        message: `Theme drop "${selectedTheme.name}" sendt til alle aktive brugere! 🎉`,
      });
      setThemeDropForm({ themeName: "" });
    } catch (error) {
      console.error("[AdminPortal] Failed to send theme drop", error);
      setThemeDropFeedback({
        status: "error",
        message: error.message || "Kunne ikke sende theme drop.",
      });
    } finally {
      setIsSendingThemeDrop(false);
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
            <FeedbackBanner
              feedback={sladeshFeedback}
              onDismiss={() => setSladeshFeedback(null)}
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
                Sladesh Reset
              </div>
              <p className="text-xs text-[color:var(--muted)]">
                Nulstil Sladesh for din bruger (tメllere + marker aktive udfordringer som failed) til test.
              </p>
              <button
                type="button"
                onClick={handleResetSladesh}
                disabled={isResettingSladesh || !isAdmin}
                className="rounded-2xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 shadow-sm transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isResettingSladesh ? "Nulstiller..." : "Nulstil Sladesh"}
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
              <button
                type="button"
                onClick={() => {
                  // Simulate a failed Sladesh to test wheel eligibility
                  const mockFailedChallenge = {
                    id: crypto.randomUUID(),
                    senderId: currentUser.uid,
                    senderName: currentUser.displayName || 'Test User',
                    receiverId: 'mock-receiver',
                    receiverName: 'Mock Receiver',
                    status: 'FAILED',
                    createdAt: Date.now(),
                    deadlineAt: Date.now() - 1000,
                  };

                  // Add to localStorage
                  try {
                    const stored = window.localStorage.getItem('sladesh_challenges');
                    const challenges = stored ? JSON.parse(stored) : [];
                    challenges.push(mockFailedChallenge);
                    window.localStorage.setItem('sladesh_challenges', JSON.stringify(challenges));

                    // Clear wheel usage to make eligible
                    window.localStorage.removeItem('sladesh_wheel_used_at');

                    alert('✅ Failed Sladesh simuleret! Gå til Sladesh-siden for at se "Vil du prøve lykken?" knappen.');
                    window.location.reload();
                  } catch (e) {
                    alert('❌ Fejl: ' + e.message);
                  }
                }}
                className="rounded-2xl border border-purple-200 bg-white px-4 py-2 text-sm font-semibold text-purple-600 shadow-sm transition hover:bg-purple-50"
              >
                🎰 Simuler Failed Sladesh (Wheel Test)
              </button>
            </div>
          </Card>
        </section>

        <section className="space-y-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
              Bruger Sladesh Nulstilling
            </div>
            <p className="text-sm text-[color:var(--muted)]">
              Nulstil Sladesh data for en specifik bruger (kun brugere der har brugt Sladesh).
            </p>
          </div>
          <Card className="space-y-4 px-5 py-6">
            <FeedbackBanner
              feedback={userResetFeedback}
              onDismiss={() => setUserResetFeedback(null)}
            />
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wide text-[color:var(--muted)]">
                  Vælg bruger
                </label>
                {usersLoading ? (
                  <div className="text-sm text-[color:var(--muted)]">Indlæser brugere...</div>
                ) : (
                  <select
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    disabled={!isAdmin || usersLoading}
                    className="w-full rounded-2xl border px-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[color:var(--brand,#FF385C)] focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60"
                    style={{
                      borderColor: "var(--line)",
                      backgroundColor: "var(--subtle)",
                      color: "var(--ink)",
                      "--tw-ring-offset-color": "var(--bg)",
                    }}
                  >
                    <option value="">Vælg en bruger...</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.fullName}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {selectedUserId && (() => {
                const selectedUser = users.find(u => u.id === selectedUserId);
                if (!selectedUser) return null;

                const hasUsedSladesh = selectedUser.sladeshSent > 0 || selectedUser.sladeshReceived > 0;

                return (
                  <div className="rounded-2xl border px-4 py-3 space-y-3" style={{ borderColor: "var(--line)", backgroundColor: "var(--subtle)" }}>
                    <div className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
                      {selectedUser.fullName}
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <div className="text-[color:var(--muted)]">Sendt</div>
                        <div className="font-semibold" style={{ color: "var(--ink)" }}>{selectedUser.sladeshSent}</div>
                      </div>
                      <div>
                        <div className="text-[color:var(--muted)]">Modtaget</div>
                        <div className="font-semibold" style={{ color: "var(--ink)" }}>{selectedUser.sladeshReceived}</div>
                      </div>
                      <div>
                        <div className="text-[color:var(--muted)]">Gennemført</div>
                        <div className="font-semibold" style={{ color: "var(--ink)" }}>{selectedUser.sladeshCompletedCount}</div>
                      </div>
                      <div>
                        <div className="text-[color:var(--muted)]">Fejlet</div>
                        <div className="font-semibold" style={{ color: "var(--ink)" }}>{selectedUser.sladeshFailedCount}</div>
                      </div>
                    </div>
                    {!hasUsedSladesh && (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                        ⚠️ Denne bruger har ikke brugt Sladesh endnu. Nulstilling er ikke mulig.
                      </div>
                    )}
                  </div>
                );
              })()}

              <button
                type="button"
                onClick={handleResetUserSladesh}
                disabled={isResettingUserSladesh || !isAdmin || !selectedUserId || (() => {
                  const selectedUser = users.find(u => u.id === selectedUserId);
                  return !selectedUser || (selectedUser.sladeshSent === 0 && selectedUser.sladeshReceived === 0);
                })()}
                className="w-full rounded-2xl border border-red-200 bg-white px-4 py-3 text-sm font-semibold text-red-600 shadow-sm transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isResettingUserSladesh ? "Nulstiller..." : "Nulstil Brugerens Sladesh"}
              </button>
            </div>
          </Card>
        </section>

        <section className="space-y-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
              Stress Signal
            </div>
            <p className="text-sm text-[color:var(--muted)]">
              Send en push-notifikation til alle subscribers i en kanal.
            </p>
          </div>
          <Card className="space-y-4 px-5 py-6">
            <FeedbackBanner
              feedback={stressSignalFeedback}
              onDismiss={() => setStressSignalFeedback(null)}
            />
            <form className="space-y-4" onSubmit={handleStressSignalSubmit}>
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wide text-[color:var(--muted)]">
                  Kanal
                </label>
                <select
                  value={stressSignalForm.channelId}
                  onChange={handleStressSignalChange("channelId")}
                  disabled={channelsLoading || !isAdmin}
                  className="w-full rounded-2xl border px-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[color:var(--brand,#FF385C)] focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60"
                  style={{
                    borderColor: "var(--line)",
                    backgroundColor: "var(--subtle)",
                    color: "var(--ink)",
                    "--tw-ring-offset-color": "var(--bg)",
                  }}
                >
                  <option value="">Vælg kanal...</option>
                  {channels.map((channel) => (
                    <option key={channel.id} value={channel.id}>
                      {channel.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wide text-[color:var(--muted)]">
                  Titel
                </label>
                <input
                  type="text"
                  value={stressSignalForm.title}
                  onChange={handleStressSignalChange("title")}
                  placeholder="fx Vigtig besked"
                  disabled={!isAdmin}
                  className="w-full rounded-2xl border px-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[color:var(--brand,#FF385C)] focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60"
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
                  Besked
                </label>
                <textarea
                  value={stressSignalForm.message}
                  onChange={handleStressSignalChange("message")}
                  rows={4}
                  placeholder="Skriv din besked her..."
                  disabled={!isAdmin}
                  className="w-full rounded-2xl border px-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[color:var(--brand,#FF385C)] focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60"
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
                disabled={isSendingStressSignal || !isAdmin}
                className="w-full rounded-2xl bg-[color:var(--brand,#FF385C)] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSendingStressSignal ? "Sender..." : "Send Stress Signal"}
              </button>
            </form>
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

        {/* Theme Drop Section */}
        <section className="space-y-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
              Theme Drop
            </div>
            <p className="text-sm text-[color:var(--muted)]">
              Udløs en kaskade af emojis over alle checked-in brugeres skærme.
            </p>
          </div>
          <Card className="space-y-4 px-5 py-6">
            <FeedbackBanner
              feedback={themeDropFeedback}
              onDismiss={() => setThemeDropFeedback(null)}
            />
            <form className="space-y-4" onSubmit={handleThemeDropSubmit}>
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wide text-[color:var(--muted)]">
                  Vælg tema
                </label>
                <select
                  value={themeDropForm.themeName}
                  onChange={handleThemeDropChange("themeName")}
                  disabled={!isAdmin}
                  className="w-full rounded-2xl border px-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[color:var(--brand,#FF385C)] focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60"
                  style={{
                    borderColor: "var(--line)",
                    backgroundColor: "var(--subtle)",
                    color: "var(--ink)",
                    "--tw-ring-offset-color": "var(--bg)",
                  }}
                >
                  <option value="">Vælg et tema...</option>
                  {Object.entries(THEME_PRESETS).map(([key, theme]) => (
                    <option key={key} value={key}>
                      {theme.name}
                    </option>
                  ))}
                </select>
              </div>
              {themeDropForm.themeName && THEME_PRESETS[themeDropForm.themeName] && (
                <div className="rounded-2xl border px-4 py-3" style={{ borderColor: "var(--line)", backgroundColor: "var(--subtle)" }}>
                  <div className="text-xs font-medium uppercase tracking-wide text-[color:var(--muted)] mb-2">
                    Emoji preview
                  </div>
                  <div className="flex gap-2 text-2xl">
                    {THEME_PRESETS[themeDropForm.themeName].emojis.map((emoji, index) => (
                      <span key={index}>{emoji}</span>
                    ))}
                  </div>
                </div>
              )}
              <button
                type="submit"
                disabled={isSendingThemeDrop || !isAdmin || !themeDropForm.themeName}
                className="w-full rounded-2xl bg-[color:var(--brand,#FF385C)] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSendingThemeDrop ? "Sender..." : "🎉 Udløs Theme Drop"}
              </button>
            </form>
          </Card>
        </section>

        {/* Donor Management Section */}
        <section className="space-y-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
              Donorer
            </div>
            <p className="text-sm text-[color:var(--muted)]">
              Administrer top donerer som vises på donationssiden.
            </p>
          </div>
          <Card className="space-y-4 px-5 py-6">
            <FeedbackBanner
              feedback={donorFeedback}
              onDismiss={() => setDonorFeedback(null)}
            />
            <form className="space-y-4" onSubmit={handleDonorSubmit}>
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wide text-[color:var(--muted)]">
                  Vælg bruger
                </label>
                {usersLoading ? (
                  <div className="text-sm text-[color:var(--muted)]">Indlæser brugere...</div>
                ) : (
                  <select
                    value={selectedDonorUser?.id || ""}
                    onChange={(e) => {
                      const user = users.find(u => u.id === e.target.value);
                      setSelectedDonorUser(user || null);
                    }}
                    disabled={!isAdmin || usersLoading}
                    className="w-full rounded-2xl border px-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[color:var(--brand,#FF385C)] focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60"
                    style={{
                      borderColor: "var(--line)",
                      backgroundColor: "var(--subtle)",
                      color: "var(--ink)",
                      "--tw-ring-offset-color": "var(--bg)",
                    }}
                  >
                    <option value="">Vælg en bruger...</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.fullName}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium uppercase tracking-wide text-[color:var(--muted)]">
                    Beløb (DKK)
                  </label>
                  <input
                    type="number"
                    value={donorForm.amount}
                    onChange={handleDonorChange("amount")}
                    required
                    min="0"
                    step="1"
                    placeholder="100"
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
                    Dato
                  </label>
                  <input
                    type="date"
                    value={donorForm.date}
                    onChange={handleDonorChange("date")}
                    required
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
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wide text-[color:var(--muted)]">
                  Besked (valgfri)
                </label>
                <textarea
                  value={donorForm.message}
                  onChange={handleDonorChange("message")}
                  rows={2}
                  placeholder="Tak for en fed app!"
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
                disabled={isSavingDonor}
                className="w-full rounded-2xl bg-[color:var(--brand,#FF385C)] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSavingDonor ? "Gemmer..." : "Opret donor"}
              </button>
            </form>
          </Card>

          <Card className="space-y-4 px-5 py-6">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                Alle donorer
              </div>
              {donorsLoading && (
                <span className="text-xs text-[color:var(--muted)]">Indlæser…</span>
              )}
            </div>
            {!donorsLoading && donors.length === 0 && (
              <div className="rounded-2xl border border-dashed px-4 py-3 text-sm text-[color:var(--muted)]">
                Ingen donorer endnu.
              </div>
            )}
            <div className="space-y-3">
              {donors.map((donor) => {
                const isEditing = donorEditingId === donor.id;
                return (
                  <div
                    key={donor.id}
                    className="rounded-2xl border px-4 py-3"
                    style={{
                      borderColor: "var(--line)",
                      backgroundColor: "var(--subtle)",
                    }}
                  >
                    {isEditing ? (
                      <form className="space-y-3" onSubmit={handleUpdateDonor}>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <label className="text-xs font-medium uppercase tracking-wide text-[color:var(--muted)]">
                              Beløb (DKK)
                            </label>
                            <input
                              type="number"
                              value={donorEditingForm.amount}
                              onChange={handleDonorEditChange("amount")}
                              required
                              min="0"
                              step="1"
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
                              Dato
                            </label>
                            <input
                              type="date"
                              value={donorEditingForm.date}
                              onChange={handleDonorEditChange("date")}
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
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-medium uppercase tracking-wide text-[color:var(--muted)]">
                            Besked
                          </label>
                          <textarea
                            value={donorEditingForm.message}
                            onChange={handleDonorEditChange("message")}
                            rows={2}
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
                            onClick={cancelEditingDonor}
                            className="flex-1 rounded-2xl border px-4 py-2 text-sm font-semibold text-[color:var(--muted)] hover:text-[color:var(--ink)]"
                            style={{ borderColor: "var(--line)" }}
                            disabled={isUpdatingDonor}
                          >
                            Annuller
                          </button>
                          <button
                            type="submit"
                            disabled={isUpdatingDonor}
                            className="flex-1 rounded-2xl bg-[color:var(--brand,#FF385C)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition disabled:opacity-60"
                          >
                            {isUpdatingDonor ? "Gemmer..." : "Gem"}
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="flex flex-col gap-3">
                        <div className="flex items-start gap-3">
                          {/* User Avatar */}
                          {donor.userAvatarGradient && (
                            <div
                              className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                              style={{
                                background: `linear-gradient(${donor.userAvatarGradient.angle}deg, ${donor.userAvatarGradient.from}, ${donor.userAvatarGradient.to})`,
                              }}
                            >
                              <span className="text-sm font-bold text-white">
                                {donor.userInitials || '?'}
                              </span>
                            </div>
                          )}
                          <div className="flex-1">
                            <div className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
                              {donor.userName}
                            </div>
                            <div className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
                              {new Intl.NumberFormat('da-DK', { style: 'currency', currency: 'DKK', minimumFractionDigits: 0 }).format(donor.amount)} • {new Intl.DateTimeFormat('da-DK', { year: 'numeric', month: 'short', day: 'numeric' }).format(donor.date instanceof Date ? donor.date : new Date(donor.date))}
                            </div>
                            {donor.message && (
                              <div className="mt-1 text-xs italic text-[color:var(--muted)]">
                                "{donor.message}"
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => startEditingDonor(donor)}
                            className="rounded-2xl border px-3 py-1 text-xs font-semibold text-[color:var(--muted)] hover:text-[color:var(--ink)]"
                            style={{ borderColor: "var(--line)" }}
                          >
                            Redigér
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteDonor(donor.id)}
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
        </section>

        {/* Stress Beacon Management */}
        {isAdmin && (
          <section className="space-y-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                Stress Beacon
              </div>
              <p className="text-sm text-[color:var(--muted)]">
                Opret en Stress Beacon der sender drinkpåmindelser til brugere inden for 100m radius hver 15. minut i 2 timer.
              </p>
            </div>
            <Card className="space-y-4 px-5 py-6">
              <FeedbackBanner
                feedback={beaconFeedback}
                onDismiss={() => setBeaconFeedback(null)}
              />

              <form className="space-y-4" onSubmit={handleBeaconSubmit}>
                <button
                  type="button"
                  onClick={handleUseMyLocation}
                  className="w-full rounded-2xl border px-4 py-3 text-sm font-semibold transition hover:bg-[color:var(--subtle)]"
                  style={{
                    borderColor: "var(--line)",
                    color: "var(--ink)",
                  }}
                >
                  📍 Brug Min Lokation
                </button>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-medium uppercase tracking-wide text-[color:var(--muted)]">
                      Latitude
                    </label>
                    <input
                      type="text"
                      value={beaconForm.latitude}
                      onChange={handleBeaconChange("latitude")}
                      placeholder="55.6761"
                      required
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
                      Longitude
                    </label>
                    <input
                      type="text"
                      value={beaconForm.longitude}
                      onChange={handleBeaconChange("longitude")}
                      placeholder="12.5683"
                      required
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
                  disabled={isCreatingBeacon}
                  className="w-full rounded-2xl bg-[color:var(--brand,#FF385C)] px-4 py-3 text-sm font-semibold text-white shadow-sm transition disabled:opacity-60"
                >
                  {isCreatingBeacon ? "Opretter..." : "Opret Beacon"}
                </button>
              </form>

              {/* Active Beacons List */}
              {!beaconsLoading && activeBeacons.length > 0 && (
                <div className="space-y-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                    Aktive Beacons ({activeBeacons.length})
                  </div>
                  <div className="space-y-3">
                    {activeBeacons.map((beacon) => {
                      const createdAt = beacon.createdAt?.toDate?.() || new Date();
                      const expiresAt = beacon.expiresAt?.toDate?.() || new Date();
                      const now = new Date();
                      const timeLeft = Math.max(0, Math.floor((expiresAt - now) / 1000 / 60));

                      return (
                        <div
                          key={beacon.id}
                          className="rounded-2xl border px-4 py-3"
                          style={{
                            borderColor: "var(--line)",
                            backgroundColor: "var(--subtle)",
                          }}
                        >
                          <div className="flex flex-col gap-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1">
                                <div className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
                                  {beacon.creatorName || "Ukendt"}
                                </div>
                                <div className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
                                  📍 {beacon.latitude.toFixed(4)}, {beacon.longitude.toFixed(4)}
                                </div>
                                <div className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
                                  🔔 {beacon.notificationsSent || 0} notifikationer sendt
                                </div>
                                <div className="mt-1 text-xs font-semibold" style={{ color: timeLeft > 30 ? "var(--success)" : "var(--warning)" }}>
                                  ⏱️ {timeLeft > 0 ? `${timeLeft} min tilbage` : "Udløbet"}
                                </div>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => handleDeactivateBeacon(beacon.id)}
                                className="rounded-2xl border border-red-200 px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                              >
                                Deaktivér
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </Card>
          </section>
        )}
      </div >
    </Page >
  );
}




