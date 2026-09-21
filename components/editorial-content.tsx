import { BookOpen, CheckCircle2, Lightbulb } from "lucide-react";

export type EditorialSection = {
  title: string;
  paragraphs: string[];
  bullets?: string[];
};

type EditorialContentProps = {
  eyebrow?: string;
  title: string;
  intro: string;
  sections: EditorialSection[];
  checklist?: string[];
};

export function EditorialContent({ eyebrow = "HƯỚNG DẪN THỰC TẾ", title, intro, sections, checklist = [] }: EditorialContentProps) {
  return (
    <section className="mt-10 overflow-hidden rounded-[26px] border border-[#dfe8f1] bg-white shadow-[0_8px_30px_rgba(25,55,90,.05)]">
      <header className="border-b border-[#e7edf4] bg-gradient-to-br from-[#eef9fd] to-white px-6 py-7 sm:px-8 sm:py-9">
        <p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[.13em] text-[#168ac0]"><BookOpen size={16}/>{eyebrow}</p>
        <h2 className="mt-3 max-w-4xl text-2xl font-extrabold leading-tight tracking-[-.03em] text-[#0b2e59] sm:text-3xl">{title}</h2>
        <p className="mt-3 max-w-4xl text-[15px] leading-7 text-[#3f5064]">{intro}</p>
      </header>

      <div className="grid lg:grid-cols-[250px_minmax(0,1fr)]">
        <aside className="border-b border-[#e7edf4] bg-[#f8fbfd] p-6 lg:border-b-0 lg:border-r lg:p-7">
          <p className="text-xs font-extrabold uppercase tracking-[.12em] text-[#0b2e59]">Nội dung chính</p>
          <ol className="mt-4 space-y-3">
            {sections.map((section, index) => <li key={section.title} className="flex gap-3 text-sm font-semibold leading-5 text-[#40566f]"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-[#d9f1fb] text-xs font-extrabold text-[#147aa8]">{index + 1}</span>{section.title}</li>)}
          </ol>
        </aside>

        <article className="p-6 sm:p-8 lg:p-10">
          <div className="space-y-9">
            {sections.map((section, index) => <section key={section.title}>
              <h3 className="flex items-start gap-3 text-xl font-extrabold leading-7 tracking-[-.02em] text-[#0b2e59]"><span className="mt-0.5 text-[#229ed9]">{String(index + 1).padStart(2, "0")}.</span>{section.title}</h3>
              <div className="mt-3 space-y-3 text-[15px] leading-7 text-[#3f5064]">{section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div>
              {section.bullets?.length ? <ul className="mt-4 grid gap-3 sm:grid-cols-2">{section.bullets.map((bullet) => <li key={bullet} className="flex items-start gap-2.5 rounded-xl bg-[#f7fafc] p-3.5 text-sm font-medium leading-6 text-[#3f5064]"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#229ed9]"/>{bullet}</li>)}</ul> : null}
            </section>)}
          </div>

          {checklist.length ? <div className="mt-10 rounded-2xl border border-[#bfe4f4] bg-[#eef9fd] p-5 sm:p-6"><h3 className="flex items-center gap-2 font-extrabold text-[#0b2e59]"><Lightbulb className="size-5 text-[#229ed9]"/>Ghi nhớ trước khi quyết định</h3><ul className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">{checklist.map((item) => <li key={item} className="flex items-start gap-2 text-sm font-semibold leading-6 text-[#3f5064]"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-[#229ed9]"/>{item}</li>)}</ul></div> : null}
        </article>
      </div>
    </section>
  );
}