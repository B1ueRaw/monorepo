import { describe, expect, it } from 'vitest'
import type { TranslationKey, TranslationOptions } from '@sdppp/common'
import { createPromptTemplateWindowMessage, parsePromptTemplateWindowAction } from './promptTemplateWindow'

describe('prompt template window', () => {
    it('builds text cards and accepts only known actions', () => {
        const t = (key: TranslationKey, options?: TranslationOptions) => `${key}:${options?.count ?? ''}`
        const message = createPromptTemplateWindowMessage([
            { id: 'preset-1', name: '舞台背景', prompt: '把背景变成舞台' },
        ], 'preset-1', t)

        expect(message).toMatchObject({
            type: 'sdppp:open-prompt-templates',
            appliedTemplateId: 'preset-1',
            items: [{ id: 'preset-1', name: '舞台背景', prompt: '把背景变成舞台' }],
        })
        expect(parsePromptTemplateWindowAction({
            type: 'sdppp:prompt-template-action',
            id: 'preset-1',
            action: 'use',
        })).toEqual({ id: 'preset-1', action: 'use' })
        expect(parsePromptTemplateWindowAction({
            type: 'sdppp:prompt-template-action',
            id: '',
            action: 'delete',
        })).toBeNull()
    })
})
