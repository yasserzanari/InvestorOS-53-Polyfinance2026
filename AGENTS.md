# Repository instructions

- Target runtime is AWS. Prefer deployable AWS integrations and least-privilege IAM; never claim a mock is a live integration.
- Keep `docs/` local and ignored. Do not force-add it or push its contents.
- Keep work in small, reviewable changes. Check remote `main` before publishing; use `gh` for PR workflows when suitable and integrate promptly after checks pass.
- Never commit credentials, `.env` files, Terraform state/plans, or private datasets.
- Frontend lives in `apps/web`, Python API in `apps/api`, workflow definitions in `services/workflows`, and AWS infrastructure in `infrastructure/terraform`.
- Financial metrics must be deterministic and traceable to their inputs. Clearly distinguish observed data, assumptions, and simulations.
