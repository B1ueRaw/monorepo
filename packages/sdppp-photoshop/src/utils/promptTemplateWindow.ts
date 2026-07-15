import type { TranslationKey, TranslationOptions } from '@sdppp/common'
import type { PromptTemplate } from './promptTemplates'

const MESSAGE_TYPE = 'sdppp:open-prompt-templates'
const ACTION_MESSAGE_TYPE = 'sdppp:prompt-template-action'
const ACTIONS = ['use'] as const

type Translate = (key: TranslationKey, options?: TranslationOptions) => string
export type PromptTemplateWindowAction = (typeof ACTIONS)[number]

declare global {
    interface Window {
        uxpHost?: { postMessage: (message: unknown) => void }
    }
}

export function parsePromptTemplateWindowAction(message: unknown): { id: string; action: PromptTemplateWindowAction } | null {
    if (!message || typeof message !== 'object') return null
    const { type, id = '', action } = message as Record<string, unknown>
    if (type !== ACTION_MESSAGE_TYPE || typeof id !== 'string') return null
    if (typeof action !== 'string' || !ACTIONS.includes(action as PromptTemplateWindowAction)) return null
    if (!id) return null
    return { id, action: action as PromptTemplateWindowAction }
}

export function createPromptTemplateWindowMessage(templates: PromptTemplate[], appliedTemplateId: string, t: Translate) {
    return {
        type: MESSAGE_TYPE,
        title: t('comfy_simple.prompt_templates.modal_title'),
        emptyText: t('comfy_simple.prompt_templates.custom_empty'),
        closeText: t('common.close'),
        useText: t('comfy_simple.prompt_templates.use_button'),
        cancelText: t('common.cancel'),
        appliedTemplateId,
        items: templates.map(({ id, name, prompt }) => ({ id, name, prompt })),
    }
}

export function openPromptTemplateWindow(templates: PromptTemplate[], appliedTemplateId: string, t: Translate) {
    if (!window.uxpHost) {
        console.warn('[prompt-templates] UXP host is unavailable')
        return
    }
    window.uxpHost.postMessage(createPromptTemplateWindowMessage(templates, appliedTemplateId, t))
}
