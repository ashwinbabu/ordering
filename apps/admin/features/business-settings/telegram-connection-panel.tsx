"use client";

import { useState } from "react";
import { CircleAlert, Copy } from "lucide-react";
import {
  useCreateStaffGroupPairingTokenMutation,
  useTelegramConnectionQuery,
} from "@/features/business-settings/telegram-query";

interface TelegramConnectionPanelProps {
  businessId: string;
  locationId: string;
}

export function TelegramConnectionPanel({
  businessId,
  locationId,
}: TelegramConnectionPanelProps) {
  const statusQuery = useTelegramConnectionQuery(businessId, locationId, true);
  const createTokenMutation = useCreateStaffGroupPairingTokenMutation(
    businessId,
    locationId,
  );
  const [pairing, setPairing] = useState<{
    token: string;
    expiresAt: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleConnect() {
    setCopied(false);
    const result = await createTokenMutation.mutateAsync();
    setPairing(result);
  }

  const status = statusQuery.data;
  const connected = status?.staffGroup.connected ?? false;
  const command = pairing ? `/connect ${pairing.token}` : "";

  return (
    <section id="settings-notifications" className="settings-section">
      <div className="settings-section-head">
        <div>
          <h2>Telegram notifications</h2>
          <p>Send new-order alerts to your restaurant&apos;s Telegram group.</p>
        </div>
      </div>

      {statusQuery.isPending ? (
        <p className="read-only-meta">Checking connection…</p>
      ) : statusQuery.error ? (
        <p className="read-only-meta">Couldn&apos;t load Telegram status.</p>
      ) : (
        <>
          <div className="operational-setting">
            <span>
              <strong>Staff group</strong>
              <small>
                {connected
                  ? `Connected · ${status?.staffGroup.chatTitle ?? "Telegram group"}`
                  : "Not connected"}
              </small>
            </span>
            <button
              className="secondary-button compact-button"
              disabled={createTokenMutation.isPending}
              onClick={() => {
                void handleConnect();
              }}
            >
              {connected ? "Reconnect" : "Connect Telegram group"}
            </button>
          </div>

          {pairing && (
            <div className="telegram-pairing-box">
              <ol>
                <li>
                  Add {status?.botUsername ? `@${status.botUsername}` : "the bot"} to
                  your staff Telegram group.
                </li>
                <li>
                  Send this command in the group:
                  <div className="telegram-token-row">
                    <code>{command}</code>
                    <button
                      type="button"
                      className="secondary-button compact-button"
                      onClick={() => {
                        void navigator.clipboard?.writeText(command);
                        setCopied(true);
                      }}
                    >
                      <Copy size={13} />
                      {copied ? "Copied" : "Copy"}
                    </button>
                  </div>
                </li>
              </ol>
              <small>This code expires in 15 minutes.</small>
            </div>
          )}

          {createTokenMutation.error && (
            <p className="telegram-error-text">
              <CircleAlert size={14} />
              {createTokenMutation.error instanceof Error
                ? createTokenMutation.error.message
                : "Couldn't generate a code."}
            </p>
          )}
        </>
      )}
    </section>
  );
}
