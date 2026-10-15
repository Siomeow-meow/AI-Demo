# POS Lesson: Payments and Security

Common payment types: cash, chip cards (EMV), contactless (tap) cards and phones, QR codes and e-wallets, and online or invoice payments. Card data is protected by tokenization (the terminal swaps the card number for a token) and point-to-point encryption.

PCI DSS is the security standard for businesses that handle card payments. Basic rules: never store the CVV or the full magnetic stripe data, do not write card numbers on paper, use certified payment terminals, keep software updated, and limit who can access the system.

Fraud controls at the till: manager approval for refunds, voids and large discounts; each cashier uses their own login; compare refund and void counts per cashier; and check ID or signatures where required. Always give a receipt, and reconcile card settlements against bank deposits.

Refunds should go back to the original payment method, and each one should reference the original sale.
