import { describe, expect, it } from 'vitest'
import {
    createPromptTemplateContextKey,
    getAppliedPromptTemplateIds,
    reconcileAppliedPromptTemplateIds,
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

    it('removes only presets that are missing from the edited prompt in the current context', () => {
        const templates = [
            { id: 'cinematic', name: 'Cinematic', prompt: 'cinematic lighting' },
            { id: 'watercolor', name: 'Watercolor', prompt: 'watercolor style' },
        ]
        const contexts = {
            'ComfyUI:workflow-a': ['cinematic', 'watercolor'],
            'ComfyUI:workflow-b': ['watercolor'],
        }

        const reconciled = reconcileAppliedPromptTemplateIds(
            contexts,
            'ComfyUI:workflow-a',
            templates,
            'cinematic lighting\na portrait with added details',
        )

        expect(reconciled).toEqual({
            'ComfyUI:workflow-a': ['cinematic'],
            'ComfyUI:workflow-b': ['watercolor'],
        })
        expect(reconcileAppliedPromptTemplateIds(
            reconciled,
            'ComfyUI:workflow-a',
            templates,
            'cinematic lighting\na portrait with more added details',
        )).toBe(reconciled)
        expect(reconcileAppliedPromptTemplateIds(
            reconciled,
            'ComfyUI:workflow-a',
            templates,
            'watercolor style\na portrait where that preset was never applied',
        )).toEqual({
            'ComfyUI:workflow-b': ['watercolor'],
        })
    })
})
