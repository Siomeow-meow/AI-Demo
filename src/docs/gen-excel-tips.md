# General Lesson: Spreadsheet Tips (Excel and Google Sheets)

Core formulas: SUM, AVERAGE, MIN, MAX, COUNT, IF (do something depending on a condition), SUMIF and SUMIFS (total with conditions), COUNTIF, and lookups: XLOOKUP, or VLOOKUP and INDEX/MATCH in older versions.

Absolute references use dollar signs: $A$1 stays fixed when you copy a formula, while A1 shifts. Use F4 to toggle. Name important ranges to make formulas readable.

Pivot tables summarise large data in seconds: drag fields into rows, columns and values to total, count or average by category.

Good habits: keep one table per sheet with a single header row and no merged cells; keep raw data separate from calculations; use data validation (drop-down lists) to prevent typos; format numbers consistently; and check totals with a second method. Common errors: #N/A means a lookup found nothing, #REF! means a deleted reference, #DIV/0! means dividing by zero. Wrap risky formulas in IFERROR carefully so you do not hide real problems.
