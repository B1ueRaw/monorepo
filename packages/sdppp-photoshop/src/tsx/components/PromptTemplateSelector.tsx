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

export function PromptTemplateLibraryButton() {
    const { t } = useTranslation()
    const templates = MainStore(state => state.promptTemplates)
    const appliedId = MainStore(state => state.appliedPromptTemplateId)

    return (
        <Tooltip title={t('comfy_simple.prompt_templates.manage_tooltip')}>
            <Button
                type="text"
                size="small"
                icon={<BookOpenText size={14} />}
                onClick={() => openPromptTemplateWindow(templates, appliedId, t)}
            >
                {t('comfy_simple.prompt_templates.button')}
            </Button>
        </Tooltip>
    )
}

export function PromptTemplateSelector() {
    const { t } = useTranslation()
    const provider = MainStore(state => state.provider)
    const templates = MainStore(state => state.promptTemplates)
    const selectedId = MainStore(state => state.selectedPromptTemplateId)
    const appliedId = MainStore(state => state.appliedPromptTemplateId)
    const history = MainStore(state => state.generationHistory)
    const [editing, setEditing] = useState<PromptTemplate | null>()
    const [applying, setApplying] = useState(false)
    const [applyError, setApplyError] = useState('')
    const [form] = Form.useForm<TemplateForm>()

    const selected = templates.find(template => template.id === selectedId)
    const appliedTemplate = templates.find(template => template.id === appliedId)

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

    const save = async () => {
        const values = await form.validateFields()
        const name = values.name.trim()
        if (templates.some(template => template.id !== editing?.id && template.name.toLowerCase() === name.toLowerCase())) {
            form.setFields([{ name: 'name', errors: [t('comfy_simple.prompt_templates.duplicate_key')] }])
            return
        }

        const template: PromptTemplate = {
            id: editing?.id ?? `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            name,
            prompt: values.prompt.trim(),
        }
        try {
            if (editing && appliedTemplate?.id === editing.id) {
                await updateTemplate(appliedTemplate, true)
                await updateTemplate(template)
            }
            MainStore.setState({
                promptTemplates: editing
                    ? templates.map(item => item.id === template.id ? template : item)
                    : [...templates, template],
                selectedPromptTemplateId: template.id,
                appliedPromptTemplateId: appliedTemplate?.id === template.id ? template.id : appliedId,
            })
            setEditing(undefined)
        } catch (error) {
            setApplyError(error instanceof Error ? error.message : t('comfy_simple.prompt_templates.applied_failed'))
        }
    }

    const remove = async () => {
        const template = templates.find(item => item.id === selectedId)
        if (!template) return
        try {
            if (appliedId === template.id) await updateTemplate(template, true)
            MainStore.setState({
                promptTemplates: templates.filter(item => item.id !== template.id),
                selectedPromptTemplateId: '',
                appliedPromptTemplateId: appliedId === template.id ? '' : appliedId,
            })
        } catch (error) {
            setApplyError(error instanceof Error ? error.message : t('comfy_simple.prompt_templates.applied_failed'))
        }
    }

    const toggleTemplate = useCallback(async (template: PromptTemplate) => {
        setApplying(true)
        setApplyError('')
        try {
            if (appliedTemplate) {
                await updateTemplate(appliedTemplate, true)
                MainStore.setState({ appliedPromptTemplateId: '' })
            }
            if (appliedTemplate?.id !== template.id) {
                await updateTemplate(template)
                MainStore.setState({
                    selectedPromptTemplateId: template.id,
                    appliedPromptTemplateId: template.id,
                })
            }
        } catch (error) {
            setApplyError(error instanceof Error ? error.message : t('comfy_simple.prompt_templates.applied_failed'))
        } finally {
            setApplying(false)
        }
    }, [appliedTemplate, t, updateTemplate])

    useEffect(() => {
        const listener = (event: MessageEvent) => {
            const command = parsePromptTemplateWindowAction(event.data)
            if (!command) return
            const template = MainStore.getState().promptTemplates.find(item => item.id === command.id)
            if (!template) return
            void toggleTemplate(template)
        }
        window.addEventListener('message', listener)
        return () => window.removeEventListener('message', listener)
    }, [toggleTemplate])

    if (!provider) return null

    return (
        <>
            <Flex gap={4} style={{ marginBottom: 8 }}>
                <Select
                    allowClear
                    value={selectedId || undefined}
                    placeholder={t('comfy_simple.prompt_templates.modal_title')}
                    options={templates.map(template => ({ label: template.name, value: template.id }))}
                    disabled={applying}
                    onChange={async value => {
                        setApplyError('')
                        if (appliedTemplate) {
                            setApplying(true)
                            try {
                                await updateTemplate(appliedTemplate, true)
                                MainStore.setState({ appliedPromptTemplateId: '' })
                            } catch (error) {
                                setApplyError(error instanceof Error ? error.message : t('comfy_simple.prompt_templates.applied_failed'))
                                return
                            } finally {
                                setApplying(false)
                            }
                        }
                        MainStore.setState({ selectedPromptTemplateId: value ?? '' })
                    }}
                    style={{ flex: 1 }}
                />
                <Button type="primary" loading={applying} disabled={!selected} onClick={() => selected && void toggleTemplate(selected)}>
                    {t(appliedTemplate ? 'common.cancel' : 'common.apply')}
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
            </Flex>
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
                        label={t('comfy_simple.prompt_templates.positive_label')}
                        rules={[{ required: true, whitespace: true, message: t('comfy_simple.prompt_templates.missing_value') }]}
                    >
                        <Input.TextArea autoSize={{ minRows: 3, maxRows: 8 }} />
                    </Form.Item>
                </Form>
            </Modal>
        </>
    )
}
