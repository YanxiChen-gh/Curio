import { chromium } from "playwright";

async function main() {
  const browser = await chromium.connectOverCDP("http://localhost:9222");
  const context = browser.contexts()[0];
  const page = await context.newPage();

  // Navigate to XHS to load their JS
  await page.goto("https://www.rednote.com/explore", {
    waitUntil: "domcontentloaded",
    timeout: 15_000,
  });
  await page.waitForTimeout(2000);

  // Test: call the feed API to get a note by ID
  // Using a note ID + xsec_token from the saved posts
  const noteId = "69e4d8df000000001b020016";
  const xsecToken = "ABj0rx0DvwJFK8l6S0dXyKOSwiohUDyf0AvHYV5vP-dHc=";

  const result = await page.evaluate(
    async ({ noteId, xsecToken }) => {
      const data = {
        source_note_id: noteId,
        image_formats: ["jpg", "webp", "avif"],
        extra: { need_body_topic: 1 },
        xsec_source: "pc_collect",
        xsec_token: xsecToken,
      };

      try {
        const res = await fetch("/api/sns/web/v1/feed", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
          credentials: "include",
        });
        const json = await res.json();
        return { status: res.status, success: json.success, data: json.data ? "has_data" : "no_data", code: json.code, msg: json.msg };
      } catch (err: any) {
        return { error: err.message };
      }
    },
    { noteId, xsecToken },
  );

  console.log("API result:", JSON.stringify(result, null, 2));

  if (result.data === "has_data") {
    // Try to get the actual note content
    const noteData = await page.evaluate(
      async ({ noteId, xsecToken }) => {
        const data = {
          source_note_id: noteId,
          image_formats: ["jpg", "webp", "avif"],
          extra: { need_body_topic: 1 },
          xsec_source: "pc_collect",
          xsec_token: xsecToken,
        };
        const res = await fetch("/api/sns/web/v1/feed", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
          credentials: "include",
        });
        const json = await res.json();
        if (!json.data?.items?.[0]) return null;
        const card = json.data.items[0].note_card;
        return {
          title: card.title,
          desc: card.desc,
          type: card.type,
          user: card.user?.nickname,
          ip_location: card.ip_location,
          tag_list: card.tag_list?.map((t: any) => t.name),
          image_count: card.image_list?.length || 0,
          image_urls: card.image_list?.slice(0, 3).map((i: any) => i.url_default || i.url),
        };
      },
      { noteId, xsecToken },
    );
    console.log("\nNote data:", JSON.stringify(noteData, null, 2));
  }

  await page.close();
}

main().catch(console.error).finally(() => process.exit());
