# GrideX

Plan it. Lock in. Win the day. Calendar, weekly routine, must-dos (today / week / month), focus sessions and rewards, in black and white.

## Run it (Windows)
1. Double-click `start-gridex.bat` (or open a terminal in this folder and run `node server.js`).
2. Open http://localhost:3000. Keep the black window open while you use the app.

## Sign in
- Google: needs GOOGLE_CLIENT_ID in your `.env` file (see `.env.example`).
- Gmail + password: sign up with a real Gmail address and a password. GrideX sends a 6-digit code to prove the mailbox is yours.
  - Without email settings, the code is printed in the black window (only the person running the server can see it). Fine for your own PC.
  - To have the code emailed, add SMTP_USER (your Gmail) and SMTP_PASS (a Gmail App password) to `.env`. Required if you put the app online for other people.

## Your data
Saved per account in the `data` folder. Back it up by copying that folder. Keep `.env` private.

## Honest limits
A website cannot truly close other apps on your device. The focus shield shows warnings and counts distractions (including leaving this tab). Real app blocking needs a native Android/desktop app.
