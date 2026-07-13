import { describe, expect, it } from 'vitest'
import { createComfyPromptInjection, injectPromptTemplate } from '../../utils/promptTemplates'

describe('prompt template injection', () => {
    it('injects API and Comfy prompts without changing stored values', () => {
        const template = { id: '1', name: 'Style', prompt: 'cinematic', negativePrompt: 'blurry' }
        const nodes = [
            { id: 'prompt', title: 'Prompt', widgets: [{ outputType: 'string' }] },
            { id: 'negative_prompt', title: 'Negative Prompt', widgets: [{ outputType: 'string' }] },
        ]
        const values = { prompt: 'a cat', negative_prompt: 'watermark' }

        expect(injectPromptTemplate(values, nodes, template)).toEqual({
            prompt: 'cinematic\na cat',
            negative_prompt: 'blurry\nwatermark',
        })
        expect(values.prompt).toBe('a cat')

        const comfy = createComfyPromptInjection(
            { nodes: {
                '25': { id: '25', title: '#01. Pos Prompt', widgets: [{ outputType: 'string' }] },
                '26': { id: '26', title: '#02. Neg Prompt', widgets: [{ outputType: 'string' }] },
            }, nodeIndexes: ['25', '26'] },
            { '25': ['portrait'], '26': ['bad anatomy'] },
            template,
        )
        expect(comfy.updates.map(item => item.value)).toEqual(['cinematic\nportrait', 'blurry\nbad anatomy'])
        expect(comfy.restore.map(item => item.value)).toEqual(['portrait', 'bad anatomy'])
    })
})
