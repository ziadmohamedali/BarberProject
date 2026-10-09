import { useEffect, useState } from "react";
import "./ProductModal.css";

function ProductModal({
  product,
  isSelected,
  onClose,
  onSelect,
  onRemove,
}) {
  const initialImage = product?.picture || product?.gallery?.[0] || "";
  const [activeImage, setActiveImage] = useState(initialImage);

  useEffect(() => {
    setActiveImage(initialImage);
  }, [product?.id, initialImage]);

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
        <button className="close-button" onClick={onClose}>
          ×
        </button>

        <div className="modal-image-section">
          {activeImage
            ? <img className="modal-main-image" src={activeImage} alt={product.title} />
            : <div className="modal-image-placeholder" role="img" aria-label="No image available">HADAD</div>}

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
              ? "Haircut"
              : "Package"}
          </span>

          <h2 id="product-modal-title">{product.title}</h2>

          <p>
            {product.popupDescription ||
              product.description}
          </p>

                    {product.duration && (
            <div className="product-duration">{product.duration} min</div>
          )}

          <div className="product-price">
                        {product.oldPrice !== null && product.oldPrice !== undefined && product.oldPrice !== "" && (
              <span className="old-price">
                {product.oldPrice} EGP
              </span>
            )}

            <span className="current-price">
              {product.price} EGP
            </span>
          </div>

          <button
            className="select-product-button"
            onClick={handleSelect}
          >
            {isSelected
              ? "Remove from Selection"
              : "Select Product"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ProductModal;