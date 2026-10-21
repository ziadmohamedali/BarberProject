/* eslint-disable react/prop-types -- Existing app uses JavaScript components without PropTypes. */
function ImageInput({ id, label, image, alt, onChange, onRemove, disabled, primary = false, t }) {
  return (
    <article className={`product-image-slot${image ? " has-image" : ""}${primary ? " primary-image-slot" : ""}`}>
      <div className="product-image-slot-preview">
        {image ? <img src={image} alt={alt} /> : <span aria-hidden="true">{primary ? "H." : "+"}</span>}
      </div>
      <div className="product-image-slot-actions">
        <label htmlFor={id} className="image-action-button">{image ? t("Replace image") : primary ? t("Upload main image") : label}</label>
        <input id={id} type="file" accept="image/jpeg,image/png,image/webp" required={primary && !image} disabled={disabled} onChange={onChange} />
        {image && <button type="button" className="image-remove-button" disabled={disabled} onClick={onRemove}>{t("Remove")}</button>}
      </div>
    </article>
  );
}

export default function ProductEditor({ draft, editing, error, busy, uploading, progress, onChange, onUpload, onRemoveImage, onSave, onCancel, onArchive, onDelete, t }) {
  return (
    <form id="product-editor" className="product-editor product-editor-premium" onSubmit={onSave}>
      <div className="product-editor-heading">
        <div><span className="eyebrow">{t(editing ? "EDIT SERVICE" : "NEW SERVICE")}</span><h2>{t(editing ? "Edit product" : "Add a product")}</h2>        <p>{t("Manage the details customers see on the Mohamed Hadad website.")}</p></div>        <button type="button" className="text-button" disabled={busy || uploading} onClick={onCancel}>{t("Cancel")}</button>
      </div>

      <section className="product-image-manager" aria-label={t("Product images")}>
        <div className="product-main-image">
          <div><span className="product-image-section-label">{t("Main image")}</span><small>{t("JPEG, PNG or WebP · Maximum 5 MB")}</small></div>
          <ImageInput t={t} id="product-main-image" label="Upload main image" image={draft.picture} alt={t("Main product preview")} primary disabled={busy || uploading} onChange={event => onUpload(event, "picture")} onRemove={() => onRemoveImage("picture")} />
        </div>
        <div className="product-gallery-manager">
          <div className="gallery-heading"><div><strong>{t("Gallery images")}</strong><span>{t("Up to 4 additional images")}</span></div><b>{draft.gallery.filter(Boolean).length} / 4</b></div>
          <div className="product-gallery-grid">
            {[0, 1, 2, 3].map(index => <ImageInput
              key={index}
              t={t}
              id={`product-gallery-${index}`}
              label={t("Add gallery image {number}", { number: index + 1 })}
              image={draft.gallery[index]}
              alt={t("Gallery image {number} preview", { number: index + 1 })}
              disabled={busy || uploading || (!draft.gallery[index] && draft.gallery.filter(Boolean).length >= 4)}
              onChange={event => onUpload(event, "gallery", index)}
              onRemove={() => onRemoveImage("gallery", index)}
            />)}
          </div>
        </div>
        {uploading && <div className="image-upload-progress" role="status"><span>{t("Uploading image…")} {progress}%</span><progress max="100" value={progress}>{progress}%</progress></div>}
      </section>

      <div className="editor-grid product-fields-grid">
        <label>{t("Product name")}<input required maxLength={30} value={draft.title} onChange={event => onChange("title", event.target.value)} autoComplete="off" /></label>
        <label>{t("Category")}<select value={draft.category} onChange={event => onChange("category", event.target.value)}><option value="haircut">{t("Haircut Service")}</option><option value="package">{t("Package")}</option></select></label>
        <label className="wide-field">{t("Description")}<textarea required rows="4" value={draft.description} onChange={event => onChange("description", event.target.value)} /></label>
        <label>{t("Price (EGP)")}<input required type="number" min="1" step="1" value={draft.price} onChange={event => onChange("price", event.target.value)} /></label>
        <label>{t("Old price (optional)")}<input type="number" min={Number(draft.price || 0) + 1} step="1" value={draft.oldPrice} onChange={event => onChange("oldPrice", event.target.value)} /></label>
        <label>{t("Duration in minutes (optional)")}<input type="number" min="1" step="1" value={draft.duration} onChange={event => onChange("duration", event.target.value)} /></label>
        <label>{t("Display order")}<input required type="number" min="0" step="1" value={draft.sortOrder} onChange={event => onChange("sortOrder", event.target.value)} /></label>
        <label className="product-active-toggle"><input type="checkbox" checked={draft.active} onChange={event => onChange("active", event.target.checked)} /><span><strong>{t("Active on public website")}</strong><small>{t("Inactive products are hidden from customers.")}</small></span></label>
      </div>

      {error && <p className="editor-error" role="alert">{error}</p>}
      <div className="product-form-actions">
        <div>{editing && <><button type="button" className="archive-product-button" disabled={busy || uploading} onClick={onArchive}>{t(draft.active ? "Archive product" : "Restore product")}</button><button type="button" className="danger-action" disabled={busy || uploading} onClick={onDelete}>{t("Delete product")}</button></>}</div>
        <div><button type="button" className="text-button" disabled={busy || uploading} onClick={onCancel}>{t("Cancel")}</button><button className="primary-button" type="submit" disabled={busy || uploading}>{busy ? t("Saving…") : t("Save product")}</button></div>
      </div>
    </form>
  );
}
