import React, { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@animaapp/playground-react-sdk";
import { ArrowRight, CheckCircle, WarningCircle } from "@phosphor-icons/react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

const REASONS = [
  {
    n: "01",
    title: "Nobody knows what you do.",
    body: "Your homepage tries to say everything. It says nothing. Visitors bounce in four seconds because they couldn&#39;t find the one sentence that should have been at the top.",
  },
  {
    n: "02",
    title: "It loads like it&#39;s 2009.",
    body: "Bloated plugins, uncompressed images, render-blocking scripts. Every extra second costs you 7% of conversions. Do the math.",
  },
  {
    n: "03",
    title: "Your CTAs are invisible.",
    body: "You buried the most important button under three carousels and a stock photo of a handshake. No wonder nobody clicks it.",
  },
  {
    n: "04",
    title: "The mobile version is an afterthought.",
    body: "Half your traffic is on a phone. Your site treats them like second-class citizens with tiny tap targets and horizontal scroll nightmares.",
  },
  {
    n: "05",
    title: "Your copy sounds like a press release.",
    body: "&#39;Empowering synergistic solutions for tomorrow&#39;s challenges.&#39; We have no idea what you sell. Neither do your customers.",
  },
  {
    n: "06",
    title: "The forms are broken or terrifying.",
    body: "Twenty required fields, no inline validation, and a CAPTCHA from 2012. You&#39;re actively punishing people who want to give you money.",
  },
  {
    n: "07",
    title: "You have zero visual hierarchy.",
    body: "Everything is the same size, the same weight, the same urgency. The eye doesn&#39;t know where to go so it leaves.",
  },
  {
    n: "08",
    title: "Your nav menu is a labyrinth.",
    body: "Three levels deep, ambiguous labels, no clear path to purchase. Navigation should guide, not confuse. Yours confuses.",
  },
];

function useReveal<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) { setIsVisible(true); observer.disconnect(); }
      },
      { threshold: 0.08 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return { ref, isVisible };
}

function App() {
  useEffect(() => {
    document.title = "Unfuckyourweb — We Unfuck Your Website.";
    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  return (
    <div className="min-h-screen bg-black text-white font-sans">
      <SiteNav />
      <HeroSection />
      <ReasonsSection />
      <ContactSection />
      <SiteFooter />
    </div>
  );
}

function SiteNav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? "border-b border-white/10 bg-black/90 backdrop-blur-sm" : ""
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 md:px-12">
        <span className="font-mono text-sm tracking-widest uppercase text-white">
          Unfuckyourweb
        </span>
        <button
          type="button"
          onClick={() => {
            document.getElementById("contact")?.scrollIntoView({ behavior: "smooth" });
          }}
          className="font-mono text-xs tracking-widest uppercase text-white border border-white/40 px-4 py-2 hover:bg-white hover:text-black transition-all duration-200"
        >
          Get Unfucked →
        </button>
      </div>
    </header>
  );
}

function HeroSection() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 80);
    return () => clearTimeout(t);
  }, []);

  return (
    <section className="min-h-screen flex flex-col justify-end px-6 pt-32 pb-16 md:px-12 md:pb-20 border-b border-white/10">
      <div
        className={`transition-all duration-700 ease-out ${
          mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
        }`}
      >
        <p className="font-mono text-xs tracking-[0.3em] uppercase text-white/40 mb-8">
          Digital Agency · Est. 2024
        </p>
        <h1 className="font-heading text-[clamp(3.5rem,11vw,10rem)] leading-[0.9] tracking-tight text-white max-w-5xl">
          Your website<br />
          is <em>fucking</em><br />
          broken.
        </h1>
        <div className="mt-12 flex flex-col sm:flex-row items-start sm:items-end gap-8 sm:gap-16">
          <p className="max-w-sm text-base leading-7 text-white/50 font-light">
            We find exactly what&#39;s killing your conversions, confusing your visitors, and embarrassing your brand — then we fix it.
          </p>
          <button
            type="button"
            onClick={() => {
              document.getElementById("reasons")?.scrollIntoView({ behavior: "smooth" });
            }}
            className="font-mono text-xs tracking-widest uppercase text-white/40 hover:text-white transition-colors duration-200 flex items-center gap-2 shrink-0"
          >
            Scroll to see why
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </section>
  );
}

function ReasonsSection() {
  return (
    <section id="reasons" className="border-b border-white/10">
      <div className="mx-auto max-w-7xl px-6 md:px-12 py-16 md:py-20">
        <p className="font-mono text-xs tracking-[0.3em] uppercase text-white/30 mb-12">
          8 reasons it&#39;s fucked
        </p>
      </div>
      <div>
        {REASONS.map((reason, i) => (
          <ReasonRow key={reason.n} reason={reason} index={i} />
        ))}
      </div>
    </section>
  );
}

