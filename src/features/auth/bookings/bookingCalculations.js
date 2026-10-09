import { DEPOSIT_AMOUNT } from "./bookingConfig";

export function calculateBookingTotals(products) {
  const total = products.reduce((sum, product) => sum + Number(product.price), 0);
  return {
    total,
    deposit: DEPOSIT_AMOUNT,
    remaining: total - DEPOSIT_AMOUNT,
  };
}
