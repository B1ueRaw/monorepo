import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    events: [] as string[],
    setWidgetValue: vi.fn(async ({ values }: { values: Array<{ value: string }> }) => {
        mocks.events.push(`set:${values[0].value}`)
        return { success: true }
    }),
    run: vi.fn(async () => ({
        async *[Symbol.asyncIterator]() {
            mocks.events.push('stream:start')
            yield { success: true }
            mocks.events.push('stream:end')
        },
    })),
}))

vi.mock('@sdppp/common', () => ({
    t: (_key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? _key,
    sdpppSDK: {
        stores: {
            ComfyStore: { getState: () => ({ widgetableStructure: {}, widgetableValues: {} }) },
        },
        plugins: {
            ComfyCaller: {
                setWidgetValue: mocks.setWidgetValue,
                run: mocks.run,
                stopAll: vi.fn(),
            },
            photoshop: {
                taskAdd: vi.fn(),
                taskUpdate: vi.fn(),
            },
        },
    },
}))

vi.mock('../../tsx/App.store', () => ({
    MainStore: {
        getState: () => ({
            promptTemplates: [{ id: 'template', name: 'Template', prompt: 'injected' }],
            selectedPromptTemplateId: 'template',
        }),
    },
}))

vi.mock('../../utils/promptTemplates', () => ({
    createComfyPromptInjection: () => ({
        updates: [{ nodeID: 'prompt', widgetIndex: 0, value: 'injected' }],
        restore: [{ nodeID: 'prompt', widgetIndex: 0, value: '' }],
        prompt: 'injected',
    }),
}))

import { ComfyTask } from './ComfyTask'

describe('ComfyTask prompt injection', () => {
    it('restores the prompt only after the run stream is consumed', async () => {
        mocks.events.length = 0
        mocks.run.mockImplementationOnce(async () => {
            mocks.events.push('run')
            return {
                async *[Symbol.asyncIterator]() {
                    mocks.events.push('stream:start')
                    yield { success: true }
                    mocks.events.push('stream:end')
                },
            }
        })

        await new ComfyTask({ size: 1 }, 'workflow', 1, null, null, {
            handleImageResult: vi.fn(),
        }).promise

        expect(mocks.events).toEqual([
            'set:injected',
            'run',
            'stream:start',
            'stream:end',
            'set:',
        ])
    })
})
