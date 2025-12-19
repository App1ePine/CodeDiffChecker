import { type DiffFile, generateDiffFile } from '@git-diff-view/file'
import { DiffModeEnum, DiffView, setEnableFastDiffTemplate } from '@git-diff-view/vue'
import ElementPlus, {
  ElCard,
  ElCol,
  ElDescriptions,
  ElDescriptionsItem,
  ElInput,
  ElInputNumber,
  ElRadioButton,
  ElRadioGroup,
  ElRow,
  ElSwitch,
} from 'element-plus'
import { computed, createApp, h, ref } from 'vue'
import type { ShareDetail } from '@/api/types'

type ShareViewerData = {
  share: ShareDetail
  sourceUrl: string
  shareUrl: string
  leftContent: string
  rightContent: string
}

type Theme = 'light' | 'dark'

declare global {
  interface Window {
    initShareViewer: (selector: string, shareData: ShareViewerData) => void
  }
}

window.initShareViewer = (selector: string, shareData: ShareViewerData) => {
  const App = {
    setup() {
      const share = shareData.share
      const sourceUrl = shareData.sourceUrl
      const shareUrl = shareData.shareUrl
      const leftContent = ref(shareData.leftContent)
      const rightContent = ref(shareData.rightContent)
      const currentYear = new Date().getFullYear()

      const fastDiffEnabled = ref(true)
      const wrap = ref(true)
      const highlight = ref(true)
      const theme = ref<Theme>('light')
      const fontSize = ref(14)
      const mode = ref<DiffModeEnum>(DiffModeEnum.Split)

      const diffFile = computed<DiffFile>(() => {
        setEnableFastDiffTemplate(fastDiffEnabled.value)
        const diff = generateDiffFile('left', leftContent.value, 'right', rightContent.value, '', '', {})
        diff.initTheme(theme.value)
        diff.init()
        diff.buildSplitDiffLines()
        diff.buildUnifiedDiffLines()
        return diff
      })

      function formatDate(dateStr: string | null) {
        if (!dateStr) return 'Never'
        return new Date(dateStr).toLocaleString()
      }

      function scrollToTop() {
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }

      const updateMode = (value: string | number | boolean | undefined) => {
        if (typeof value === 'number') {
          mode.value = value as DiffModeEnum
        }
      }

      const updateBoolean = (target: typeof fastDiffEnabled) => (value: string | number | boolean) => {
        target.value = Boolean(value)
      }

      const updateTheme = (value: string | number | boolean | undefined) => {
        if (value === 'light' || value === 'dark') {
          theme.value = value
        }
      }

      const updateFontSize = (value: number | undefined) => {
        if (typeof value === 'number') {
          fontSize.value = value
        }
      }
      const updateContent = (target: typeof leftContent) => (value: string) => {
        target.value = value
      }

      return () =>
        h('div', { class: 'app-shell' }, [
          // App Header
          h('header', { class: 'app-header', style: { justifyContent: 'center' } }, [
            h(
              'div',
              {
                class: 'brand',
                style: { cursor: 'pointer' },
                onClick: scrollToTop,
              },
              [h('span', { class: 'brand-title' }, 'Code Diff Checker')]
            ),
          ]),

          // App Main Content
          h('main', { class: 'app-main' }, [
            h('div', { class: 'share-viewer' }, [
              // Editor Row
              h(ElRow, { gutter: 16, class: 'editor-row' }, () => [
                h(ElCol, { span: 24, md: 12 }, () =>
                  h(
                    ElCard,
                    { class: 'editor-card' },
                    {
                      header: () => h('strong', 'Left source'),
                      default: () =>
                        h(ElInput, {
                          modelValue: leftContent.value,
                          'onUpdate:modelValue': updateContent(leftContent),
                          type: 'textarea',
                          rows: 12,
                          class: 'editor-input',
                          readonly: false,
                          resize: 'none',
                          placeholder: 'Left source',
                        }),
                    }
                  )
                ),
                h(ElCol, { span: 24, md: 12 }, () =>
                  h(
                    ElCard,
                    { class: 'editor-card' },
                    {
                      header: () => h('strong', 'Right source'),
                      default: () =>
                        h(ElInput, {
                          modelValue: rightContent.value,
                          'onUpdate:modelValue': updateContent(rightContent),
                          type: 'textarea',
                          rows: 12,
                          class: 'editor-input',
                          readonly: false,
                          resize: 'none',
                          placeholder: 'Right source',
                        }),
                    }
                  )
                ),
              ]),

              // Diff Card
              h(
                ElCard,
                { shadow: 'never' },
                {
                  header: () =>
                    h('div', { class: 'header' }, [
                      h('div', [
                        h('h2', { class: 'title' }, share.title),
                        h('p', { class: 'meta' }, [
                          'Shared by ',
                          h('strong', share.ownerName),
                          ` - Created ${formatDate(share.createdAt)} - Expires ${formatDate(share.expiresAt)}`,
                        ]),
                      ]),
                      h('div', { class: 'controls' }, [
                        // Split/Unified Toggle
                        h(
                          ElRadioGroup,
                          {
                            size: 'small',
                            modelValue: mode.value,
                            'onUpdate:modelValue': updateMode,
                          },
                          {
                            default: () => [
                              h(ElRadioButton, { label: DiffModeEnum.Split }, () => 'Split'),
                              h(ElRadioButton, { label: DiffModeEnum.Unified }, () => 'Unified'),
                            ],
                          }
                        ),
                        h(ElSwitch, {
                          size: 'large',
                          modelValue: fastDiffEnabled.value,
                          'onUpdate:modelValue': updateBoolean(fastDiffEnabled),
                          activeText: 'Fast diff',
                          inlinePrompt: true,
                          inactiveText: 'Precise',
                        }),
                        h(ElSwitch, {
                          size: 'large',
                          modelValue: wrap.value,
                          'onUpdate:modelValue': updateBoolean(wrap),
                          activeText: 'Wrap',
                          inlinePrompt: true,
                          inactiveText: 'No wrap',
                        }),
                        h(ElSwitch, {
                          size: 'large',
                          modelValue: highlight.value,
                          'onUpdate:modelValue': updateBoolean(highlight),
                          activeText: 'Highlight',
                          inlinePrompt: true,
                          inactiveText: 'Plain',
                        }),
                        h(
                          ElRadioGroup,
                          {
                            size: 'small',
                            modelValue: theme.value,
                            'onUpdate:modelValue': updateTheme,
                          },
                          {
                            default: () => [
                              h(ElRadioButton, { label: 'light' }, () => 'Light'),
                              h(ElRadioButton, { label: 'dark' }, () => 'Dark'),
                            ],
                          }
                        ),
                        h(
                          ElInputNumber,
                          {
                            size: 'small',
                            modelValue: fontSize.value,
                            'onUpdate:modelValue': updateFontSize,
                            min: 12,
                            max: 22,
                            step: 1,
                          },
                          {
                            suffix: () => 'px',
                          }
                        ),
                      ]),
                    ]),
                  default: () =>
                    h(
                      'div',
                      {
                        class: ['diff-wrapper', theme.value],
                        style: { fontSize: `${fontSize.value}px` },
                      },
                      [
                        diffFile.value
                          ? h(DiffView, {
                              diffFile: diffFile.value,
                              diffViewFontSize: fontSize.value,
                              diffViewHighlight: highlight.value,
                              diffViewMode: mode.value,
                              diffViewTheme: theme.value,
                              diffViewWrap: wrap.value,
                            })
                          : null,
                      ]
                    ),
                }
              ),

              // Summary Card
              h(
                ElCard,
                { class: 'share-summary', shadow: 'never' },
                {
                  header: () => h('strong', 'Summary'),
                  default: () =>
                    h(
                      ElDescriptions,
                      { column: 1, border: true },
                      {
                        default: () => [
                          h(ElDescriptionsItem, { label: 'Title' }, () => share.title),
                          h(ElDescriptionsItem, { label: 'Owner' }, () => share.ownerName),
                          h(ElDescriptionsItem, { label: 'Created at' }, () => formatDate(share.createdAt)),
                          h(ElDescriptionsItem, { label: 'Expires on' }, () => formatDate(share.expiresAt)),
                          h(ElDescriptionsItem, { label: 'Source URL' }, () =>
                            h(
                              'a',
                              {
                                href: sourceUrl,
                                target: '_blank',
                                style: { color: '#409eff', textDecoration: 'underline' },
                              },
                              sourceUrl
                            )
                          ),
                          h(ElDescriptionsItem, { label: 'Share URL' }, () =>
                            h(
                              'a',
                              {
                                href: shareUrl,
                                target: '_blank',
                                style: { color: '#409eff', textDecoration: 'underline' },
                              },
                              shareUrl
                            )
                          ),
                        ],
                      }
                    ),
                }
              ),
            ]),
          ]),

          // App Footer
          h('footer', { class: 'app-footer' }, `© ${currentYear} Code Diff Checker · ApplePine`),
        ])
    },
  }

  const app = createApp(App)
  app.use(ElementPlus)
  app.mount(selector)
}
