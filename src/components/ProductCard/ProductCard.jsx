/* eslint-disable react/prop-types -- The app uses JavaScript components without PropTypes. */
import "./ProductCard.css";
import { useState } from "react";
import { useLanguage } from "../../lib/i18n";

function ProductCard({
  product,
  isSelected,
  onOpen,
}) {
  const { t, language } = useLanguage();
  const [imageFailed, setImageFailed] = useState(false);
  const currentPrice = Number(product.price);
  const oldPrice = product.oldPrice == null || product.oldPrice === "" ? NaN : Number(product.oldPrice);
  const hasDiscount = Number.isFinite(currentPrice)
    && currentPrice >= 0
    && Number.isFinite(oldPrice)
    && oldPrice > currentPrice;
  const discountPercent = hasDiscount ? Math.round(((oldPrice - currentPrice) / oldPrice) * 100) : 0;
  const numberLocale = language === "ar" ? "ar-EG" : "en-EG";
  const formatPrice = (price) => Number.isFinite(Number(price))
    ? new Intl.NumberFormat(numberLocale, { maximumFractionDigits: 2 }).format(Number(price))
    : price;
  const duration = Number(product.duration);
  const hasDuration = product.duration != null && product.duration !== "" && Number.isFinite(duration) && duration > 0;
  const description = typeof product.description === "string" ? product.description.trim() : "";

  return (
    <article className={`product-card ${isSelected ? "selected" : ""}`}>
      <div className="product-card-image">
        {product.picture && !imageFailed
          ? <img src={product.picture} alt={product.title} loading="lazy" decoding="async" onError={() => setImageFailed(true)} />
          : <div className="product-image-placeholder" role="img" aria-label={t("No image available")}>HADAD</div>}

        {isSelected && (
          <span className="selected-badge">
            {t("Selected")}
          </span>
        )}
      </div>

      <div className="product-card-content">
        <span className="product-category">{t(product.category === "haircut" ? "Haircut" : "Package")}</span>

        <h3>{product.title}</h3>

        {description
          ? <p className="product-card-description">{description}</p>
          : <p className="product-card-description is-empty" aria-hidden="true" />}
        {hasDuration && <span className="card-duration" dir="auto">{new Intl.NumberFormat(numberLocale).format(duration)} {t("min")}</span>}

        <div className="product-price">
          <div className="product-price-values">
            {hasDiscount && <span className="old-price" dir="ltr">{formatPrice(oldPrice)} {t("EGP")}</span>}
            <span className="current-price" dir="ltr">{formatPrice(product.price)} {t("EGP")}</span>
          </div>
          {hasDiscount && <span className="product-discount" aria-label={t("{percent}% discount", { percent: discountPercent })}>-{discountPercent}%</span>}
        </div>

        <button
          type="button"
          className="details-button"
          aria-label={t("View details for {title}", { title: product.title })}
          onClick={(event) => {
            event.stopPropagation();
            onOpen(product);
          }}
        >
          {t("View Details")}
        </button>
      </div>
    </article>
  );
}

export default ProductCard;
