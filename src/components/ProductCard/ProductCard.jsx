import "./ProductCard.css";

function ProductCard({
  product,
  isSelected,
  onOpen,
}) {
  return (
    <article className={`product-card ${isSelected ? "selected" : ""}`}>
      <div className="product-card-image">
        {product.picture
          ? <img src={product.picture} alt={product.title} />
          : <div className="product-image-placeholder" role="img" aria-label="No image available">HADAD</div>}

        {isSelected && (
          <span className="selected-badge">
            Selected
          </span>
        )}
      </div>

      <div className="product-card-content">
        <span className="product-category">
          {product.category === "haircut" ? "Haircut" : "Package"}
        </span>

        <h3>{product.title}</h3>

                <p>{product.description}</p>
        {product.duration && <span className="card-duration">{product.duration} min</span>}

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
          className="details-button"
          onClick={() => onOpen(product)}
        >
          View Details
        </button>
      </div>
    </article>
  );
}

export default ProductCard;