import { sdpppSDK, type TranslationKey, type TranslationOptions } from '@sdppp/common'
import { createFileResourceFromExternal } from '@sdppp/resourcing/src/@sideweb/file-resource-actions'
import { MainStore, type GenerationHistoryItem } from '../tsx/App.store'

const MESSAGE_TYPE = 'sdppp:open-generation-history'
const ACTION_MESSAGE_TYPE = 'sdppp:generation-history-action'
const ACTIONS = ['delete', 'smartobject', 'newdoc', 'selection'] as const

type Translate = (key: TranslationKey, options?: TranslationOptions) => string
type GenerationHistoryAction = (typeof ACTIONS)[number]

declare global {
    interface Window {
        uxpHost?: { postMessage: (message: unknown) => void }
    }
}

function resolveDocumentId(item: GenerationHistoryItem) {
    const documentId = item.docId
        ?? (sdpppSDK as any)?.stores?.PhotoshopStore?.getState?.()?.activeDocumentID
    return typeof documentId === 'number' && Number.isFinite(documentId) && documentId > 0
        ? documentId
        : undefined
}

function parseActionMessage(message: unknown): { id: string; action: GenerationHistoryAction } | null {
    if (!message || typeof message !== 'object') return null
    const { type, id, action } = message as Record<string, unknown>
    if (type !== ACTION_MESSAGE_TYPE || typeof id !== 'string' || !id) return null
    if (typeof action !== 'string' || !ACTIONS.includes(action as GenerationHistoryAction)) return null
    return { id, action: action as GenerationHistoryAction }
}

function disposeHandle(handle: unknown) {
    try {
        if (handle && typeof (handle as { dispose?: unknown }).dispose === 'function') {
            (handle as { dispose: () => void }).dispose()
        }
    } catch (error) {
        console.warn('[generation-history] dispose handle failed', error)
    }
}

async function materializeHistoryImage(item: GenerationHistoryItem) {
    const sources = [item.url, item.image].filter((source, index, values): source is string => (
        typeof source === 'string'
        && source.length > 0
        && !/^javascript:/i.test(source.trim())
        && values.indexOf(source) === index
    ))

    for (const url of sources) {
        try {
            const result = await createFileResourceFromExternal({ url, fileName: item.fileName })
            const primary = result?.batch?.[0] ?? result
            const handle = primary?.handle ?? result?.handle
            if (!result?.error && !primary?.error && primary?.resource) {
                return { primary, handle }
            }
            disposeHandle(handle)
        } catch (error) {
            console.warn('[generation-history] materialize image failed', error)
        }
    }
    return null
}

export function createGenerationHistoryWindowMessage(history: GenerationHistoryItem[], t: Translate) {
    return {
        type: MESSAGE_TYPE,
        title: t('generation_history.title', { count: history.length }),
        emptyText: t('generation_history.empty'),
        closeText: t('common.close'),
        imageAlt: t('generation_history.image_alt'),
        previewText: t('generation_history.preview'),
        positiveLabel: t('generation_history.prompt'),
        negativeLabel: t('comfy_simple.prompt_templates.negative_label'),
        actionLabels: {
            delete: t('image.delete_current'),
            smartobject: t('image.import_as_smartobject'),
            newdoc: t('image.import_as_newdoc'),
            selection: t('image.import_selection_button'),
        },
        items: history.map(item => ({
            id: item.id,
            image: item.image,
            canSelect: Boolean(resolveDocumentId(item)),
            meta: `${new Date(item.createdAt).toLocaleString()}\n${item.source}`,
            template: item.templateName ? t('generation_history.template', { name: item.templateName }) : '',
            prompt: item.prompt,
            negativePrompt: item.negativePrompt ?? '',
        })),
    }
}

export function openGenerationHistoryWindow(history: GenerationHistoryItem[], t: Translate) {
    if (!window.uxpHost) {
        console.warn('[generation-history] UXP host is unavailable')
        return
    }
    window.uxpHost.postMessage(createGenerationHistoryWindowMessage(history, t))
}

export async function handleGenerationHistoryWindowAction(message: unknown) {
    const actionMessage = parseActionMessage(message)
    if (!actionMessage) return false

    const item = MainStore.getState().generationHistory.find(historyItem => historyItem.id === actionMessage.id)
    if (!item) return false

    if (actionMessage.action === 'delete') {
        MainStore.setState(state => ({
            generationHistory: state.generationHistory.filter(historyItem => historyItem.id !== item.id),
        }))
        return true
    }

    let boundaryUri = item.boundaryUri ?? undefined
    if (actionMessage.action === 'selection') {
        const documentId = resolveDocumentId(item)
        if (!documentId) return false
        boundaryUri = `uxp://boundary/${documentId}/selection`
    }

    const materialized = await materializeHistoryImage(item)
    if (!materialized) {
        console.warn('[generation-history] image resource is unavailable', item.id)
        return false
    }

    try {
        await sdpppSDK.plugins.photoshop.importImage({
            resource: materialized.primary.resource,
            boundaryUri,
            type: actionMessage.action === 'newdoc' ? 'newdoc' : 'smartobject',
            sourceWidth: item.width ?? materialized.primary.width ?? undefined,
            sourceHeight: item.height ?? materialized.primary.height ?? undefined,
        } as any)
        return true
    } catch (error) {
        console.warn('[generation-history] import image failed', error)
        return false
    } finally {
        disposeHandle(materialized.handle)
    }
}

if (typeof window !== 'undefined') {
    window.addEventListener('message', event => {
        void handleGenerationHistoryWindowAction(event.data)
    })
}
