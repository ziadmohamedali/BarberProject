import { calculateBookingTotals } from "../../features/auth/bookings/bookingCalculations";
import "./SelectionSummary.css";

function SelectionSummary({
  selectedProducts,
  onRemove,
  onContinue,
}) {
  const { total, deposit } = calculateBookingTotals(selectedProducts);

  if (selectedProducts.length === 0) {
    return null;
  }

  return (
    <section className="selection-summary">
      <div className="section-heading">
        <span>Your Selection</span>
        <h2>Selected Products</h2>
      </div>

      <div className="selected-list">
        {selectedProducts.map((product) => (
          <div className="selected-item" key={product.id}>
            <div>
              <h3>{product.title}</h3>
              <p>{product.price} EGP</p>
            </div>

            <button onClick={() => onRemove(product.id)}>
              Remove
            </button>
          </div>
        ))}
      </div>

      <div className="selection-total">
        <span>Total</span>
        <strong>{total} EGP</strong>
      </div>

      {total < deposit && <p className="selection-minimum-note">Add services worth at least {deposit} EGP to continue.</p>}
      <button
        className="continue-button"
        onClick={onContinue}
        disabled={total < deposit}
      >
        Continue
      </button>
    </section>
  );
}

export default SelectionSummary;