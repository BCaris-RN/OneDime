const names = { first: "First Dime", spotlight: "Spotlight", freelance: "Freelance", market: "Market", paypal: "PayPal" };
export const monthInputs = new Map<string, HTMLInputElement>();
for (const [app,name] of Object.entries(names)) {
  const label = document.createElement("label"), input = document.createElement("input");
  label.id = `stats-month-${app}`;
  label.textContent = `Stats month: ${name}`;
  input.type = "month";
  input.addEventListener("change", () => {
    if (input.validity.valid && /^\d{4}-(0[1-9]|1[0-2])$/.test(input.value))
      document.dispatchEvent(new CustomEvent("onedime:month", { detail: app }));
  });
  label.append(input); document.getElementById(`app-${app}`)!.prepend(label);
  monthInputs.set(app,input);
}
export const monthQuery = (app: string) => monthInputs.get(app)?.value ? `?month=${monthInputs.get(app)!.value}` : "";
