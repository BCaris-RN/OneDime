/*  (o) OneDime | public/feedback.ts
 *  ----------------------------------------------------------
 *  Private beta feedback, sent from the player's current app.
 */

type Feedback = { app: string; body: string; blocking: boolean };

export function initializeFeedback(send: (feedback: Feedback) => Promise<unknown>) {
  const dialog = document.getElementById("feedback-dialog") as HTMLDialogElement;
  const form = document.getElementById("feedback-form") as HTMLFormElement;
  const app = document.getElementById("feedback-app") as HTMLSelectElement;
  const body = document.getElementById("feedback-body") as HTMLTextAreaElement;
  const blocking = document.getElementById("feedback-blocking") as HTMLInputElement;
  const error = document.getElementById("feedback-error")!;
  const count = document.getElementById("feedback-count")!;
  const thanks = document.getElementById("feedback-thanks")!;
  const submit = document.getElementById("feedback-submit") as HTMLButtonElement;
  const menu = document.getElementById("header-menu") as HTMLDetailsElement;
  let opener: HTMLElement | null = null;
  let sending = false;

  function updateBody() {
    body.setCustomValidity("");
    body.removeAttribute("aria-invalid");
    count.textContent = `${body.value.trim().length} / 1,000 characters`;
  }

  document.querySelectorAll<HTMLButtonElement>("[data-feedback-open]").forEach(button => {
    button.addEventListener("click", () => {
      opener = menu.contains(button) ? menu.querySelector("summary") : button;
      menu.open = false;
      if (sending) {
        dialog.showModal();
        body.focus();
        return;
      }
      form.reset();
      form.hidden = false;
      thanks.hidden = true;
      error.textContent = "";
      app.value = document.querySelector<HTMLButtonElement>('#app-nav [aria-selected="true"]')?.dataset.app ?? "first";
      updateBody();
      dialog.showModal();
      body.focus();
    });
  });
  document.getElementById("feedback-close")!.addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => opener?.focus());
  menu.addEventListener("keydown", event => {
    if (event.key !== "Escape") return;
    menu.open = false;
    menu.querySelector("summary")!.focus();
  });
  body.addEventListener("input", updateBody);
  form.addEventListener("submit", event => {
    event.preventDefault();
    if (sending) return;
    const text = body.value.trim();
    if (!text || text.length > 1000) {
      body.setCustomValidity(text ? "Keep your note to 1,000 characters." : "Tell us what happened.");
      body.setAttribute("aria-invalid", "true");
      body.reportValidity();
      body.focus();
      return;
    }
    sending = true;
    submit.disabled = true;
    submit.textContent = "Sending…";
    error.textContent = "";
    void send({ app: app.value, body: text, blocking: blocking.checked }).then(() => {
      form.hidden = true;
      body.value = "";
      thanks.hidden = false;
      if (dialog.open) thanks.focus();
    }).catch(reason => {
      error.textContent = reason instanceof Error ? reason.message : "Your note could not be sent. Please try again.";
      if (dialog.open) body.focus();
    }).finally(() => {
      sending = false;
      submit.disabled = false;
      submit.textContent = "Send feedback";
    });
  });
}
