# Get a permanent co-op link (deploy to Render)

This gives you a link like `https://dukedefense-xxxx.onrender.com` that works
**forever**, with **co-op**, whether your PC is on or off. It's free and needs
no credit card.

There are two account sign-ups in here (GitHub + Render). Those are the only
steps nobody can do for you — everything in this project is already configured
for the deploy.

Takes about 10 minutes, once.

---

## Part 1 — put the game on GitHub (free, no card)

GitHub is where your code lives so Render can read it.

1. Go to **https://github.com** and **Sign up** (skip if you have an account).
2. Click the **+** at the top-right → **New repository**.
3. Name it **`dukedefense`** (no `$` sign — repo names can't have one).
   Leave it **Public**. Click **Create repository**.
4. On the new empty repo page, click the link **"uploading an existing file"**.
5. Open your game folder `D:\CLAUDE HACKS\DUKE$DEFENSE` in Explorer.
   Select **everything** — all the files **and** the `js` and `css` folders —
   and **drag them into the browser** upload area. Wait for it to finish.
6. Click the green **Commit changes** button.

Your code is now on GitHub. Note the repo's web address, e.g.
`https://github.com/YOURNAME/dukedefense`.

---

## Part 2 — deploy on Render (free, no card)

1. Go to **https://render.com** and click **Get Started** / **Sign up**.
   Choose **"Sign in with GitHub"** — this connects your repos automatically,
   which saves a step later.
2. On the dashboard, click **New +** (top right) → **Blueprint**.
3. Pick your **`dukedefense`** repository from the list.
4. Render reads the included **`render.yaml`** and shows a service named
   *dukedefense* on the **Free** plan. Click **Apply** (or **Create Services**).
5. Wait 1–2 minutes while it builds and boots. When the status turns
   **Live**, Render shows your URL near the top:

   ```
   https://dukedefense-xxxx.onrender.com
   ```

**That is your permanent link. Send it to anyone, anywhere.**

Everyone opens it → **CO-OP · 4 PLAYER** → one person **Hosts** and reads out
the room code → the others **Join**. No install, no address to type.

---

## One thing to expect

Render's free plan puts the app to sleep after ~15 minutes with nobody on it.
The **first** person to open the link after a nap waits ~30–50 seconds while it
wakes up (the game waits patiently and connects automatically — just don't
close the tab). After that it's instant for everyone until it's idle again.

If you ever want it to never sleep, Render's cheapest paid plan removes that —
but the free plan is perfectly fine for playing with friends.

---

## Shortcut for later

Once your repo is public, this URL pre-fills the whole Render deploy — bookmark
it with your repo address swapped in:

```
https://render.com/deploy?repo=https://github.com/YOURNAME/dukedefense
```

## Updating the game later

Change a file, re-upload it to the GitHub repo (same drag-and-drop), and Render
redeploys within a minute automatically. The link never changes.
