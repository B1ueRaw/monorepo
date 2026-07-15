import { Button, Flex, Form, Input, Modal, Popconfirm, Select, Tooltip, Typography } from 'antd'
import { BookOpenText, History as HistoryIcon, Pencil, Plus, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { sdpppSDK, useTranslation } from '@sdppp/common'
import { createComfyPromptInjection, getPromptSnapshot, injectPromptTemplate, type PromptTemplate } from '../../utils/promptTemplates'
import { openPromptTemplateWindow, parsePromptTemplateWindowAction } from '../../utils/promptTemplateWindow'
import { customapiStore } from '../../providers/_customapi/renderer/customapi.store'
import { replicateStore } from '../../providers/_replicate/renderer/replicate.store'
import { runninghubStore } from '../../providers/_runninghub/renderer/runninghub.store'
import { openGenerationHistoryWindow } from '../../utils/generationHistoryWindow'
import { MainStore } from '../App.store'

type TemplateForm = Pick<PromptTemplate, 'name' | 'prompt'>

export function PromptTemplateSelector({ libraryOnly = false }: { libraryOnly?: boolean } = {}) {
    const { t } = useTranslation()
    const provider = MainStore(state => state.provider)
    const templates = MainStore(state => state.promptTemplates)
    const selectedId = MainStore(state => state.selectedPromptTemplateId)
    const appliedIds = MainStore(state => state.appliedPromptTemplateIds)
    const history = MainStore(state => state.generationHistory)
    const [editing, setEditing] = useState<PromptTemplate | null>()
    const [applying, setApplying] = useState(false)
    const [applyError, setApplyError] = useState('')
    const [form] = Form.useForm<TemplateForm>()

    const selected = templates.find(template => template.id === selectedId)
    const isSelectedApplied = !!selected && appliedIds.includes(selected.id)

    const openEditor = useCallback((template: PromptTemplate | null) => {
        setEditing(template)
        form.setFieldsValue(template ?? { name: '', prompt: '' })
    }, [form])

    const updateTemplate = useCallback(async (template: PromptTemplate, remove = false) => {
        if (provider === 'ComfyUI') {
            const state = sdpppSDK.stores.ComfyStore.getState()
            const updates = createComfyPromptInjection(state.widgetableStructure, state.widgetableValues, template, remove).updates
            if (!updates.length && !remove) throw new Error(t('comfy_simple.prompt_templates.apply_failed_missing_binding', {
                part: t('comfy_simple.prompt_templates.positive_label'),
            }))
            if (updates.length) await sdpppSDK.plugins.ComfyCaller.setWidgetValue({ values: updates })
            return
        }

        const store = provider === 'CustomAPI' ? customapiStore
            : provider === 'Replicate' ? replicateStore
                : provider === 'RunningHub' ? runninghubStore
                    : null
        if (!store) throw new Error(t('comfy_simple.prompt_templates.apply_unavailable'))

        const state = store.getState()
        const values = injectPromptTemplate(state.currentValues, state.currentNodes, template, remove)
        if (!remove && !getPromptSnapshot(values, state.currentNodes).prompt) throw new Error(t('comfy_simple.prompt_templates.apply_failed_missing_binding', {
            part: t('comfy_simple.prompt_templates.positive_label'),
        }))
        state.setCurrentValues(values)
    }, [provider, t])

    const saveTemplate = useCallback(async (template: PromptTemplate) => {
        const state = MainStore.getState()
        const existing = state.promptTemplates.find(item => item.id === template.id)
        if (state.promptTemplates.some(item => item.id !== template.id && item.name.toLowerCase() === template.name.toLowerCase())) return false
        try {
            if (existing && state.appliedPromptTemplateIds.includes(existing.id)) {
                await updateTemplate(existing, true)
                await updateTemplate(template)
            }
            MainStore.setState({
                promptTemplates: existing
                    ? state.promptTemplates.map(item => item.id === template.id ? template : item)
                    : [...state.promptTemplates, template],
                selectedPromptTemplateId: template.id,
            })
            return true
        } catch (error) {
            setApplyError(error instanceof Error ? error.message : t('comfy_simple.prompt_templates.applied_failed'))
            return false
        }
    }, [t, updateTemplate])

    const save = async () => {
        const values = await form.validateFields()
        const name = values.name.trim()
        if (templates.some(template => template.id !== editing?.id && template.name.toLowerCase() === name.toLowerCase())) {
            form.setFields([{ name: 'name', errors: [t('comfy_simple.prompt_templates.duplicate_key')] }])
            return
        }
        if (await saveTemplate({
            id: editing?.id ?? `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            name,
            prompt: values.prompt.trim(),
        })) setEditing(undefined)
    }

    const remove = useCallback(async (id = selectedId) => {
        const state = MainStore.getState()
        const template = state.promptTemplates.find(item => item.id === id)
        if (!template) return
        try {
            if (state.appliedPromptTemplateIds.includes(template.id)) await updateTemplate(template, true)
            MainStore.setState({
                promptTemplates: state.promptTemplates.filter(item => item.id !== template.id),
                selectedPromptTemplateId: state.selectedPromptTemplateId === template.id ? '' : state.selectedPromptTemplateId,
                appliedPromptTemplateIds: state.appliedPromptTemplateIds.filter(item => item !== template.id),
            })
        } catch (error) {
            setApplyError(error instanceof Error ? error.message : t('comfy_simple.prompt_templates.applied_failed'))
        }
    }, [selectedId, t, updateTemplate])

    const toggleTemplate = useCallback(async (template: PromptTemplate) => {
        setApplying(true)
        setApplyError('')
        try {
            const state = MainStore.getState()
            const applied = state.appliedPromptTemplateIds.includes(template.id)
            await updateTemplate(template, applied)
            MainStore.setState({
                selectedPromptTemplateId: template.id,
                appliedPromptTemplateIds: applied
                    ? state.appliedPromptTemplateIds.filter(item => item !== template.id)
                    : [...state.appliedPromptTemplateIds, template.id],
            })
        } catch (error) {
            setApplyError(error instanceof Error ? error.message : t('comfy_simple.prompt_templates.applied_failed'))
        } finally {
            setApplying(false)
        }
    }, [t, updateTemplate])

    useEffect(() => {
        const listener = (event: MessageEvent) => {
            const command = parsePromptTemplateWindowAction(event.data)
            if (!command) return
            if (command.action === 'save' && command.item) {
                void saveTemplate(command.item)
                return
            }
            const template = MainStore.getState().promptTemplates.find(item => item.id === command.id)
            if (!template) return
            if (command.action === 'delete') void remove(template.id)
            else void toggleTemplate(template)
        }
        window.addEventListener('message', listener)
        return () => window.removeEventListener('message', listener)
    }, [remove, saveTemplate, toggleTemplate])

    if (!provider) return null

    return (
        <>
            {libraryOnly ? (
                <Tooltip title={t('comfy_simple.prompt_templates.manage_tooltip')}>
                    <Button
                        type="text"
                        size="small"
                        icon={<BookOpenText size={14} />}
                        onClick={() => openPromptTemplateWindow(templates, appliedIds, t)}
                    >
                        {t('comfy_simple.prompt_templates.button')}
                    </Button>
                </Tooltip>
            ) : <Flex gap={4} style={{ marginBottom: 8 }}>
                <Select
                    allowClear
                    value={selectedId || undefined}
                    placeholder={t('comfy_simple.prompt_templates.modal_title')}
                    options={templates.map(template => ({ label: template.name, value: template.id }))}
                    disabled={applying}
                    onChange={value => MainStore.setState({ selectedPromptTemplateId: value ?? '' })}
                    style={{ flex: 1 }}
                />
                <Button type="primary" loading={applying} disabled={!selected} onClick={() => selected && void toggleTemplate(selected)}>
                    {t(isSelectedApplied ? 'common.cancel' : 'common.apply')}
                </Button>
                <Tooltip title={t('comfy_simple.prompt_templates.add_title')}>
                    <Button icon={<Plus size={16} />} onClick={() => openEditor(null)} />
                </Tooltip>
                <Tooltip title={t('comfy_simple.prompt_templates.edit_title')}>
                    <Button icon={<Pencil size={16} />} disabled={!selected} onClick={() => selected && openEditor(selected)} />
                </Tooltip>
                <Popconfirm
                    title={t('comfy_simple.prompt_templates.delete_confirm_title')}
                    description={t('comfy_simple.prompt_templates.delete_confirm_content')}
                    onConfirm={() => void remove()}
                    disabled={!selected}
                >
                    <Tooltip title={t('common.delete')}>
                        <Button danger icon={<Trash2 size={16} />} disabled={!selected} />
                    </Tooltip>
                </Popconfirm>
                <Tooltip title={t('generation_history.title', { count: history.length })}>
                    <Button
                        aria-label={t('generation_history.title', { count: history.length })}
                        icon={<HistoryIcon size={16} />}
                        onClick={() => openGenerationHistoryWindow(history, t)}
                    />
                </Tooltip>
            </Flex>}
            {applyError ? <Typography.Text type="danger" style={{ display: 'block', marginBottom: 8 }}>{applyError}</Typography.Text> : null}
            <Modal
                open={editing !== undefined}
                title={t(editing ? 'comfy_simple.prompt_templates.edit_title' : 'comfy_simple.prompt_templates.add_title')}
                okText={t('common.save')}
                cancelText={t('common.cancel')}
                onOk={save}
                onCancel={() => setEditing(undefined)}
                destroyOnClose
            >
                <Form form={form} layout="vertical">
                    <Form.Item
                        name="name"
                        label={t('comfy_simple.prompt_templates.name_placeholder')}
                        rules={[{ required: true, whitespace: true, message: t('comfy_simple.prompt_templates.missing_key') }]}
                    >
                        <Input />
                    </Form.Item>
                    <Form.Item
                        name="prompt"
                        label={t('generation_history.prompt')}
                        rules={[{ required: true, whitespace: true, message: t('comfy_simple.prompt_templates.missing_value') }]}
                    >
                        <Input.TextArea autoSize={{ minRows: 3, maxRows: 8 }} />
                    </Form.Item>
                </Form>
            </Modal>
        </>
    )
}

export function PromptTemplateLibraryButton() {
    return <PromptTemplateSelector libraryOnly />
}
