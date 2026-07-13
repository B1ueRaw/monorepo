import { useStore } from 'zustand'
import { useState } from 'react'
import './App.less'
import { sdpppSDK } from '@sdppp/common'
import { Button, ConfigProvider, Flex, Image, Modal, Select, theme } from 'antd'
import { Providers } from '../providers'
import { MainStore, type GenerationHistoryItem } from './App.store'
import ImagePreviewWrapper from './components/ImagePreviewWrapper'
import { SDPPPGateway } from './gateway/sdppp'
import { useTranslation, I18nextProvider, i18n } from '@sdppp/common'
import zhCN from 'antd/locale/zh_CN'
import enUS from 'antd/locale/en_US'
import { PromptTemplateSelector } from './components/PromptTemplateSelector'

 

export default function App() {
    const psTheme = useStore(sdpppSDK.stores.PhotoshopStore, state => state.theme)
    const showingPreview = MainStore(state => state.showingPreview)
    const previewImageList = MainStore(state => state.previewImageList)
    const generationHistory = MainStore(state => state.generationHistory)

    const fontSize = 12

    

    return <I18nextProvider i18n={i18n}>
        <AppContent psTheme={psTheme} showingPreview={showingPreview} previewImageList={previewImageList} generationHistory={generationHistory} fontSize={fontSize} />
    </I18nextProvider>
}

function AppContent({ psTheme, showingPreview, previewImageList, generationHistory, fontSize }: {
    psTheme: string;
    showingPreview: boolean;
    previewImageList: any[];
    generationHistory: GenerationHistoryItem[];
    fontSize: number;
}) {
    const { t, isZhCN } = useTranslation()
    const antdLocale = isZhCN() ? zhCN : enUS
    const [historyOpen, setHistoryOpen] = useState(false)
    

    return <div id="app" className={themeClassName(psTheme)}>
        <ConfigProvider
            locale={antdLocale}
            getPopupContainer={trigger => trigger?.parentElement || document.body}
            theme={{
                token: {
                    colorPrimary: '#34773d',
                    colorLink: 'var(--sdppp-host-text-color)',
                    colorLinkHover: 'var(--sdppp-widget-hover-text-color)',
                    colorLinkActive: 'var(--sdppp-host-text-color)',

                },
                algorithm: [psTheme === 'kPanelBrightnessDarkGray' || psTheme === 'kPanelBrightnessMediumGray' || psTheme === 'kPanelBrightnessLightGray' ? theme.darkAlgorithm : theme.defaultAlgorithm, theme.compactAlgorithm],
                components: {
                    Typography: {
                        colorText: 'var(--sdppp-host-text-color)',
                        // 控制 Typography 内所有链接的颜色
                        colorLink: 'var(--sdppp-host-text-color)',
                        colorLinkHover: 'var(--sdppp-widget-hover-text-color)',
                        colorLinkActive: 'var(--sdppp-host-text-color)',
                    },
                    Input: {
                        fontSize: fontSize,
                        colorBgContainer: 'var(--sdppp-widget-background-color)',
                        colorText: 'var(--sdppp-host-text-color)',
                        colorBorder: 'var(--sdppp-widget-border-color)',
                        colorTextPlaceholder: 'var(--sdppp-host-text-color-secondary)'
                    },
                    Select: {
                        fontSize: fontSize,
                        colorBgContainer: 'var(--sdppp-widget-background-color)',
                        colorText: 'var(--sdppp-host-text-color)',
                        colorBorder: 'var(--sdppp-widget-border-color)',
                        colorBgElevated: 'var(--sdppp-widget-background-color)',
                        colorTextDescription: 'var(--sdppp-host-text-color)',
                        controlItemBgActive: 'var(--sdppp-widget-border-color)',
                        controlItemBgHover: 'var(--sdppp-widget-hover-background-color)',
                        optionSelectedBg: 'var(--sdppp-widget-border-color)',
                        optionActiveBg: 'var(--sdppp-widget-hover-background-color)',
                        colorTextPlaceholder: 'var(--sdppp-host-text-color-secondary)',
                    },
                    Checkbox: {
                        fontSize: fontSize,
                        colorText: 'var(--sdppp-host-text-color)',
                    },
                    Radio: {
                        fontSize: fontSize,
                    },
                    Slider: {
                        fontSize: fontSize,
                        colorBgElevated: 'var(--sdppp-host-text-color)',
                    },
                    Switch: {
                        fontSize: fontSize,
                        colorBgContainer: 'var(--sdppp-widget-background-color)',
                        colorText: 'var(--sdppp-host-text-color)'
                    },
                    InputNumber: {
                        fontSize: fontSize,
                        colorBgContainer: 'var(--sdppp-widget-background-color)',
                        colorText: 'var(--sdppp-host-text-color)',
                        colorBorder: 'var(--sdppp-widget-border-color)'
                    },
                    Upload: {
                        fontSize: fontSize,
                        colorBgContainer: 'var(--sdppp-widget-background-color)',
                        colorText: 'var(--sdppp-host-text-color)',
                        colorBorder: 'var(--sdppp-widget-border-color)'
                    },
                    Button: {
                        fontSize: fontSize,
                        colorBgContainer: 'var(--sdppp-widget-background-color)',
                        colorText: 'var(--sdppp-host-text-color)',
                        colorBorder: 'var(--sdppp-widget-border-color)'
                    },
                    Tree: {
                        fontSize: 14,
                        colorBgContainer: 'transparent',
                        colorText: 'var(--sdppp-host-text-color)',
                        nodeSelectedBg: 'var(--sdppp-widget-hover-background-color)',
                        nodeHoverBg: 'var(--sdppp-widget-hover-background-color)',
                    },
                }
            }}>
            {!showingPreview ? <Flex gap={8} justify="center" align="center" style={{ marginBottom: 16 }}>
                {previewImageList.length ? (
                    <Button size="small" type="primary" onClick={() => MainStore.setState({ showingPreview: true })}>
                        {t('preview.show', { count: previewImageList.length, defaultMessage: 'Show Preview ({count})' })}
                    </Button>
                ) : null}
                <Button size="small" disabled={!generationHistory.length} onClick={() => setHistoryOpen(true)}>
                    {t('image_history.title', { count: generationHistory.length })}
                </Button>
            </Flex> : null}
            <Modal
                open={historyOpen}
                title={t('image_history.title', { count: generationHistory.length })}
                footer={null}
                width={520}
                onCancel={() => setHistoryOpen(false)}
            >
                <Image.PreviewGroup>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, maxHeight: '70vh', overflowY: 'auto' }}>
                        {generationHistory.map(item => (
                            <Image key={item.id} src={item.image} alt={t('generation_history.image_alt')} width="100%" />
                        ))}
                    </div>
                </Image.PreviewGroup>
            </Modal>
            {
                showingPreview ? <ImagePreviewWrapper /> : null
            }
            {!showingPreview ? <PromptTemplateSelector /> : null}
            <SDPPPGateway />
        </ConfigProvider>
    </div>
}

function themeClassName(theme: string) {
    if (theme == "kPanelBrightnessLightGray") {
        return "__ps_light__"
    }
    if (theme == "kPanelBrightnessMediumGray") {
        return "__ps_dark__"
    }
    if (theme == "kPanelBrightnessDarkGray") {
        return "__ps_darkest__"
    }
    return "__ps_lightest__"
}
