# Deploy Backend Login On Render

## 1. Create the service

1. Push this repository to GitHub.
2. Open Render.
3. Create a new Web Service from this repository.
4. Render will detect `render.yaml` automatically.

## 2. Fill environment variables

Set these variables in Render:

- `CORS_ORIGINS=https://gatlosv1.github.io`
- `FIREBASE_API_KEY`
- `FIREBASE_AUTH_DOMAIN`
- `FIREBASE_DATABASE_URL`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_STORAGE_BUCKET`
- `FIREBASE_MESSAGING_SENDER_ID`
- `FIREBASE_APP_ID`
- `FIREBASE_MEASUREMENT_ID`
- `AUTH_ACCOUNTS_JSON`

Optional if you still need SQL features on the backend:

- `DB_SERVER`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`

## 3. Copy the Render URL

After deploy, Render gives you a public URL like:

`https://your-app.onrender.com`

## 4. Wire frontend login to backend

Open `auth-config.js` and set:

```js
window.__AUTH_CONFIG__ = window.__AUTH_CONFIG__ || {
  API_BASE_URL: "https://your-app.onrender.com"
};
```

Then push again so GitHub Pages uses that backend.

## 5. Verify

Test these URLs:

- `https://your-app.onrender.com/health`
- `https://gatlosv1.github.io/QuanLyPhanMemChanhThu/dang-nhap.html`
