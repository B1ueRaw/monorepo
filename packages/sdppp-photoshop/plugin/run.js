
const { entrypoints, storage } = require("uxp");

const HISTORY_MESSAGE = "sdppp:open-generation-history";
const HISTORY_ACTION_MESSAGE = "sdppp:generation-history-action";
const PROMPT_TEMPLATES_MESSAGE = "sdppp:open-prompt-templates";
const PROMPT_TEMPLATES_ACTION_MESSAGE = "sdppp:prompt-template-action";
let historyDialog = null;
let historyWebview = null;
let promptTemplatesDialog = null;
let promptTemplatesWebview = null;

function applyStyles(element, styles) {
    Object.assign(element.style, styles);
    return element;
}

function appendText(parent, tag, value, styles = {}) {
    const element = applyStyles(document.createElement(tag), styles);
    element.textContent = typeof value === "string" ? value : "";
    parent.appendChild(element);
    return element;
}

function appendHistoryIcon(parent, name) {
    const icons = {
        preview: "./icons/history-preview.png",
        delete: "./icons/history-delete.png",
        smartobject: "./icons/history-smartobject.png",
        newdoc: "./icons/history-newdoc.png",
        selection: "./icons/history-selection.png",
    };
    const icon = applyStyles(document.createElement("img"), {
        display: "block",
        width: "16px",
        height: "16px",
        pointerEvents: "none",
    });
    icon.src = icons[name] || "";
    icon.alt = "";
    parent.appendChild(icon);
}

function postHistoryAction(itemId, action) {
    const webview = historyWebview
        || document.getElementById("content-webview")
        || document.querySelector("webview");
    if (!webview || typeof webview.postMessage !== "function") {
        console.warn("Generation history webview is unavailable");
        return false;
    }
    try {
        webview.postMessage({ type: HISTORY_ACTION_MESSAGE, id: itemId, action }, "*");
        return true;
    } catch (error) {
        console.error("Failed to send generation history action", error);
        return false;
    }
}

function removeHistoryDialog() {
    if (!historyDialog) return;
    const dialog = historyDialog;
    historyDialog = null;
    try { dialog.close(); } catch (_) { }
    if (dialog.parentNode) dialog.parentNode.removeChild(dialog);
}

function postPromptTemplateAction(itemId, action) {
    const webview = promptTemplatesWebview
        || document.getElementById("content-webview")
        || document.querySelector("webview");
    if (!webview || typeof webview.postMessage !== "function") return false;
    try {
        webview.postMessage({ type: PROMPT_TEMPLATES_ACTION_MESSAGE, id: itemId || "", action }, "*");
        return true;
    } catch (error) {
        console.error("Failed to send prompt template action", error);
        return false;
    }
}

function removePromptTemplatesDialog() {
    if (!promptTemplatesDialog) return;
    const dialog = promptTemplatesDialog;
    promptTemplatesDialog = null;
    try { dialog.close(); } catch (_) { }
    if (dialog.parentNode) dialog.parentNode.removeChild(dialog);
}

