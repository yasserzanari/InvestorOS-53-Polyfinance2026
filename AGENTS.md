# Repository instructions

- Target runtime is AWS. Prefer deployable AWS integrations and least-privilege IAM; never claim a mock is a live integration.
- Maintained repository documentation lives in `docs/`. Keep local research, captures, validation outputs, and private data ignored; do not add them to the maintained documentation tree.
- Keep work in small, reviewable changes. Check remote `main` before publishing; use `gh` for PR workflows when suitable and integrate promptly after checks pass.
- Never commit credentials, `.env` files, Terraform state/plans, or private datasets.
- Frontend lives in `apps/web`, Python API in `apps/api`, workflow definitions in `services/workflows`, and AWS infrastructure in `infrastructure/terraform`.
- Financial metrics must be deterministic and traceable to their inputs. Clearly distinguish observed data, assumptions, and simulations.
- For work on profiles, portfolio analysis, research, skills, visualizations, or AWS integration, read `docs/product/hackathon-alignment.md` first. It is the shared coordination brief for the Polyfinance 2026 challenge; reconcile it with the code and deployment evidence before changing a contract.
- Keep the current-state documentation explicit about whether a capability is present in code, configured in a stack, deployed, and verified end to end. Endpoint presence or Terraform configuration alone is not proof of a live integration.
