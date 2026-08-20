import { Check, CircleCheck, Clock3, Truck } from "lucide-react";
import type { FulfilmentType, OrderStatus } from "../../domain/storefront";

// Position of each in-progress status along the 4-step timeline below.
// "delivered"/"completed" land past the last step so every step reads as
// done; "cancelled"/"refunded" resolve to -1 (nothing active) rather than
// crash -- callers showing a cancelled/refunded order should route to a
// dedicated cancelled state instead of rendering this timeline.
const timelineStepIndex: Record<OrderStatus, number> = {
  placed: 0,
  accepted: 1,
  preparing: 2,
  "out-for-delivery": 3,
  delivered: 4,
  completed: 4,
  cancelled: -1,
  refunded: -1,
};

interface OrderStatusTimelineProps {
  status: OrderStatus;
  fulfilment: FulfilmentType;
  venueName: string;
  isCashOnDelivery: boolean;
}

export function OrderStatusTimeline({
  status,
  fulfilment,
  venueName,
  isCashOnDelivery,
}: OrderStatusTimelineProps) {
  const isDelivery = fulfilment === "delivery";
  const currentStepIndex = timelineStepIndex[status];

  return (
    <section
      className="order-status-timeline"
      aria-labelledby="order-status-title"
    >
      <div className="order-status-timeline__heading">
        <h2 id="order-status-title">Order status</h2>
        <span className="live-pill">
          <i aria-hidden="true" />
          Live
        </span>
      </div>
      <ol>
        <StatusStep
          active={currentStepIndex === 0}
          complete={currentStepIndex > 0}
          icon={<Check size={15} />}
          title="Order received"
          body={
            isCashOnDelivery
              ? `Sent to ${venueName}. Pay cash when it arrives.`
              : `Payment confirmed and sent to ${venueName}.`
          }
        />
        <StatusStep
          active={currentStepIndex === 1}
          complete={currentStepIndex > 1}
          icon={<CircleCheck size={15} />}
          title="Accepted"
          body="The kitchen has accepted your order."
        />
        <StatusStep
          active={currentStepIndex === 2}
          complete={currentStepIndex > 2}
          icon={<Clock3 size={15} />}
          title="Preparing"
          body="Your food is being made fresh."
        />
        {isDelivery ? (
          <StatusStep
            active={currentStepIndex === 3}
            complete={currentStepIndex > 3}
            icon={<Truck size={15} />}
            title="Out for delivery"
            body="Your order is on its way."
          />
        ) : (
          <StatusStep
            active={currentStepIndex === 3}
            complete={currentStepIndex > 3}
            icon={<Check size={15} />}
            title="Ready for pickup"
            body="Collect your order from the outlet."
          />
        )}
      </ol>
    </section>
  );
}

function StatusStep({
  active = false,
  complete = false,
  body,
  icon,
  title,
}: {
  active?: boolean;
  complete?: boolean;
  body: string;
  icon: React.ReactNode;
  title: string;
}) {
  const className = active ? "is-active" : complete ? "is-complete" : undefined;
  return (
    <li className={className}>
      <span className="timeline-marker">
        {complete ? <Check size={15} /> : icon}
      </span>
      <div>
        <strong>{title}</strong>
        <p>{body}</p>
      </div>
    </li>
  );
}