function openPromptTemplatesDialog(message) {
    if (!message || !Array.isArray(message.items)) return;
    removePromptTemplatesDialog();

    const dialog = applyStyles(document.createElement("dialog"), {
        width: "720px",
        height: "640px",
        padding: "0",
        position: "relative",
        overflow: "hidden",
        color: "var(--uxp-host-text-color)",
        backgroundColor: "var(--uxp-host-background-color)",
    });
    const header = applyStyles(document.createElement("div"), {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 16px",
        borderBottom: "1px solid var(--uxp-host-border-color)",
    });
    appendText(header, "h2", message.title, { margin: "0", fontSize: "16px" });
    const closeButton = appendText(header, "button", message.closeText, { padding: "4px 12px" });
    dialog.appendChild(header);

    const content = applyStyles(document.createElement("div"), {
        display: "flex",
        alignContent: "flex-start",
        flexWrap: "wrap",
        gap: "12px",
        height: "580px",
        padding: "12px 16px",
        overflowY: "auto",
        boxSizing: "border-box",
    });
    const items = message.items.filter(item => item && typeof item === "object");
    if (!items.length) {
        appendText(content, "p", message.emptyText, { width: "100%", textAlign: "center", opacity: "0.7" });
    }

    items.forEach(item => {
        const card = applyStyles(document.createElement("div"), {
            display: "flex",
            position: "relative",
            flexDirection: "column",
            width: "calc(50% - 6px)",
            height: "210px",
            padding: "14px",
            overflow: "hidden",
            border: item.id === message.appliedTemplateId
                ? "1px solid #34773d"
                : "1px solid var(--uxp-host-border-color)",
            borderRadius: "8px",
            boxSizing: "border-box",
        });
        appendText(card, "h3", item.name, {
            margin: "0 0 10px",
            fontSize: "15px",
        });
        appendText(card, "div", item.prompt, {
            flex: "1",
            overflow: "hidden",
            opacity: "0.82",
            fontSize: "13px",
            lineHeight: "1.55",
            whiteSpace: "pre-wrap",
        });

        const actions = applyStyles(document.createElement("div"), {
            display: "none",
            position: "absolute",
            right: "0",
            bottom: "0",
            left: "0",
            gap: "8px",
            padding: "10px",
            backgroundColor: "rgba(20, 20, 20, 0.9)",
        });
        const useButton = appendText(
            actions,
            "div",
            item.id === message.appliedTemplateId ? message.cancelText : message.useText,
            {
                flex: "1",
                padding: "7px 10px",
                color: "#fff",
                border: "1px solid #34773d",
                borderRadius: "5px",
                backgroundColor: "#34773d",
                textAlign: "center",
                cursor: "pointer",
            },
        );
        useButton.setAttribute("role", "button");
        useButton.addEventListener("click", event => {
            event.stopPropagation();
            if (postPromptTemplateAction(item.id, "use")) removePromptTemplatesDialog();
        });
        card.appendChild(actions);
        card.addEventListener("mouseenter", () => { actions.style.display = "flex"; });
        card.addEventListener("mouseleave", () => { actions.style.display = "none"; });
        content.appendChild(card);
    });
    dialog.appendChild(content);
    document.body.appendChild(dialog);
    promptTemplatesDialog = dialog;

    closeButton.addEventListener("click", removePromptTemplatesDialog);
    dialog.addEventListener("close", () => {
        if (promptTemplatesDialog === dialog) promptTemplatesDialog = null;
        if (dialog.parentNode) dialog.parentNode.removeChild(dialog);
    });
    try {
        dialog.show();
    } catch (error) {
        removePromptTemplatesDialog();
        console.error("Failed to open prompt templates window", error);
    }
}

