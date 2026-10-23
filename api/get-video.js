import chromium from '@sparticuz/chromium';
import { chromium as playwright } from 'playwright-core';

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  let browser;
  const log = [];
  try {
    const raw = req.body?.url;
    if (typeof raw !== 'string') return res.status(400).json({ error: 'URL_REQUIRED' });
    const input = new URL(raw);
    if (input.protocol !== 'https:' || input.hostname !== 'prompt-motion.com' ||
        !/^\/[a-z0-9-]+\/?$/i.test(input.pathname)) {
      return res.status(400).json({ error: 'INVALID_PROMPT_MOTION_URL' });
    }
    browser = await playwright.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
    const context = await browser.newContext({ userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36' });
    const page = await context.newPage();
    page.on('response', response => {
      const u = response.url();
      if (u.includes('prompt-motion.com') && (u.includes('.mp4') || u.includes('challenge') || u.includes('cdn-cgi'))) {
        log.push({ status: response.status(), url: u.slice(0, 400) });
      }
    });
    const documentResponse = await page.goto(input.toString(), { waitUntil: 'domcontentloaded', timeout: 22000 });
    await page.locator('video').first().waitFor({ state: 'attached', timeout: 10000 }).catch(() => {});
    const videos = await page.locator('video').evaluateAll(nodes => nodes.map(v => ({
      src: v.currentSrc || v.src || v.querySelector('source')?.src || null,
      poster: v.poster || null,
      readyState: v.readyState,
      networkState: v.networkState
    })));
    const mp4 = videos.map(v => v.src).find(u => u && /^https:\/\/media\.prompt-motion\.com\//.test(u));
    let media = null;
    if (mp4) {
      try {
        const response = await context.request.get(mp4, { timeout: 15000, maxRedirects: 3 });
        const mime = response.headers()['content-type'] || '';
        media = { status: response.status(), contentType: mime, contentLength: response.headers()['content-length'] || null,
          cloudflareChallenge: mime.includes('text/html') && (await response.text()).slice(0, 2000).toLowerCase().includes('cloudflare') };
        if (req.body?.download === true && response.ok() && mime.includes('video/')) {
          const body = await response.body();
          if (body.length > 20_000_000) return res.status(413).json({ error: 'VIDEO_TOO_LARGE', size: body.length, media });
          res.setHeader('Content-Type', 'video/mp4');
          res.setHeader('Content-Disposition', 'attachment; filename="prompt-motion.mp4"');
          return res.status(200).send(body);
        }
      } catch (e) { media = { error: String(e.message) }; }
    }
    return res.status(200).json({ ok: Boolean(mp4), pageStatus: documentResponse?.status() || null, videos, media, log,
      note: 'PoC: Cloudflare challenges are reported, not bypassed' });
  } catch (e) {
    return res.status(500).json({ error: 'POC_FAILED', detail: String(e.message), log });
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}
