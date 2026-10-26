# Put GrideX online for a short test (Render FREE plan)
IMPORTANT: the free plan has no saved disk. Accounts and data can RESET when the app restarts, and the app sleeps when idle (the first visit can take about a minute). Tell testers this. Use it only for a few days of feedback.

1. Make a free account at github.com. Create a NEW PRIVATE repository named gridex. Upload every file from this folder (drag and drop on the "uploading an existing file" page). Do NOT upload .env or data.
2. Make an account at render.com. Click New > Blueprint, connect GitHub, choose the gridex repository. Render reads render.yaml.
3. When asked, fill in SMTP_USER (your sending Gmail) and SMTP_PASS (its 16-letter app password). Without them, testers cannot receive sign-up codes. GOOGLE_CLIENT_ID can stay empty.
4. Click Apply. Wait until it says Live. Open the address Render gives you (https://gridex-xxxx.onrender.com).
5. Test: sign up with a Gmail. The code must arrive in that inbox (check Spam).
6. Google button (optional): Google Cloud > Credentials > your Web client > add the Render address under Authorized JavaScript origins, then put the Client ID in Render > Environment > GOOGLE_CLIENT_ID.
When the test is over, delete the service in Render.
