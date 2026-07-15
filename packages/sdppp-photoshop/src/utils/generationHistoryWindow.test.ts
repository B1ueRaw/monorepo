import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { TranslationKey, TranslationOptions } from '@sdppp/common'

const mocks = vi.hoisted(() => ({
    activeDocumentID: 77,
    generationHistory: [] as any[],
    importImage: vi.fn(),
    materialize: vi.fn(),
    dispose: vi.fn(),
}))

vi.mock('@sdppp/common', () => ({
    sdpppSDK: {
        stores: {
            PhotoshopStore: { getState: () => ({ activeDocumentID: mocks.activeDocumentID }) },
        },
        plugins: {
            photoshop: { importImage: mocks.importImage },
        },
    },
}))

vi.mock('@sdppp/resourcing/src/@sideweb/file-resource-actions', () => ({
    createFileResourceFromExternal: mocks.materialize,
}))

vi.mock('../tsx/App.store', () => ({
    MainStore: {
        getState: () => ({ generationHistory: mocks.generationHistory }),
        setState: (update: any) => {
            const next = typeof update === 'function'
                ? update({ generationHistory: mocks.generationHistory })
                : update
            if (next.generationHistory) mocks.generationHistory = next.generationHistory
        },
    },
}))

import {
    createGenerationHistoryWindowMessage,
    handleGenerationHistoryWindowAction,
} from './generationHistoryWindow'

const historyItem = {
    id: 'history-1',
    createdAt: 0,
    image: 'data:image/png;base64,image',
    url: 'https://example.com/original.png',
    source: 'ComfyUI',
    templateName: 'Portrait',
    prompt: 'portrait prompt',
    negativePrompt: 'blur',
    docId: 42,
    boundaryUri: 'uxp://boundary/42/canvas',
    width: 2048,
    height: 1024,
}

beforeEach(() => {
    mocks.activeDocumentID = 77
    mocks.generationHistory = [{ ...historyItem }]
    mocks.importImage.mockReset().mockResolvedValue({})
    mocks.materialize.mockReset().mockResolvedValue({
        resource: 'resource-1',
        handle: { dispose: mocks.dispose },
        width: 512,
        height: 256,
    })
    mocks.dispose.mockReset()
})

describe('createGenerationHistoryWindowMessage', () => {
    it('includes the hover controls needed by the host window', () => {
        const t = (key: TranslationKey, options?: TranslationOptions) => `${key}:${options?.name ?? options?.count ?? ''}`
        const message = createGenerationHistoryWindowMessage(mocks.generationHistory, t)

        expect(message).toMatchObject({
            type: 'sdppp:open-generation-history',
            title: 'generation_history.title:1',
            previewText: 'generation_history.preview:',
            positiveLabel: 'generation_history.prompt:',
            backText: 'comfy.back:',
            copyText: 'image.copy:',
            actionLabels: {
                delete: 'image.delete_current:',
                smartobject: 'image.import_as_smartobject:',
                newdoc: 'image.import_as_newdoc:',
                selection: 'image.import_selection_button:',
            },
            items: [{
                id: 'history-1',
                createdAt: 0,
                image: 'data:image/png;base64,image',
                canSelect: true,
                template: 'generation_history.template:Portrait',
                prompt: 'portrait prompt',
                negativePrompt: 'blur',
            }],
        })
        expect(message.items[0].dateLabel).toMatch(/^\d{2}-\d{2}$/)
        expect(message.items[0].meta).toContain('\nComfyUI')
    })

    it('sorts history newest first for date grouping', () => {
        const t = (key: TranslationKey) => key
        const message = createGenerationHistoryWindowMessage([
            { ...historyItem, id: 'older', createdAt: 1 },
            { ...historyItem, id: 'newer', createdAt: 2 },
        ], t)

        expect(message.items.map(item => item.id)).toEqual(['newer', 'older'])
    })
})

describe('handleGenerationHistoryWindowAction', () => {
    it.each([
        ['smartobject', 'smartobject', 'uxp://boundary/42/canvas'],
        ['newdoc', 'newdoc', 'uxp://boundary/42/canvas'],
        ['selection', 'smartobject', 'uxp://boundary/42/selection'],
    ] as const)('imports a history image for the %s action', async (action, type, boundaryUri) => {
        const handled = await handleGenerationHistoryWindowAction({
            type: 'sdppp:generation-history-action',
            id: 'history-1',
            action,
        })

        expect(handled).toBe(true)
        expect(mocks.materialize).toHaveBeenCalledWith({
            url: 'https://example.com/original.png',
            fileName: undefined,
        })
        expect(mocks.importImage).toHaveBeenCalledWith({
            resource: 'resource-1',
            boundaryUri,
            type,
            sourceWidth: 2048,
            sourceHeight: 1024,
        })
        expect(mocks.dispose).toHaveBeenCalledOnce()
    })

    it('deletes only the selected history item', async () => {
        mocks.generationHistory.push({ ...historyItem, id: 'history-2' })

        const handled = await handleGenerationHistoryWindowAction({
            type: 'sdppp:generation-history-action',
            id: 'history-1',
            action: 'delete',
        })

        expect(handled).toBe(true)
        expect(mocks.generationHistory.map(item => item.id)).toEqual(['history-2'])
        expect(mocks.materialize).not.toHaveBeenCalled()
    })

    it('falls back to a stored thumbnail for older history items', async () => {
        delete mocks.generationHistory[0].url

        const handled = await handleGenerationHistoryWindowAction({
            type: 'sdppp:generation-history-action',
            id: 'history-1',
            action: 'smartobject',
        })

        expect(handled).toBe(true)
        expect(mocks.materialize).toHaveBeenCalledWith({
            url: 'data:image/png;base64,image',
            fileName: undefined,
        })
    })
})
