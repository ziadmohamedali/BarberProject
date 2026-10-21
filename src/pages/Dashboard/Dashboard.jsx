/* eslint-disable react/prop-types -- Existing app components use JavaScript props without PropTypes. */
import { useEffect, useMemo, useRef, useState } from "react";
import { getAppointmentErrorMessage } from "../../features/auth/bookings/bookingService";
import ContactSettings from "../../components/ContactSettings/ContactSettings";
import LiveHome from "./LiveHome";
import NavigationSidebar from "../../components/NavigationSidebar/NavigationSidebar";
import ProductEditor from "./ProductEditor";
import { useLanguage } from "../../lib/i18n";
import useScrollLock from "../../hooks/useScrollLock";
import "./Dashboard.css";

const whatsappNumber = (number = "") => {
  const digits = number.replace(/\D/g, "");
  const normalized = digits.startsWith("00") ? digits.slice(2) : digits.startsWith("0") ? `20${digits.slice(1)}` : digits;
  return normalized.length >= 8 && normalized.length <= 15 ? normalized : "";
};

const bookingStatusLabel = (status) => ({
  pending_review: "Pending Review",
  awaiting_payment: "Awaiting Payment",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
  rejected: "Rejected",
}[status] || status);

const depositStatusLabel = (status) => ({
  not_requested: "Not Requested",
  awaiting_payment: "Awaiting Payment",
  payment_verified: "Payment Verified",
  refunded: "Refunded",
}[status] || status);

const formatAppointmentDate = (value, language) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(language === "ar" ? "ar-EG" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const formatAppointmentPrice = (value, language) => new Intl.NumberFormat(
  language === "ar" ? "ar-EG" : "en-GB",
  { maximumFractionDigits: 0 }
).format(Number(value) || 0);

const localDateKey = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
};

const toDateTimeLocal = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const nextFiveMinuteLocal = () => toDateTimeLocal(new Date(Math.ceil(Date.now() / 300000) * 300000));

function AppointmentCheckpoints({ appointment, t }) {
  const status = appointment.bookingStatus;
  const isTerminal = ["cancelled", "rejected"].includes(status);
  const depositDone = ["payment_verified", "refunded"].includes(appointment.depositStatus);
  const steps = [
    { label: "Request received", state: "complete" },
    { label: "Owner review", state: status === "pending_review" ? "current" : "complete" },
    { label: "Deposit verification", state: depositDone ? "complete" : status === "awaiting_payment" && !isTerminal ? "current" : "upcoming" },
    { label: "Appointment confirmed", state: ["confirmed", "completed"].includes(status) ? "complete" : status === "awaiting_payment" && depositDone ? "current" : "upcoming" },
    { label: "Visit completed", state: status === "completed" ? "complete" : status === "confirmed" ? "current" : "upcoming" },
  ];
  const nextStep = status === "pending_review" ? "Review the request and check availability."
    : status === "awaiting_payment" && !depositDone ? "Contact the customer with deposit instructions, then verify payment."
      : status === "awaiting_payment" ? "The deposit is verified. Confirm the appointment."
        : status === "confirmed" ? "Mark the appointment complete after the visit."
          : status === "completed" ? "This appointment is complete."
            : status === "rejected" ? "This request was rejected."
              : "This appointment was cancelled.";

  return <section className="appointment-checkpoints" aria-label={t("Request checkpoints")}>
    <div className="appointment-checkpoints-heading"><div><span className="eyebrow">{t("REQUEST FLOW")}</span><h3>{t("Request checkpoints")}</h3></div>{isTerminal && <span className="checkpoint-terminal">{t(bookingStatusLabel(status))}</span>}</div>
    <ol>{steps.map((step) => <li className={`checkpoint-${step.state}`} key={step.label}><span className="checkpoint-marker" aria-hidden="true">{step.state === "complete" ? "✓" : ""}</span><span>{t(step.label)}</span></li>)}</ol>
    {!isTerminal && <p className="checkpoint-next"><strong>{t("Next step")}</strong>{t(nextStep)}</p>}
  </section>;
}

const emptyProduct = (category) => ({
  picture: "", title: "", description: "", price: "", oldPrice: "",
  category, duration: "", active: true, gallery: [], sortOrder: 0,
});

