# Fieldwork — Freelancer Collaboration Platform (Full Stack)

A working Node.js/Express backend + vanilla JS frontend, wired to the Azure
resources you already created (SQL Database, Blob Storage, App Service).

## What's included
- **Backend**: Express REST API (`server.js` + `routes/`) using `mssql` to talk
  to Azure SQL and `@azure/storage-blob` to talk to Blob Storage.
- **Frontend**: `public/index.html`, `style.css`, `app.js` — a single-page app
  with 6 views: Dashboard, Projects, Shared Files, Time Tracking, Payments, Profiles.
- All 5 tables from your schema (Users, Projects, TimeLogs, Payments, Reviews)
  are fully wired — create, read, update where relevant.
- File upload/download/delete goes straight to your `project-files` Blob container.
- Time tracking auto-calculates hours from start/end time (server-side), same
  logic as the Azure Function from the guide — but built into the main API so
  you don't need a second deployment if you're short on time. (You can still
  keep the separate Azure Function as an extra artifact to screenshot for AZ900.)

## 1. Local setup (test before deploying)

```bash
npm install
cp .env.example .env
```

Open `.env` and fill in real values:

```
DB_SERVER=freelancer-sql-server-yourname.database.windows.net
DB_NAME=FreelancerDB
DB_USER=sqladmin
DB_PASSWORD=<your real password>
AZURE_STORAGE_CONNECTION_STRING=<from Storage Account > Access Keys>
AZURE_STORAGE_CONTAINER=project-files
```

Where to find these:
- **SQL values**: Azure Portal → SQL databases → FreelancerDB → Connection strings (ADO.NET tab has the server name)
- **Storage connection string**: Azure Portal → your Storage Account → Security + networking → Access keys → key1 → Connection string

Run it:
```bash
npm start
```
Open `http://localhost:8080` — you should see the app, and the sidebar dot
should turn green ("database connected") within a couple seconds.

If the dot stays red: double-check your SQL Server firewall allows your IP
(Azure Portal → SQL Server → Networking → add your client IP).

## 2. Deploy to your existing App Service

You already created the App Service in Step 4 of the main guide. Two ways to get this code live:

### Option A — GitHub (matches the guide)
1. Push this whole folder to the GitHub repo you connected in Deployment Center
2. In Azure Portal → your App Service → **Deployment Center**, confirm it's watching the right branch — it'll auto-deploy on push
3. Go to your App Service → **Configuration** → **Application settings** → add each variable from `.env` as a new setting (same names: `DB_SERVER`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `AZURE_STORAGE_CONNECTION_STRING`, `AZURE_STORAGE_CONTAINER`). **Never commit your real `.env` file to GitHub** — it's already in `.gitignore`.
4. Save → App Service restarts automatically → visit your app URL

### Option B — Zip deploy (faster, no GitHub needed)
```bash
zip -r deploy.zip . -x "node_modules/*" ".env" ".git/*"
az webapp deploy --resource-group rg-freelancer-platform --name freelancer-platform-yourname --src-path deploy.zip --type zip
```
(Run `az login` first if you haven't used Azure CLI before. Same Application
Settings step from Option A still applies — set env vars in the Portal.)

## 3. Verify it's live
Visit `https://<your-app-name>.azurewebsites.net/api/health` — you should see:
```json
{"status":"ok","database":"connected"}
```
Screenshot this for your report — it's solid proof the App Service, SQL DB,
and networking are all correctly wired together.

## 4. Quick test flow for your demo video
1. **Profiles** tab → create 2-3 users (mix of Client/Freelancer roles)
2. **Projects** tab → create a project, assign client + freelancer
3. **Shared Files** tab → upload a sample file (goes to Blob Storage — check the portal container to confirm it landed there)
4. **Time Tracking** tab → log hours against the project, watch the hours auto-calculate
5. **Payments** tab → raise an invoice, mark it paid
6. **Profiles** tab → go back and leave a review on the project, watch the average rating update on the freelancer's card

That flow alone demonstrates every objective and additional point from your
project brief, live, with real data hitting real Azure resources.

## Notes on the "designed, not built" items
- **Payment gateway**: `PUT /api/payments/:id/pay` simulates what a Stripe/
  Razorpay webhook would call. Swapping in a real gateway later just means
  pointing their webhook at this endpoint (or routing it through a Logic App
  as described in the main guide).
- Everything else (reviews, profiles/portfolios) is fully functional here —
  not just a data model on paper anymore.
