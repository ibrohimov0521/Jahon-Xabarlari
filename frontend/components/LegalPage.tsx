import type { ReactNode } from "react";
import Link from "next/link";
import { Header } from "./Header";
import { SITE_CONTACT_EMAIL, SITE_NAME } from "../lib/site";

type LegalSection = { title: string; children: ReactNode };

type LegalPageProps = {
  title: string;
  intro: string;
  sections: LegalSection[];
  children?: ReactNode;
};

export function LegalPage({ title, intro, sections, children }: LegalPageProps) {
  return (
    <main className="min-h-screen">
      <Header />
      <section className="container-page py-8 sm:py-12">
        <article className="mx-auto max-w-4xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-8 lg:p-10">
          <div className="border-b border-slate-200 pb-6 dark:border-slate-700">
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">{SITE_NAME}</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 dark:text-white sm:text-4xl">{title}</h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600 dark:text-slate-300">{intro}</p>
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Last updated: 23 August 2026</p>
          </div>
          <div className="mt-8 grid gap-8 text-[15px] leading-7 text-slate-700 dark:text-slate-300">
            {sections.map((section) => (
              <section key={section.title}>
                <h2 className="text-xl font-bold text-slate-950 dark:text-white">{section.title}</h2>
                <div className="mt-3 space-y-3">{section.children}</div>
              </section>
            ))}
            {children}
          </div>
          <footer className="mt-10 border-t border-slate-200 pt-6 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-400">
            <p>Questions or requests: <a className="font-semibold text-blue-600 hover:underline dark:text-blue-400" href={`mailto:${SITE_CONTACT_EMAIL}`}>{SITE_CONTACT_EMAIL}</a></p>
            <nav className="mt-3 flex flex-wrap gap-x-4 gap-y-2" aria-label="Legal pages">
              <Link className="hover:text-blue-600 hover:underline" href="/privacy">Privacy Policy</Link>
              <Link className="hover:text-blue-600 hover:underline" href="/terms">Terms of Service</Link>
              <Link className="hover:text-blue-600 hover:underline" href="/data-deletion">Data Deletion</Link>
            </nav>
          </footer>
        </article>
      </section>
    </main>
  );
}
