import { writePty } from "@/lib/tauri";

export function toBytes(str: string): number[] {
  return Array.from(new TextEncoder().encode(str));
}

export async function sendKeys(sessionId: string, keys: number[]): Promise<void> {
  const keypresses: number[][] = [];
  let i = 0;
  while (i < keys.length) {
    if (keys[i] === 0x1b && keys[i + 1] === 0x5b && i + 2 < keys.length) {
      keypresses.push(keys.slice(i, i + 3));
      i += 3;
    } else {
      keypresses.push([keys[i]]);
      i += 1;
    }
  }
  for (let k = 0; k < keypresses.length; k++) {
    await writePty(sessionId, keypresses[k]);
    if (k < keypresses.length - 1) {
      await new Promise((r) => setTimeout(r, 50));
    }
  }
}

export async function sendText(sessionId: string, text: string): Promise<void> {
  const bytes = toBytes(text + "\r");
  await writePty(sessionId, bytes);
}
