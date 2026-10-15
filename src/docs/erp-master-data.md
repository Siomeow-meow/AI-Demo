# ERP Lesson: Master Data

Master data is the slowly changing reference information that every transaction uses: customers, suppliers, items (products and materials), the chart of accounts, employees, price lists and units of measure. Transactions such as orders and invoices refer to it.

Bad master data causes visible problems: duplicate customers split a sales history, wrong units of measure cause stock errors, and missing tax or bank details block payments.

Good habits: one owner per data type, required fields and validation on entry, naming and coding standards, a duplicate check before creating a new record, an approval step for sensitive changes such as supplier bank accounts, and regular clean-up. Instead of deleting old records, mark them inactive so history stays intact.
