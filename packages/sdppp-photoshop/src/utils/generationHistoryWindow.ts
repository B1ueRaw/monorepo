import type { TranslationKey, TranslationOptions } from '@sdppp/common'
import type { GenerationHistoryItem } from '../tsx/App.store'

const MESSAGE_TYPE = 'sdppp:open-generation-history'

type Translate = (key: TranslationKey, options?: TranslationOptions) => string

declare global {
    interface Window {
        uxpHost?: { postMessage: (message: unknown) => void }
    }
}

export function createGenerationHistoryWindowMessage(history: GenerationHistoryItem[], t: Translate) {
    return {
        type: MESSAGE_TYPE,
        title: t('generation_history.title', { count: history.length }),
        emptyText: t('generation_history.empty'),
        closeText: t('common.close'),
        imageAlt: t('generation_history.image_alt'),
        positiveLabel: t('generation_history.prompt'),
        negativeLabel: t('comfy_simple.prompt_templates.negative_label'),
        items: history.map(item => ({
            image: item.image,
            meta: `${new Date(item.createdAt).toLocaleString()}\n${item.source}`,
            template: item.templateName ? t('generation_history.template', { name: item.templateName }) : '',
            prompt: item.prompt,
            negativePrompt: item.negativePrompt ?? '',
        })),
    }
}

export function openGenerationHistoryWindow(history: GenerationHistoryItem[], t: Translate) {
    if (!window.uxpHost) {
        console.warn('[generation-history] UXP host is unavailable')
        return
    }
    window.uxpHost.postMessage(createGenerationHistoryWindowMessage(history, t))
}
