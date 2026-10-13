const playerName = document.querySelector<HTMLSpanElement>("#player-name");

async function loadPlayer() {
  const response = await fetch("/api/me", {
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    window.location.assign("/");
    return;
  }

  const payload = (await response.json()) as {
    player: {
      displayName: string | null;
      email: string | null;
    };
  };

  if (playerName) {
    playerName.textContent = payload.player.displayName ?? payload.player.email ?? "Player";
  }
}

void loadPlayer();
