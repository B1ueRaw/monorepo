export interface PromptTemplate {
    id: string
    name: string
    prompt: string
}

export interface PromptSnapshot {
    prompt: string
    negativePrompt?: string
}

export interface PromptNode {
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
    if (`\n${value}\n`.includes(`\n${prefix}\n`)) return value
    return value ? `${prefix}\n${value}` : prefix
}

function removePrompt(template: string, current: unknown): string {
    const prefix = template.trim()
    const value = typeof current === 'string' ? current.trim() : ''
    const wrapped = `\n${value}\n`
    const block = `\n${prefix}\n`
    return wrapped.includes(block) ? wrapped.replace(block, '\n').slice(1, -1).trim() : value
}

function promptNode(nodes: PromptNode[], role: PromptRole): PromptNode | undefined {
    return nodes.find(node =>
        node.widgets?.some(widget => ['string', 'text', 'customtext'].includes(widget.outputType?.toLowerCase() ?? '')) && promptRole(node) === role
    )
}

export function findPositivePromptNode(nodes: PromptNode[]): PromptNode | undefined {
    return promptNode(nodes, 'positive')
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
    template?: PromptTemplate | PromptTemplate[],
    remove = false,
): Record<string, any> {
    if (!template) return values

    const next = { ...values }
    const positive = promptNode(nodes, 'positive')
    const templates = Array.isArray(template) ? template : [template]
    if (positive) {
        next[positive.id] = templates.reduce(
            (value, item) => item.prompt.trim() ? (remove ? removePrompt(item.prompt, value) : mergePrompt(item.prompt, value)) : value,
            next[positive.id],
        )
    }
    return next
}

export function createComfyPromptInjection(
    structure: { nodes?: Record<string, PromptNode>; nodeIndexes?: string[] } | null | undefined,
    values: Record<string, any[]> | null | undefined,
    template?: PromptTemplate | PromptTemplate[],
    remove = false,
) {
    const nodes = structure?.nodes ?? {}
    const orderedNodes = (structure?.nodeIndexes ?? Object.keys(nodes)).map(id => nodes[id]).filter(Boolean)
    const updates: Array<{ nodeID: string; widgetIndex: number; value: string }> = []
    const restore: Array<{ nodeID: string; widgetIndex: number; value: string }> = []
    const prompts: Partial<Record<PromptRole, string>> = {}

    const templates = template ? (Array.isArray(template) ? template : [template]) : []
    const add = (role: PromptRole, templatePrompts: string[]) => {
        const node = promptNode(orderedNodes, role)
        if (!node) return
        const widgetIndex = node.widgets!.findIndex(widget => ['string', 'text', 'customtext'].includes(widget.outputType?.toLowerCase() ?? ''))
        const current = values?.[node.id]?.[widgetIndex] ?? ''
        if (typeof current !== 'string') return
        const value = templatePrompts.reduce(
            (prompt, item) => item.trim() ? (remove ? removePrompt(item, prompt) : mergePrompt(item, prompt)) : prompt,
            current,
        ).trim()
        prompts[role] = value
        if (!templatePrompts.some(item => item.trim()) || value === current) return
        updates.push({ nodeID: node.id, widgetIndex, value })
        if (!remove) restore.push({ nodeID: node.id, widgetIndex, value: current })
    }

    add('positive', templates.map(item => item.prompt))
    add('negative', [])
    return {
        updates,
        restore,
        prompt: prompts.positive ?? '',
        negativePrompt: prompts.negative || undefined,
    }
}
