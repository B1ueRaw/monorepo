import { describe, expect, it } from 'vitest'
import type { TranslationKey, TranslationOptions } from '@sdppp/common'
import { createGenerationHistoryWindowMessage } from './generationHistoryWindow'

describe('createGenerationHistoryWindowMessage', () => {
    it('includes the prompt details needed by the host window', () => {
        const t = (key: TranslationKey, options?: TranslationOptions) => `${key}:${options?.name ?? options?.count ?? ''}`
        const message = createGenerationHistoryWindowMessage([{
            id: 'history-1',
            createdAt: 0,
            image: 'data:image/png;base64,image',
            source: 'ComfyUI',
            templateName: 'Portrait',
            prompt: 'portrait prompt',
            negativePrompt: 'blur',
        }], t)

        expect(message).toMatchObject({
            type: 'sdppp:open-generation-history',
            title: 'generation_history.title:1',
            positiveLabel: 'generation_history.prompt:',
            items: [{
                image: 'data:image/png;base64,image',
                template: 'generation_history.template:Portrait',
                prompt: 'portrait prompt',
                negativePrompt: 'blur',
            }],
        })
        expect(message.items[0].meta).toContain('\nComfyUI')
    })
})
