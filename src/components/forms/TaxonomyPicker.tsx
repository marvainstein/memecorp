import { CATEGORIES, LANGUAGES, type TaxonomyItem } from "@/lib/memes/taxonomy";

type Props = {
  name: "categories" | "languages";
  defaultValue?: string[];
  legend?: string;
  columns?: string;
};

const SOURCES: Record<Props["name"], { items: readonly (TaxonomyItem | { slug: string; label: string })[]; legend: string }> = {
  categories: { items: CATEGORIES, legend: "Categorías" },
  languages: { items: LANGUAGES, legend: "Idiomas del texto" },
};

/** Group of Win95 checkboxes posting every checked slug under the same field name. */
export function TaxonomyPicker({ name, defaultValue = [], legend, columns = "grid-cols-2 sm:grid-cols-3" }: Props) {
  const { items, legend: fallback } = SOURCES[name];
  return (
    <fieldset className="win-groupbox">
      <legend>{legend ?? fallback}</legend>
      <div className={`grid gap-x-3 gap-y-1 ${columns}`}>
        {items.map((item) => (
          <label key={item.slug} className="flex min-w-0 cursor-pointer items-center gap-1.5">
            <input type="checkbox" name={name} value={item.slug} defaultChecked={defaultValue.includes(item.slug)} className="win-check" />
            <span className="truncate">{"es" in item ? item.es : item.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
