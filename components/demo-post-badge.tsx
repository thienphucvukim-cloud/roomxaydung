export function DemoPostBadge({ isDemo = false }: { isDemo?: boolean }) {
  if (!isDemo) return null;
  return <span data-demo-post="true" title="Nội dung demo dùng để kiểm tra website" className="inline-flex w-fit shrink-0 items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-bold leading-none text-amber-800">Bài demo</span>;
}
