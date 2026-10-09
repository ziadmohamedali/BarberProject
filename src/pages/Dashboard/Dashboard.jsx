import { useMemo, useRef, useState } from "react";
import { getAppointmentErrorMessage } from "../../features/auth/bookings/bookingService";
import ContactSettings from "../../components/ContactSettings/ContactSettings";
import NavigationSidebar from "../../components/NavigationSidebar/NavigationSidebar";
import { useLanguage } from "../../lib/i18n";
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

const emptyProduct = (category) => ({
  picture: "", title: "", description: "", price: "", oldPrice: "",
  category, duration: "", active: true, gallery: [],
});

function Dashboard({ theme, onToggleTheme, products, bookings, appointments = [], contactSettings, onCreateProduct, onUploadProductImage, onDeleteUnusedProductImages, onUpdateProduct, onDeleteProduct, onReorderProducts, onUpdateBooking, onUpdateAppointment, onSaveContactSettings, onChangeOwnerPassword, onBackToShop, onLogout, onReload }) {
  const { language, t } = useLanguage();
  const [section, setSection] = useState("products");
  const [category, setCategory] = useState("haircut");
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [formError, setFormError] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current: "", next: "", confirmation: "" });
  const [passwordError, setPasswordError] = useState("");
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const persistedImageUrls = useRef(new Set());
  const [appointmentSearch, setAppointmentSearch] = useState("");
  const [appointmentStatus, setAppointmentStatus] = useState("all");
  const [appointmentMessage, setAppointmentMessage] = useState("");

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

  const updateDraft = (field, value) => setDraft((current) => ({ ...current, [field]: value }));

  const uploadImage = async (event, target, index) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;

    setFormError("");
    setUploadingImage(true);
    try {
      const imageUrl = await onUploadProductImage(file);
      const previousImage = target === "picture" ? draft?.picture : draft?.gallery?.[index];
      if (target === "picture") updateDraft("picture", imageUrl);
      else {
        setDraft((current) => {
          if (!current) return current;
          const gallery = [...(current.gallery || [])];
          gallery[index] = imageUrl;
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
    }
  };

  const removeDraftImage = async (target, index) => {
    const previousImage = target === "picture" ? draft?.picture : draft?.gallery?.[index];
    if (target === "picture") updateDraft("picture", "");
    else {
      setDraft((current) => {
        if (!current) return current;
        const gallery = [...(current.gallery || [])];
        gallery[index] = "";
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
    setDraft(emptyProduct(category));
    persistedImageUrls.current = new Set();
    setFormError("");
  };

  const beginEdit = (product) => {
    setEditingId(product.id);
    setDraft({ ...product, price: String(product.price), oldPrice: product.oldPrice == null ? "" : String(product.oldPrice), gallery: product.gallery || [] });
    persistedImageUrls.current = new Set([product.picture, ...(product.gallery || [])].filter(Boolean));
    setFormError("");
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
    if (draft.oldPrice !== "" && (!Number.isInteger(oldPrice) || oldPrice <= 0)) {
      setFormError(t("Enter a positive whole-number old price or leave it empty."));
      return;
    }
    const duration = draft.duration === "" ? null : Number(draft.duration);
    if (duration !== null && (!Number.isInteger(duration) || duration <= 0)) {
      setFormError(t("Duration must be a positive whole number of minutes."));
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
      sortOrder: editingId === null ? categoryProducts.length : draft.sortOrder,
    };
    await runAction(async () => {
      if (editingId === null) await onCreateProduct(saved);
      else await onUpdateProduct(saved);
      const savedImageUrls = new Set([saved.picture, ...saved.gallery].filter(Boolean));
      const unusedDraftImages = [draft.picture, ...(draft.gallery || [])]
        .filter((image) => image && !persistedImageUrls.current.has(image) && !savedImageUrls.has(image));
      persistedImageUrls.current = savedImageUrls;
      setDraft(null);
      if (unusedDraftImages.length) {
        try {
          await onDeleteUnusedProductImages(unusedDraftImages);
        } catch (error) {
          throw new Error(t("Product saved, but unused images could not be cleaned up: {error}", { error: error.message }));
        }
      }
    });
  };

  const deleteProduct = (product) => {
    if (window.confirm(t("Are you sure you want to delete “{title}”?", { title: product.title }))) {
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
      || appointment.customer.name.toLocaleLowerCase().includes(query)
      || appointment.customer.whatsapp.toLocaleLowerCase().includes(query)
      || appointment.reference.toLocaleLowerCase().includes(query);
    const matchesStatus = appointmentStatus === "all" || appointment.bookingStatus === appointmentStatus;
    return matchesQuery && matchesStatus;
  });

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
          <p className="dashboard-summary">{t("SHOP MANAGEMENT")} · {products.length} {t("Products")} · {appointments.length} {t("Appointments")} · {bookings.length} {t("Requests")}</p>
        </div>

        {actionError && <p className="editor-error" role="alert">{t(actionError)} <button type="button" className="text-button" onClick={onReload}>{t("Reload data")}</button></p>}

        <details className="account-security">
          <summary>{t("Change owner password")}</summary>
          <form className="password-change-form" onSubmit={changePassword}>
            <label>{t("Current password")}<input type="password" autoComplete="current-password" required value={passwordForm.current} onChange={(event) => setPasswordForm((current) => ({ ...current, current: event.target.value }))} /></label>
            <label>{t("New password")}<input type="password" autoComplete="new-password" minLength={8} required value={passwordForm.next} onChange={(event) => setPasswordForm((current) => ({ ...current, next: event.target.value }))} /></label>
            <label>{t("Confirm new password")}<input type="password" autoComplete="new-password" minLength={8} required value={passwordForm.confirmation} onChange={(event) => setPasswordForm((current) => ({ ...current, confirmation: event.target.value }))} /></label>
            {passwordError && <p className="editor-error" role="alert">{t(passwordError)}</p>}
            {passwordSaved && <p className="password-saved" role="status">{t("Password updated successfully.")}</p>}
            <button className="primary-button" type="submit" disabled={passwordBusy}>{passwordBusy ? t("Updating…") : t("Update password")}</button>
          </form>
        </details>

        {section === "products" ? (
          <>
            <div className="dashboard-toolbar">
              <div className="dashboard-tabs">
                <button className={category === "haircut" ? "active" : ""} onClick={() => setCategory("haircut")}>{t("Haircuts")}</button>
                <button className={category === "package" ? "active" : ""} onClick={() => setCategory("package")}>{t("Packages")}</button>
              </div>
            </div>
            {draft && (
              <form id="product-editor" className="product-editor" onSubmit={saveProduct}>
                <div className="editor-heading"><div><span className="eyebrow">{t(editingId === null ? "NEW SERVICE" : "UPDATE SERVICE")}</span><h2>{t(editingId === null ? "Add a product" : "Edit product")}</h2></div><button type="button" className="text-button" disabled={uploadingImage || busy} onClick={cancelDraft}>{t("Cancel")}</button></div>
                <div className="editor-grid">
                  <label className="wide-field">{t("Main image file")} {t(editingId === null ? "(required)" : "(optional replacement)")}<input type="file" accept="image/jpeg,image/png,image/webp" required={editingId === null && !draft.picture} disabled={uploadingImage} onChange={(event) => uploadImage(event, "picture")} /></label>
                  {draft.picture && <div className="image-preview-field"><img className="product-image-preview" src={draft.picture} alt={t("Main product preview")} /><button type="button" className="text-button" disabled={uploadingImage || busy} onClick={() => removeDraftImage("picture")}>{t("Remove main image")}</button></div>}
                  <label>{t("Title")}<input required maxLength={30} value={draft.title} onChange={(event) => updateDraft("title", event.target.value)} placeholder={t("Classic Haircut")} /></label>
                  <label>{t("Category")}<select value={draft.category} onChange={(event) => updateDraft("category", event.target.value)}><option value="haircut">{t("Haircut")}</option><option value="package">{t("Package")}</option></select></label>
                  <label>{t("Duration in minutes (optional)")}<input type="number" min="1" step="1" value={draft.duration} onChange={(event) => updateDraft("duration", event.target.value)} placeholder="30" /></label>
                  <label>{t("Description")}<textarea required rows="3" value={draft.description} onChange={(event) => updateDraft("description", event.target.value)} /></label>
                  <label>{t("Price (EGP)")}<input required type="number" min="1" step="1" value={draft.price} onChange={(event) => updateDraft("price", event.target.value)} /></label>
                  <label>{t("Old price (optional)")}<input type="number" min="1" step="1" value={draft.oldPrice} onChange={(event) => updateDraft("oldPrice", event.target.value)} /></label>
                  <div className="wide-field gallery-fields"><span>{t("Additional images (optional, up to 4)")}</span>{[0, 1, 2, 3].map((index) => <div className="gallery-image-field" key={index}><label>{t("Image {number}", { number: index + 2 })}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploadingImage} onChange={(event) => uploadImage(event, "gallery", index)} /></label>{draft.gallery[index] && <><img className="product-image-preview" src={draft.gallery[index]} alt={t("Product image {number} preview", { number: index + 2 })} /><button type="button" className="text-button" disabled={uploadingImage || busy} onClick={() => removeDraftImage("gallery", index)}>{t("Remove image {number}", { number: index + 2 })}</button></>}</div>)}</div>
                </div>
                {uploadingImage && <p className="editor-hint" role="status">{t("Uploading image…")}</p>}
                {formError && <p className="editor-error" role="alert">{t(formError)}</p>}
                <button className="primary-button" type="submit" disabled={busy || uploadingImage}>{busy ? t("Saving…") : t("Save product")}</button>
              </form>
            )}
            <div className="managed-products">
              {categoryProducts.length === 0 && <div className="empty-state">{t(category === "haircut" ? "No haircuts yet. Add your first service above." : "No packages yet. Add your first service above.")}</div>}
              {categoryProducts.map((product, index) => (
                <article className={`managed-product ${product.active ? "" : "is-hidden"}`} key={product.id}>
                  {product.picture && <img src={product.picture} alt="" />}
                  <div className="managed-product-info"><div className="managed-title"><h3>{product.title}</h3><span className={product.active ? "status-pill visible" : "status-pill"}>{t(product.active ? "Visible" : "Hidden")}</span></div><p>{product.price} {t("EGP")}{product.duration ? ` · ${product.duration} ${t("min")}` : ""}</p></div>
                  <div className="managed-actions"><button title={t("Move up")} aria-label={t("Move {title} up", { title: product.title })} disabled={index === 0 || busy} onClick={() => moveProduct(index, -1)}>↑</button><button title={t("Move down")} aria-label={t("Move {title} down", { title: product.title })} disabled={index === categoryProducts.length - 1 || busy} onClick={() => moveProduct(index, 1)}>↓</button><button disabled={busy} onClick={() => beginEdit(product)}>{t("Edit")}</button><button disabled={busy} onClick={() => toggleProduct(product)}>{t(product.active ? "Hide" : "Show")}</button><button className="danger-action" disabled={busy} onClick={() => deleteProduct(product)}>{t("Delete")}</button></div>
                </article>
              ))}
            </div>
          </>
        ) : section === "appointments" ? (
          <section className="appointment-management" aria-labelledby="appointments-title">
            <div className="appointment-list-heading">
              <div><span className="eyebrow">{t("BOOKING MANAGEMENT")}</span><h2 id="appointments-title">{t("Appointments")}</h2></div>
              <span>{visibleAppointments.length} / {appointments.length}</span>
            </div>
            <div className="appointment-filters">
              <label>{t("Search appointments")}
                <input type="search" value={appointmentSearch} onChange={(event) => setAppointmentSearch(event.target.value)} placeholder={t("Name, phone, or booking reference")} />
              </label>
              <label>{t("Booking status")}
                <select value={appointmentStatus} onChange={(event) => setAppointmentStatus(event.target.value)}>
                  <option value="all">{t("All statuses")}</option>
                      {["pending_review", "awaiting_payment", "confirmed", "completed", "cancelled", "rejected"].map((status) => (
                        <option key={status} value={status}>{t(bookingStatusLabel(status))}</option>
                  ))}
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
              <div className="appointment-list">
                {visibleAppointments.map((appointment) => {
                  const contactNumber = whatsappNumber(appointment.customer.whatsapp);
                  const whatsappText = appointment.bookingStatus === "awaiting_payment"
                    ? t("Hello {name}, your HADAD request {reference} has been accepted. To confirm the appointment, a 50 EGP deposit is required. Please reply here for InstaPay or Vodafone Cash payment instructions. The deposit will be verified by our team.", {
                      name: appointment.customer.name,
                      reference: appointment.reference,
                    })
                    : t("Hello {name}, this is HADAD contacting you about your request {reference}. Please reply here so we can confirm availability and arrange your visit.", {
                      name: appointment.customer.name,
                      reference: appointment.reference,
                    });
                  const message = encodeURIComponent(whatsappText);
                  return (
                    <article className="appointment-card" key={appointment.id}>
                      <div className="appointment-card-top">
                        <div>
                          <span className="eyebrow">{appointment.reference}</span>
                          <h3>{appointment.customer.name}</h3>
                          <p>{t("Request received")}: {new Date(appointment.createdAt).toLocaleString(language === "ar" ? "ar-EG" : "en")}</p>
                        </div>
                        <span className={`appointment-status status-${appointment.bookingStatus}`}>{t(bookingStatusLabel(appointment.bookingStatus))}</span>
                      </div>
                      <div className="appointment-services">
                        {appointment.services.map((service) => (
                          <div key={service.productId}><span>{service.title}</span><strong>{service.price} {t("EGP")}</strong></div>
                        ))}
                      </div>
                      <div className="appointment-card-meta">
                        <span>{t("Duration")}: {appointment.duration} {t("min")}</span>
                        <strong>{t("Total")}: {appointment.total} {t("EGP")}</strong>
                        <span>{t("Deposit")}: {appointment.deposit} {t("EGP")} · {t(depositStatusLabel(appointment.depositStatus))}</span>
                      </div>
                      <details className="appointment-details">
                        <summary>{t("View appointment details")}</summary>
                        <dl>
                          <div><dt>{t("Phone / WhatsApp")}</dt><dd>{appointment.customer.whatsapp}</dd></div>
                          {appointment.customer.email && <div><dt>{t("Email")}</dt><dd>{appointment.customer.email}</dd></div>}
                          <div><dt>{t("Notes")}</dt><dd>{appointment.notes || t("No notes provided.")}</dd></div>
                        </dl>
                      </details>
                      <div className="appointment-actions">
                        {contactNumber && <a href={`https://wa.me/${contactNumber}?text=${message}`} target="_blank" rel="noreferrer">{t("Contact on WhatsApp")}</a>}
                        {appointment.bookingStatus === "pending_review" && <>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => updateAppointment(appointment, {
                              bookingStatus: "awaiting_payment",
                              ...(appointment.depositStatus === "payment_verified" ? {} : { depositStatus: "awaiting_payment" }),
                            })}
                          >{t("Accept & request deposit")}</button>
                          <button type="button" className="danger-action" disabled={busy} onClick={() => updateAppointment(appointment, { bookingStatus: "rejected" })}>{t("Reject")}</button>
                        </>}
                        {appointment.bookingStatus === "awaiting_payment" && <>
                          <button type="button" disabled={busy || appointment.depositStatus !== "payment_verified"} onClick={() => updateAppointment(appointment, { bookingStatus: "confirmed" })}>{t("Confirm appointment")}</button>
                          {appointment.depositStatus !== "payment_verified" && <span className="appointment-payment-hint">{t("Verify the deposit before confirming.")}</span>}
                          <button type="button" className="danger-action" disabled={busy} onClick={() => updateAppointment(appointment, { bookingStatus: "rejected" })}>{t("Reject")}</button>
                          <button type="button" className="danger-action" disabled={busy} onClick={() => updateAppointment(appointment, { bookingStatus: "cancelled" })}>{t("Cancel appointment")}</button>
                        </>}
                        {appointment.bookingStatus === "confirmed" && <>
                          <button type="button" disabled={busy} onClick={() => updateAppointment(appointment, { bookingStatus: "completed" })}>{t("Mark completed")}</button>
                          <button type="button" className="danger-action" disabled={busy} onClick={() => updateAppointment(appointment, { bookingStatus: "cancelled" })}>{t("Cancel appointment")}</button>
                        </>}
                        <label className="deposit-status-control">{t("Deposit status")}
                          <select disabled={busy} value={appointment.depositStatus} onChange={(event) => updateAppointment(appointment, { depositStatus: event.target.value })}>
                            <option value="not_requested" disabled={appointment.depositStatus !== "not_requested"}>{t("Not Requested")}</option>
                            <option value="awaiting_payment" disabled={appointment.depositStatus !== "awaiting_payment" && appointment.bookingStatus !== "awaiting_payment"}>{t("Awaiting Payment")}</option>
                            <option value="payment_verified" disabled={appointment.depositStatus !== "awaiting_payment" && appointment.depositStatus !== "payment_verified"}>{t("Payment Verified")}</option>
                            <option value="refunded" disabled={appointment.depositStatus !== "refunded" && (appointment.depositStatus !== "payment_verified" || !["cancelled", "rejected"].includes(appointment.bookingStatus))}>{t("Refunded")}</option>
                          </select>
                        </label>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        ) : section === "requests" ? (
          <div className="request-list">
            {bookings.length === 0 && <div className="empty-state">{t("Customer requests will appear here once submitted.")}</div>}
            {bookings.map((booking) => (
              <article className="request-card" key={booking.id}>
                <div className="request-head"><div><span className="eyebrow">{t("REQUEST · {date}", { date: booking.createdAt ? new Date(booking.createdAt).toLocaleString(language === "ar" ? "ar-EG" : "en") : t("Date unavailable") })}</span><h2>{booking.customer.name}</h2></div><a href={`https://wa.me/${whatsappNumber(booking.customer.whatsapp)}`} target="_blank" rel="noreferrer">{t("WhatsApp")} ↗</a></div>
                <div className="request-contact"><span>{booking.customer.whatsapp}</span><span>{booking.customer.email}</span></div>
                <div className="request-products">{booking.products.map((item, index) => <div key={`${item.productId}-${index}`}><span>{item.title}</span><strong>{item.price} {t("EGP")}</strong></div>)}</div>
                <div className="request-totals"><div><span>{t("Total")}</span><strong>{booking.total} {t("EGP")}</strong></div><div><span>{t("Deposit")}</span><strong>{booking.deposit} {t("EGP")}</strong></div><div><span>{t("Remaining")}</span><strong>{booking.remaining} {t("EGP")}</strong></div></div>
                <div className="request-controls"><label>{t("Request status")}<select disabled={busy} value={booking.bookingStatus || "pending"} onChange={(event) => updateBooking(booking.id, "bookingStatus", event.target.value)}><option value="pending">{t("Pending")}</option><option value="confirmed">{t("Confirmed")}</option><option value="completed">{t("Completed")}</option><option value="cancelled">{t("Cancelled")}</option></select></label><label>{t("Payment status")}<select disabled={busy} value={booking.paymentStatus || "pending"} onChange={(event) => updateBooking(booking.id, "paymentStatus", event.target.value)}><option value="pending">{t("Pending")}</option><option value="confirmed">{t("Confirmed")}</option><option value="rejected">{t("Rejected")}</option></select></label></div>
              </article>
            ))}
          </div>
        ) : (
          <ContactSettings contactSettings={contactSettings} onSave={onSaveContactSettings} />
        )}
      </section>
      </main>
    </>
  );
}

export default Dashboard;
