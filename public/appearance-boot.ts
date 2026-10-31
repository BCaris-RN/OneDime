// Runs before first paint so a saved or default skin never flashes the Current colors first.
try {
  const root = document.documentElement;
  const saved = JSON.parse(localStorage.getItem("onedime-appearance") ?? "null") as { skin?: string; mode?: string } | null;
  const skin = saved && ["current", "paper", "slate", "glass"].includes(saved.skin ?? "") ? saved.skin!
    : localStorage.getItem("onedime-theme") ? "current" : "glass";
  if (skin !== "current") root.dataset.skin = skin;
  if (saved?.mode === "light" || saved?.mode === "dark") root.dataset.theme = saved.mode;
  root.dataset.tab = "first";
} catch { /* app.ts applies the same choice once it loads. */ }
