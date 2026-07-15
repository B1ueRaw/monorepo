import { describe, expect, it } from 'vitest'
import type { TranslationKey, TranslationOptions } from '@sdppp/common'
import { createPromptTemplateWindowMessage, parsePromptTemplateWindowAction } from './promptTemplateWindow'

describe('prompt template window', () => {
    it('builds text cards and accepts only known actions', () => {
        const t = (key: TranslationKey, options?: TranslationOptions) => `${key}:${options?.count ?? ''}`
        const message = createPromptTemplateWindowMessage([
            { id: 'preset-1', name: '舞台背景', prompt: '把背景变成舞台' },
        ], ['preset-1'], t)

        expect(message).toMatchObject({
            type: 'sdppp:open-prompt-templates',
            appliedTemplateIds: ['preset-1'],
            addText: 'comfy_simple.prompt_templates.add_title:',
            editText: 'comfy_simple.prompt_templates.edit_title:',
            deleteText: 'common.delete:',
            deleteConfirmText: 'comfy_simple.prompt_templates.delete_confirm_content:',
            promptText: 'generation_history.prompt:',
            items: [{ id: 'preset-1', name: '舞台背景', prompt: '把背景变成舞台' }],
        })
        expect(parsePromptTemplateWindowAction({
            type: 'sdppp:prompt-template-action',
            id: 'preset-1',
            action: 'use',
        })).toEqual({ id: 'preset-1', action: 'use' })
        expect(parsePromptTemplateWindowAction({
            type: 'sdppp:prompt-template-action',
            id: 'preset-1',
            action: 'save',
            item: { id: 'preset-1', name: '新名称', prompt: '新提示词' },
        })).toEqual({
            id: 'preset-1',
            action: 'save',
            item: { id: 'preset-1', name: '新名称', prompt: '新提示词' },
        })
        expect(parsePromptTemplateWindowAction({
            type: 'sdppp:prompt-template-action',
            id: 'preset-1',
            action: 'delete',
        })).toEqual({ id: 'preset-1', action: 'delete' })
        expect(parsePromptTemplateWindowAction({
            type: 'sdppp:prompt-template-action',
            id: '',
            action: 'save',
            item: { id: '', name: '', prompt: '' },
        })).toBeNull()
    })
})
