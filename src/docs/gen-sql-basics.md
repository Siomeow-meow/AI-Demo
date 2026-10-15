# General Lesson: SQL Basics

SQL is the language for asking questions of relational databases, where data lives in tables of rows and columns.

Read data: SELECT name, city FROM customers WHERE city = 'Manila' ORDER BY name LIMIT 10. Summarise: SELECT region, SUM(revenue) FROM sales GROUP BY region, with HAVING to filter the groups. Combine tables with a JOIN: SELECT o.id, c.name FROM orders o JOIN customers c ON c.id = o.customer_id. INNER JOIN keeps matching rows only; LEFT JOIN keeps every row from the left table even when there is no match.

Change data: INSERT adds rows, UPDATE changes rows, DELETE removes rows. Always include a WHERE clause on UPDATE and DELETE, or you will change every row. Try the SELECT first to see which rows would be affected.

Key ideas: a primary key uniquely identifies a row, a foreign key links to another table, and an index speeds up searches. Avoid building queries by joining user input into strings, which leads to SQL injection; use parameters.
