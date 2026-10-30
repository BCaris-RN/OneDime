const canonicalToFictional: Readonly<Record<string, string>> = {
  Prolific: "SurveyNest",
  Rev: "TypeTrail",
  TranscribeMe: "WordHarbor",
  SideShift: "TaskCurrent",
  Microworkers: "MicroGuild",
  YouTube: "BrightCast",
  TikTok: "LoopStage",
  Instagram: "SnapGarden",
  Facebook: "TownSquare",
  Upwork: "TaskHarbor",
  Fiverr: "QuickGig",
  "Freelancer.com": "SkillDock",
  Toptal: "ApexWork",
  Behance: "ArtBoard",
  Dribbble: "PixelPort",
  DoorDash: "BasketPath",
  Uber: "HopLine",
  "Uber Eats": "MealRoute",
  Lyft: "RideRiver",
  Instacart: "FreshCart",
  Grubhub: "PlateLoop",
  TaskRabbit: "HandyHive",
  Rover: "PawTrail",
  Thumbtack: "LocalSpark",
  Amazon: "NorthStar Market",
  "eBay": "BidBay",
  Etsy: "MakerLane",
  "Facebook Marketplace": "TownSquare Market",
  "TikTok Shop": "LoopCart",
  Shopify: "ShopSpring",
  "Printify Shop": "InkCart",
  Printify: "InkWorks",
  "Ninja Transfers": "TransferForge"
};
const fictionalToCanonical = new Map(Object.entries(canonicalToFictional).map(([canonical, fictional]) => [fictional, canonical]));
const names = Object.keys(canonicalToFictional).sort((a, b) => b.length - a.length);

declare global {
  interface Window { __ONEDIME_DEMO_VIDEO__?: boolean }
}

if (window.__ONEDIME_DEMO_VIDEO__ === true) {
  document.documentElement.classList.add("demo-video-mode");
  const display = (value: string) => names.reduce((result, canonical) => {
    const escaped = canonical.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return result.replace(new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}(?=$|[^\\p{L}\\p{N}])`, "gu"), (_match, before: string) => `${before}${canonicalToFictional[canonical]}`);
  }, value);
  const platformControls = 'input[id*="platform" i], input[id*="plat" i], select[id*="plat" i], input[name="platform"]';

  function decorate(root: ParentNode) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes: Text[] = [];
    while (walker.nextNode()) {
      const text = walker.currentNode as Text;
      if (text.parentElement?.closest("script,style,textarea,[contenteditable='true']")) continue;
      nodes.push(text);
    }
    for (const text of nodes) {
      const before = text.textContent ?? "", after = display(before);
      if (after !== before) text.textContent = after;
    }
    root.querySelectorAll<HTMLElement>("[aria-label],[title],[placeholder]").forEach(element => {
      for (const attribute of ["aria-label", "title", "placeholder"]) {
        const value = element.getAttribute(attribute);
        if (value) {
          const translated = display(value);
          if (translated !== value) element.setAttribute(attribute, translated);
        }
      }
    });
    root.querySelectorAll<HTMLOptionElement>("select[id*='plat' i] option, select[name='platform'] option, select[id*='sup' i] option, select[name='made_by'] option, datalist#platform-options option").forEach(option => {
      const canonical = option.dataset.demoCanonical ?? option.value || option.textContent ?? "";
      if (!option.dataset.demoCanonical) option.dataset.demoCanonical = canonical;
      option.value = canonical;
      const before = option.textContent ?? canonical, translated = display(before || canonical);
      if (translated !== before) option.textContent = translated;
      if (option.parentElement?.tagName === "DATALIST") option.value = display(canonical);
    });
    root.querySelectorAll<HTMLInputElement>(platformControls).forEach(input => {
      const fictional = canonicalToFictional[input.value];
      if (fictional && input.value !== fictional) input.value = fictional;
    });
  }

  function restoreCanonicalValues(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(restoreCanonicalValues);
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(Object.entries(value).map(([key, item]) => {
      if ((key === "platform" || key === "store" || key === "made_by") && typeof item === "string")
        return [key, fictionalToCanonical.get(item) ?? item];
      return [key, restoreCanonicalValues(item)];
    }));
  }

  const badge = document.createElement("span");
  badge.className = "demo-mode-badge";
  badge.textContent = "Local demo · fictional data · no PayPal connection";
  document.querySelector(".brand")?.after(badge);

  const originalFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    if (typeof init?.body === "string" && init.headers && new Headers(init.headers).get("content-type")?.includes("application/json")) {
      try {
        init = { ...init, body: JSON.stringify(restoreCanonicalValues(JSON.parse(init.body))) };
      } catch { /* Pass non-JSON requests through unchanged. */ }
    }
    return originalFetch(input, init);
  };

  document.addEventListener("change", event => {
    if (event.target instanceof HTMLInputElement && event.target.matches(platformControls)) {
      const fictional = canonicalToFictional[event.target.value];
      if (fictional) event.target.value = fictional;
    }
  });
  decorate(document);
  new MutationObserver(records => records.forEach(record => {
    if (record.type === "characterData" && record.target instanceof Text) {
      const before = record.target.textContent ?? "", translated = display(before);
      if (translated !== before) record.target.textContent = translated;
    }
    record.addedNodes.forEach(node => {
      if (node instanceof Element) decorate(node);
      else if (node instanceof Text) {
        const before = node.textContent ?? "", translated = display(before);
        if (translated !== before) node.textContent = translated;
      }
    });
  })).observe(document.documentElement, { subtree: true, childList: true, characterData: true });
}
