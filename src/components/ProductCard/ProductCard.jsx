import "./ProductCard.css";
import { useLanguage } from "../../lib/i18n";

function ProductCard({
  product,
  isSelected,
  onOpen,
}) {
  const { t } = useLanguage();
  return (
    <article className={`product-card ${isSelected ? "selected" : ""}`}>
      <div className="product-card-image">
        {product.picture
          ? <img src={product.picture} alt={product.title} />
          : <div className="product-image-placeholder" role="img" aria-label={t("No image available")}>HADAD</div>}

        {isSelected && (
          <span className="selected-badge">
            {t("Selected")}
          </span>
        )}
      </div>

      <div className="product-card-content">
        <span className="product-category">
          {t(product.category === "haircut" ? "Haircut" : "Package")}
        </span>

        <h3>{product.title}</h3>

                <p>{product.description}</p>
        {product.duration && <span className="card-duration">{product.duration} {t("min")}</span>}

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
          className="details-button"
          onClick={() => onOpen(product)}
        >
          {t("View Details")}
        </button>
      </div>
    </article>
  );
}

export default ProductCard;