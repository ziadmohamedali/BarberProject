import "./CategoryFilter.css";
import { useLanguage } from "../../lib/i18n";

function CategoryFilter({ activeCategory, onCategoryChange }) {
  const { t } = useLanguage();
  return (
    <div className="category-filter">
      <button
        className={activeCategory === "haircut" ? "active" : ""}
        onClick={() => onCategoryChange("haircut")}
      >
        {t("Haircuts")}
      </button>

      <button
        className={activeCategory === "package" ? "active" : ""}
        onClick={() => onCategoryChange("package")}
      >
        {t("Packages")}
      </button>
    </div>
  );
}

export default CategoryFilter;