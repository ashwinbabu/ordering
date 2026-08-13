export type OrderStatus =
  | "New"
  | "Preparing"
  | "Out for delivery"
  | "Delivered"
  | "Cancelled";

export interface OrderItem {
  name: string;
  qty: number;
  variants?: string[];
  instructions?: string;
}

export interface TimelineItem {
  label: string;
  time: string;
  complete: boolean;
}

export interface Order {
  id: string;
  status: OrderStatus;
  customer: string;
  phone: string;
  shortAddress: string;
  fullAddress: string;
  deliveryInstructions: string;
  received: string;
  age: string;
  subtotal: number;
  discount: number;
  deliveryFee: number;
  tax: number;
  rounding: number;
  total: number;
  paid: boolean;
  items: OrderItem[];
  instructions?: string;
  timeline: TimelineItem[];
  cancellationReason?: string;
}

export function formatMoney(value: number) {
  return `₹${value.toLocaleString("en-IN")}`;
}

export function nextOrderAction(status: OrderStatus) {
  if (status === "New") return "Accept order";
  if (status === "Preparing") return "Mark out for delivery";
  if (status === "Out for delivery") return "Mark delivered";
  return null;
}

export function nextOrderStatus(status: OrderStatus): OrderStatus | null {
  if (status === "New") return "Preparing";
  if (status === "Preparing") return "Out for delivery";
  if (status === "Out for delivery") return "Delivered";
  return null;
}

