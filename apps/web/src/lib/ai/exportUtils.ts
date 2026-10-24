/**
 * Conversation Export Utilities (v2)
 *
 * Safe Markdown, Structured JSON, and Professional Printable HTML / PDF generation
 * for AI Copilot conversations.
 * Zero external library dependencies; uses standard browser Blob and sanitized printable frame.
 */
import type { AiUiMessage } from '@/types/ai';

export function exportConversationToMarkdown(
  messages: AiUiMessage[],
  title = 'medu-copilot-chat',
): void {
  if (!messages || messages.length === 0) return;

  const now = new Date();
  const dateStr = now.toLocaleString();
  let md = `# M-EDU AI Copilot — Suhbat Tarixi\n\n`;
  md += `**Sana:** ${dateStr}  \n`;
  md += `**Jami xabarlar:** ${messages.length}  \n\n`;
  md += `---\n\n`;

  for (const m of messages) {
    const isUser = m.role === 'user';
    const roleBadge = isUser ? '👤 **Foydalanuvchi**' : '🤖 **M-EDU Copilot**';
    md += `### ${roleBadge}\n\n`;
    md += `${m.content || ''}\n\n`;

    if (m.toolActivities && m.toolActivities.length > 0) {
      md += `*Bajarilgan amallar:*\n`;
      for (const t of m.toolActivities) {
        md += `- 🔧 **${t.subject || t.toolName}**: ${t.detail || 'Bajarildi'}\n`;
      }
      md += '\n';
    }
    md += `---\n\n`;
  }

  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeTitle = title.toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 50);
  a.download = `${safeTitle}-${Date.now()}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportConversationToJson(
  messages: AiUiMessage[],
  title = 'medu-copilot-chat',
): void {
  if (!messages || messages.length === 0) return;

  const exportPayload = {
    platform: 'M-EDU Intelligent Education Platform',
    exportedAt: new Date().toISOString(),
    title,
    messagesCount: messages.length,
    messages: messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: m.createdAt ? new Date(m.createdAt).toISOString() : undefined,
      toolActivities: m.toolActivities?.map((t) => ({
        toolName: t.toolName,
        status: t.status,
        result: t.result,
      })),
      attachments: m.attachments?.map((a) => ({
        type: a.type,
        name: a.name,
        size: a.size,
      })),
    })),
  };

  const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeTitle = title.toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 50);
  a.download = `${safeTitle}-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function exportConversationToPrint(
  messages: AiUiMessage[] = [],
  title = "M-EDU AI Copilot — Tahliliy Hisobot",
  institution = "M-EDU Ta'lim Markazi",
): void {
  if (typeof window === 'undefined') return;

  if (messages.length === 0) {
    window.print();
    return;
  }

  const printWindow = window.open('', '_blank', 'width=900,height=800');
  if (!printWindow) {
    window.print();
    return;
  }

  const dateStr = new Date().toLocaleDateString('uz-UZ', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const messagesHtml = messages
    .map((m) => {
      const isUser = m.role === 'user';
      const roleName = isUser ? 'Foydalanuvchi' : 'M-EDU Copilot AI';
      const roleClass = isUser ? 'user-msg' : 'ai-msg';
      const badgeClass = isUser ? 'user-badge' : 'ai-badge';
      const safeContent = escapeHtml(m.content || '').replace(/\n/g, '<br/>');

      let toolsHtml = '';
      if (m.toolActivities && m.toolActivities.length > 0) {
        toolsHtml = `
          <div class="tool-box">
            <strong>Bajarilgan tizim amallari:</strong>
            <ul>
              ${m.toolActivities
                .map((t) => `<li><code>${escapeHtml(t.toolName || 'tool')}</code>: ${escapeHtml(t.status || 'Bajarildi')}</li>`)
                .join('')}
            </ul>
          </div>
        `;
      }

      return `
        <div class="msg-card ${roleClass}">
          <div class="msg-header">
            <span class="role-badge ${badgeClass}">${roleName}</span>
            <span class="timestamp">${m.createdAt ? new Date(m.createdAt).toLocaleTimeString() : ''}</span>
          </div>
          <div class="msg-body">${safeContent}</div>
          ${toolsHtml}
        </div>
      `;
    })
    .join('');

  const docHtml = `
    <!DOCTYPE html>
    <html lang="uz">
    <head>
      <meta charset="utf-8" />
      <title>${escapeHtml(title)}</title>
      <style>
        @page {
          size: A4;
          margin: 18mm 16mm;
        }
        * {
          box-sizing: border-box;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          color: #1a1a1a;
          background: #ffffff;
          line-height: 1.5;
          margin: 0;
          padding: 24px;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 2px solid #007aff;
          padding-bottom: 14px;
          margin-bottom: 20px;
        }
        .brand-title {
          font-size: 20px;
          font-weight: 800;
          color: #007aff;
          letter-spacing: -0.5px;
        }
        .inst-name {
          font-size: 13px;
          font-weight: 600;
          color: #555555;
        }
        .meta-box {
          font-size: 11px;
          color: #777777;
          text-align: right;
        }
        .msg-card {
          margin-bottom: 14px;
          padding: 12px 14px;
          border-radius: 10px;
          page-break-inside: avoid;
          border: 1px solid #e5e7eb;
        }
        .user-msg {
          background: #f8fafc;
          border-left: 4px solid #007aff;
        }
        .ai-msg {
          background: #ffffff;
          border-left: 4px solid #5856d6;
        }
        .msg-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 6px;
        }
        .role-badge {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          padding: 2px 8px;
          border-radius: 6px;
        }
        .user-badge {
          background: #007aff;
          color: #ffffff;
        }
        .ai-badge {
          background: #5856d6;
          color: #ffffff;
        }
        .timestamp {
          font-size: 10px;
          color: #888888;
        }
        .msg-body {
          font-size: 13px;
          color: #222222;
        }
        .tool-box {
          margin-top: 8px;
          padding: 8px;
          background: #f1f5f9;
          border-radius: 6px;
          font-size: 11px;
        }
        .tool-box ul {
          margin: 4px 0 0 16px;
          padding: 0;
        }
        .footer {
          margin-top: 30px;
          border-top: 1px solid #e5e7eb;
          padding-top: 10px;
          display: flex;
          justify-content: space-between;
          font-size: 10px;
          color: #999999;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <div class="brand-title">M-EDU Intelligence</div>
          <div class="inst-name">${escapeHtml(institution)}</div>
        </div>
        <div class="meta-box">
          <div><strong>Sana:</strong> ${dateStr}</div>
          <div><strong>Xabarlar soni:</strong> ${messages.length} ta</div>
        </div>
      </div>

      <div class="conversation">
        ${messagesHtml}
      </div>

      <div class="footer">
        <span>M-EDU Platformasi — AI Copilot Tahliliy Eksporti</span>
        <span>Maxfiy — Faqat ichki foydalanish uchun</span>
      </div>

      <script>
        window.onload = function() {
          setTimeout(function() {
            window.print();
          }, 300);
        };
      </script>
    </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(docHtml);
  printWindow.document.close();
}
