import "./CategoryFilter.css";

function CategoryFilter({ activeCategory, onCategoryChange }) {
  return (
    <div className="category-filter">
      <button
        className={activeCategory === "haircut" ? "active" : ""}
        onClick={() => onCategoryChange("haircut")}
      >
        Haircuts
      </button>

      <button
        className={activeCategory === "package" ? "active" : ""}
        onClick={() => onCategoryChange("package")}
      >
        Packages
      </button>
    </div>
  );
}

export default CategoryFilter;