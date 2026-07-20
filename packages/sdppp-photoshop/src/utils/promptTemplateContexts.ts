export type AppliedPromptTemplateIdsByContext = Record<string, string[]>

const EMPTY_APPLIED_PROMPT_TEMPLATE_IDS: string[] = []

export function createPromptTemplateContextKey(provider: string, contextId?: string | null): string {
    return `${provider.trim() || 'Unknown'}:${contextId?.trim() || '__default__'}`
}

export function getAppliedPromptTemplateIds(
    contexts: AppliedPromptTemplateIdsByContext,
    contextKey: string,
): string[] {
    return contexts[contextKey] ?? EMPTY_APPLIED_PROMPT_TEMPLATE_IDS
}

export function setAppliedPromptTemplateIds(
    contexts: AppliedPromptTemplateIdsByContext,
    contextKey: string,
    templateIds: string[],
): AppliedPromptTemplateIdsByContext {
    const next = { ...contexts }
    if (templateIds.length) next[contextKey] = templateIds
    else delete next[contextKey]
    return next
}

export function removePromptTemplateFromAllContexts(
    contexts: AppliedPromptTemplateIdsByContext,
    templateId: string,
): AppliedPromptTemplateIdsByContext {
    return Object.fromEntries(Object.entries(contexts).flatMap(([contextKey, templateIds]) => {
        const nextIds = templateIds.filter(id => id !== templateId)
        return nextIds.length ? [[contextKey, nextIds]] : []
    }))
}
