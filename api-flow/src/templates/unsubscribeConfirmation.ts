function escapeHtml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

const BASE_STYLES = `
    :root {
        --page-bg: #eaf1f8;
        --surface: #ffffff;
        --text: #1e293b;
        --text-secondary: #475569;
        --text-muted: #64748b;
        --border: #e2e8f0;
        --primary: #3b82f6;
        --success: #10b981;
        --success-bg: #dcfce7;
        --success-text: #166534;
        --danger-bg: #fee2e2;
        --danger-text: #b91c1c;
        --info-bg: #eff6ff;
        --shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
    }
    @media (prefers-color-scheme: dark) {
        :root {
            --page-bg: #0b1220;
            --surface: #0f172a;
            --text: #e2e8f0;
            --text-secondary: #94a3b8;
            --text-muted: #64748b;
            --border: #334155;
            --primary: #60a5fa;
            --success: #34d399;
            --success-bg: #0f2e21;
            --success-text: #6ee7b7;
            --danger-bg: #3f1d1d;
            --danger-text: #fca5a5;
            --info-bg: #16213a;
            --shadow: 0 4px 6px -1px rgb(0 0 0 / 0.4), 0 2px 4px -2px rgb(0 0 0 / 0.4);
        }
    }
    * { box-sizing: border-box; }
    body {
        margin: 0;
        min-height: 100dvh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
        background-color: var(--page-bg);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        color: var(--text);
    }
    .card {
        width: 100%;
        max-width: 420px;
        background-color: var(--surface);
        border: 1px solid var(--border);
        border-radius: 12px;
        box-shadow: var(--shadow);
        padding: 40px 36px 32px;
        text-align: center;
    }
    .wordmark {
        font-size: 14px;
        font-weight: 700;
        color: var(--primary);
        letter-spacing: 0.02em;
        margin-bottom: 28px;
    }
    .badge {
        width: 52px;
        height: 52px;
        margin: 0 auto 20px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    .badge svg { width: 26px; height: 26px; }
    h1 { font-size: 21px; font-weight: 700; margin: 0 0 12px; text-wrap: balance; }
    .body-copy { font-size: 15px; line-height: 1.55; color: var(--text-secondary); margin: 0 0 28px; }
    .body-copy strong { color: var(--text); font-weight: 600; }
    .divider { border: none; border-top: 1px solid var(--border); margin: 0 0 20px; }
    .actions { display: flex; flex-direction: column; gap: 10px; }
    .actions a { color: var(--primary); text-decoration: none; font-size: 14px; font-weight: 600; }
    .actions a:hover, .actions a:focus-visible { filter: brightness(1.15); }
    .actions a:focus-visible { outline: 2px solid var(--primary); outline-offset: 3px; border-radius: 3px; }
    .confirm-button {
        width: 100%;
        padding: 12px 20px;
        background-color: var(--primary);
        color: white;
        border: none;
        border-radius: 8px;
        font-size: 15px;
        font-weight: 600;
        font-family: inherit;
        cursor: pointer;
    }
    .confirm-button:hover, .confirm-button:focus-visible { filter: brightness(1.1); }
    .confirm-button:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
    .footnote { font-size: 12.5px; color: var(--text-muted); margin-top: 20px; line-height: 1.5; }
`;

function page(title: string, bodyHtml: string): string {
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${title}</title>
<style>${BASE_STYLES}</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}

const CHECK_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"></path></svg>`;
const WARNING_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a1.5 1.5 0 0 0 1.29 2.25h17.78A1.5 1.5 0 0 0 22.18 18L13.71 3.86a1.5 1.5 0 0 0-2.6 0Z"></path></svg>`;
const MAIL_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16v16H4z"></path><path d="m4 6 8 7 8-7"></path></svg>`;

function card({ title, pageTitle, badgeIcon, badgeBg, badgeColor, bodyHtml, actionsHtml, footnote }: {
    title: string,
    pageTitle: string,
    badgeIcon: string,
    badgeBg: string,
    badgeColor: string,
    bodyHtml: string,
    actionsHtml: string,
    footnote: string
}): string {
    return page(pageTitle, `
<div class="card">
    <div class="wordmark">rivers.run</div>
    <div class="badge" style="background-color: ${badgeBg}; color: ${badgeColor};">${badgeIcon}</div>
    <h1>${title}</h1>
    <p class="body-copy">${bodyHtml}</p>
    <hr class="divider" />
    ${actionsHtml}
    <p class="footnote">${footnote}</p>
</div>`);
}

export function renderUnsubscribeConfirmation({ email, listsUrl }: { email: string, listsUrl: string }): string {
    const safeEmail = escapeHtml(email);
    const safeListsUrl = escapeHtml(listsUrl);
    return card({
        pageTitle: "rivers.run — Unsubscribed",
        title: "You're unsubscribed",
        badgeIcon: CHECK_ICON,
        badgeBg: "var(--success-bg)",
        badgeColor: "var(--success-text)",
        bodyHtml: `<strong>${safeEmail}</strong> won't get river alerts or list digest emails from rivers.run anymore. No further action is needed.`,
        actionsHtml: `<div class="actions"><a href="${safeListsUrl}">View your lists</a></div>`,
        footnote: "Changed your mind? Log in at rivers.run and re-enable email alerts from Settings."
    });
}

export function renderUnsubscribeError(): string {
    return card({
        pageTitle: "rivers.run — Unsubscribe link invalid",
        title: "This link isn't valid",
        badgeIcon: WARNING_ICON,
        badgeBg: "var(--danger-bg)",
        badgeColor: "var(--danger-text)",
        bodyHtml: "We couldn't verify this unsubscribe link. It may have been altered, or the account it points to no longer exists.",
        actionsHtml: `<div class="actions"><a href="https://rivers.run">Go to rivers.run</a></div>`,
        footnote: "You can also disable email alerts by logging in and visiting Settings."
    });
}

// GET requests aren't trusted to mutate state on their own - corporate email security
// gateways and link scanners routinely pre-fetch every URL in an email, including the
// List-Unsubscribe header target, before a human ever opens the message. So a verified
// GET renders this confirm step instead of unsubscribing directly; only a real POST
// (Gmail's silent one-click, or this page's own form submission) does the mutation.
export function renderUnsubscribeConfirmPrompt({ actionUrl }: { actionUrl: string }): string {
    const safeActionUrl = escapeHtml(actionUrl);
    return card({
        pageTitle: "rivers.run — Confirm unsubscribe",
        title: "Unsubscribe from rivers.run emails?",
        badgeIcon: MAIL_ICON,
        badgeBg: "var(--info-bg)",
        badgeColor: "var(--primary)",
        bodyHtml: "Click below to stop river alerts and list digest emails. This works from any device - you don't need to log in.",
        actionsHtml: `<form method="POST" action="${safeActionUrl}"><button type="submit" class="confirm-button">Confirm unsubscribe</button></form>`,
        footnote: "If you didn't mean to open this link, you can safely close this page - nothing has changed yet."
    });
}
