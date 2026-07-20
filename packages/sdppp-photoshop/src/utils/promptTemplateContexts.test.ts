import { describe, expect, it } from 'vitest'
import {
    createPromptTemplateContextKey,
    getAppliedPromptTemplateIds,
    removePromptTemplateFromAllContexts,
    setAppliedPromptTemplateIds,
} from './promptTemplateContexts'

describe('prompt template contexts', () => {
    it('isolates applied template ids by provider and workflow or model', () => {
        const comfyWorkflowA = createPromptTemplateContextKey('ComfyUI', 'workflow-a')
        const comfyWorkflowB = createPromptTemplateContextKey('ComfyUI', 'workflow-b')
        const replicateModel = createPromptTemplateContextKey('Replicate', 'owner/model')

        let contexts = setAppliedPromptTemplateIds({}, comfyWorkflowA, ['cinematic'])
        contexts = setAppliedPromptTemplateIds(contexts, comfyWorkflowB, ['watercolor'])
        contexts = setAppliedPromptTemplateIds(contexts, replicateModel, ['portrait'])

        expect(getAppliedPromptTemplateIds(contexts, comfyWorkflowA)).toEqual(['cinematic'])
        expect(getAppliedPromptTemplateIds(contexts, comfyWorkflowB)).toEqual(['watercolor'])
        expect(getAppliedPromptTemplateIds(contexts, replicateModel)).toEqual(['portrait'])
        expect(getAppliedPromptTemplateIds(contexts, createPromptTemplateContextKey('CustomAPI', 'google:model'))).toEqual([])
    })

    it('removes a deleted template from every context and drops empty buckets', () => {
        const contexts = {
            'ComfyUI:workflow-a': ['cinematic', 'watercolor'],
            'Replicate:owner/model': ['cinematic'],
        }

        expect(removePromptTemplateFromAllContexts(contexts, 'cinematic')).toEqual({
            'ComfyUI:workflow-a': ['watercolor'],
        })
    })
})