export const INITIAL_ORDERS: Order[] = [
  {
    id: "1049",
    status: "New",
    customer: "Nikhil Rao",
    phone: "+91 98765 12048",
    shortAddress: "Mandrem Beach Road",
    fullAddress: "Casa Sol, House 22, Mandrem Beach Road, near the football ground, Mandrem, Goa 403527",
    deliveryInstructions: "Please bring the order to the reception desk.",
    received: "3:48 PM",
    age: "2 min",
    subtotal: 3450,
    discount: 250,
    deliveryFee: 50,
    tax: 290,
    rounding: 0,
    total: 3540,
    paid: true,
    items: [
      { name: "Chicken Cafreal Burger", qty: 2, variants: ["Classic", "Cheese"] },
      { name: "Paneer Tikka Wrap", qty: 2, variants: ["Extra cheese"] },
      { name: "Mushroom Melt Burger", qty: 1 },
      { name: "Chicken Cafreal Rice Bowl", qty: 2, variants: ["Extra cafreal sauce"] },
      { name: "Peri Peri Fries", qty: 3 },
      { name: "Rose Milk", qty: 2, variants: ["Less ice"] },
      { name: "Fresh Lime Soda", qty: 2, variants: ["Sweet & salted"] },
      { name: "Cold Coffee", qty: 2 },
      { name: "Masala Lemonade", qty: 2 },
      { name: "Crispy Chicken Bites", qty: 1, instructions: "Mild spice" },
      { name: "Loaded Nachos", qty: 1 },
      { name: "Garlic Butter Corn", qty: 2 },
      { name: "Chocolate Brownie", qty: 2 },
      { name: "Vanilla Ice Cream", qty: 2 },
      { name: "Sparkling Water", qty: 3 },
    ],
    instructions: "Please label the vegetarian items separately.",
    timeline: [
      { label: "Order received", time: "3:48 PM", complete: true },
      { label: "Accepted", time: "—", complete: false },
      { label: "Out for delivery", time: "—", complete: false },
      { label: "Delivered", time: "—", complete: false },
    ],
  },
  {
    id: "1048",
    status: "New",
    customer: "Priya Menon",
    phone: "+91 98210 44821",
    shortAddress: "Ashvem Road, Mandrem",
    fullAddress:
      "House 14, Palm Grove Lane, near Vaayu Waterman’s Village, Ashvem Road, Mandrem, Goa 403527",
    deliveryInstructions: "Blue gate. Please call once outside.",
    received: "3:42 PM",
    age: "6 min",
    subtotal: 510,
    discount: 50,
    deliveryFee: 35,
    tax: 45,
    rounding: 0,
    total: 540,
    paid: true,
    items: [
      {
        name: "Paneer Tikka Wrap",
        qty: 1,
        variants: ["Regular", "Extra cheese"],
        instructions: "No onions",
      },
      { name: "Rose Milk", qty: 2, variants: ["Less ice"] },
    ],
    instructions: "Pack cutlery for one person.",
    timeline: [
      { label: "Order received", time: "3:42 PM", complete: true },
      { label: "Accepted", time: "—", complete: false },
      { label: "Out for delivery", time: "—", complete: false },
      { label: "Delivered", time: "—", complete: false },
    ],
  },
  {
    id: "1047",
    status: "Preparing",
    customer: "Rohit Shenoy",
    phone: "+91 99161 27541",
    shortAddress: "Junas Waddo, Mandrem",
    fullAddress:
      "Villa 3, Casa Mira, Junas Waddo, opposite Mandrem Garden, Mandrem, Goa 403527",
    deliveryInstructions: "Leave with the security guard if unreachable.",
    received: "3:31 PM",
    age: "17 min",
    subtotal: 640,
    discount: 0,
    deliveryFee: 40,
    tax: 40,
    rounding: 0,
    total: 720,
    paid: false,
    items: [
      {
        name: "Chicken Cafreal Burger",
        qty: 2,
        variants: ["Classic bun", "Cheese"],
      },
      { name: "Peri Peri Fries", qty: 1 },
    ],
    timeline: [
      { label: "Order received", time: "3:31 PM", complete: true },
      { label: "Accepted", time: "3:34 PM", complete: true },
      { label: "Out for delivery", time: "—", complete: false },
      { label: "Delivered", time: "—", complete: false },
    ],
  },
  {
    id: "1042",
    status: "Out for delivery",
    customer: "Aisha Khan",
    phone: "+91 97644 70812",
    shortAddress: "Dandos Waddo, Arambol",
    fullAddress:
      "Flat 2B, Marigold Apartments, Dandos Waddo, behind Double Dutch, Arambol, Goa 403524",
    deliveryInstructions: "Second floor; lift is working.",
    received: "2:58 PM",
    age: "50 min",
    subtotal: 540,
    discount: 0,
    deliveryFee: 30,
    tax: 40,
    rounding: 0,
    total: 610,
    paid: true,
    items: [
      {
        name: "Chicken Cafreal Rice Bowl",
        qty: 1,
        variants: ["Extra cafreal sauce"],
      },
      { name: "Fresh Lime Soda", qty: 2, variants: ["Sweet & salted"] },
    ],
    instructions: "Keep the lime sodas upright.",
    timeline: [
      { label: "Order received", time: "2:58 PM", complete: true },
      { label: "Accepted", time: "3:01 PM", complete: true },
      { label: "Out for delivery", time: "3:29 PM", complete: true },
      { label: "Delivered", time: "—", complete: false },
    ],
  },
  {
    id: "1039",
    status: "Delivered",
    customer: "Kabir Bhat",
    phone: "+91 98900 12572",
    shortAddress: "Mandrem Beach Road",
    fullAddress:
      "Room 8, The Banyan House, Mandrem Beach Road, Mandrem, Goa 403527",
    deliveryInstructions: "Reception can receive the order.",
    received: "1:16 PM",
    age: "Delivered 1:58 PM",
    subtotal: 380,
    discount: 40,
    deliveryFee: 25,
    tax: 31,
    rounding: -1,
    total: 395,
    paid: true,
    items: [
      { name: "Mushroom Melt Burger", qty: 1, variants: ["Whole-wheat bun"] },
      { name: "Cold Coffee", qty: 1 },
    ],
    timeline: [
      { label: "Order received", time: "1:16 PM", complete: true },
      { label: "Accepted", time: "1:19 PM", complete: true },
      { label: "Out for delivery", time: "1:42 PM", complete: true },
      { label: "Delivered", time: "1:58 PM", complete: true },
    ],
  },
];
