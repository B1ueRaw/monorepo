import { describe, expect, it } from 'vitest'
import { createComfyPromptInjection, getPromptSnapshot, injectPromptTemplate } from '../../utils/promptTemplates'

describe('prompt template injection', () => {
    it('injects API and Comfy prompts without changing stored values', () => {
        const template = { id: '1', name: 'Style', prompt: 'cinematic' }
        const nodes = [
            { id: 'prompt', title: 'Prompt', widgets: [{ outputType: 'string' }] },
            { id: 'negative_prompt', title: 'Negative Prompt', widgets: [{ outputType: 'string' }] },
        ]
        const values = { prompt: 'a cat', negative_prompt: 'watermark' }

        const injected = injectPromptTemplate(values, nodes, template)
        expect(injected).toEqual({
            prompt: 'cinematic\na cat',
            negative_prompt: 'watermark',
        })
        expect(getPromptSnapshot(injected, nodes)).toEqual({
            prompt: 'cinematic\na cat',
            negativePrompt: 'watermark',
        })
        expect(values.prompt).toBe('a cat')
        expect(injectPromptTemplate(injected, nodes, template, true)).toEqual(values)

        const watercolor = { id: '2', name: 'Watercolor', prompt: 'watercolor' }
        const combined = injectPromptTemplate(values, nodes, [template, watercolor])
        expect(combined.prompt).toBe('watercolor\ncinematic\na cat')
        expect(injectPromptTemplate(combined, nodes, template, true).prompt).toBe('watercolor\na cat')
        expect(injectPromptTemplate(combined, nodes, [template, watercolor])).toEqual(combined)

        const comfy = createComfyPromptInjection(
            { nodes: {
                '25': { id: '25', title: '#01. Pos Prompt', widgets: [{ outputType: 'string' }] },
                '26': { id: '26', title: '#02. Neg Prompt', widgets: [{ outputType: 'string' }] },
            }, nodeIndexes: ['25', '26'] },
            { '25': ['portrait'], '26': ['bad anatomy'] },
            template,
        )
        expect(comfy.updates.map(item => item.value)).toEqual(['cinematic\nportrait'])
        expect(comfy.restore.map(item => item.value)).toEqual(['portrait'])
        expect(createComfyPromptInjection(
            { nodes: {
                '25': { id: '25', title: '#01. Pos Prompt', widgets: [{ outputType: 'string' }] },
                '26': { id: '26', title: '#02. Neg Prompt', widgets: [{ outputType: 'string' }] },
            }, nodeIndexes: ['25', '26'] },
            { '25': ['cinematic\nportrait'], '26': ['bad anatomy'] },
            template,
            true,
        ).updates.map(item => item.value)).toEqual(['portrait'])
        expect({ prompt: comfy.prompt, negativePrompt: comfy.negativePrompt }).toEqual({
            prompt: 'cinematic\nportrait',
            negativePrompt: 'bad anatomy',
        })

        const withoutTemplate = createComfyPromptInjection(
            { nodes: {
                '25': { id: '25', title: 'Prompt', widgets: [{ outputType: 'string' }] },
                '26': { id: '26', title: 'Negative Prompt', widgets: [{ outputType: 'string' }] },
            } },
            { '25': ['portrait'], '26': ['bad anatomy'] },
        )
        expect(withoutTemplate).toMatchObject({
            updates: [],
            restore: [],
            prompt: 'portrait',
            negativePrompt: 'bad anatomy',
        })

        const visiblePrompt = createComfyPromptInjection(
            { nodes: {
                '50': { id: '50', title: '#05-提示词', widgets: [{ outputType: 'customtext' }] },
            } },
            { '50': [undefined] },
            template,
        )
        expect(visiblePrompt.updates).toEqual([{ nodeID: '50', widgetIndex: 0, value: 'cinematic' }])
    })
})
