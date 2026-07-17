# Aii Prompt Playbook

Static Prompt Playbook for GitHub Pages. Prompt data lives in `playbook-data.json`.

## Publish on GitHub Pages

1. Push this repository to GitHub.
2. In **Settings → Pages**, select **Deploy from a branch**, then choose the branch containing `index.html` (normally `main`) and the `/ (root)` folder.
3. Open the URL provided by GitHub Pages.

## First-time admin setup

1. Select **ผู้ดูแล** and enter the passcode configured in `index.html`.
2. Select **ตั้งค่า GitHub**.
3. Create a GitHub **fine-grained personal access token** that is restricted to this repository and grants **Contents: Read and write**. Paste it into the setup form along with the repository owner, name, and Pages branch. On a standard `owner.github.io/repository` Pages URL, the owner and repository are filled in automatically.
4. Edit prompts and select **บันทึกให้ทุกคนเห็น**.

The token is kept only in that browser tab's session storage. It is never committed to the repository or exposed to site visitors. GitHub Pages can take a few minutes to deploy the changed JSON file.

## Security note

The admin passcode is visible in a static site's source code, so it is only a user-interface gate. GitHub token permissions are the actual protection that prevents unauthorized writes. Give tokens only to trusted administrators, scope each token to this repository, and revoke it when no longer needed.
