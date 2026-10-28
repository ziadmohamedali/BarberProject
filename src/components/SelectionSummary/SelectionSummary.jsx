/* eslint-disable react/prop-types -- The app uses JavaScript components without PropTypes. */
import { calculateBookingTotals } from "../../features/auth/bookings/bookingCalculations";
import { useLanguage } from "../../lib/i18n";
import "./SelectionSummary.css";

function SelectionSummary({
  selectedProducts,
  onRemove,
  onContinue,
}) {
  const { t } = useLanguage();
  const { total } = calculateBookingTotals(selectedProducts);

  if (selectedProducts.length === 0) {
    return null;
  }

  return (
    <section className="selection-summary">
      <div className="section-heading">
        <span>{t("Your Selection")}</span>
        <h2>{t("Selected Products")}</h2>
      </div>

      <div className="selected-list">
        {selectedProducts.map((product) => (
          <div className="selected-item" key={product.id}>
            <div>
              <h3>{product.title}</h3>
              <p>{product.price} {t("EGP")}</p>
            </div>

            <button onClick={() => onRemove(product.id)}>
              {t("Remove")}
            </button>
          </div>
        ))}
      </div>

      <div className="selection-total">
        <span>{t("Total")}</span>
        <strong>{total} {t("EGP")}</strong>
      </div>

      <button
        className="continue-button"
        onClick={onContinue}
      >
        {t("Continue")}
      </button>
    </section>
  );
}

export default SelectionSummary;
