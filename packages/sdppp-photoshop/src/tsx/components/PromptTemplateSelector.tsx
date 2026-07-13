import { Button, Flex, Form, Input, Modal, Popconfirm, Select, Tooltip } from 'antd'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from '@sdppp/common'
import type { PromptTemplate } from '../../utils/promptTemplates'
import { MainStore } from '../App.store'

type TemplateForm = Pick<PromptTemplate, 'name' | 'prompt' | 'negativePrompt'>

export function PromptTemplateSelector() {
    const { t } = useTranslation()
    const provider = MainStore(state => state.provider)
    const templates = MainStore(state => state.promptTemplates)
    const selectedId = MainStore(state => state.selectedPromptTemplateId)
    const [editing, setEditing] = useState<PromptTemplate | null>()
    const [form] = Form.useForm<TemplateForm>()

    if (!provider) return null

    const openEditor = (template: PromptTemplate | null) => {
        setEditing(template)
        form.setFieldsValue(template ?? { name: '', prompt: '', negativePrompt: '' })
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
            negativePrompt: values.negativePrompt?.trim(),
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

    return (
        <>
            <Flex gap={4} style={{ marginBottom: 8 }}>
                <Select
                    allowClear
                    value={selectedId || undefined}
                    placeholder={t('comfy_simple.prompt_templates.modal_title')}
                    options={templates.map(template => ({ label: template.name, value: template.id }))}
                    onChange={value => MainStore.setState({ selectedPromptTemplateId: value ?? '' })}
                    style={{ flex: 1 }}
                />
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
            </Flex>
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
                    <Form.Item name="negativePrompt" label={t('comfy_simple.prompt_templates.negative_label')}>
                        <Input.TextArea autoSize={{ minRows: 2, maxRows: 6 }} />
                    </Form.Item>
                </Form>
            </Modal>
        </>
    )
}
