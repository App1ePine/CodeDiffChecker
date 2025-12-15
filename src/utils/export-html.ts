import { fetchShareBySlug } from '@/api/shares'
import type { ShareSummary } from '@/api/types'
import { decodeContent } from '@/utils/compression'

const ASSETS = {
  elementPlus: {
    cdn: 'https://unpkg.com/element-plus@2.9.1/dist/index.css',
    local: '/element-plus.css',
  },
  gitDiffView: {
    cdn: 'https://unpkg.com/@git-diff-view/vue@0.0.32/dist/css/diff-view.css',
    local: '/diff-view.css',
  },
}

async function fetchWithFallback(url: string, fallbackUrl?: string): Promise<string> {
  const tryFetch = async (targetUrl: string, timeout = 5000) => {
    const controller = new AbortController()
    const id = setTimeout(() => controller.abort(), timeout)
    try {
      const response = await fetch(targetUrl, { signal: controller.signal })
      clearTimeout(id)
      if (!response.ok) throw new Error(`Failed to load: ${targetUrl}`)
      return await response.text()
    } catch (e) {
      clearTimeout(id)
      throw e
    }
  }

  try {
    return await tryFetch(url, 2000)
  } catch (error) {
    if (fallbackUrl) {
      console.warn(`CDN load failed for ${url}, falling back to ${fallbackUrl}`, error)
      const origin = window.location.origin
      return await tryFetch(`${origin}${fallbackUrl}`)
    }
    throw error
  }
}

function escapeScriptContent(content: string): string {
  return content.replace(/<\/script>/g, '<\\/script>')
}

export async function exportShareToHtml(shareSummary: ShareSummary) {
  try {
    const { share } = await fetchShareBySlug(shareSummary.slug)
    const leftContent = decodeContent(share.leftContent)
    const rightContent = decodeContent(share.rightContent)

    const bundleUrl = `${window.location.origin}/export-bundle.js`

    const [bundleJs, epCss, gdvCss] = await Promise.all([
      fetchWithFallback(bundleUrl),
      fetchWithFallback(ASSETS.elementPlus.cdn, ASSETS.elementPlus.local),
      fetchWithFallback(ASSETS.gitDiffView.cdn, ASSETS.gitDiffView.local),
    ])

    const appOrigin = window.location.origin

    const shareData = {
      share,
      sourceUrl: appOrigin,
      shareUrl: shareSummary.url,
      leftContent,
      rightContent,
    }

    const escapedShareData = escapeScriptContent(JSON.stringify(shareData))

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${share.title} - Diff Export</title>
    <style>
        ${epCss}
        ${gdvCss}
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f7fa; }
        
        /* App Layout CSS */
        .app-shell { min-height: 100vh; display: flex; flex-direction: column; background: #f5f6fb; }
        .app-header { position: sticky; top: 0; z-index: 100; display: flex; align-items: center; padding: 16px 32px; background: rgba(255, 255, 255, 0.9); backdrop-filter: blur(16px); border-bottom: 1px solid rgba(15, 23, 42, 0.08); }
        .brand { display: flex; align-items: center; gap: 8px; }
        .brand-title { font-size: 20px; font-weight: 600; color: #1f2937; }
        .app-main { flex: 1; padding: 24px; display: flex; flex-direction: column; }
        .app-footer { padding: 24px 32px; text-align: center; color: #9ca3af; font-size: 14px; border-top: 1px solid rgba(15, 23, 42, 0.08); background: rgba(255, 255, 255, 0.7); }

        .share-viewer { display: flex; flex-direction: column; gap: 20px; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; }
        .title { margin: 0; font-size: 1.5rem; font-weight: 600; color: #303133; }
        .meta { margin: 4px 0 0; color: #909399; font-size: 14px; }
        .controls { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
        .diff-wrapper { overflow: auto; min-height: 200px; border: 1px solid #dcdfe6; border-radius: 4px; background: white; }
        .share-summary :deep(.el-descriptions__label) { width: 160px; }
        @media (max-width: 768px) {
            .controls { width: 100%; justify-content: flex-start; }
        }
    </style>
</head>
<body>
    <div id="app"></div>

    <!-- Main Bundle (Vue + EP + GitDiffView) -->
    <script>
        ${bundleJs}
    </script>

    <!-- Init Script -->
    <script>
        const shareData = ${escapedShareData};
        if (window.initShareViewer) {
            window.initShareViewer('#app', shareData);
        } else {
            console.error('initShareViewer not found');
            document.body.innerHTML = '<h1>Error: Export bundle failed to initialize.</h1>';
        }
    </script>
</body>
</html>`

    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${shareSummary.slug}-${share.title.replace(/[^a-z0-9]/gi, '_')}.html`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  } catch (error) {
    console.error('Export failed', error)
    throw error
  }
}
