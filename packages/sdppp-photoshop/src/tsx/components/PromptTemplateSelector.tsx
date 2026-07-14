import { Button, Flex, Form, Input, List, Modal, Popconfirm, Select, Tag, Tooltip, Typography } from 'antd'
import { History as HistoryIcon, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { sdpppSDK, useTranslation } from '@sdppp/common'
import { createComfyPromptInjection, getPromptSnapshot, injectPromptTemplate, type PromptTemplate } from '../../utils/promptTemplates'
import { customapiStore } from '../../providers/_customapi/renderer/customapi.store'
import { replicateStore } from '../../providers/_replicate/renderer/replicate.store'
import { runninghubStore } from '../../providers/_runninghub/renderer/runninghub.store'
import { MainStore } from '../App.store'

type TemplateForm = Pick<PromptTemplate, 'name' | 'prompt'>

export function PromptTemplateSelector() {
    const { t } = useTranslation()
    const provider = MainStore(state => state.provider)
    const templates = MainStore(state => state.promptTemplates)
    const selectedId = MainStore(state => state.selectedPromptTemplateId)
    const history = MainStore(state => state.generationHistory)
    const [editing, setEditing] = useState<PromptTemplate | null>()
    const [historyOpen, setHistoryOpen] = useState(false)
    const [applying, setApplying] = useState(false)
    const [appliedTemplate, setAppliedTemplate] = useState<PromptTemplate>()
    const [applyError, setApplyError] = useState('')
    const [form] = Form.useForm<TemplateForm>()

    if (!provider) return null

    const openEditor = (template: PromptTemplate | null) => {
        setEditing(template)
        form.setFieldsValue(template ?? { name: '', prompt: '' })
    }

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
        MainStore.setState({
            promptTemplates: editing
                ? templates.map(item => item.id === template.id ? template : item)
                : [...templates, template],
            selectedPromptTemplateId: template.id,
        })
        setEditing(undefined)
    }

    const remove = () => MainStore.setState({
        promptTemplates: templates.filter(template => template.id !== selectedId),
        selectedPromptTemplateId: '',
    })

    const selected = templates.find(template => template.id === selectedId)

    const updateTemplate = async (template: PromptTemplate, remove = false) => {
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
    }

    const apply = async () => {
        if (!selected) return
        setApplying(true)
        setApplyError('')
        try {
            if (appliedTemplate) {
                await updateTemplate(appliedTemplate, true)
                setAppliedTemplate(undefined)
            } else {
                await updateTemplate(selected)
                setAppliedTemplate(selected)
            }
        } catch (error) {
            setApplyError(error instanceof Error ? error.message : t('comfy_simple.prompt_templates.applied_failed'))
        } finally {
            setApplying(false)
        }
    }

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
                                setAppliedTemplate(undefined)
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
                <Button type="primary" loading={applying} disabled={!selected} onClick={apply}>
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
                    onConfirm={remove}
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
                        disabled={!history.length}
                        onClick={() => setHistoryOpen(true)}
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
            <Modal
                open={historyOpen}
                title={t('generation_history.title', { count: history.length })}
                footer={null}
                width={480}
                onCancel={() => setHistoryOpen(false)}
            >
                <List
                    dataSource={history}
                    locale={{ emptyText: t('generation_history.empty') }}
                    style={{ maxHeight: '70vh', overflowY: 'auto' }}
                    renderItem={item => (
                        <List.Item key={item.id}>
                            <Flex vertical gap={8} style={{ width: '100%' }}>
                                <img
                                    src={item.image}
                                    alt={t('generation_history.image_alt')}
                                    style={{ width: '100%', maxHeight: 360, objectFit: 'contain', borderRadius: 4 }}
                                />
                                <Typography.Text type="secondary">
                                    {new Date(item.createdAt).toLocaleString()} · {item.source}
                                </Typography.Text>
                                {item.templateName ? <Tag>{t('generation_history.template', { name: item.templateName })}</Tag> : null}
                                <Typography.Text strong>{t('comfy_simple.prompt_templates.positive_label')}</Typography.Text>
                                <Typography.Paragraph style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}>
                                    {item.prompt}
                                </Typography.Paragraph>
                                {item.negativePrompt ? (
                                    <>
                                        <Typography.Text strong>{t('comfy_simple.prompt_templates.negative_label')}</Typography.Text>
                                        <Typography.Paragraph style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}>
                                            {item.negativePrompt}
                                        </Typography.Paragraph>
                                    </>
                                ) : null}
                            </Flex>
                        </List.Item>
                    )}
                />
            </Modal>
        </>
    )
}
