/* eslint-disable react/prop-types -- The app uses JavaScript components without PropTypes. */
import { useEffect, useState } from "react";
import { useLanguage } from "../../lib/i18n";
import useScrollLock from "../../hooks/useScrollLock";
import "./ProductModal.css";

function ProductModal({
  product,
  isSelected,
  onClose,
  onSelect,
  onRemove,
}) {
  const { t } = useLanguage();
  const initialImage = product?.picture || product?.gallery?.[0] || "";
  const [activeImage, setActiveImage] = useState(initialImage);

  useScrollLock(Boolean(product));

  useEffect(() => {
    setActiveImage(initialImage);
  }, [product?.id, initialImage]);

  useEffect(() => {
    if (!product) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [product, onClose]);

  if (!product) return null;

  const gallery = [product.picture, ...(product.gallery || []).filter(Boolean).slice(0, 4)];
  const availableGallery = gallery.filter(Boolean);

  const handleSelect = () => {
    if (isSelected) {
      onRemove(product);
    } else {
      onSelect(product);
    }
  };

  return (
        <div className="modal-overlay" onClick={onClose}>
      <div
        className="product-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button className="close-button" type="button" aria-label={t("Close details")} onClick={onClose}>
          ×
        </button>

        <div className="modal-image-section">
          {activeImage
            ? <img className="modal-main-image" src={activeImage} alt={product.title} />
            : <div className="modal-image-placeholder" role="img" aria-label={t("No image available")}>HADAD</div>}

          {availableGallery.length > 1 && (
              <div className="thumbnail-list">
                {availableGallery.map((image, index) => (
                  <button
                    key={`${image}-${index}`}
                    className={
                      activeImage === image
                        ? "thumbnail active"
                        : "thumbnail"
                    }
                    onClick={() => setActiveImage(image)}
                  >
                    <img
                      src={image}
                      alt={`${product.title} ${index + 1}`}
                    />
                  </button>
                ))}
              </div>
            )}
        </div>

        <div className="modal-content">
          <span className="product-category">
            {product.category === "haircut"
              ? t("Haircut")
              : t("Package")}
          </span>

          <h2 id="product-modal-title">{product.title}</h2>

          <p>
            {product.popupDescription ||
              product.description}
          </p>

                    {product.duration && (
            <div className="product-duration">{product.duration} {t("min")}</div>
          )}

          <div className="product-price">
                        {product.oldPrice !== null && product.oldPrice !== undefined && product.oldPrice !== "" && (
              <span className="old-price">
                {product.oldPrice} {t("EGP")}
              </span>
            )}

            <span className="current-price">
              {product.price} {t("EGP")}
            </span>
          </div>

          <button
            className="select-product-button"
            onClick={handleSelect}
          >
            {isSelected
              ? t("Remove from Selection")
              : t("Select Product")}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ProductModal;