function ReasonRow({ reason, index }: { reason: typeof REASONS[0]; index: number }) {
  const { ref, isVisible } = useReveal<HTMLDivElement>();

  return (
    <div
      ref={ref}
      className={`group border-t border-white/10 px-6 md:px-12 py-8 md:py-10 transition-all duration-500 ease-out hover:bg-white/[0.03] ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      }`}
      style={{ transitionDelay: `${index * 40}ms` }}
    >
      <div className="mx-auto max-w-7xl flex items-start gap-6 md:gap-12">
        <span className="font-mono text-xs text-white/20 mt-1 shrink-0 w-7">
          {reason.n}
        </span>
        <div className="flex-1 md:flex md:items-baseline md:gap-12">
          <h3
            className="font-heading text-[clamp(1.6rem,3.5vw,2.8rem)] leading-tight text-white md:w-1/2 shrink-0"
            dangerouslySetInnerHTML={{ __html: reason.title }}
          />
          <p
            className="mt-3 md:mt-0 text-sm md:text-base leading-7 text-white/40 font-light md:flex-1"
            dangerouslySetInnerHTML={{ __html: reason.body }}
          />
        </div>
        <span className="hidden md:block shrink-0 text-white/10 group-hover:text-white/40 transition-colors duration-200 mt-1">
          <ArrowRight size={18} />
        </span>
      </div>
    </div>
  );
}

function ContactSection() {
  const { ref, isVisible } = useReveal<HTMLElement>();
  const { create, isPending, error } = useMutation("ContactSubmission");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const isFormValid = name.trim().length > 1 && email.trim().length > 4 && message.trim().length > 10;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFeedback(null);
    if (!isFormValid) {
      setFeedback({ type: "error", text: "Give us your name, a real email, and enough detail." });
      return;
    }
    try {
      await create({ name: name.trim(), email: email.trim(), message: message.trim() });
      setFeedback({ type: "success", text: "Got it. We&#39;ll take a look and get back to you." });
      setName(""); setEmail(""); setMessage("");
    } catch {
      setFeedback({ type: "error", text: "Didn&#39;t send. Try again." });
    }
  };

  return (
    <section
      id="contact"
      ref={ref}
      className={`px-6 md:px-12 py-24 md:py-32 border-b border-white/10 transition-all duration-700 ease-out ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
      }`}
    >
      <div className="mx-auto max-w-7xl">
        <div className="md:grid md:grid-cols-2 md:gap-24">
          <div>
            <p className="font-mono text-xs tracking-[0.3em] uppercase text-white/30 mb-8">
              Let&#39;s fix it
            </p>
            <h2 className="font-heading text-[clamp(2.8rem,6vw,5.5rem)] leading-[0.95] text-white mb-8">
              Ready to get<br /><em>unfucked?</em>
            </h2>
            <p className="text-sm leading-7 text-white/40 font-light max-w-xs">
              Tell us what&#39;s broken. We&#39;ll tear it apart, tell you exactly what&#39;s wrong, and fix it properly.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-12 md:mt-0 space-y-5" noValidate>
            <div>
              <label htmlFor="name" className="font-mono text-xs tracking-widest uppercase text-white/30 block mb-2">
                Name
              </label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                disabled={isPending}
                className="bg-transparent border-0 border-b border-white/20 rounded-none px-0 py-3 text-white placeholder:text-white/20 focus-visible:ring-0 focus-visible:border-white transition-colors duration-200 font-light"
              />
            </div>
            <div>
              <label htmlFor="email" className="font-mono text-xs tracking-widest uppercase text-white/30 block mb-2">
                Email
              </label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                disabled={isPending}
                className="bg-transparent border-0 border-b border-white/20 rounded-none px-0 py-3 text-white placeholder:text-white/20 focus-visible:ring-0 focus-visible:border-white transition-colors duration-200 font-light"
              />
            </div>
            <div>
              <label htmlFor="message" className="font-mono text-xs tracking-widest uppercase text-white/30 block mb-2">
                What&#39;s broken
              </label>
              <Textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Slow pages, bad UX, weak conversions, ugly hierarchy — be specific."
                disabled={isPending}
                className="bg-transparent border-0 border-b border-white/20 rounded-none px-0 py-3 text-white placeholder:text-white/20 focus-visible:ring-0 focus-visible:border-white transition-colors duration-200 font-light min-h-28 resize-none"
              />
            </div>

            {(feedback || error) && (
              <div
                className={`flex items-start gap-3 py-3 text-sm font-light ${
                  feedback?.type === "success" ? "text-green-400" : "text-amber-400"
                }`}
                aria-live="polite"
              >
                {feedback?.type === "success" ? (
                  <CheckCircle size={18} className="mt-0.5 shrink-0" />
                ) : (
                  <WarningCircle size={18} className="mt-0.5 shrink-0" />
                )}
                <span dangerouslySetInnerHTML={{ __html: feedback?.text ?? error?.message ?? "" }} />
              </div>
            )}

            <div className="pt-4">
              <Button
                type="submit"
                disabled={isPending}
                className="bg-white text-black hover:bg-white/90 font-mono text-xs tracking-widest uppercase px-8 py-4 h-auto rounded-none transition-all duration-200"
              >
                {isPending ? "Sending..." : "Send It"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer className="px-6 md:px-12 py-8">
      <div className="mx-auto max-w-7xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <span className="font-mono text-xs tracking-widest uppercase text-white/20">
          Unfuckyourweb © 2024
        </span>
        <span className="font-mono text-xs text-white/20">
          No fluff. Just clean code.
        </span>
      </div>
    </footer>
  );
}

export default App;
