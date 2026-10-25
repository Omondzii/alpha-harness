# Alpha Harness

<a href="https://www.star-history.com/?repos=residual-lab%2Falpha-harness&type=date&legend=bottom-right">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=residual-lab/alpha-harness&type=date&theme=dark&legend=bottom-right" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=residual-lab/alpha-harness&type=date&legend=bottom-right" />
   <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=residual-lab/alpha-harness&type=date&legend=bottom-right" />
 </picture>
</a>

## Multiple accounts

Run two processes per account while developing: one backend and one frontend. The plain
commands start the default account:

```bash
# From backend/
uv run alpha-harness

# From frontend/
npm run dev
```

To run another account, prefix both commands with the same profile name. For example, account 2:

```bash
# From backend/
ALPHA_HARNESS_PROFILE=acc2 uv run alpha-harness

# From frontend/
ALPHA_HARNESS_PROFILE=acc2 npm run dev
```

Use `acc3`, `acc4`, and so on for additional accounts. Each profile gets its own data directory
and matching backend/frontend ports: the default uses `~/.alpha-harness`, backend port 8000,
and frontend port 5173; `acc2` uses `~/.alpha-harness/acc2`, backend port 8002, and frontend
port 5175. Open the Vite URL (for example, `http://localhost:5175` for `acc2`) in the
corresponding browser profile.

The profile automatically keeps the Vite proxy and the backend WebSocket origin check paired.
To override the automatic settings, set `ALPHA_HARNESS_DATA_DIR`, `ALPHA_HARNESS_PORT`, or
`ALPHA_HARNESS_FRONTEND_PORT` explicitly.

Do not run multiple accounts with the same data directory: the catalog is single-writer. Each
backend also runs its own background sync and session checks, so many concurrent accounts use
more resources and may increase upstream requests.