function openHistoryDialog(message) {
    if (!message || !Array.isArray(message.items)) return;
    removeHistoryDialog();

    const dialog = applyStyles(document.createElement("dialog"), {
        width: "720px",
        height: "640px",
        padding: "0",
        position: "relative",
        overflow: "hidden",
        color: "var(--uxp-host-text-color)",
        backgroundColor: "var(--uxp-host-background-color)",
    });
    const header = applyStyles(document.createElement("div"), {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 16px",
        borderBottom: "1px solid var(--uxp-host-border-color)",
    });
    appendText(header, "h2", message.title, { margin: "0", fontSize: "16px" });
    const closeButton = appendText(header, "button", message.closeText, { padding: "4px 12px" });
    dialog.appendChild(header);

    const content = applyStyles(document.createElement("div"), {
        height: "580px",
        padding: "12px 16px",
        overflowY: "auto",
        boxSizing: "border-box",
    });
    const items = message.items.filter(item => item && typeof item === "object");
    if (!items.length) {
        appendText(content, "p", message.emptyText, { textAlign: "center", opacity: "0.7" });
    }

    const zoomLayer = applyStyles(document.createElement("div"), {
        display: "none",
        position: "absolute",
        top: "0",
        right: "0",
        bottom: "0",
        left: "0",
        zIndex: "1000",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        boxSizing: "border-box",
        backgroundColor: "rgba(0, 0, 0, 0.92)",
        cursor: "zoom-out",
    });
    const zoomImage = applyStyles(document.createElement("img"), {
        display: "block",
        maxWidth: "100%",
        maxHeight: "100%",
        objectFit: "contain",
    });
    const zoomCloseButton = appendText(zoomLayer, "button", "×", {
        position: "absolute",
        top: "12px",
        right: "12px",
        width: "40px",
        height: "40px",
        padding: "0",
        border: "0",
        borderRadius: "20px",
        color: "#fff",
        backgroundColor: "rgba(0, 0, 0, 0.65)",
        fontSize: "26px",
        cursor: "pointer",
    });
    zoomCloseButton.title = typeof message.closeText === "string" ? message.closeText : "";
    zoomCloseButton.setAttribute("aria-label", zoomCloseButton.title);
    zoomLayer.insertBefore(zoomImage, zoomCloseButton);
    const closeZoom = () => {
        zoomLayer.style.display = "none";
        zoomImage.removeAttribute("src");
    };
    const openZoom = (source, alt) => {
        zoomImage.src = source;
        zoomImage.alt = alt;
        zoomLayer.style.display = "flex";
    };
    zoomLayer.addEventListener("click", closeZoom);
    zoomImage.addEventListener("click", event => event.stopPropagation());
    zoomCloseButton.addEventListener("click", event => {
        event.stopPropagation();
        closeZoom();
    });

    const createActionBar = (item, onDelete) => {
        const bar = applyStyles(document.createElement("div"), {
            display: "flex",
            position: "absolute",
            left: "50%",
            bottom: "8px",
            gap: "0",
            transform: "translateX(-68px)",
        });
        const labels = message.actionLabels && typeof message.actionLabels === "object"
            ? message.actionLabels
            : {};
        ["delete", "smartobject", "newdoc", "selection"].forEach(action => {
            const danger = action === "delete";
            const disabled = action === "selection" && item.canSelect === false;
            const width = danger ? "56px" : "32px";
            const button = applyStyles(document.createElement("div"), {
                display: "flex",
                position: "relative",
                alignItems: "center",
                justifyContent: "center",
                width,
                minWidth: width,
                maxWidth: width,
                height: "32px",
                minHeight: "32px",
                maxHeight: "32px",
                margin: "0",
                marginRight: action === "selection" ? "0" : "8px",
                padding: "0",
                border: danger ? "1px solid rgba(255, 255, 255, 0.7)" : "1px solid #34773d",
                borderRadius: "6px",
                color: "#fff",
                backgroundColor: danger ? "rgba(20, 20, 20, 0.75)" : "#34773d",
                boxShadow: "0 2px 4px rgba(0, 0, 0, 0.35)",
                boxSizing: "border-box",
                cursor: disabled ? "not-allowed" : "pointer",
                opacity: disabled ? "0.4" : "1",
            });
            button.title = typeof labels[action] === "string" ? labels[action] : action;
            button.tabIndex = disabled ? -1 : 0;
            button.setAttribute("role", "button");
            button.setAttribute("aria-disabled", disabled ? "true" : "false");
            button.setAttribute("aria-label", button.title);
            const tooltip = appendText(button, "span", button.title, {
                display: "none",
                position: "absolute",
                left: "50%",
                bottom: "38px",
                zIndex: "1",
                padding: "3px 6px",
                borderRadius: "4px",
                color: "#fff",
                backgroundColor: "rgba(0, 0, 0, 0.85)",
                fontSize: "12px",
                whiteSpace: "nowrap",
                pointerEvents: "none",
                transform: "translateX(-50%)",
            });
            appendHistoryIcon(button, action);
            button.addEventListener("mouseenter", () => { tooltip.style.display = "block"; });
            button.addEventListener("mouseleave", () => { tooltip.style.display = "none"; });
            const activate = event => {
                event.stopPropagation();
                if (disabled || !postHistoryAction(item.id, action)) return;
                if (danger) onDelete();
            };
            button.addEventListener("click", activate);
            button.addEventListener("keydown", event => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                activate(event);
            });
            bar.appendChild(button);
        });
        return bar;
    };

    items.forEach(item => {
        const card = applyStyles(document.createElement("section"), {
            marginBottom: "12px",
            padding: "12px",
            border: "1px solid var(--uxp-host-border-color)",
            borderRadius: "6px",
        });
        const imageSource = typeof item.image === "string" ? item.image : "";
        if (imageSource && !/^javascript:/i.test(imageSource.trim())) {
            const imageRow = applyStyles(document.createElement("div"), {
                display: "flex",
                justifyContent: "center",
                marginBottom: "8px",
            });
            const imageFrame = applyStyles(document.createElement("div"), {
                display: "inline-block",
                position: "relative",
                maxWidth: "100%",
                cursor: "zoom-in",
            });
            const image = applyStyles(document.createElement("img"), {
                display: "block",
                maxWidth: "100%",
                maxHeight: "360px",
                objectFit: "contain",
            });
            image.src = imageSource;
            image.alt = typeof message.imageAlt === "string" ? message.imageAlt : "";
            const hoverLayer = applyStyles(document.createElement("div"), {
                display: "none",
                position: "absolute",
                top: "0",
                right: "0",
                bottom: "0",
                left: "0",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                backgroundColor: "rgba(0, 0, 0, 0.52)",
            });
            const previewLabel = applyStyles(document.createElement("div"), {
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "14px",
                fontWeight: "400",
                pointerEvents: "none",
            });
            appendHistoryIcon(previewLabel, "preview");
            appendText(previewLabel, "span", message.previewText, {});
            hoverLayer.appendChild(previewLabel);
            hoverLayer.appendChild(createActionBar(item, () => {
                if (card.parentNode) card.parentNode.removeChild(card);
                if (!content.querySelector("section")) {
                    appendText(content, "p", message.emptyText, { textAlign: "center", opacity: "0.7" });
                }
            }));
            hoverLayer.addEventListener("click", () => openZoom(imageSource, image.alt));
            image.addEventListener("click", () => openZoom(imageSource, image.alt));
            imageFrame.addEventListener("mouseenter", () => { hoverLayer.style.display = "flex"; });
            imageFrame.addEventListener("mouseleave", () => { hoverLayer.style.display = "none"; });
            imageFrame.appendChild(image);
            imageFrame.appendChild(hoverLayer);
            imageRow.appendChild(imageFrame);
            card.appendChild(imageRow);
        }
        appendText(card, "div", item.meta, { marginBottom: "6px", opacity: "0.7", fontSize: "12px", whiteSpace: "pre-wrap" });
        if (item.template) {
            appendText(card, "div", item.template, { marginBottom: "8px", fontSize: "12px" });
        }
        appendText(card, "strong", message.positiveLabel, { display: "block", marginBottom: "4px" });
        appendText(card, "div", item.prompt, { marginBottom: item.negativePrompt ? "10px" : "0", whiteSpace: "pre-wrap" });
        if (item.negativePrompt) {
            appendText(card, "strong", message.negativeLabel, { display: "block", marginBottom: "4px" });
            appendText(card, "div", item.negativePrompt, { whiteSpace: "pre-wrap" });
        }
        content.appendChild(card);
    });
    dialog.appendChild(content);
    dialog.appendChild(zoomLayer);
    document.body.appendChild(dialog);
    historyDialog = dialog;

    closeButton.addEventListener("click", removeHistoryDialog);
    dialog.addEventListener("close", () => {
        if (historyDialog === dialog) historyDialog = null;
        if (dialog.parentNode) dialog.parentNode.removeChild(dialog);
    });
    try {
        dialog.show();
    } catch (error) {
        removeHistoryDialog();
        console.error("Failed to open generation history window", error);
    }
}

