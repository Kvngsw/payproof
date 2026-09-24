export type FaqItem = {
  id: string;
  question: string;
  answer: string;
};

export const FAQS: FaqItem[] = [
  {
    id: "paid",
    question: "How do I know the buyer actually paid?",
    answer:
      "Every payment is confirmed to PayProof at the source. There is no screenshot to check and no alert to forward. Paid means the money is already sitting in the reserved account.",
  },
  {
    id: "dispatch-fee",
    question: "What happens to the dispatch fee?",
    answer:
      "It is held together with the product price, not paid out early. When the buyer confirms delivery, the product price is released to you and the dispatch fee is released for the rider. If the order is reported, both stay locked.",
  },
  {
    id: "any-bank",
    question: "Can my buyer pay any way they like?",
    answer:
      "Yes. Bank transfer, USSD, card, ATM, or any bank they already use. You share the same reserved account number every time.",
  },
  {
    id: "never-arrives",
    question: "What if the package never arrives?",
    answer:
      "The buyer taps Report Issue and the order freezes. The payout stays exactly where it is and does not move to anyone while the order is in that state.",
  },
  {
    id: "when-paid",
    question: "When do I get paid?",
    answer:
      "After the buyer confirms delivery. The product price is released to your settlement account, and the dispatch fee is handled separately.",
  },
  {
    id: "account-number",
    question: "Do I need a new account number for every sale?",
    answer:
      "No. You get one reserved account when you sign up. Share that number in any chat for as long as you sell.",
  },
  {
    id: "cost",
    question: "What does PayProof cost?",
    answer:
      "PayProof is free during the pilot. Pricing will be announced before the pilot ends.",
  },
  {
    id: "bank",
    question: "Is PayProof a bank?",
    answer:
      "No. PayProof creates a reserved account through a licensed payment rail. The money settles there and is released by PayProof's rules, not by chat messages.",
  },
  {
    id: "tracking",
    question: "How does the buyer track the order?",
    answer:
      "The buyer sees the order status and full timeline in their dashboard. Delivery status moves as the order progresses, and any manual status update is labeled right in the interface.",
  },
  {
    id: "chat-apps",
    question: "Can I use this in WhatsApp or Instagram chats?",
    answer:
      "Yes. PayProof does not replace your chat. You send the reserved account number in the chat you already use, and the payment is verified behind it.",
  },
  {
    id: "reputation",
    question: "What is the reputation badge?",
    answer:
      "It counts completed orders divided by total orders, calculated from real data every time it renders. Nothing about it is bought or faked.",
  },
  {
    id: "dispute",
    question: "What happens in a dispute?",
    answer:
      "The order moves to Disputed and the payout freezes. The money does not move to the seller, the rider, or back to the buyer while the order sits in that state.",
  },
];

export const LANDING_FAQS = FAQS.slice(0, 5);
