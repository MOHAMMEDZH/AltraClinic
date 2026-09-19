# D1b — Push API image via GitHub Actions (ACR Tasks blocked on free trial)

Azure Free Trial often returns `TasksOperationsNotAllowed` for `az acr build`.  
Use this path instead: GitHub builds the image and pushes to `acrclinictest`.

## One-time: GitHub secrets

Repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**:

| Secret name | Value |
|-------------|--------|
| `ACR_LOGIN_SERVER` | `acrclinictest.azurecr.io` |
| `ACR_USERNAME` | From ACR → **Access keys** (admin user **Enabled**) |
| `ACR_PASSWORD` | From ACR → **Access keys** (password) |

Never paste these into chat.

## Run the workflow

1. GitHub → **Actions** → **Clinic-test API → ACR**
2. **Run workflow** → branch `cursor/clinic-test-deploy-kickoff` → tag `d1`
3. Wait for green
4. Confirm in Azure ACR → **Repositories** → `clinic-test-api` → tag `d1`

Then create Container App pointing at that image (Sweden Central).
