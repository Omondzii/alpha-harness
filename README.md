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

To run another account, prefix both commands with the same profile name. Use lowercase letters,
numbers, and internal hyphens, up to 32 characters. For example, a named account:

```bash
# From backend/
ALPHA_HARNESS_PROFILE=john uv run alpha-harness

# From frontend/
ALPHA_HARNESS_PROFILE=john npm run dev
```

Each profile gets its own data directory and matching backend/frontend ports. The default uses
`~/.alpha-harness`, backend port 8000, and frontend port 5173. `john` uses
`~/.alpha-harness/john` and gets a stable port pair derived from its name. Numbered profiles
such as `acc2` keep their familiar ports 8002 and 5175. Open the Vite URL printed when it starts
in the corresponding browser profile.

The profile automatically keeps the Vite proxy and the backend WebSocket origin check paired.
Named profile ports are derived consistently by the backend and Vite. If a derived port is
already in use, startup fails rather than silently choosing a different port; choose another
name or set `ALPHA_HARNESS_PORT` and/or `ALPHA_HARNESS_FRONTEND_PORT` to available ports.
You can also override the data location with `ALPHA_HARNESS_DATA_DIR`.

Do not run multiple accounts with the same data directory: the catalog is single-writer. Each
backend also runs its own background sync and session checks, so many concurrent accounts use
more resources and may increase upstream requests.