window.addEventListener("message", event => {
    if (event.data?.type === HISTORY_MESSAGE) {
        historyWebview = event.source;
        openHistoryDialog(event.data);
    } else if (event.data?.type === PROMPT_TEMPLATES_MESSAGE) {
        promptTemplatesWebview = event.source;
        openPromptTemplatesDialog(event.data);
    }
});

const _id = Symbol("_id");
const _root = Symbol("_root");
const _attachment = Symbol("_attachment");
const _menuItems = Symbol("_menuItems");

class PanelController {
    constructor({ id, menuItems } = {}) {
        this[_id] = null;
        this[_root] = null;
        this[_attachment] = null;
        this[_menuItems] = [];

        this[_id] = id;
        this[_menuItems] = menuItems || [];
        this.menuItems = this[_menuItems].map(menuItem => ({
            id: menuItem.id,
            label: menuItem.label,
            enabled: menuItem.enabled || true,
            checked: menuItem.checked || false
        }));

        ["create", "show", "hide", "destroy", "invokeMenu"].forEach(fn => this[fn] = this[fn].bind(this));
    }

    create() {
        this[_root] = document.getElementById("root");
        // this[_root].style.height = "100vh";
        this[_root].style.overflowY = "hidden";
        this[_root].style.overflowX = "hidden";

        // render entry
        // 渲染入口
        globalThis.sdpppX.__start__(this[_root]);

        return this[_root];
    }

    show(event) {
        if (!this[_root]) this.create();
        this[_attachment] = event;
    }

    hide() {
        if (this[_attachment] && this[_root]) {
            this[_attachment].removeChild(this[_root]);
            this[_attachment] = null;
        }
    }

    destroy() { }

    invokeMenu(id) {
        const menuItem = this[_menuItems].find(c => c.id === id);
        if (menuItem) {
            const handler = menuItem.oninvoke;
            if (handler) {
                handler();
            }
        }
    }
}

entrypoints.setup({
    plugin: {
        create(plugin) {
        },
        destroy() {
        }
    },
    panels: {
        'sd-ppp': new PanelController({
            id: "sd-ppp", menuItems: [
                {
                    id: "sd-ppp-log",
                    label: "查看日志",
                    enabled: true,
                    checked: false,
                    oninvoke: async () => {
                        const logContent = globalThis.sdpppX.__getLogs__().join('\n');
                        
                        // 同时将日志写入文件
                        try {
                            const localFileSystem = storage.localFileSystem;
                            
                            // 获取插件数据文件夹
                            const pluginDataFolder = await localFileSystem.getTemporaryFolder();
                            
                            // 创建日志文件名（带时间戳）
                            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                            const logFileName = `sdppp-log-${timestamp}.txt`;
                            
                            // 创建或获取日志文件
                            const logFile = await pluginDataFolder.createFile(`${logFileName}`, { type: "file", overwrite: true});
                            
                            alert(`日志已保存到文件: ${logFile.nativePath}\n\n\n`);

                            // 写入日志内容
                            await logFile.write(logContent, {append: false});
                        } catch (error) {
                            console.error('写入日志文件失败:', error);
                        }
                    }
                }
            ]
        }),
    }
});
