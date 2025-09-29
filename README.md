# PriceShooters

A neon, top-down arena prototype built for experimenting with cash-out risk mechanics.

## Running locally

1. Install dependencies if you have not already: `npm install`.
2. Start the development server: `npm start`.
3. Open `http://localhost:3000` in your browser to play.

## Resolving merge conflicts from the command line

If GitHub reports that it cannot automatically merge your pull request, run the merge locally to resolve the conflict and push the result.

1. Fetch the latest branches so you have up-to-date references:
   ```bash
   git fetch origin
   ```
2. Check out the topic branch for your pull request (replace the branch name with yours):
   ```bash
   git checkout codex/adjust-overlay-rule-for-click-interactions-c3xppv
   ```
3. Merge the base branch into your topic branch:
   ```bash
   git merge main
   ```
4. Fix any conflicts in your editor—keep the versions you want, remove the conflict markers, then stage the files:
   ```bash
   git add <file paths>
   ```
5. Commit the merge to finalize the resolution:
   ```bash
   git commit
   ```
6. Push the updated branch back to GitHub so the pull request can complete:
   ```bash
   git push
   ```

These steps mirror the instructions provided by GitHub’s “Check out via the command line” dialog and let you finish the merge even when the web UI cannot.
