import type { Page, TestInfo } from "@playwright/test";

export function capturePageDiagnostics(page: Page, testInfo: TestInfo) {
  const messages: string[] = [];
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) {
      messages.push(`console.${message.type()}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => messages.push(`pageerror: ${error.message}`));
  page.on("requestfailed", (request) => {
    messages.push(
      `requestfailed: ${request.method()} ${request.url()} — ${request.failure()?.errorText ?? "unknown"}`,
    );
  });
  return async () => {
    if (messages.length) {
      await testInfo.attach("browser-diagnostics.txt", {
        body: Buffer.from(messages.join("\n")),
        contentType: "text/plain",
      });
    }
    return messages;
  };
}
