# Security Policy

## Supported Versions

Use this section to tell people about which versions of your project are
currently being supported with security updates.

| Version | Supported          |
| ------- | ------------------ |
| 5.1.x   | :white_check_mark: |
| 5.0.x   | :x:                |
| 4.0.x   | :white_check_mark: |
| < 4.0   | :x:                |

## Environment Variables & Secrets Management

### Firebase Configuration
All Firebase API keys and credentials must be stored in a `.env` file, **NOT** in version control.

**Setup Steps:**
1. Copy `.env.example` to `.env` in the project root
2. Fill in your Firebase credentials in the `.env` file
3. Never commit the `.env` file - it is already in `.gitignore`

**Example .env file:**
```
FIREBASE_API_KEY=your_actual_api_key_here
FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
FIREBASE_DATABASE_URL=https://your_project.firebaseio.com
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
FIREBASE_MESSAGING_SENDER_ID=your_sender_id
FIREBASE_APP_ID=your_app_id
FIREBASE_MEASUREMENT_ID=your_measurement_id
```

**For production/deployment:**
- Set these environment variables in your hosting platform (Netlify, Vercel, etc.)
- Use `.env.production` for production-specific configuration
- Never hardcode secrets in any files committed to version control

## Reporting a Vulnerability

Use this section to tell people how to report a vulnerability.

Tell them where to go, how often they can expect to get an update on a
reported vulnerability, what to expect if the vulnerability is accepted or
declined, etc.
