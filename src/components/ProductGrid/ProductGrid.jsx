import ProductCard from "../ProductCard/ProductCard";
import "./ProductGrid.css";

function ProductGrid({
  products,
  selectedProducts,
  onOpenProduct,
}) {
  return (
    <div className="product-grid">
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          isSelected={selectedProducts.some(
            (selected) => selected.id === product.id
          )}
          onOpen={onOpenProduct}
        />
      ))}
    </div>
  );
}

export default ProductGrid;