function Dashboard({ theme, onToggleTheme, products, bookings, appointments = [], contactSettings, homeSettings, onCreateProduct, onUploadProductImage, onDeleteUnusedProductImages, onUpdateProduct, onDeleteProduct, onReorderProducts, onUpdateBooking, onUpdateAppointment, onSaveContactSettings, onSaveHomeSettings, onUploadHomeImage, onChangeOwnerPassword, onBackToShop, onLogout, onReload }) {
  const { language, t } = useLanguage();
  const [section, setSection] = useState("products");
  const [category, setCategory] = useState("haircut");
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current: "", next: "", confirmation: "" });
  const [passwordError, setPasswordError] = useState("");
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const persistedImageUrls = useRef(new Set());
  const productSubmittingRef = useRef(false);
  const imageUploadRef = useRef(false);
  const [appointmentSearch, setAppointmentSearch] = useState("");
  const [appointmentStatus, setAppointmentStatus] = useState("all");
  const [appointmentDepositStatus, setAppointmentDepositStatus] = useState("all");
  const [appointmentDate, setAppointmentDate] = useState("");
  const [appointmentService, setAppointmentService] = useState("all");
  const [selectedAppointmentId, setSelectedAppointmentId] = useState(null);
  const [appointmentMessage, setAppointmentMessage] = useState("");
  const [appointmentDateDraft, setAppointmentDateDraft] = useState("");

  const categoryProducts = useMemo(
    () => products.filter((product) => product.category === category),
    [products, category]
  );

  const runAction = async (action) => {
    setActionError("");
    setBusy(true);
    try {
      await action();
    } catch (error) {
      setActionError(t(getAppointmentErrorMessage(error, "The change could not be saved. Please try again.")));
    } finally {
      setBusy(false);
    }
  };

  const updateDraft = (field, value) => {
    setFormError("");
    setFormSuccess("");
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const uploadImage = async (event, target, index) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = "";
    if (!file || imageUploadRef.current) return;

    imageUploadRef.current = true;
    setFormError("");
    setFormSuccess("");
    setUploadProgress(0);
    setUploadingImage(true);
    try {
      const imageUrl = await onUploadProductImage(file, setUploadProgress);
      const galleryIndex = target === "gallery" && !draft?.gallery?.[index]
        ? (draft?.gallery?.length || 0)
        : index;
      const previousImage = target === "picture" ? draft?.picture : draft?.gallery?.[galleryIndex];
      if (target === "picture") updateDraft("picture", imageUrl);
      else {
        setDraft((current) => {
          if (!current) return current;
          const gallery = [...(current.gallery || [])];
          if (gallery[galleryIndex]) gallery[galleryIndex] = imageUrl;
          else gallery.push(imageUrl);
          return { ...current, gallery };
        });
      }
      if (previousImage && !persistedImageUrls.current.has(previousImage)) {
        await onDeleteUnusedProductImages([previousImage]);
      }
    } catch (error) {
      setFormError(t(error.message || "The image could not be uploaded."));
    } finally {
      setUploadingImage(false);
      setUploadProgress(0);
      imageUploadRef.current = false;
    }
  };

  const removeDraftImage = async (target, index) => {
    const previousImage = target === "picture" ? draft?.picture : draft?.gallery?.[index];
    if (target === "picture") updateDraft("picture", "");
    else {
      setDraft((current) => {
        if (!current) return current;
        const gallery = [...(current.gallery || [])];
        gallery.splice(index, 1);
        return { ...current, gallery };
      });
    }

    if (previousImage && !persistedImageUrls.current.has(previousImage)) {
      try {
        await onDeleteUnusedProductImages([previousImage]);
      } catch (error) {
        setFormError(t("Image was removed from the draft, but cleanup failed: {error}", { error: error.message }));
      }
    }
  };

  const beginAdd = () => {
    setEditingId(null);
    setDraft({ ...emptyProduct(category), sortOrder: categoryProducts.length });
    persistedImageUrls.current = new Set();
    setFormError("");
    setFormSuccess("");
  };

  const beginEdit = (product) => {
    setEditingId(product.id);
    setDraft({ ...product, price: String(product.price), oldPrice: product.oldPrice == null ? "" : String(product.oldPrice), duration: product.duration == null ? "" : String(product.duration), sortOrder: Number(product.sortOrder ?? 0), gallery: Array.isArray(product.gallery) ? [...product.gallery] : [] });
    persistedImageUrls.current = new Set([product.picture, ...(product.gallery || [])].filter(Boolean));
    setFormError("");
    setFormSuccess("");
  };

  const cancelDraft = async () => {
    const uploadedImages = [draft?.picture, ...(draft?.gallery || [])]
      .filter((image) => image && !persistedImageUrls.current.has(image));
    try {
      await onDeleteUnusedProductImages(uploadedImages);
      setDraft(null);
    } catch (error) {
      setFormError(t(error.message || "New images could not be cleaned up. Please try again."));
    }
  };

  const saveProduct = async (event) => {
    event.preventDefault();
    if (productSubmittingRef.current) return;
    const price = Number(draft.price);
    if (!draft.picture) {
      setFormError(t("Upload a main product image before saving."));
      return;
    }
    if (!draft.title.trim() || draft.title.trim().length > 30 || !draft.description.trim() || !Number.isInteger(price) || price <= 0) {
      setFormError(t("Add a title (up to 30 characters), a description, and a whole-number price above 0."));
      return;
    }
    const oldPrice = draft.oldPrice === "" ? null : Number(draft.oldPrice);
    if (draft.oldPrice !== "" && (!Number.isInteger(oldPrice) || oldPrice <= price)) {
      setFormError(t("Old price must be a whole number greater than the current price."));
      return;
    }
    const duration = draft.duration === "" ? null : Number(draft.duration);
    if (duration !== null && (!Number.isInteger(duration) || duration <= 0)) {
      setFormError(t("Duration must be a positive whole number of minutes."));
      return;
    }
    const sortOrder = Number(draft.sortOrder);
    if (!Number.isInteger(sortOrder) || sortOrder < 0) {
      setFormError(t("Display order must be zero or a positive whole number."));
      return;
    }
    const saved = {
      ...draft,
      ...(editingId === null ? {} : { id: editingId }),
      title: draft.title.trim(),
      description: draft.description.trim(),
      price,
      oldPrice,
      duration,
      gallery: draft.gallery.filter(Boolean).slice(0, 4),
      sortOrder,
    };
    productSubmittingRef.current = true;
    setBusy(true);
    setFormError("");
    setFormSuccess("");
    try {
      if (editingId === null) await onCreateProduct(saved);
      else await onUpdateProduct(saved);
      const savedImageUrls = new Set([saved.picture, ...saved.gallery].filter(Boolean));
      const unusedDraftImages = [draft.picture, ...(draft.gallery || [])]
        .filter((image) => image && !persistedImageUrls.current.has(image) && !savedImageUrls.has(image));
      persistedImageUrls.current = savedImageUrls;
      setDraft(null);
      setFormSuccess(t(editingId === null ? "Product added successfully." : "Product updated successfully."));
      if (unusedDraftImages.length) {
        try {
          await onDeleteUnusedProductImages(unusedDraftImages);
        } catch (error) {
          setFormError(t("Product saved, but unused images could not be cleaned up: {error}", { error: error.message }));
        }
      }
    } catch (error) {
      setFormError(t(getAppointmentErrorMessage(error, "The product could not be saved. Please try again.")));
    } finally {
      productSubmittingRef.current = false;
      setBusy(false);
    }
  };

  const archiveDraftProduct = async () => {
    if (!draft || editingId === null || productSubmittingRef.current) return;
    const existing = products.find(product => product.id === editingId);
    if (!existing) return;
    const nextActive = !existing.active;
    if (existing.active && !window.confirm(t("Archive {title}? It will be hidden from the public services list.", { title: existing.title }))) return;
    productSubmittingRef.current = true;
    setBusy(true);
    setFormError("");
    try {
      await onUpdateProduct({ ...existing, active: nextActive });
      setDraft(null);
      setFormSuccess(t(nextActive ? "Product restored to the public list." : "Product archived and hidden from the public list."));
    } catch (error) {
      setFormError(t(getAppointmentErrorMessage(error, "The product could not be archived.")));
    } finally {
      productSubmittingRef.current = false;
      setBusy(false);
    }
  };

  const deleteDraftProduct = async () => {
    if (!draft || editingId === null || productSubmittingRef.current) return;
    const existing = products.find(product => product.id === editingId);
    if (!existing || !window.confirm(t("Permanently delete {title}? This cannot be undone.", { title: existing.title }))) return;
    productSubmittingRef.current = true;
    setBusy(true);
    setFormError("");
    try {
      await onDeleteProduct(editingId);
      setDraft(null);
      setFormSuccess(t("Product deleted successfully."));
    } catch (error) {
      setFormError(t(getAppointmentErrorMessage(error, "The product could not be deleted.")));
    } finally {
      productSubmittingRef.current = false;
      setBusy(false);
    }
  };

  const deleteProduct = (product) => {
    if (window.confirm(t("Are you sure you want to delete â€œ{title}â€?", { title: product.title }))) {
      runAction(() => onDeleteProduct(product.id));
    }
  };

  const toggleProduct = (product) => runAction(() => onUpdateProduct({ ...product, active: !product.active }));

  const moveProduct = (index, direction) => {
    const next = [...categoryProducts];
    const neighbor = index + direction;
    if (!next[neighbor]) return;
    [next[index], next[neighbor]] = [next[neighbor], next[index]];
    runAction(() => onReorderProducts(next));
  };

  const updateBooking = (id, field, value) => runAction(() => onUpdateBooking(id, field, value));

  const updateAppointment = async (appointment, changes) => {
    const nextStatus = changes.bookingStatus;
    const actionName = nextStatus
      ? t(nextStatus === "awaiting_payment" ? "accept this request and request the deposit" : nextStatus === "confirmed" ? "confirm this appointment" : nextStatus === "rejected" ? "reject this request" : nextStatus === "completed" ? "mark this appointment as completed" : "cancel this appointment")
      : "";
    const confirmationMessage = actionName
      ? t("Are you sure you want to {action} for {name} ({reference})?", {
      action: actionName,
      name: appointment.customer.name,
      reference: appointment.reference,
    })
      : changes.depositStatus && changes.depositStatus !== appointment.depositStatus
        ? t("Update the deposit status for {reference} to {status}?", {
          reference: appointment.reference,
          status: t(depositStatusLabel(changes.depositStatus)),
        })
        : "";
    if (confirmationMessage && !window.confirm(confirmationMessage)) return;

    setAppointmentMessage("");
    await runAction(async () => {
      await onUpdateAppointment(appointment.id, changes);
      setAppointmentMessage("Appointment updated successfully.");
    });
  };

  const visibleAppointments = appointments.filter((appointment) => {
    const query = appointmentSearch.trim().toLocaleLowerCase();
    const matchesQuery = !query
      || String(appointment.customer.name || "").toLocaleLowerCase().includes(query)
      || String(appointment.customer.whatsapp || "").toLocaleLowerCase().includes(query)
      || String(appointment.customer.email || "").toLocaleLowerCase().includes(query)
      || String(appointment.reference || "").toLocaleLowerCase().includes(query);
    const matchesStatus = appointmentStatus === "all" || appointment.bookingStatus === appointmentStatus;
    const matchesDepositStatus = appointmentDepositStatus === "all" || appointment.depositStatus === appointmentDepositStatus;
    const matchesDate = !appointmentDate || localDateKey(appointment.appointmentAt) === appointmentDate;
    const matchesService = appointmentService === "all" || appointment.services.some(service => service.title === appointmentService);
    return matchesQuery && matchesStatus && matchesDepositStatus && matchesDate && matchesService;
  });
  const selectedAppointment = appointments.find(appointment => appointment.id === selectedAppointmentId);
  const selectedAppointmentIdValue = selectedAppointment?.id;
  const selectedAppointmentAtValue = selectedAppointment?.appointmentAt;
  useScrollLock(Boolean(selectedAppointment));
  useEffect(() => {
    if (!selectedAppointmentIdValue) return undefined;
    setAppointmentDateDraft(toDateTimeLocal(selectedAppointmentAtValue));
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setSelectedAppointmentId(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedAppointmentAtValue, selectedAppointmentIdValue]);
  const selectedContactNumber = selectedAppointment ? whatsappNumber(selectedAppointment.customer.whatsapp) : "";
  const selectedAppointmentContext = [
    selectedAppointment?.preferredAppointmentAt && `${t("Customer preference:")} ${formatAppointmentDate(selectedAppointment.preferredAppointmentAt, language)} (${t("preference, not confirmation")})`,
    selectedAppointment?.appointmentAt && `${t("Current appointment time:")} ${formatAppointmentDate(selectedAppointment.appointmentAt, language)}`,
  ].filter(Boolean).join("\n");
  const selectedWhatsAppText = selectedAppointment?.bookingStatus === "awaiting_payment"
    ? `${t("Hello {name}, your Mohamed Hadad request {reference} has been accepted. To confirm the appointment, a 50 EGP deposit is required. Please reply here for InstaPay or Vodafone Cash payment instructions. The deposit will be verified by our team.", {
      name: selectedAppointment.customer.name,
      reference: selectedAppointment.reference,
    })}${selectedAppointmentContext}`
    : selectedAppointment && `${t("Hello {name}, this is Mohamed Hadad contacting you about your request {reference}. Please reply here so we can confirm availability and arrange your visit.", {
      name: selectedAppointment.customer.name,
      reference: selectedAppointment.reference,
    })}${selectedAppointmentContext}`;
  const dashboardStats = [
    { label: "Pending requests", value: appointments.filter(item => ["pending_review", "awaiting_payment"].includes(item.bookingStatus)).length, tone: "pending" },
    { label: "Approved appointments", value: appointments.filter(item => item.bookingStatus === "confirmed").length, tone: "approved" },
    { label: "Completed appointments", value: appointments.filter(item => item.bookingStatus === "completed").length, tone: "completed" },
    { label: "Deposits to verify", value: appointments.filter(item => item.depositStatus === "awaiting_payment").length, tone: "deposit" },
  ];

  const handleAddProduct = () => {
    setSection("products");
    if (!draft) beginAdd();
    requestAnimationFrame(() => document.getElementById("product-editor")?.scrollIntoView({ behavior: "smooth" }));
  };

  const changePassword = async (event) => {
    event.preventDefault();
    setPasswordError("");
    setPasswordSaved(false);

    if (passwordForm.next.length < 8) {
      setPasswordError(t("Use at least 8 characters for the new password."));
      return;
    }
    if (passwordForm.next !== passwordForm.confirmation) {
      setPasswordError(t("The new passwords do not match."));
      return;
    }
    if (passwordForm.current === passwordForm.next) {
      setPasswordError(t("Choose a new password different from your current one."));
      return;
    }

    setPasswordBusy(true);
    try {
      await onChangeOwnerPassword(passwordForm.current, passwordForm.next);
      setPasswordForm({ current: "", next: "", confirmation: "" });
      setPasswordSaved(true);
    } catch (error) {
      setPasswordError(t(error.message || "The password could not be changed. Please try again."));
    } finally {
      setPasswordBusy(false);
    }
  };

  const dashboardNavigation = [
    { id: "products", label: "Products", icon: "services" },
    { id: "appointments", label: "Appointments", icon: "book" },
    { id: "requests", label: "Requests", icon: "requests" },
    { id: "live-home", label: "Live Home", icon: "home" },
    { id: "contact-settings", label: "Contact Settings", icon: "settings" },
  ];

  return (
    <>
      <NavigationSidebar
        variant="dashboard"
        items={dashboardNavigation}
        activeItem={section}
        onNavigate={setSection}
        onAddProduct={handleAddProduct}
        theme={theme}
        onToggleTheme={onToggleTheme}
        onBackToShop={onBackToShop}
        onLogout={onLogout}
      />
      <main className="dashboard-page dashboard-main">
      <section className="dashboard-shell" id="dashboard">
        <div className="dashboard-title-row">
          <div><span className="eyebrow">{t("OWNER SPACE")}</span><h1>{t("Dashboard")}</h1></div>
          <p className="dashboard-summary">{t("SHOP MANAGEMENT")} Â· {products.length} {t("Products")} Â· {appointments.length} {t("Appointments")} Â· {bookings.length} {t("Requests")}</p>
        </div>

        <section className="dashboard-overview" aria-label={t("Booking overview")}>
          {dashboardStats.map(card => <article className={`overview-card ${card.tone}`} key={card.tone}><span>{t(card.label)}</span><strong>{card.value}</strong></article>)}
        </section>

        {actionError && <p className="editor-error" role="alert">{t(actionError)} <button type="button" className="text-button" onClick={onReload}>{t("Reload data")}</button></p>}

        <details className="account-security">
          <summary>{t("Change owner password")}</summary>
          <form className="password-change-form" onSubmit={changePassword}>
            <label>{t("Current password")}<input type="password" autoComplete="current-password" required value={passwordForm.current} onChange={(event) => setPasswordForm((current) => ({ ...current, current: event.target.value }))} /></label>
            <label>{t("New password")}<input type="password" autoComplete="new-password" minLength={8} required value={passwordForm.next} onChange={(event) => setPasswordForm((current) => ({ ...current, next: event.target.value }))} /></label>
            <label>{t("Confirm new password")}<input type="password" autoComplete="new-password" minLength={8} required value={passwordForm.confirmation} onChange={(event) => setPasswordForm((current) => ({ ...current, confirmation: event.target.value }))} /></label>
            {passwordError && <p className="editor-error" role="alert">{t(passwordError)}</p>}
            {passwordSaved && <p className="password-saved" role="status">{t("Password updated successfully.")}</p>}
            <button className="primary-button" type="submit" disabled={passwordBusy}>{passwordBusy ? t("Updatingâ€¦") : t("Update password")}</button>
          </form>
        </details>

        {section === "products" ? (
          <>
            <div className="dashboard-toolbar">
              <div className="dashboard-tabs" role="group" aria-label={t("Product category")}>
                <button type="button" aria-pressed={category === "haircut"} className={category === "haircut" ? "active" : ""} onClick={() => setCategory("haircut")}>
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4v16M18 4v16M6 9h12M6 15h12" /></svg>
                  {t("Haircuts")}
                </button>
                <button type="button" aria-pressed={category === "package"} className={category === "package" ? "active" : ""} onClick={() => setCategory("package")}>
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h16v12H4zM3 4h18v4H3zM12 8v12M12 4c-4-4-7 1 0 4m0-4c4-4 7 1 0 4" /></svg>
                  {t("Packages")}
                </button>
              </div>
              <button type="button" className="primary-button add-product-button" disabled={busy || uploadingImage} onClick={beginAdd}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
                {t("Add product")}
              </button>
            </div>
            {formSuccess && <p className="product-feedback success" role="status">{formSuccess}</p>}
            {formError && !draft && <p className="product-feedback error" role="alert">{formError}</p>}
            {draft && (
              <ProductEditor
                draft={draft}
                editing={editingId !== null}
                error={formError}
                busy={busy}
                uploading={uploadingImage}
                progress={uploadProgress}
                onChange={updateDraft}
                onUpload={uploadImage}
                onRemoveImage={removeDraftImage}
                onSave={saveProduct}
                onCancel={cancelDraft}
                onArchive={archiveDraftProduct}
                onDelete={deleteDraftProduct}
                t={t}
              />
            )}
            <div className="managed-products">
              {categoryProducts.length === 0 && <div className="empty-state">{t(category === "haircut" ? "No haircuts yet. Add your first service above." : "No packages yet. Add your first service above.")}</div>}
              {categoryProducts.map((product, index) => (
                <article className={`managed-product ${product.active ? "" : "is-hidden"}`} key={product.id}>
                  {product.picture ? <img src={product.picture} alt="" /> : <span className="managed-product-thumb-empty" aria-hidden="true">H.</span>}
                  <div className="managed-product-info"><div className="managed-title"><h3>{product.title}</h3><span className={product.active ? "status-pill visible" : "status-pill"}>{t(product.active ? "Visible" : "Hidden")}</span></div><p>{product.price} {t("EGP")}{product.duration ? ` Â· ${product.duration} ${t("min")}` : ""}</p></div>

                  <div className="managed-product-meta"><span>{t(product.category === "haircut" ? "Haircut Service" : "Package")}</span><span>{t("Order {number}", { number: product.sortOrder ?? index })}</span><span>{t("{number} gallery images", { number: product.gallery?.length || 0 })}</span></div>
                  <div className="managed-actions"><button title={t("Move up")} aria-label={t("Move {title} up", { title: product.title })} disabled={index === 0 || busy} onClick={() => moveProduct(index, -1)}>â†‘</button><button title={t("Move down")} aria-label={t("Move {title} down", { title: product.title })} disabled={index === categoryProducts.length - 1 || busy} onClick={() => moveProduct(index, 1)}>â†“</button><button className="edit-product-button" disabled={busy} onClick={() => beginEdit(product)}>{t("Edit product")}</button><button disabled={busy} onClick={() => toggleProduct(product)}>{t(product.active ? "Hide" : "Show")}</button><button className="danger-action" disabled={busy} onClick={() => deleteProduct(product)}>{t("Delete")}</button></div>
                </article>
              ))}
            </div>
          </>
        ) : section === "appointments" ? (
          <section className="appointment-management" aria-labelledby="appointments-title">
            <div className="appointment-list-heading">
              <div><span className="eyebrow">{t("BOOKING MANAGEMENT")}</span><h2 id="appointments-title">{t("Appointments")}</h2></div>
              <span className="appointment-result-count">{t("Showing {visible} of {total} appointments", { visible: visibleAppointments.length, total: appointments.length })}</span>
            </div>
            <div className="appointment-filters">
              <label>{t("Search appointments")}
                <input type="search" value={appointmentSearch} onChange={(event) => setAppointmentSearch(event.target.value)} placeholder={t("Name, phone, email, or booking reference")} />
              </label>
              <label>{t("Booking status")}
                <select value={appointmentStatus} onChange={(event) => setAppointmentStatus(event.target.value)}>
                  <option value="all">{t("All statuses")}</option>
                  {["pending_review", "awaiting_payment", "confirmed", "completed", "cancelled", "rejected"].map((status) => (
                    <option key={status} value={status}>{t(bookingStatusLabel(status))}</option>
                  ))}
                </select>
              </label>
              <label>{t("Deposit status")}
                <select value={appointmentDepositStatus} onChange={(event) => setAppointmentDepositStatus(event.target.value)}>
                  <option value="all">{t("All deposit statuses")}</option>
                  {["not_requested", "awaiting_payment", "payment_verified", "refunded"].map((status) => (
                    <option key={status} value={status}>{t(depositStatusLabel(status))}</option>
                  ))}
                </select>
              </label>
              <label>{t("Appointment date")}
                <input type="date" value={appointmentDate} onChange={event => setAppointmentDate(event.target.value)} />
              </label>
              <label>{t("Service")}
                <select value={appointmentService} onChange={event => setAppointmentService(event.target.value)}>
                  <option value="all">{t("All services")}</option>
                  {[...new Set(appointments.flatMap(appointment => appointment.services.map(service => service.title)))].sort().map(service => <option key={service} value={service}>{service}</option>)}
                </select>
              </label>
            </div>
            {appointmentMessage && <p className="appointment-success" role="status">{t(appointmentMessage)}</p>}
            {actionError && <p className="editor-error" role="alert">{t(actionError)}</p>}
            {appointments.length === 0 ? (
              <div className="empty-state">{t("No appointments have been received yet.")}</div>
            ) : visibleAppointments.length === 0 ? (
              <div className="empty-state">{t("No appointments match these filters.")}</div>
            ) : (
              <div className="appointment-table-wrap">
                <table className="appointment-table">
                  <thead><tr>
                    <th scope="col">{t("Customer")}</th>
                    <th scope="col">{t("Service")}</th>
                    <th scope="col">{t("Appointment date")}</th>
                    <th scope="col">{t("Total")}</th>
                    <th scope="col">{t("Booking status")}</th>
                    <th scope="col">{t("Actions")}</th>
                  </tr></thead>
                  <tbody>
                {visibleAppointments.map((appointment) => {
                  const primaryAppointmentAction = appointment.bookingStatus === "pending_review"
                    ? <button type="button" className="appointment-primary-action" disabled={busy} onClick={() => updateAppointment(appointment, {
                      bookingStatus: "awaiting_payment",
                      ...(appointment.depositStatus === "payment_verified" ? {} : { depositStatus: "awaiting_payment" }),
                    })}>{t("Accept & request deposit")}</button>
                    : appointment.bookingStatus === "awaiting_payment"
                      ? <button type="button" className="appointment-primary-action" disabled={busy || appointment.depositStatus !== "payment_verified"} onClick={() => updateAppointment(appointment, { bookingStatus: "confirmed" })}>{t("Confirm appointment")}</button>
                      : appointment.bookingStatus === "confirmed"
                        ? <button type="button" className="appointment-primary-action" disabled={busy} onClick={() => updateAppointment(appointment, { bookingStatus: "completed" })}>{t("Mark completed")}</button>
                        : null;
                  return (
                    <tr key={appointment.id}>
                      <td data-label={t("Customer")}>
                        <div className="appointment-table-customer"><strong>{appointment.customer.name}</strong><span className="appointment-reference">{appointment.reference}</span><span dir="ltr">{appointment.customer.whatsapp}</span>{appointment.customer.email && <small dir="ltr">{appointment.customer.email}</small>}</div>
                      </td>
                      <td data-label={t("Service")}>
                        <div className="appointment-table-service"><strong>{appointment.services[0]?.title || "â€”"}</strong>{appointment.services.length > 1 && <span>{t("{number} more services", { number: appointment.services.length - 1 })}</span>}<small>{t("Duration")}: {formatAppointmentPrice(appointment.duration, language)} {t("min")}</small></div>
                      </td>
                      <td data-label={t("Appointment date")}>
                        <div className="appointment-table-date"><strong>{t("Requested preference")}: {formatAppointmentDate(appointment.preferredAppointmentAt, language) || t("Not provided")}</strong><small>{t("Current appointment time")}: {formatAppointmentDate(appointment.appointmentAt, language) || t("Not scheduled")}</small>{appointment.createdAt && <small>{t("Request received")}: {formatAppointmentDate(appointment.createdAt, language)}</small>}</div>
                      </td>
                      <td data-label={t("Total")}>
                        <div className="appointment-table-price"><strong>{formatAppointmentPrice(appointment.total, language)} {t("EGP")}</strong><small>{t("Deposit")}: {formatAppointmentPrice(appointment.deposit, language)} {t("EGP")}</small></div>
                      </td>
                      <td data-label={t("Booking status")}>
                        <div className="appointment-table-status"><span className={`appointment-status status-${appointment.bookingStatus}`}>{t(bookingStatusLabel(appointment.bookingStatus))}</span><span className={`deposit-status-badge deposit-${appointment.depositStatus}`}>{t(depositStatusLabel(appointment.depositStatus))}</span></div>
                      </td>
                      <td data-label={t("Actions")}>
                        <div className="appointment-table-actions">
                          {primaryAppointmentAction}
                          {appointment.bookingStatus === "awaiting_payment" && appointment.depositStatus !== "payment_verified" && <small className="appointment-payment-hint">{t("Verify the deposit before confirming.")}</small>}
                          <button className="appointment-view-details" type="button" onClick={() => setSelectedAppointmentId(appointment.id)}>{t("View request details")}</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ) : section === "requests" ? (
          <div className="request-list">
            {bookings.length === 0 && <div className="empty-state">{t("Customer requests will appear here once submitted.")}</div>}
            {bookings.map((booking) => (
              <article className="request-card" key={booking.id}>
                <div className="request-head"><div><span className="eyebrow">{t("REQUEST Â· {date}", { date: booking.createdAt ? new Date(booking.createdAt).toLocaleString(language === "ar" ? "ar-EG" : "en") : t("Date unavailable") })}</span><h2>{booking.customer.name}</h2></div><a href={`https://wa.me/${whatsappNumber(booking.customer.whatsapp)}`} target="_blank" rel="noreferrer">{t("WhatsApp")} â†—</a></div>
                <div className="request-contact"><span>{booking.customer.whatsapp}</span><span>{booking.customer.email}</span></div>
                <div className="request-products">{booking.products.map((item, index) => <div key={`${item.productId}-${index}`}><span>{item.title}</span><strong>{item.price} {t("EGP")}</strong></div>)}</div>
                <div className="request-totals"><div><span>{t("Total")}</span><strong>{booking.total} {t("EGP")}</strong></div><div><span>{t("Deposit")}</span><strong>{booking.deposit} {t("EGP")}</strong></div><div><span>{t("Remaining")}</span><strong>{booking.remaining} {t("EGP")}</strong></div></div>
                <div className="request-controls"><label>{t("Request status")}<select disabled={busy} value={booking.bookingStatus || "pending"} onChange={(event) => updateBooking(booking.id, "bookingStatus", event.target.value)}><option value="pending">{t("Pending")}</option><option value="confirmed">{t("Confirmed")}</option><option value="completed">{t("Completed")}</option><option value="cancelled">{t("Cancelled")}</option></select></label><label>{t("Payment status")}<select disabled={busy} value={booking.paymentStatus || "pending"} onChange={(event) => updateBooking(booking.id, "paymentStatus", event.target.value)}><option value="pending">{t("Pending")}</option><option value="confirmed">{t("Confirmed")}</option><option value="rejected">{t("Rejected")}</option></select></label></div>
              </article>
            ))}
          </div>
        ) : section === "live-home" ? (
          <LiveHome settings={homeSettings} onSave={onSaveHomeSettings} onUploadImage={onUploadHomeImage} onDeleteImages={onDeleteUnusedProductImages} />
        ) : (
          <ContactSettings contactSettings={contactSettings} onSave={onSaveContactSettings} />
        )}
      </section>
      {selectedAppointment && (
        <div className="appointment-dialog-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && setSelectedAppointmentId(null)}>
          <section className="appointment-dialog" role="dialog" aria-modal="true" aria-labelledby="appointment-dialog-title">
            <button type="button" className="appointment-dialog-close" onClick={() => setSelectedAppointmentId(null)} aria-label={t("Close details")}>Ã—</button>
            <span className="eyebrow">{t("REQUEST DETAILS")}</span>
            <h2 id="appointment-dialog-title">{selectedAppointment.customer.name}</h2>
            <p className="appointment-dialog-reference">{selectedAppointment.reference}</p>
            {selectedContactNumber && <a className="appointment-contact-link" href={`https://wa.me/${selectedContactNumber}?text=${encodeURIComponent(selectedWhatsAppText || "")}`} target="_blank" rel="noreferrer">{t("Contact on WhatsApp")}</a>}
            {appointmentMessage && <p className="appointment-success" role="status">{t(appointmentMessage)}</p>}
            {actionError && <p className="editor-error" role="alert">{t(actionError)}</p>}
            <AppointmentCheckpoints appointment={selectedAppointment} t={t} />
            <dl>
              <div><dt>{t("Phone / WhatsApp")}</dt><dd>{selectedAppointment.customer.whatsapp}</dd></div>
              {selectedAppointment.customer.email && <div><dt>{t("Email")}</dt><dd>{selectedAppointment.customer.email}</dd></div>}
              <div><dt>{t("Customer preference")}</dt><dd>{formatAppointmentDate(selectedAppointment.preferredAppointmentAt, language) || t("Not provided")}</dd></div>
              <div><dt>{t("Appointment date")}</dt><dd>{formatAppointmentDate(selectedAppointment.appointmentAt, language) || t("Not scheduled")}</dd></div>
              {selectedAppointment.createdAt && <div><dt>{t("Request received")}</dt><dd>{formatAppointmentDate(selectedAppointment.createdAt, language)}</dd></div>}
              <div><dt>{t("Appointment status")}</dt><dd>{t(bookingStatusLabel(selectedAppointment.bookingStatus))}</dd></div>
              <div><dt>{t("Deposit status")}</dt><dd>{t(depositStatusLabel(selectedAppointment.depositStatus))}</dd></div>
              <div><dt>{t("Duration")}</dt><dd>{formatAppointmentPrice(selectedAppointment.duration, language)} {t("min")}</dd></div>
              <div><dt>{t("Notes")}</dt><dd>{selectedAppointment.notes || t("No notes provided.")}</dd></div>
            </dl>
            {!(["completed", "cancelled", "rejected"].includes(selectedAppointment.bookingStatus)) && <form className="appointment-reschedule" onSubmit={(event) => { event.preventDefault(); if (appointmentDateDraft) updateAppointment(selectedAppointment, { appointmentAt: new Date(appointmentDateDraft).toISOString() }); }}>
              <label htmlFor="appointment-reschedule-time">{t("Set agreed appointment date and time")}</label>
              <div><input id="appointment-reschedule-time" type="datetime-local" step="300" min={nextFiveMinuteLocal()} value={appointmentDateDraft} onChange={(event) => setAppointmentDateDraft(event.target.value)} required /><button type="submit" className="status-action" disabled={busy || !appointmentDateDraft}>{t("Save appointment time")}</button></div>
              <small>{t("The customer preference remains recorded separately. Save here to change the salon-agreed appointment time.")}</small>
            </form>}
            <div className="appointment-dialog-services">{selectedAppointment.services.map(service => <div key={service.productId}><span>{service.title}</span><strong>{formatAppointmentPrice(service.price, language)} {t("EGP")}</strong></div>)}</div>
            <div className="appointment-dialog-totals"><span>{t("Total")} <strong>{formatAppointmentPrice(selectedAppointment.total, language)} {t("EGP")}</strong></span><span>{t("Deposit")} <strong>{formatAppointmentPrice(selectedAppointment.deposit, language)} {t("EGP")}</strong></span></div>
            <div className="appointment-dialog-actions">
              {selectedAppointment.bookingStatus === "pending_review" && <>
                <button type="button" className="status-action" disabled={busy} onClick={() => updateAppointment(selectedAppointment, { bookingStatus: "awaiting_payment", ...(selectedAppointment.depositStatus === "payment_verified" ? {} : { depositStatus: "awaiting_payment" }) })}>{t("Accept & request deposit")}</button>
                <button type="button" className="danger-action" disabled={busy} onClick={() => updateAppointment(selectedAppointment, { bookingStatus: "rejected" })}>{t("Reject")}</button>
              </>}
              {selectedAppointment.bookingStatus === "awaiting_payment" && <>
                <button type="button" className="status-action" disabled={busy || selectedAppointment.depositStatus !== "payment_verified"} onClick={() => updateAppointment(selectedAppointment, { bookingStatus: "confirmed" })}>{t("Confirm appointment")}</button>
                {selectedAppointment.depositStatus !== "payment_verified" && <span className="appointment-payment-hint">{t("Verify the deposit before confirming.")}</span>}
                <button type="button" className="danger-action" disabled={busy} onClick={() => updateAppointment(selectedAppointment, { bookingStatus: "rejected" })}>{t("Reject")}</button>
                <button type="button" className="danger-action" disabled={busy} onClick={() => updateAppointment(selectedAppointment, { bookingStatus: "cancelled" })}>{t("Cancel appointment")}</button>
              </>}
              {selectedAppointment.bookingStatus === "confirmed" && <>
                <button type="button" className="status-action" disabled={busy} onClick={() => updateAppointment(selectedAppointment, { bookingStatus: "completed" })}>{t("Mark completed")}</button>
                <button type="button" className="danger-action" disabled={busy} onClick={() => updateAppointment(selectedAppointment, { bookingStatus: "cancelled" })}>{t("Cancel appointment")}</button>
              </>}
              <label className="deposit-status-control">{t("Deposit status")}
                <select disabled={busy} value={selectedAppointment.depositStatus} onChange={(event) => updateAppointment(selectedAppointment, { depositStatus: event.target.value })}>
                  <option value="not_requested" disabled={selectedAppointment.depositStatus !== "not_requested"}>{t("Not Requested")}</option>
                  <option value="awaiting_payment" disabled={selectedAppointment.depositStatus !== "awaiting_payment" && selectedAppointment.bookingStatus !== "awaiting_payment"}>{t("Awaiting Payment")}</option>
                  <option value="payment_verified" disabled={selectedAppointment.depositStatus !== "awaiting_payment" && selectedAppointment.depositStatus !== "payment_verified"}>{t("Payment Verified")}</option>
                  <option value="refunded" disabled={selectedAppointment.depositStatus !== "refunded" && (selectedAppointment.depositStatus !== "payment_verified" || !["cancelled", "rejected"].includes(selectedAppointment.bookingStatus))}>{t("Refunded")}</option>
                </select>
              </label>
            </div>
          </section>
        </div>
      )}
      </main>
    </>
  );
}

export default Dashboard;
