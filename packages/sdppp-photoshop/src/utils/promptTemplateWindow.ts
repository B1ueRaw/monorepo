import type { TranslationKey, TranslationOptions } from '@sdppp/common'
import type { PromptTemplate } from './promptTemplates'

const MESSAGE_TYPE = 'sdppp:open-prompt-templates'
const ACTION_MESSAGE_TYPE = 'sdppp:prompt-template-action'
const ACTIONS = ['use', 'save', 'delete'] as const

type Translate = (key: TranslationKey, options?: TranslationOptions) => string
export type PromptTemplateWindowAction = (typeof ACTIONS)[number]

declare global {
    interface Window {
        uxpHost?: { postMessage: (message: unknown) => void }
    }
}

export function parsePromptTemplateWindowAction(message: unknown): { id: string; action: PromptTemplateWindowAction; item?: PromptTemplate } | null {
    if (!message || typeof message !== 'object') return null
    const { type, id = '', action, item } = message as Record<string, unknown>
    if (type !== ACTION_MESSAGE_TYPE || typeof id !== 'string') return null
    if (typeof action !== 'string' || !ACTIONS.includes(action as PromptTemplateWindowAction)) return null
    if (!id) return null
    if (action === 'save') {
        if (!item || typeof item !== 'object') return null
        const template = item as Record<string, unknown>
        if (template.id !== id || typeof template.name !== 'string' || !template.name.trim() || typeof template.prompt !== 'string' || !template.prompt.trim()) return null
        return { id, action, item: { id, name: template.name.trim(), prompt: template.prompt.trim() } }
    }
    return { id, action: action as PromptTemplateWindowAction }
}

export function createPromptTemplateWindowMessage(templates: PromptTemplate[], appliedTemplateIds: string[], t: Translate) {
    return {
        type: MESSAGE_TYPE,
        title: t('comfy_simple.prompt_templates.modal_title'),
        emptyText: t('comfy_simple.prompt_templates.custom_empty'),
        closeText: t('common.close'),
        addText: t('comfy_simple.prompt_templates.add_title'),
        editText: t('comfy_simple.prompt_templates.edit_title'),
        deleteText: t('common.delete'),
        deleteConfirmText: t('comfy_simple.prompt_templates.delete_confirm_content'),
        saveText: t('common.save'),
        nameText: t('comfy_simple.prompt_templates.name_placeholder'),
        promptText: t('generation_history.prompt'),
        missingNameText: t('comfy_simple.prompt_templates.missing_key'),
        missingPromptText: t('comfy_simple.prompt_templates.missing_value'),
        duplicateNameText: t('comfy_simple.prompt_templates.duplicate_key'),
        confirmText: t('common.confirm'),
        appliedText: t('comfy_simple.prompt_templates.applied_tag'),
        useText: t('comfy_simple.prompt_templates.use_button'),
        cancelText: t('common.cancel'),
        appliedTemplateIds,
        items: templates.map(({ id, name, prompt }) => ({ id, name, prompt })),
    }
}

export function openPromptTemplateWindow(templates: PromptTemplate[], appliedTemplateIds: string[], t: Translate) {
    if (!window.uxpHost) {
        console.warn('[prompt-templates] UXP host is unavailable')
        return
    }
    window.uxpHost.postMessage(createPromptTemplateWindowMessage(templates, appliedTemplateIds, t))
}
