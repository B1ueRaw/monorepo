
const { entrypoints, storage } = require("uxp");

const HISTORY_MESSAGE = "sdppp:open-generation-history";
let historyDialog = null;

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

function removeHistoryDialog() {
    if (!historyDialog) return;
    const dialog = historyDialog;
    historyDialog = null;
    try { dialog.close(); } catch (_) { }
    if (dialog.parentNode) dialog.parentNode.removeChild(dialog);
}

function openHistoryDialog(message) {
    if (!message || !Array.isArray(message.items)) return;
    removeHistoryDialog();

    const dialog = applyStyles(document.createElement("dialog"), {
        width: "720px",
        height: "640px",
        padding: "0",
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

    items.forEach(item => {
        const card = applyStyles(document.createElement("section"), {
            marginBottom: "12px",
            padding: "12px",
            border: "1px solid var(--uxp-host-border-color)",
            borderRadius: "6px",
        });
        const imageSource = typeof item.image === "string" ? item.image : "";
        if (imageSource && !/^javascript:/i.test(imageSource.trim())) {
            const image = applyStyles(document.createElement("img"), {
                display: "block",
                width: "100%",
                maxHeight: "360px",
                marginBottom: "8px",
                objectFit: "contain",
            });
            image.src = imageSource;
            image.alt = typeof message.imageAlt === "string" ? message.imageAlt : "";
            card.appendChild(image);
        }
        appendText(card, "div", item.meta, { marginBottom: "6px", opacity: "0.7", fontSize: "12px" });
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
    if (event.data?.type === HISTORY_MESSAGE) openHistoryDialog(event.data);
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
