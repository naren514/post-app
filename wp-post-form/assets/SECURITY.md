# Security notes

- `wp-post-form/.env` contains secrets (WordPress username + Application Password). It is intentionally **ignored** by git.
- If you ever accidentally commit credentials, rotate the WordPress Application Password immediately and rewrite git history.
