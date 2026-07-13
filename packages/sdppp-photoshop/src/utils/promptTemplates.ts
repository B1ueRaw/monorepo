export interface PromptTemplate {
    id: string
    name: string
    prompt: string
    negativePrompt?: string
}

export interface PromptSnapshot {
    prompt: string
    negativePrompt?: string
}

interface PromptNode {
    id: string
    title?: string
    widgets?: Array<{ name?: string; outputType?: string }>
}

type PromptRole = 'positive' | 'negative'

function promptRole(node: PromptNode): PromptRole | null {
    const label = [node.id, node.title, ...(node.widgets ?? []).map(widget => widget.name)]
        .filter(Boolean)
        .join(' ')
        .replace(/[_-]/g, ' ')
        .toLowerCase()

    if ((!/\bprompt\b/.test(label) && !label.includes('提示词')) || /\b(system|optimizer|optimization)\b|系统/.test(label)) return null
    return /\b(negative|neg)\b|负面|负向|反向/.test(label) ? 'negative' : 'positive'
}

function mergePrompt(template: string, current: unknown): string {
    const prefix = template.trim()
    const value = typeof current === 'string' ? current.trim() : ''
    if (value === prefix || value.startsWith(`${prefix}\n`)) return value
    return value ? `${prefix}\n${value}` : prefix
}

function promptNode(nodes: PromptNode[], role: PromptRole): PromptNode | undefined {
    return nodes.find(node =>
        node.widgets?.some(widget => ['string', 'text'].includes(widget.outputType?.toLowerCase() ?? '')) && promptRole(node) === role
    )
}

export function getPromptSnapshot(values: Record<string, any>, nodes: PromptNode[]): PromptSnapshot {
    const positive = promptNode(nodes, 'positive')
    const negative = promptNode(nodes, 'negative')
    const prompt = positive && typeof values[positive.id] === 'string' ? values[positive.id].trim() : ''
    const negativePrompt = negative && typeof values[negative.id] === 'string' ? values[negative.id].trim() : ''
    return { prompt, negativePrompt: negativePrompt || undefined }
}

export function injectPromptTemplate(
    values: Record<string, any>,
    nodes: PromptNode[],
    template?: PromptTemplate,
): Record<string, any> {
    if (!template) return values

    const next = { ...values }
    const positive = promptNode(nodes, 'positive')
    const negative = template.negativePrompt?.trim() ? promptNode(nodes, 'negative') : undefined

    if (positive && template.prompt.trim()) next[positive.id] = mergePrompt(template.prompt, next[positive.id])
    if (negative) next[negative.id] = mergePrompt(template.negativePrompt!, next[negative.id])
    return next
}

export function createComfyPromptInjection(
    structure: { nodes?: Record<string, PromptNode>; nodeIndexes?: string[] } | null | undefined,
    values: Record<string, any[]> | null | undefined,
    template?: PromptTemplate,
) {
    const nodes = structure?.nodes ?? {}
    const orderedNodes = (structure?.nodeIndexes ?? Object.keys(nodes)).map(id => nodes[id]).filter(Boolean)
    const updates: Array<{ nodeID: string; widgetIndex: number; value: string }> = []
    const restore: Array<{ nodeID: string; widgetIndex: number; value: string }> = []
    const prompts: Partial<Record<PromptRole, string>> = {}

    const add = (role: PromptRole, templatePrompt: string | undefined) => {
        const node = promptNode(orderedNodes, role)
        if (!node) return
        const widgetIndex = node.widgets!.findIndex(widget => ['string', 'text'].includes(widget.outputType?.toLowerCase() ?? ''))
        const current = values?.[node.id]?.[widgetIndex]
        if (typeof current !== 'string') return
        const value = templatePrompt?.trim() ? mergePrompt(templatePrompt, current) : current.trim()
        prompts[role] = value
        if (!templatePrompt?.trim()) return
        updates.push({ nodeID: node.id, widgetIndex, value })
        restore.push({ nodeID: node.id, widgetIndex, value: current })
    }

    add('positive', template?.prompt)
    add('negative', template?.negativePrompt)
    return {
        updates,
        restore,
        prompt: prompts.positive ?? '',
        negativePrompt: prompts.negative || undefined,
    }
}
