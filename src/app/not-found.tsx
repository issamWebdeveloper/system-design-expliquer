import Link from "next/link";
import { ArrowRight } from "lucide-react";
import EmptyIllustration from "@/components/site/EmptyIllustration";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-20 text-center md:py-28">
      <EmptyIllustration className="h-32 w-52" />
      <p className="text-brand mt-6 text-sm font-semibold tracking-widest">404</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-fg">This route has no upstream</h1>
      <p className="mt-3 text-muted">
        The page you asked for isn&apos;t part of any architecture here. Try one of the systems instead.
      </p>
      <Link
        href="/#catalogue"
        className="bg-brand shadow-soft mt-7 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-[#fff] transition-all hover:-translate-y-0.5"
      >
        Browse all systems <ArrowRight size={16} aria-hidden />
      </Link>
    </div>
  );
}
