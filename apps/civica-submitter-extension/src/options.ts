// Options page logic. Reads + writes the three config values via
// chrome.storage.local. Nothing transmitted off-device.

import { readConfig, writeConfig } from "./config";

const $ = <T extends HTMLElement = HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} not found`);
  return el as T;
};

async function init(): Promise<void> {
  const cfg = await readConfig();
  $<HTMLInputElement>("baseUrl").value = cfg.baseUrl;
  $<HTMLInputElement>("bearerToken").value = cfg.bearerToken;
  $<HTMLInputElement>("activePacketId").value = cfg.activePacketId ?? "";

  $("save").addEventListener("click", async () => {
    const baseUrl = $<HTMLInputElement>("baseUrl").value.trim();
    const bearerToken = $<HTMLInputElement>("bearerToken").value.trim();
    const activePacketIdRaw = $<HTMLInputElement>("activePacketId").value.trim();

    const status = $("status");
    status.className = "status";
    status.textContent = "";

    if (!baseUrl) {
      status.className = "status err";
      status.textContent = "Gateway URL is required.";
      return;
    }
    try {
      const url = new URL(baseUrl);
      if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
        status.className = "status err";
        status.textContent = "Gateway URL must be https (or localhost for dev).";
        return;
      }
    } catch {
      status.className = "status err";
      status.textContent = "Gateway URL is not a valid URL.";
      return;
    }

    await writeConfig({
      baseUrl,
      bearerToken,
      activePacketId: activePacketIdRaw || null,
    });

    status.className = "status ok";
    status.textContent = "Saved.";
  });
}

void init();
