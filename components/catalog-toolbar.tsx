"use client";

import { useState, type FormEvent } from "react";
import { Plus, Search, SlidersHorizontal, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type CatalogToolbarProps = {
  query: string;
  placeholder: string;
  searchLabel: string;
  publishLabel: string;
  publishTitle: string;
  publishId?: string;
  publishDisabled?: boolean;
  onQueryChange: (value: string) => void;
  onSearch: (event: FormEvent<HTMLFormElement>) => void;
  onClear: () => void;
  onPublish: () => void;
  filterGroups?: { label: string; options: string[] }[];
  filterTitle?: string;
  filterLabel?: string;
  onFilter?: (value: string) => void;
  sortValue?: string;
  sortOptions?: { value: string; label: string; description?: string }[];
  onSort?: (value: string) => void;
};

export function CatalogToolbar({ query, placeholder, searchLabel, publishLabel, publishTitle, publishId, publishDisabled, onQueryChange, onSearch, onClear, onPublish, filterGroups, filterTitle = "Lọc nhanh mẫu nhà", filterLabel = "Bộ lọc mẫu nhà", onFilter, sortValue, sortOptions, onSort }: CatalogToolbarProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  return <section className="catalog-toolbar" aria-label="Đăng và tìm kiếm">
    <button data-requires-account id={publishId} type="button" disabled={publishDisabled} onClick={onPublish} className="catalog-publish-button" aria-label={publishTitle} title={publishTitle}>
      <span className="catalog-publish-icon"><Plus size={17} strokeWidth={2} aria-hidden="true"/></span>
      <span className="catalog-publish-label">{publishLabel}</span>
    </button>
    <form onSubmit={onSearch} className="catalog-search" role="search" aria-label={searchLabel}>
      <button type="submit" className="catalog-search-submit" aria-label={searchLabel} title={searchLabel}><Search size={18} aria-hidden="true"/></button>
      <input type="search" value={query} onChange={event => onQueryChange(event.target.value)} placeholder={placeholder} aria-label={searchLabel} maxLength={120}/>
      {query && <button type="button" onClick={onClear} className="catalog-search-clear" aria-label="Xóa tìm kiếm"><X size={16} aria-hidden="true"/></button>}
    </form>
    {filterGroups && onFilter && <Popover open={filtersOpen} onOpenChange={setFiltersOpen}>
      <PopoverTrigger asChild><button type="button" className="catalog-filter-button" aria-label={filterLabel}><SlidersHorizontal size={17} aria-hidden="true"/><span>Bộ lọc</span></button></PopoverTrigger>
      <PopoverContent align="end" className="w-[min(320px,calc(100vw-2rem))] rounded-xl p-4">
        <p className="mb-3 text-sm font-semibold">{filterTitle}</p>
        {sortOptions && onSort && <div className="mb-3"><p className="mb-1.5 text-xs text-[#667085]">Sắp xếp</p><div className="flex flex-wrap gap-1.5">{sortOptions.map(option => <button key={option.value} type="button" title={option.description} aria-pressed={sortValue === option.value} onClick={() => { onSort(option.value); setFiltersOpen(false); }} className={`rounded-lg border px-2.5 py-1.5 text-xs hover:border-[#229ed9] hover:text-[#168ac0] ${sortValue === option.value ? "border-[#229ed9] bg-[#edf8fd] text-[#168ac0]" : "border-[#e3eaf2] text-[#475467]"}`}>{option.label}</button>)}</div></div>}
        {filterGroups.map(group => <div key={group.label} className="mb-3"><p className="mb-1.5 text-xs text-[#667085]">{group.label}</p><div className="flex flex-wrap gap-1.5">{group.options.map(value => <button key={value} type="button" aria-pressed={query === value} onClick={() => { onFilter(value); setFiltersOpen(false); }} className={`rounded-lg border px-2.5 py-1.5 text-xs hover:border-[#229ed9] hover:text-[#168ac0] ${query === value ? "border-[#229ed9] bg-[#edf8fd] text-[#168ac0]" : "border-[#e3eaf2] text-[#475467]"}`}>{value}</button>)}</div></div>)}
        <button type="button" onClick={() => { onClear(); setFiltersOpen(false); }} className="text-xs font-semibold text-[#168ac0]">Xóa bộ lọc</button>
      </PopoverContent>
    </Popover>}
  </section>;
}
