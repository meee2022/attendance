// A ready-to-send e-mail as an .eml file. «X-Unsent: 1» makes Outlook open it
// as a new message rather than a received one — recipient, subject, text and
// the attached PDF already in place, waiting for «إرسال». A web page cannot
// attach a file to a mailto: link, so this is how the form reaches Outlook.

function base64(bytes: Uint8Array) {
    let binary = "";
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(binary);
}
const utf8 = (text: string) => base64(new TextEncoder().encode(text));
// RFC 2047 for headers that are not plain ASCII
const header = (text: string) => `=?UTF-8?B?${utf8(text)}?=`;
// base64 bodies are wrapped at 76 characters
const wrap = (b64: string) => b64.replace(/.{1,76}/g, "$&\r\n");
const escapeHtml = (t: string) => t.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export async function outlookDraft({ to, subject, text, file }: { to: string; subject: string; text: string; file: File }) {
    const boundary = `----=_visit_${crypto.getRandomValues(new Uint32Array(2)).join("")}`;
    // Centred, one paragraph per line, in an Arabic face Outlook has on Windows;
    // a table because Outlook lays mail out with Word's engine
    const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
    const paragraphs = lines.map((line, i) => {
        const first = i === 0, last = i === lines.length - 1, request = /^يرجى/.test(line);
        const style = `margin:0 0 10px;${first || last || request ? "font-weight:bold;" : ""}${request ? "color:#8A1538;" : ""}`;
        return `<p align="center" style="${style}">${escapeHtml(line)}</p>`;
    }).join("");
    const html = `<table width="100%" dir="rtl" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" dir="rtl" style="padding:16px 8px;font-family:'Sakkal Majalla','Traditional Arabic','Segoe UI',Tahoma,Arial,sans-serif;font-size:22px;line-height:1.7;color:#1e293b">${paragraphs}</td></tr></table>`;
    const pdf = new Uint8Array(await file.arrayBuffer());
    const eml = [
        `To: ${to}`,
        `Subject: ${header(subject)}`,
        "X-Unsent: 1",
        "MIME-Version: 1.0",
        `Content-Type: multipart/mixed; boundary="${boundary}"`,
        "",
        `--${boundary}`,
        "Content-Type: text/html; charset=UTF-8",
        "Content-Transfer-Encoding: base64",
        "",
        wrap(utf8(html)),
        `--${boundary}`,
        `Content-Type: application/pdf; name="${header(file.name)}"`,
        "Content-Transfer-Encoding: base64",
        `Content-Disposition: attachment; filename="${header(file.name)}"; filename*=UTF-8''${encodeURIComponent(file.name)}`,
        "",
        wrap(base64(pdf)),
        `--${boundary}--`,
        "",
    ].join("\r\n");
    return new Blob([eml], { type: "message/rfc822" });
}

export function downloadBlob(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
