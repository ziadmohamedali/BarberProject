import { useMemo, useRef, useState } from "react";
import ContactSettings from "../../components/ContactSettings/ContactSettings";
import "./Dashboard.css";

const whatsappNumber = (number = "") => {
  const digits = number.replace(/\D/g, "");
  return digits.startsWith("0") ? `20${digits.slice(1)}` : digits;
};

const emptyProduct = (category) => ({
  picture: "", title: "", description: "", price: "", oldPrice: "",
  category, duration: "", active: true, gallery: [],
});

function Dashboard({ theme, onToggleTheme, products, bookings, contactSettings, onCreateProduct, onUploadProductImage, onDeleteUnusedProductImages, onUpdateProduct, onDeleteProduct, onReorderProducts, onUpdateBooking, onSaveContactSettings, onChangeOwnerPassword, onBackToShop, onLogout, onReload }) {
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
      setActionError(error.message || "The change could not be saved. Please try again.");
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
      setFormError(error.message || "The image could not be uploaded.");
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
        setFormError(`Image was removed from the draft, but cleanup failed: ${error.message}`);
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
      setFormError(error.message || "New images could not be cleaned up. Please try again.");
    }
  };

  const saveProduct = async (event) => {
    event.preventDefault();
    const price = Number(draft.price);
    if (!draft.picture) {
      setFormError("Upload a main product image before saving.");
      return;
    }
    if (!draft.title.trim() || draft.title.trim().length > 30 || !draft.description.trim() || !Number.isInteger(price) || price <= 0) {
      setFormError("Add a title (up to 30 characters), a description, and a whole-number price above 0.");
      return;
    }
    const oldPrice = draft.oldPrice === "" ? null : Number(draft.oldPrice);
    if (draft.oldPrice !== "" && (!Number.isInteger(oldPrice) || oldPrice <= 0)) {
      setFormError("Enter a positive whole-number old price or leave it empty.");
      return;
    }
    const duration = draft.duration === "" ? null : Number(draft.duration);
    if (duration !== null && (!Number.isInteger(duration) || duration <= 0)) {
      setFormError("Duration must be a positive whole number of minutes.");
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
          throw new Error(`Product saved, but unused images could not be cleaned up: ${error.message}`);
        }
      }
    });
  };

  const deleteProduct = (product) => {
    if (window.confirm(`Are you sure you want to delete “${product.title}”?`)) {
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

  const changePassword = async (event) => {
    event.preventDefault();
    setPasswordError("");
    setPasswordSaved(false);

    if (passwordForm.next.length < 8) {
      setPasswordError("Use at least 8 characters for the new password.");
      return;
    }
    if (passwordForm.next !== passwordForm.confirmation) {
      setPasswordError("The new passwords do not match.");
      return;
    }
    if (passwordForm.current === passwordForm.next) {
      setPasswordError("Choose a new password different from your current one.");
      return;
    }

    setPasswordBusy(true);
    try {
      await onChangeOwnerPassword(passwordForm.current, passwordForm.next);
      setPasswordForm({ current: "", next: "", confirmation: "" });
      setPasswordSaved(true);
    } catch (error) {
      setPasswordError(error.message || "The password could not be changed. Please try again.");
    } finally {
      setPasswordBusy(false);
    }
  };

  return (
    <main className="dashboard-page">
      <header className="dashboard-header">
        <a className="brand-mark" href="/dashboard">HADAD<span>.</span></a>
        <div><span className="dashboard-kicker">OWNER SPACE</span><button className="outline-button theme-toggle" type="button" onClick={onToggleTheme} aria-label={`Switch to ${theme === "dark" ? "White" : "dark"} theme`}>{theme === "dark" ? "White" : "Dark"}</button><button className="outline-button" onClick={onBackToShop}>← Back to shop</button><button className="outline-button" onClick={onLogout}>Log out</button></div>
      </header>

      <section className="dashboard-shell" id="dashboard">
        <div className="dashboard-title-row">
          <div><span className="eyebrow">SHOP MANAGEMENT</span><h1>Dashboard</h1></div>
          <div className="dashboard-nav">
            <button className={section === "products" ? "active" : ""} onClick={() => setSection("products")}>Products <span>{products.length}</span></button>
            <button className={section === "requests" ? "active" : ""} onClick={() => setSection("requests")}>Requests <span>{bookings.length}</span></button>
            <button className={section === "contact-settings" ? "active" : ""} onClick={() => setSection("contact-settings")}>Contact Settings</button>
          </div>
        </div>

        {actionError && <p className="editor-error" role="alert">{actionError} <button type="button" className="text-button" onClick={onReload}>Reload data</button></p>}

        <details className="account-security">
          <summary>Change owner password</summary>
          <form className="password-change-form" onSubmit={changePassword}>
            <label>Current password<input type="password" autoComplete="current-password" required value={passwordForm.current} onChange={(event) => setPasswordForm((current) => ({ ...current, current: event.target.value }))} /></label>
            <label>New password<input type="password" autoComplete="new-password" minLength={8} required value={passwordForm.next} onChange={(event) => setPasswordForm((current) => ({ ...current, next: event.target.value }))} /></label>
            <label>Confirm new password<input type="password" autoComplete="new-password" minLength={8} required value={passwordForm.confirmation} onChange={(event) => setPasswordForm((current) => ({ ...current, confirmation: event.target.value }))} /></label>
            {passwordError && <p className="editor-error" role="alert">{passwordError}</p>}
            {passwordSaved && <p className="password-saved" role="status">Password updated successfully.</p>}
            <button className="primary-button" type="submit" disabled={passwordBusy}>{passwordBusy ? "Updating…" : "Update password"}</button>
          </form>
        </details>

        {section === "products" ? (
          <>
            <div className="dashboard-toolbar">
              <div className="dashboard-tabs">
                <button className={category === "haircut" ? "active" : ""} onClick={() => setCategory("haircut")}>Haircuts</button>
                <button className={category === "package" ? "active" : ""} onClick={() => setCategory("package")}>Packages</button>
              </div>
              <button className="primary-button" onClick={beginAdd}>＋ Add product</button>
            </div>
            {draft && (
              <form className="product-editor" onSubmit={saveProduct}>
                <div className="editor-heading"><div><span className="eyebrow">{editingId === null ? "NEW SERVICE" : "UPDATE SERVICE"}</span><h2>{editingId === null ? "Add a product" : "Edit product"}</h2></div><button type="button" className="text-button" disabled={uploadingImage || busy} onClick={cancelDraft}>Cancel</button></div>
                <div className="editor-grid">
                  <label className="wide-field">Main image file {editingId === null ? "(required)" : "(optional replacement)"}<input type="file" accept="image/jpeg,image/png,image/webp" required={editingId === null && !draft.picture} disabled={uploadingImage} onChange={(event) => uploadImage(event, "picture")} /></label>
                  {draft.picture && <div className="image-preview-field"><img className="product-image-preview" src={draft.picture} alt="Main product preview" /><button type="button" className="text-button" disabled={uploadingImage || busy} onClick={() => removeDraftImage("picture")}>Remove main image</button></div>}
                  <label>Title<input required maxLength={30} value={draft.title} onChange={(event) => updateDraft("title", event.target.value)} placeholder="Classic Haircut" /></label>
                  <label>Category<select value={draft.category} onChange={(event) => updateDraft("category", event.target.value)}><option value="haircut">Haircut</option><option value="package">Package</option></select></label>
                  <label>Duration in minutes (optional)<input type="number" min="1" step="1" value={draft.duration} onChange={(event) => updateDraft("duration", event.target.value)} placeholder="30" /></label>
                  <label>Description<textarea required rows="3" value={draft.description} onChange={(event) => updateDraft("description", event.target.value)} /></label>
                  <label>Price (EGP)<input required type="number" min="1" step="1" value={draft.price} onChange={(event) => updateDraft("price", event.target.value)} /></label>
                  <label>Old price (optional)<input type="number" min="1" step="1" value={draft.oldPrice} onChange={(event) => updateDraft("oldPrice", event.target.value)} /></label>
                  <div className="wide-field gallery-fields"><span>Additional images (optional, up to 4)</span>{[0, 1, 2, 3].map((index) => <div className="gallery-image-field" key={index}><label>Image {index + 2}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploadingImage} onChange={(event) => uploadImage(event, "gallery", index)} /></label>{draft.gallery[index] && <><img className="product-image-preview" src={draft.gallery[index]} alt={`Product image ${index + 2} preview`} /><button type="button" className="text-button" disabled={uploadingImage || busy} onClick={() => removeDraftImage("gallery", index)}>Remove image {index + 2}</button></>}</div>)}</div>
                </div>
                {uploadingImage && <p className="editor-hint" role="status">Uploading image…</p>}
                {formError && <p className="editor-error" role="alert">{formError}</p>}
                <button className="primary-button" type="submit" disabled={busy || uploadingImage}>{busy ? "Saving…" : "Save product"}</button>
              </form>
            )}
            <div className="managed-products">
              {categoryProducts.length === 0 && <div className="empty-state">No {category === "haircut" ? "haircuts" : "packages"} yet. Add your first service above.</div>}
              {categoryProducts.map((product, index) => (
                <article className={`managed-product ${product.active ? "" : "is-hidden"}`} key={product.id}>
                  {product.picture && <img src={product.picture} alt="" />}
                  <div className="managed-product-info"><div className="managed-title"><h3>{product.title}</h3><span className={product.active ? "status-pill visible" : "status-pill"}>{product.active ? "Visible" : "Hidden"}</span></div><p>{product.price} EGP{product.duration ? ` · ${product.duration} min` : ""}</p></div>
                  <div className="managed-actions"><button title="Move up" aria-label={`Move ${product.title} up`} disabled={index === 0 || busy} onClick={() => moveProduct(index, -1)}>↑</button><button title="Move down" aria-label={`Move ${product.title} down`} disabled={index === categoryProducts.length - 1 || busy} onClick={() => moveProduct(index, 1)}>↓</button><button disabled={busy} onClick={() => beginEdit(product)}>Edit</button><button disabled={busy} onClick={() => toggleProduct(product)}>{product.active ? "Hide" : "Show"}</button><button className="danger-action" disabled={busy} onClick={() => deleteProduct(product)}>Delete</button></div>
                </article>
              ))}
            </div>
          </>
        ) : section === "requests" ? (
          <div className="request-list">
            {bookings.length === 0 && <div className="empty-state">Customer requests will appear here once submitted.</div>}
            {bookings.map((booking) => (
              <article className="request-card" key={booking.id}>
                <div className="request-head"><div><span className="eyebrow">REQUEST · {booking.createdAt ? new Date(booking.createdAt).toLocaleString() : "Date unavailable"}</span><h2>{booking.customer.name}</h2></div><a href={`https://wa.me/${whatsappNumber(booking.customer.whatsapp)}`} target="_blank" rel="noreferrer">WhatsApp ↗</a></div>
                <div className="request-contact"><span>{booking.customer.whatsapp}</span><span>{booking.customer.email}</span></div>
                <div className="request-products">{booking.products.map((item, index) => <div key={`${item.productId}-${index}`}><span>{item.title}</span><strong>{item.price} EGP</strong></div>)}</div>
                <div className="request-totals"><div><span>Total</span><strong>{booking.total} EGP</strong></div><div><span>Deposit</span><strong>{booking.deposit} EGP</strong></div><div><span>Remaining</span><strong>{booking.remaining} EGP</strong></div></div>
                <div className="request-controls"><label>Request status<select disabled={busy} value={booking.bookingStatus || "pending"} onChange={(event) => updateBooking(booking.id, "bookingStatus", event.target.value)}><option value="pending">Pending</option><option value="confirmed">Confirmed</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></label><label>Payment status<select disabled={busy} value={booking.paymentStatus || "pending"} onChange={(event) => updateBooking(booking.id, "paymentStatus", event.target.value)}><option value="pending">Pending</option><option value="confirmed">Confirmed</option><option value="rejected">Rejected</option></select></label></div>
              </article>
            ))}
          </div>
        ) : (
          <ContactSettings contactSettings={contactSettings} onSave={onSaveContactSettings} />
        )}
      </section>
    </main>
  );
}

export default Dashboard;
