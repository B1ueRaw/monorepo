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
            appliedPromptTemplateIds: ['template'],
        }),
    },
}))

vi.mock('../../utils/promptTemplates', () => ({
    getComfyPromptSnapshot: () => ({ prompt: 'manual prompt' }),
    filterPresentPromptTemplates: () => [],
}))

import { ComfyTask } from './ComfyTask'

describe('ComfyTask prompt handling', () => {
    it('does not re-inject a stale applied template when running', async () => {
        mocks.events.length = 0
        mocks.setWidgetValue.mockClear()
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

        const handleImageResult = vi.fn()
        await new ComfyTask({ size: 1 }, 'workflow', 1, null, null, {
            handleImageResult,
        }).promise

        expect(mocks.events).toEqual([
            'run',
            'stream:start',
            'stream:end',
        ])
        expect(mocks.setWidgetValue).not.toHaveBeenCalled()
        expect(handleImageResult).not.toHaveBeenCalled()
    })
})
