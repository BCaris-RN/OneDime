/*  (o) OneDime | public/exports.ts
 *  ----------------------------------------------------------
 *  Player-controlled file downloads with explicit date filters.
 */
for (const app of ["first", "spotlight", "freelance", "market", "paypal"]) {
  const form = document.createElement("form");
  form.className = "slip row";
  const heading = document.createElement("h2");
  heading.textContent = app === "paypal" ? "Export everything" : "Export";
  const fields = document.createElement("div");
  fields.className = "fields";
  for (const [name, label, type] of [
    ["month", "Month (optional)", "month"],
    ["from", "From (optional)", "date"],
    ["to", "To (optional)", "date"]
  ]) {
    const element = document.createElement("label");
    element.textContent = label;
    const input = document.createElement("input");
    input.name = name;
    input.type = type;
    element.append(input);
    fields.append(element);
  }
  const label = document.createElement("label");
  label.textContent = "File type";
  const select = document.createElement("select");
  select.name = "format";
  for (const [value, text] of app === "paypal"
    ? [
        ["xlsx", "Excel workbook"],
        ["zip", "ZIP of CSVs"]
      ]
    : [
        ["csv", "CSV"],
        ["xlsx", "Excel workbook"]
      ]) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = text;
    select.append(option);
  }
  label.append(select);
  fields.append(label);
  const help = document.createElement("p");
  help.className = "muted";
  help.textContent = "All time by default. Choose a month or a date range. Amounts export in USD.";
  const button = document.createElement("button");
  button.type = "submit";
  button.className = "act";
  button.textContent = "Download";
  const status = document.createElement("p");
  status.setAttribute("role", "status");
  form.append(heading, help, fields, button, status);
  const details = document.createElement("details");
  details.className = "export-options";
  const summary = document.createElement("summary");
  summary.textContent = app === "paypal" ? "Export everything" : "Export";
  details.append(summary, form);
  document.getElementById(`app-${app}`)!.prepend(details);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (button.disabled) return;
    button.disabled = true;
    status.textContent = "Preparing your file…";
    try {
      const values = new FormData(form),
        query = new URLSearchParams({
          tab: app === "paypal" ? "all" : app,
          format: String(values.get("format"))
        });
      for (const key of ["month", "from", "to"])
        if (values.get(key)) query.set(key, String(values.get(key)));
      if (query.has("month") && (query.has("from") || query.has("to")))
        throw new Error("Choose a month or a date range, rather than both.");
      const response = await fetch(`/api/exports?${query}`);
      if (!response.ok)
        throw new Error(
          response.status === 429
            ? "Please wait a minute before another export."
            : "Could not export. Check the dates and your connection, then try again."
        );
      const url = URL.createObjectURL(await response.blob()),
        link = document.createElement("a");
      link.href = url;
      link.download =
        response.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ??
        `onedime-${app}.${query.get("format")}`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      status.textContent = "Download ready.";
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : "Could not export.";
    } finally {
      button.disabled = false;
    }
  });
}
