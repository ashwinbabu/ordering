import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { render } from "npm:@react-email/render@1.0.6";
import {
  Html,
  Head,
  Body,
  Container,
  Text,
  Heading,
} from "npm:@react-email/components@0.0.31";

function SpikeEmail({ name }: { name: string }) {
  return (
    <Html>
      <Head />
      <Body style={{ fontFamily: "sans-serif" }}>
        <Container>
          <Heading>Hello {name}</Heading>
          <Text>This is a React Email compatibility spike rendered inside a Supabase Edge Function.</Text>
        </Container>
      </Body>
    </Html>
  );
}

Deno.serve(async (_req: Request) => {
  const started = Date.now();
  try {
    const html = await render(<SpikeEmail name="Dispatcher" />);
    const text = await render(<SpikeEmail name="Dispatcher" />, { plainText: true });
    return new Response(
      JSON.stringify({
        ok: true,
        htmlLength: html.length,
        htmlPreview: html.slice(0, 300),
        textPreview: text.slice(0, 200),
        renderMs: Date.now() - started,
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
